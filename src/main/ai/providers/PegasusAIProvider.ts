/**
 * PegasusAI - Unified LLM Provider Interface
 * 
 * Abstração que unifica as interfaces do VOID (VoidProvider), 
 * Google Antigravity (AntigravityModel) e Open-Antigravity.
 * 
 * Objetivo: Permitir troca transparente de modelos sem alterar o core da IDE.
 */

import { CancellationToken } from 'vscode';
import { ChatMessage, LLMProviderConfig, StreamChunk } from '../../common/interfaces/llm';
import { Logger } from '../../common/utils/logger';

export enum ProviderType {
  VOID_NATIVE = 'void_native',
  ANTI_GRAVITY = 'antigravity',
  OLLAMA_LOCAL = 'ollama_local',
  OPENAI_COMPAT = 'openai_compat',
  LM_STUDIO = 'lm_studio'
}

export interface IUnifiedProvider {
  readonly type: ProviderType;
  readonly id: string;
  readonly isOnline: boolean;
  
  // Inicialização segura
  initialize(config: LLMProviderConfig): Promise<void>;
  
  // Chat com suporte a streaming
  chat(
    messages: ChatMessage[], 
    options?: { temperature?: number; maxTokens?: number },
    token?: CancellationToken
  ): AsyncGenerator<StreamChunk, void, unknown>;
  
  // Geração de código específica (Edit/Apply)
  generateEdit(
    originalCode: string,
    instructions: string,
    languageId: string,
    token?: CancellationToken
  ): Promise<{ newCode: string; diff: string; confidence: number }>;
  
  // Health check para fallback
  healthCheck(): Promise<boolean>;
  
  // Cancelamento gracioso
  cancelRequest(): void;
}

export abstract class BasePegasusProvider implements IUnifiedProvider {
  abstract readonly type: ProviderType;
  abstract readonly id: string;
  protected config?: LLMProviderConfig;
  protected logger: Logger;
  protected isCancelled: boolean = false;

  constructor() {
    this.logger = new Logger(`Provider:${this.id}`);
  }

  get isOnline(): boolean {
    // Implementação base, sobrescrita por subclasses
    return this.config?.endpoint !== undefined;
  }

  async initialize(config: LLMProviderConfig): Promise<void> {
    this.config = config;
    this.logger.info(`Provider ${this.id} initialized with config`, { 
      endpoint: config.endpoint ? '***' : 'none',
      model: config.modelId 
    });
    await this.onInitialize();
  }

  protected abstract onInitialize(): Promise<void>;

  async *chat(
    messages: ChatMessage[], 
    options?: { temperature?: number; maxTokens?: number },
    token?: CancellationToken
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.isCancelled = false;
    
    if (token) {
      token.onCancellationRequested(() => {
        this.isCancelled = true;
        this.logger.warn('Chat request cancelled by user');
      });
    }

    try {
      yield* this.executeChatStream(messages, options);
    } catch (error) {
      this.logger.error('Chat stream failed', error);
      throw error;
    }
  }

  protected abstract executeChatStream(
    messages: ChatMessage[], 
    options?: { temperature?: number; maxTokens?: number }
  ): AsyncGenerator<StreamChunk, void, unknown>;

  abstract generateEdit(
    originalCode: string,
    instructions: string,
    languageId: string,
    token?: CancellationToken
  ): Promise<{ newCode: string; diff: string; confidence: number }>;

  abstract healthCheck(): Promise<boolean>;

  cancelRequest(): void {
    this.isCancelled = true;
    this.logger.info('Request cancellation triggered');
  }
}

/**
 * Registry Singleton para gerenciar múltiplos provedores
 * Implementa a lógica de fallback do VOID + Antigravity
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, IUnifiedProvider> = new Map();
  private activeProviderId: string | null = null;

  private constructor() {}

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  register(provider: IUnifiedProvider): Promise<void> {
    this.providers.set(provider.id, provider);
    this.logger.info(`Provider registered: ${provider.id} (${provider.type})`);
  }

  async setActiveProvider(id: string): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider) {
      this.logger.error(`Provider ${id} not found`);
      return false;
    }

    if (!await provider.healthCheck()) {
      this.logger.warn(`Provider ${id} failed health check, attempting fallback`);
      return await this.activateFallback();
    }

    this.activeProviderId = id;
    this.logger.info(`Active provider set to: ${id}`);
    return true;
  }

  getActiveProvider(): IUnifiedProvider | null {
    if (!this.activeProviderId) return null;
    return this.providers.get(this.activeProviderId) || null;
  }

  async activateFallback(): Promise<boolean> {
    // Estratégia de fallback: Local -> Free Cloud -> Paid Cloud
    const priorityOrder = [
      ProviderType.OLLAMA_LOCAL,
      ProviderType.LM_STUDIO,
      ProviderType.VOID_NATIVE, // Void free tier
      ProviderType.OPENAI_COMPAT
    ];

    for (const type of priorityOrder) {
      const candidate = Array.from(this.providers.values()).find(p => p.type === type);
      if (candidate && await candidate.healthCheck()) {
        this.activeProviderId = candidate.id;
        this.logger.warn(`Fallback activated: ${candidate.id}`);
        return true;
      }
    }

    this.logger.error('No available providers for fallback');
    return false;
  }

  private get logger() {
    return new Logger('ProviderRegistry');
  }
}
