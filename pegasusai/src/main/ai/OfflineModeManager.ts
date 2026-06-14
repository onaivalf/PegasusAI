import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { IOfflineModeConfig, OfflineModeStatus, IFallbackStrategy } from '../../common/interfaces';
import { PEGASUS_CONFIG } from '../../common/constants';
import { LocalAIService } from './LocalAIService';

/**
 * Gerenciador principal do modo offline da PegasusAI
 * Garante funcionamento 100% offline por padrão com fallback inteligente
 */
export class OfflineModeManager extends EventEmitter {
  private static instance: OfflineModeManager;
  
  private config: IOfflineModeConfig;
  private localAI: LocalAIService;
  private currentStatus: OfflineModeStatus = 'initializing';
  private fallbackStrategies: Map<string, IFallbackStrategy> = new Map();
  private connectionHistory: Array<{ timestamp: number; status: OfflineModeStatus }> = [];
  private autoReconnectEnabled: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  private constructor() {
    super();
    this.localAI = LocalAIService.getInstance();
    this.config = this.loadDefaultConfig();
  }

  public static getInstance(): OfflineModeManager {
    if (!OfflineModeManager.instance) {
      OfflineModeManager.instance = new OfflineModeManager();
    }
    return OfflineModeManager.instance;
  }

  /**
   * Carrega configuração padrão para modo offline
   */
  private loadDefaultConfig(): IOfflineModeConfig {
    return {
      enabled: true,
      preferLocal: true,
      autoDownloadModels: false,
      fallbackToSmallerModel: true,
      cacheResponses: true,
      maxCacheSize: 1024 * 1024 * 100, // 100MB
      allowedProviders: ['ollama', 'lmstudio', 'native'],
      defaultModel: '',
      fallbackModel: ''
    };
  }

  /**
   * Inicializa o gerenciador de modo offline
   */
  public async initialize(): Promise<void> {
    console.log('[OfflineMode] Initializing offline mode manager...');
    
    try {
      // Configurar estratégias de fallback
      this.setupFallbackStrategies();
      
      // Inicializar serviço de IA local
      await this.localAI.initialize();
      
      // Verificar conectividade inicial
      await this.checkConnectivity();
      
      // Configurar listeners
      this.setupEventListeners();
      
      console.log('[OfflineMode] Offline mode manager initialized');
      this.emit('initialized', { status: this.currentStatus });
    } catch (error) {
      console.error('[OfflineMode] Failed to initialize:', error);
      this.currentStatus = 'error';
      this.emit('error', { error });
    }
  }

  /**
   * Configura estratégias de fallback para diferentes cenários
   */
  private setupFallbackStrategies(): void {
    // Estratégia 1: Fallback para modelo menor quando o principal falha
    this.fallbackStrategies.set('model-size', {
      id: 'model-size',
      name: 'Fallback para Modelo Menor',
      trigger: 'model-unavailable',
      action: async (context) => {
        if (!this.config.fallbackToSmallerModel) return false;
        
        const models = this.localAI.listModels();
        const smallerModel = models
          .filter(m => m.status === 'loaded' || m.status === 'available')
          .sort((a, b) => a.size - b.size)[0];
        
        if (smallerModel) {
          console.log(`[OfflineMode] Falling back to smaller model: ${smallerModel.name}`);
          this.config.defaultModel = smallerModel.id;
          return true;
        }
        return false;
      }
    });

    // Estratégia 2: Fallback entre provedores
    this.fallbackStrategies.set('provider-switch', {
      id: 'provider-switch',
      name: 'Troca de Provedor',
      trigger: 'provider-unavailable',
      action: async (context) => {
        const providers = this.localAI.listProviders();
        const availableProvider = providers.find(p => p.status === 'ready');
        
        if (availableProvider) {
          console.log(`[OfflineMode] Switching to provider: ${availableProvider.name}`);
          return true;
        }
        return false;
      }
    });

    // Estratégia 3: Cache de respostas
    this.fallbackStrategies.set('cache-response', {
      id: 'cache-response',
      name: 'Resposta em Cache',
      trigger: 'no-connectivity',
      action: async (context) => {
        if (!this.config.cacheResponses) return false;
        // Implementação futura: retornar resposta em cache
        return false;
      }
    });
  }

  /**
   * Configura listeners para eventos do sistema
   */
  private setupEventListeners(): void {
    // Listener para mudanças de conectividade
    this.localAI.on('connectivity-change', (data) => {
      this.handleConnectivityChange(data.isOnline);
    });

    // Listener para provedores ficando disponíveis
    this.localAI.on('provider-ready', (data) => {
      this.handleProviderReady(data.providerId);
    });

    // Listener para provedores ficando indisponíveis
    this.localAI.on('provider-unavailable', (data) => {
      this.handleProviderUnavailable(data.providerId);
    });
  }

  /**
   * Verifica conectividade atual
   */
  private async checkConnectivity(): Promise<void> {
    const status = this.localAI.getOfflineStatus();
    
    if (status.availableProviders.length > 0) {
      this.currentStatus = 'online-local';
      console.log('[OfflineMode] Running in local online mode');
    } else {
      this.currentStatus = 'offline';
      console.log('[OfflineMode] Running in offline mode (no providers)');
    }
    
    this.connectionHistory.push({
      timestamp: Date.now(),
      status: this.currentStatus
    });
    
    // Manter apenas últimas 100 entradas
    if (this.connectionHistory.length > 100) {
      this.connectionHistory.shift();
    }
    
    this.emit('status-change', { status: this.currentStatus, ...status });
  }

  /**
   * Lida com mudanças de conectividade
   */
  private handleConnectivityChange(isOnline: boolean): void {
    const oldStatus = this.currentStatus;
    
    if (isOnline) {
      this.currentStatus = 'online-local';
      this.reconnectAttempts = 0;
      console.log('[OfflineMode] Connection restored to local providers');
    } else {
      this.currentStatus = 'offline';
      console.log('[OfflineMode] Lost connection to all local providers');
      
      // Tentar reconexão automática se habilitado
      if (this.autoReconnectEnabled && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
    
    if (oldStatus !== this.currentStatus) {
      this.connectionHistory.push({
        timestamp: Date.now(),
        status: this.currentStatus
      });
      this.emit('status-change', { 
        status: this.currentStatus,
        previousStatus: oldStatus,
        isOnline: isOnline
      });
    }
  }

  /**
   * Agenda tentativa de reconexão
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff
    
    console.log(`[OfflineMode] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      await this.localAI.forceHealthCheck();
    }, delay);
  }

  /**
   * Lida com provedor ficando disponível
   */
  private handleProviderReady(providerId: string): void {
    console.log(`[OfflineMode] Provider ${providerId} is now ready`);
    
    if (this.currentStatus === 'offline') {
      this.currentStatus = 'online-local';
      this.reconnectAttempts = 0;
      this.emit('status-change', { status: this.currentStatus });
    }
  }

  /**
   * Lida com provedor ficando indisponível
   */
  private async handleProviderUnavailable(providerId: string): Promise<void> {
    console.log(`[OfflineMode] Provider ${providerId} is now unavailable`);
    
    // Executar estratégias de fallback
    for (const [strategyId, strategy] of this.fallbackStrategies.entries()) {
      if (strategy.trigger === 'provider-unavailable') {
        try {
          const success = await strategy.action({ providerId, reason: 'unavailable' });
          if (success) {
            console.log(`[OfflineMode] Fallback strategy ${strategyId} succeeded`);
            break;
          }
        } catch (error) {
          console.warn(`[OfflineMode] Fallback strategy ${strategyId} failed:`, error);
        }
      }
    }
    
    // Verificar se ainda temos algum provedor disponível
    const status = this.localAI.getOfflineStatus();
    if (status.availableProviders.length === 0) {
      this.currentStatus = 'offline';
      this.emit('status-change', { status: this.currentStatus });
    }
  }

  /**
   * Retorna status atual do modo offline
   */
  public getStatus(): { 
    status: OfflineModeStatus; 
    isOffline: boolean; 
    availableProviders: string[]; 
    activeModels: string[];
    history: Array<{ timestamp: number; status: OfflineModeStatus }>;
  } {
    const aiStatus = this.localAI.getOfflineStatus();
    return {
      status: this.currentStatus,
      isOffline: this.currentStatus === 'offline',
      availableProviders: aiStatus.availableProviders,
      activeModels: aiStatus.activeModels,
      history: this.connectionHistory
    };
  }

  /**
   * Habilita ou desabilita modo offline
   */
  public setOfflineMode(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`[OfflineMode] Offline mode ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('config-change', { enabled });
  }

  /**
   * Configura modelo padrão
   */
  public setDefaultModel(modelId: string): void {
    this.config.defaultModel = modelId;
    console.log(`[OfflineMode] Default model set to: ${modelId}`);
    this.emit('config-change', { defaultModel: modelId });
  }

  /**
   * Configura modelo de fallback
   */
  public setFallbackModel(modelId: string): void {
    this.config.fallbackModel = modelId;
    console.log(`[OfflineMode] Fallback model set to: ${modelId}`);
    this.emit('config-change', { fallbackModel: modelId });
  }

  /**
   * Força verificação de conectividade
   */
  public async forceConnectivityCheck(): Promise<void> {
    await this.localAI.forceHealthCheck();
    await this.checkConnectivity();
  }

  /**
   * Limpa recursos
   */
  public dispose(): void {
    this.fallbackStrategies.clear();
    this.connectionHistory = [];
    this.removeAllListeners();
  }
}
