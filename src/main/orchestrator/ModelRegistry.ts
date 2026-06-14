/**
 * PegasusAI - Model Registry
 * Gerencia o registro, descoberta e capacidades de todos os modelos disponíveis
 */

import { ModelCapability } from '../../common/types/orchestrator';
import { LocalAIService } from '../ai/LocalAIService';
import { PegasusAIProvider } from '../ai/PegasusAIProvider';

export class ModelRegistry {
  private models: Map<string, ModelCapability> = new Map();
  private localService: LocalAIService;
  private cloudProvider: PegasusAIProvider;
  private refreshTimer?: NodeJS.Timeout;
  private autoDiscoveryEnabled: boolean = true;

  constructor(localService: LocalAIService, cloudProvider: PegasusAIProvider) {
    this.localService = localService;
    this.cloudProvider = cloudProvider;
  }

  /**
   * Inicializa o registry e inicia descoberta automática
   */
  async initialize(autoDiscovery: boolean = true, refreshIntervalMs: number = 30000): Promise<void> {
    this.autoDiscoveryEnabled = autoDiscovery;
    
    // Registra modelos cloud estáticos
    await this.registerCloudModels();
    
    // Descobre modelos locais
    if (this.autoDiscoveryEnabled) {
      await this.discoverLocalModels();
      
      // Agenda refresh periódico
      this.refreshTimer = setInterval(async () => {
        await this.refresh();
      }, refreshIntervalMs);
    }
  }

  /**
   * Registra modelos cloud disponíveis
   */
  private async registerCloudModels(): Promise<void> {
    const cloudModels: ModelCapability[] = [
      {
        id: 'openai-gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        capabilities: {
          chat: true,
          codeGeneration: true,
          codeEdit: true,
          embedding: false,
          vision: true,
          streaming: true
        },
        contextWindow: 128000,
        latency: 'medium',
        cost: 'high',
        offline: false
      },
      {
        id: 'openai-gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        capabilities: {
          chat: true,
          codeGeneration: true,
          codeEdit: true,
          embedding: false,
          vision: true,
          streaming: true
        },
        contextWindow: 128000,
        latency: 'low',
        cost: 'medium',
        offline: false
      },
      {
        id: 'anthropic-claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        capabilities: {
          chat: true,
          codeGeneration: true,
          codeEdit: true,
          embedding: false,
          vision: true,
          streaming: true
        },
        contextWindow: 200000,
        latency: 'medium',
        cost: 'high',
        offline: false
      },
      {
        id: 'anthropic-claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        capabilities: {
          chat: true,
          codeGeneration: true,
          codeEdit: true,
          embedding: false,
          vision: true,
          streaming: true
        },
        contextWindow: 200000,
        latency: 'low',
        cost: 'medium',
        offline: false
      },
      {
        id: 'google-gemini-pro',
        name: 'Gemini Pro',
        provider: 'google',
        capabilities: {
          chat: true,
          codeGeneration: true,
          codeEdit: true,
          embedding: false,
          vision: true,
          streaming: true
        },
        contextWindow: 128000,
        latency: 'low',
        cost: 'low',
        offline: false
      }
    ];

    for (const model of cloudModels) {
      this.models.set(model.id, model);
    }
  }

  /**
   * Descobre modelos locais disponíveis
   */
  private async discoverLocalModels(): Promise<void> {
    try {
      const localProviders = await this.localService.discoverProviders();
      
      for (const provider of localProviders) {
        if (provider.status === 'connected') {
          const providerModels = await this.localService.getAvailableModels(provider.id);
          
          for (const model of providerModels) {
            const capability: ModelCapability = {
              id: `${provider.id}-${model.id}`,
              name: model.name || model.id,
              provider: provider.id,
              capabilities: {
                chat: true,
                codeGeneration: true,
                codeEdit: true,
                embedding: model.supportsEmbedding || false,
                vision: false,
                streaming: true
              },
              contextWindow: model.contextSize || 4096,
              latency: 'low',
              cost: 'free',
              offline: true
            };
            
            this.models.set(capability.id, capability);
          }
        }
      }
    } catch (error) {
      console.error('[ModelRegistry] Erro na descoberta de modelos locais:', error);
    }
  }

  /**
   * Refresh manual do registry
   */
  async refresh(): Promise<void> {
    if (this.autoDiscoveryEnabled) {
      await this.discoverLocalModels();
    }
  }

  /**
   * Obtém todos os modelos registrados
   */
  getAllModels(): ModelCapability[] {
    return Array.from(this.models.values());
  }

  /**
   * Obtém modelo por ID
   */
  getModel(id: string): ModelCapability | undefined {
    return this.models.get(id);
  }

  /**
   * Filtra modelos por capacidade
   */
  filterByCapability(capability: keyof ModelCapability['capabilities'], required: boolean = true): ModelCapability[] {
    return this.getAllModels().filter(model => 
      required ? model.capabilities[capability] : !model.capabilities[capability]
    );
  }

  /**
   * Filtra modelos por requisitos
   */
  filterByRequirements(requirements: {
    minContextWindow?: number;
    requiresOffline?: boolean;
    preferredLatency?: 'low' | 'medium' | 'high';
    allowedProviders?: string[];
    forbiddenProviders?: string[];
  }): ModelCapability[] {
    return this.getAllModels().filter(model => {
      if (requirements.minContextWindow && model.contextWindow < requirements.minContextWindow) {
        return false;
      }
      
      if (requirements.requiresOffline && !model.offline) {
        return false;
      }
      
      if (requirements.preferredLatency && model.latency !== requirements.preferredLatency) {
        return false;
      }
      
      if (requirements.allowedProviders && !requirements.allowedProviders.includes(model.provider)) {
        return false;
      }
      
      if (requirements.forbiddenProviders && requirements.forbiddenProviders.includes(model.provider)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Obtém modelos offline disponíveis
   */
  getOfflineModels(): ModelCapability[] {
    return this.filterByCapability('offline', true);
  }

  /**
   * Obtém modelos cloud disponíveis
   */
  getCloudModels(): ModelCapability[] {
    return this.filterByCapability('offline', false);
  }

  /**
   * Remove modelo do registry
   */
  removeModel(id: string): void {
    this.models.delete(id);
  }

  /**
   * Para o refresh automático
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}
