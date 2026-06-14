import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ILocalModel, ILocalProvider, LocalProviderStatus, ModelFormat } from '../../common/interfaces';
import { PEGASUS_CONFIG } from '../../common/constants';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

/**
 * Serviço principal para gerenciamento de IA local e modo offline
 * Suporta: Ollama, LM Studio, vLLM, e modelos GGUF nativos
 */
export class LocalAIService extends EventEmitter {
  private static instance: LocalAIService;
  
  private providers: Map<string, ILocalProvider> = new Map();
  private activeModels: Map<string, ILocalModel> = new Map();
  private modelDirectory: string;
  private isOnline: boolean = true;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.modelDirectory = path.join(PEGASUS_CONFIG.userDataPath, 'models');
    this.ensureModelDirectory();
  }

  public static getInstance(): LocalAIService {
    if (!LocalAIService.instance) {
      LocalAIService.instance = new LocalAIService();
    }
    return LocalAIService.instance;
  }

  /**
   * Inicializa o serviço e detecta provedores locais disponíveis
   */
  public async initialize(): Promise<void> {
    console.log('[LocalAI] Initializing local AI service...');
    
    // Garantir diretório de modelos
    await this.ensureModelDirectory();
    
    // Detectar provedores locais
    await this.discoverProviders();
    
    // Iniciar monitoramento de saúde
    this.startHealthMonitoring();
    
    // Carregar modelos disponíveis
    await this.loadAvailableModels();
    
    console.log('[LocalAI] Local AI service initialized successfully');
    this.emit('initialized', { providers: Array.from(this.providers.keys()) });
  }

  /**
   * Garante que o diretório de modelos existe
   */
  private async ensureModelDirectory(): Promise<void> {
    if (!fs.existsSync(this.modelDirectory)) {
      await fs.promises.mkdir(this.modelDirectory, { recursive: true });
      console.log(`[LocalAI] Created models directory: ${this.modelDirectory}`);
    }
  }

  /**
   * Descobre provedores locais disponíveis no sistema
   */
  private async discoverProviders(): Promise<void> {
    const providersToDiscover = [
      { id: 'ollama', name: 'Ollama', defaultPort: 11434 },
      { id: 'lmstudio', name: 'LM Studio', defaultPort: 1234 },
      { id: 'vllm', name: 'vLLM', defaultPort: 8000 },
      { id: 'native', name: 'PegasusAI Native (GGUF)', defaultPort: 0 }
    ];

    for (const provider of providersToDiscover) {
      try {
        const status = await this.checkProviderHealth(provider.id, provider.defaultPort);
        
        const localProvider: ILocalProvider = {
          id: provider.id,
          name: provider.name,
          port: provider.defaultPort,
          status: status ? 'ready' : 'unavailable',
          endpoint: `http://localhost:${provider.defaultPort}`,
          models: [],
          capabilities: ['chat', 'completion', 'embedding']
        };

        this.providers.set(provider.id, localProvider);
        console.log(`[LocalAI] Discovered provider: ${provider.name} (${localProvider.status})`);
      } catch (error) {
        console.warn(`[LocalAI] Failed to discover ${provider.name}:`, error);
      }
    }
  }

  /**
   * Verifica a saúde de um provedor específico
   */
  private async checkProviderHealth(providerId: string, port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        signal: controller.signal
      }).catch(() => {
        // Fallback para endpoints específicos de cada provedor
        if (providerId === 'ollama') {
          return fetch(`http://localhost:${port}/api/tags`, { 
            signal: controller.signal 
          });
        } else if (providerId === 'lmstudio') {
          return fetch(`http://localhost:${port}/v1/models`, { 
            signal: controller.signal 
          });
        }
        throw new Error('No fallback endpoint');
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Inicia o monitoramento periódico da saúde dos provedores
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [id, provider] of this.providers.entries()) {
        const wasAvailable = provider.status === 'ready';
        const isAvailable = await this.checkProviderHealth(id, provider.port);
        
        if (isAvailable && !wasAvailable) {
          provider.status = 'ready';
          this.emit('provider-ready', { providerId: id });
          console.log(`[LocalAI] Provider ${provider.name} is now ready`);
        } else if (!isAvailable && wasAvailable) {
          provider.status = 'unavailable';
          this.emit('provider-unavailable', { providerId: id });
          console.log(`[LocalAI] Provider ${provider.name} is now unavailable`);
        }
      }
      
      // Atualizar estado online/offline global
      const anyProviderReady = Array.from(this.providers.values()).some(p => p.status === 'ready');
      this.isOnline = anyProviderReady;
      this.emit('connectivity-change', { isOnline: this.isOnline });
    }, 10000); // Verificar a cada 10 segundos
  }

  /**
   * Carrega modelos disponíveis dos provedores
   */
  private async loadAvailableModels(): Promise<void> {
    for (const [providerId, provider] of this.providers.entries()) {
      if (provider.status !== 'ready') continue;

      try {
        let models: ILocalModel[] = [];

        if (providerId === 'ollama') {
          models = await this.loadOllamaModels(provider.endpoint);
        } else if (providerId === 'lmstudio') {
          models = await this.loadLMStudioModels(provider.endpoint);
        } else if (providerId === 'native') {
          models = await this.loadNativeModels();
        }

        provider.models = models;
        models.forEach(model => {
          this.activeModels.set(`${providerId}:${model.id}`, model);
        });
      } catch (error) {
        console.warn(`[LocalAI] Failed to load models from ${provider.name}:`, error);
      }
    }
  }

  /**
   * Carrega modelos do Ollama
   */
  private async loadOllamaModels(endpoint: string): Promise<ILocalModel[]> {
    try {
      const response = await fetch(`${endpoint}/api/tags`, { timeout: 5000 });
      if (!response.ok) return [];

      const data = await response.json();
      return (data.models || []).map((model: OllamaModel) => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        format: ModelFormat.GGUF,
        size: model.size,
        status: 'loaded',
        capabilities: ['chat', 'completion']
      }));
    } catch {
      return [];
    }
  }

  /**
   * Carrega modelos do LM Studio
   */
  private async loadLMStudioModels(endpoint: string): Promise<ILocalModel[]> {
    try {
      const response = await fetch(`${endpoint}/v1/models`, { timeout: 5000 });
      if (!response.ok) return [];

      const data = await response.json();
      return (data.data || []).map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        provider: 'lmstudio',
        format: ModelFormat.GGUF,
        size: 0,
        status: 'loaded',
        capabilities: ['chat', 'completion', 'embedding']
      }));
    } catch {
      return [];
    }
  }

  /**
   * Carrega modelos GGUF nativos do diretório local
   */
  private async loadNativeModels(): Promise<ILocalModel[]> {
    try {
      const files = await fs.promises.readdir(this.modelDirectory);
      const ggufFiles = files.filter(f => f.endsWith('.gguf'));

      return await Promise.all(ggufFiles.map(async (file) => {
        const filePath = path.join(this.modelDirectory, file);
        const stats = await fs.promises.stat(filePath);
        
        return {
          id: file.replace('.gguf', ''),
          name: file.replace('.gguf', ''),
          provider: 'native',
          format: ModelFormat.GGUF,
          size: stats.size,
          status: 'available',
          path: filePath,
          capabilities: ['chat', 'completion']
        };
      }));
    } catch {
      return [];
    }
  }

  /**
   * Baixa um modelo do Ollama
   */
  public async downloadModel(modelName: string, providerId: string = 'ollama'): Promise<void> {
    console.log(`[LocalAI] Downloading model: ${modelName} from ${providerId}`);
    this.emit('download-start', { modelName, providerId });

    if (providerId === 'ollama') {
      await this.downloadOllamaModel(modelName);
    } else {
      throw new Error(`Download not supported for provider: ${providerId}`);
    }

    this.emit('download-complete', { modelName, providerId });
    await this.loadAvailableModels(); // Recarregar lista
  }

  /**
   * Baixa um modelo usando a CLI do Ollama
   */
  private async downloadOllamaModel(modelName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('ollama', ['pull', modelName], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('download-progress', { 
          modelName, 
          progress: this.parseOllamaProgress(output),
          message: data.toString().trim()
        });
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Ollama pull failed: ${errorOutput}`));
        }
      });

      process.on('error', (err) => {
        reject(new Error(`Failed to start Ollama: ${err.message}. Make sure Ollama is installed.`));
      });
    });
  }

  /**
   * Parseia o progresso do download do Ollama
   */
  private parseOllamaProgress(output: string): number {
    const lines = output.split('\n');
    for (const line of lines.reverse()) {
      const match = line.match(/(\d+)%/);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return 0;
  }

  /**
   * Inicia um modelo localmente (para provedor nativo)
   */
  public async startModel(modelId: string): Promise<void> {
    const model = this.activeModels.get(modelId);
    if (!model || model.provider !== 'native') {
      throw new Error(`Model ${modelId} not found or not native`);
    }

    console.log(`[LocalAI] Starting native model: ${modelId}`);
    this.emit('model-start', { modelId });

    // Implementação futura: usar llama.cpp ou similar para carregar modelo GGUF
    // Por enquanto, apenas marca como carregado
    model.status = 'loaded';
    this.emit('model-loaded', { modelId });
  }

  /**
   * Para um modelo em execução
   */
  public async stopModel(modelId: string): Promise<void> {
    const model = this.activeModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    console.log(`[LocalAI] Stopping model: ${modelId}`);
    model.status = 'available';
    this.emit('model-stopped', { modelId });
  }

  /**
   * Retorna o status atual do modo offline
   */
  public getOfflineStatus(): { isOffline: boolean; availableProviders: string[]; activeModels: string[] } {
    const availableProviders = Array.from(this.providers.entries())
      .filter(([_, p]) => p.status === 'ready')
      .map(([id, _]) => id);

    const activeModels = Array.from(this.activeModels.entries())
      .filter(([_, m]) => m.status === 'loaded')
      .map(([id, _]) => id);

    return {
      isOffline: !this.isOnline,
      availableProviders,
      activeModels
    };
  }

  /**
   * Lista todos os modelos disponíveis
   */
  public listModels(): ILocalModel[] {
    return Array.from(this.activeModels.values());
  }

  /**
   * Lista todos os provedores configurados
   */
  public listProviders(): ILocalProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Força uma verificação de saúde imediata
   */
  public async forceHealthCheck(): Promise<void> {
    await this.loadAvailableModels();
  }

  /**
   * Limpa recursos ao encerrar
   */
  public dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    for (const [id, model] of this.activeModels.entries()) {
      if (model.status === 'loaded') {
        this.stopModel(id).catch(console.error);
      }
    }
    
    this.providers.clear();
    this.activeModels.clear();
  }
}
