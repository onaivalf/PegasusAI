/**
 * PegasusAI - Provider Registry
 * 
 * Registro centralizado de provedores LLM com suporte a fallback automático.
 * Implementa padrão Registry para gerenciar múltiplos provedores de IA.
 */

import { APP_IDENTITY, FEATURES } from '../common/constants';
import type { IProvider, IProviderConfig, IProviderRegistry } from '../common/interfaces';

export class ProviderRegistry implements IProviderRegistry {
  private providers: Map<string, IProvider> = new Map();
  private config: Map<string, IProviderConfig> = new Map();
  private defaultProviderId: string = 'local-ollama';
  private fallbackChain: string[] = [];

  constructor() {
    this.initializeDefaultProviders();
    this.setupFallbackChain();
  }

  /**
   * Inicializa provedores padrão baseados na configuração
   */
  private initializeDefaultProviders(): void {
    // Provedores locais (offline-first)
    if (FEATURES.localProviders) {
      this.registerProvider({
        id: 'local-ollama',
        name: 'Ollama Local',
        type: 'local',
        endpoint: 'http://localhost:11434',
        models: ['llama2', 'codellama', 'mistral'],
        isOffline: true,
        priority: 1,
      });

      this.registerProvider({
        id: 'local-vllm',
        name: 'vLLM Local',
        type: 'local',
        endpoint: 'http://localhost:8000',
        models: ['llama-2-7b', 'codellama-7b'],
        isOffline: true,
        priority: 2,
      });

      this.registerProvider({
        id: 'local-lmstudio',
        name: 'LM Studio',
        type: 'local',
        endpoint: 'http://localhost:1234',
        models: ['default'],
        isOffline: true,
        priority: 3,
      });
    }

    // Provedores cloud (opcionais)
    if (!FEATURES.offlineFirst) {
      this.registerProvider({
        id: 'cloud-openai',
        name: 'OpenAI',
        type: 'cloud',
        endpoint: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        isOffline: false,
        priority: 10,
      });

      this.registerProvider({
        id: 'cloud-anthropic',
        name: 'Anthropic',
        type: 'cloud',
        endpoint: 'https://api.anthropic.com',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        isOffline: false,
        priority: 11,
      });

      this.registerProvider({
        id: 'cloud-google',
        name: 'Google AI',
        type: 'cloud',
        endpoint: 'https://generativelanguage.googleapis.com',
        models: ['gemini-pro', 'gemini-ultra'],
        isOffline: false,
        priority: 12,
      });
    }
  }

  /**
   * Configura cadeia de fallback para resiliência
   */
  private setupFallbackChain(): void {
    // Ordena provedores por prioridade
    const sortedProviders = Array.from(this.providers.values())
      .sort((a, b) => a.priority - b.priority);
    
    this.fallbackChain = sortedProviders.map(p => p.id);
  }

  /**
   * Registra um novo provedor
   */
  registerProvider(config: IProviderConfig): boolean {
    if (this.providers.has(config.id)) {
      console.warn(`[ProviderRegistry] Provedor ${config.id} já registrado, atualizando...`);
    }

    this.config.set(config.id, config);
    
    // Cria instância do provider (factory pattern)
    const provider = this.createProvider(config);
    this.providers.set(config.id, provider);
    
    // Reconfigura fallback chain
    this.setupFallbackChain();
    
    return true;
  }

  /**
   * Cria instância de provedor baseada no tipo
   */
  private createProvider(config: IProviderConfig): IProvider {
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      endpoint: config.endpoint,
      models: config.models,
      isOffline: config.isOffline,
      priority: config.priority,
      
      async chat(messages: any[], options?: any): Promise<any> {
        // Implementação base - será sobrescrita por implementações específicas
        throw new Error('Método chat deve ser implementado pelo provedor');
      },
      
      async complete(prompt: string, options?: any): Promise<string> {
        // Implementação base - será sobrescrita por implementações específicas
        throw new Error('Método complete deve ser implementado pelo provedor');
      },
      
      async listModels(): Promise<string[]> {
        return config.models;
      },
      
      async isAvailable(): Promise<boolean> {
        // Verifica disponibilidade do provedor
        try {
          const response = await fetch(`${config.endpoint}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          return response.ok;
        } catch {
          return config.type === 'cloud'; // Cloud providers são considerados disponíveis
        }
      },
    };
  }

  /**
   * Obtém provedor por ID
   */
  getProvider(id: string): IProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Obtém provedor padrão
   */
  getDefaultProvider(): IProvider | undefined {
    return this.providers.get(this.defaultProviderId) || this.getAvailableProvider();
  }

  /**
   * Obtém primeiro provedor disponível na cadeia de fallback
   */
  async getAvailableProvider(): Promise<IProvider | undefined> {
    for (const providerId of this.fallbackChain) {
      const provider = this.providers.get(providerId);
      if (provider && await provider.isAvailable()) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Lista todos os provedores registrados
   */
  listProviders(): IProviderConfig[] {
    return Array.from(this.config.values());
  }

  /**
   * Lista provedores disponíveis
   */
  async listAvailableProviders(): Promise<IProviderConfig[]> {
    const available: IProviderConfig[] = [];
    
    for (const [id, config] of this.config.entries()) {
      const provider = this.providers.get(id);
      if (provider && await provider.isAvailable()) {
        available.push(config);
      }
    }
    
    return available;
  }

  /**
   * Remove provedor do registro
   */
  unregisterProvider(id: string): boolean {
    const removed = this.providers.delete(id);
    this.config.delete(id);
    
    if (removed) {
      this.setupFallbackChain();
    }
    
    return removed;
  }

  /**
   * Define provedor padrão
   */
  setDefaultProvider(id: string): boolean {
    if (!this.providers.has(id)) {
      console.error(`[ProviderRegistry] Provedor ${id} não encontrado`);
      return false;
    }
    
    this.defaultProviderId = id;
    return true;
  }

  /**
   * Executa chamada com fallback automático
   */
  async callWithFallback<T>(
    operation: (provider: IProvider) => Promise<T>,
    preferredProviderId?: string
  ): Promise<T> {
    const chain = preferredProviderId
      ? [preferredProviderId, ...this.fallbackChain.filter(id => id !== preferredProviderId)]
      : this.fallbackChain;

    let lastError: Error | null = null;

    for (const providerId of chain) {
      try {
        const provider = this.providers.get(providerId);
        if (!provider) continue;

        if (!(await provider.isAvailable())) {
          console.log(`[ProviderRegistry] Provedor ${providerId} indisponível, tentando próximo...`);
          continue;
        }

        return await operation(provider);
      } catch (error) {
        lastError = error as Error;
        console.warn(`[ProviderRegistry] Erro no provedor ${providerId}:`, error);
      }
    }

    throw new Error(
      `Todos os provedores falharam. Último erro: ${lastError?.message}`
    );
  }
}

// Exporta instância singleton
export const providerRegistry = new ProviderRegistry();
