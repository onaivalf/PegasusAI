/**
 * PegasusAI - Orchestrator Principal
 * Orquestra execução de tarefas multi-modelo com pipeline, fallback e caching
 */

import {
  TaskDefinition,
  ExecutionPlan,
  ExecutionResult,
  PipelineStage,
  PipelineContext,
  CancellationTokenSource,
  OrchestratorConfig,
  CacheEntry,
  ValidationRule,
  ModelCapability
} from '../../common/types/orchestrator';
import { ModelRegistry } from './ModelRegistry';
import { StrategyFactory } from './strategies/ModelSelectionStrategies';
import { PegasusAIProvider } from '../ai/PegasusAIProvider';
import { createHash } from 'crypto';

export class PegasusOrchestrator {
  private modelRegistry: ModelRegistry;
  private provider: PegasusAIProvider;
  private config: OrchestratorConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private validationRules: Map<string, ValidationRule> = new Map();
  private activeTasks: Map<string, CancellationTokenSource> = new Map();

  constructor(
    modelRegistry: ModelRegistry,
    provider: PegasusAIProvider,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.modelRegistry = modelRegistry;
    this.provider = provider;
    this.config = {
      enableCaching: true,
      enableValidation: true,
      maxRetries: 3,
      timeoutMs: 60000,
      parallelExecutionLimit: 5,
      fallbackEnabled: true,
      telemetryEnabled: true,
      modelRegistry: {
        autoDiscovery: true,
        refreshIntervalMs: 30000
      },
      ...config
    };
  }

  /**
   * Executa uma tarefa com orquestração completa
   */
  async executeTask(task: TaskDefinition): Promise<ExecutionResult> {
    const startTime = Date.now();
    const cancellationToken = new CancellationTokenSource();
    this.activeTasks.set(task.id, cancellationToken);

    try {
      // Verifica cache
      if (this.config.enableCaching) {
        const cachedResult = await this.checkCache(task);
        if (cachedResult) {
          return {
            taskId: task.id,
            success: true,
            output: cachedResult,
            executionLog: [],
            fallbackUsed: false,
            totalDuration: Date.now() - startTime
          };
        }
      }

      // Cria plano de execução
      const executionPlan = await this.createExecutionPlan(task);

      // Executa pipeline
      const result = await this.executePipeline(task, executionPlan, cancellationToken);

      // Armazena em cache se sucesso
      if (result.success && this.config.enableCaching) {
        await this.storeInCache(task, result.output);
      }

      return result;
    } catch (error) {
      console.error('[PegasusOrchestrator] Erro na execução:', error);
      return {
        taskId: task.id,
        success: false,
        output: { content: '', metadata: {}, tokensUsed: 0 },
        executionLog: [{
          model: 'unknown',
          status: 'error',
          startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        fallbackUsed: false,
        totalDuration: Date.now() - startTime
      };
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Cria plano de execução baseado na tarefa
   */
  private async createExecutionPlan(task: TaskDefinition): Promise<ExecutionPlan> {
    // Seleciona estratégia baseada na prioridade
    let strategyId = 'task-specific';
    if (task.requirements.requiresOffline) {
      strategyId = 'offline-first';
    } else if (task.priority === 'critical') {
      strategyId = 'low-latency';
    } else if (task.priority === 'low') {
      strategyId = 'cost-effective';
    }

    const strategy = StrategyFactory.getStrategy(strategyId);
    if (!strategy) {
      throw new Error(`Estratégia ${strategyId} não encontrada`);
    }

    // Obtém modelos disponíveis
    const availableModels = this.modelRegistry.getAllModels();
    
    // Filtra por requisitos da tarefa
    const filteredModels = availableModels.filter(model => {
      if (task.requirements.minContextWindow && model.contextWindow < task.requirements.minContextWindow) {
        return false;
      }
      if (task.requirements.requiresOffline && !model.offline) {
        return false;
      }
      if (task.requirements.allowedProviders && !task.requirements.allowedProviders.includes(model.provider)) {
        return false;
      }
      if (task.requirements.forbiddenProviders && task.requirements.forbiddenProviders.includes(model.provider)) {
        return false;
      }
      return true;
    });

    // Seleciona modelos com estratégia
    const rankedModels = await strategy.select(task, filteredModels);

    if (rankedModels.length === 0) {
      throw new Error('Nenhum modelo disponível atende aos requisitos');
    }

    // Constrói cadeia de fallback
    const fallbackChain = rankedModels.map(m => m.id);

    // Define modo de execução
    let executionMode: 'sequential' | 'parallel' | 'hybrid' = 'sequential';
    if (task.type === 'embedding') {
      executionMode = 'parallel';
    } else if (task.priority === 'critical') {
      executionMode = 'hybrid';
    }

    return {
      taskId: task.id,
      selectedModels: rankedModels.slice(0, 3).map((model, index) => ({
        model,
        role: index === 0 ? 'primary' : 'fallback',
        order: index
      })),
      executionMode,
      estimatedTime: this.estimateExecutionTime(task, rankedModels[0]),
      fallbackChain
    };
  }

  /**
   * Executa pipeline de estágios
   */
  private async executePipeline(
    task: TaskDefinition,
    plan: ExecutionPlan,
    cancellationToken: CancellationTokenSource
  ): Promise<ExecutionResult> {
    const stages: PipelineStage[] = [
      {
        id: 'preprocessing',
        name: 'Pre-processamento',
        type: 'preprocessing',
        config: {},
        execute: async (input, context) => this.preprocessInput(input, context)
      },
      {
        id: 'model-execution',
        name: 'Execução do Modelo',
        type: 'model_execution',
        config: {},
        execute: async (input, context) => this.executeModel(input, context, plan)
      },
      {
        id: 'validation',
        name: 'Validação',
        type: 'validation',
        config: {},
        execute: async (output, context) => this.validateOutput(output, task)
      },
      {
        id: 'postprocessing',
        name: 'Pós-processamento',
        type: 'postprocessing',
        config: {},
        execute: async (output, context) => this.postprocessOutput(output, context)
      }
    ];

    let context: PipelineContext = {
      taskId: task.id,
      task,
      executionPlan: plan,
      state: {},
      cancellationToken
    };

    let result: any = task.input;

    for (const stage of stages) {
      if (cancellationToken.isCancelled()) {
        throw new Error('Tarefa cancelada pelo usuário');
      }

      try {
        result = await stage.execute(result, context);
        context.state[stage.id] = result;
      } catch (error) {
        if (stage.type === 'validation' && this.config.fallbackEnabled) {
          // Tenta próximo modelo no fallback
          const fallbackResult = await this.tryFallback(task, plan, cancellationToken);
          if (fallbackResult) {
            return fallbackResult;
          }
        }
        throw error;
      }
    }

    return {
      taskId: task.id,
      success: true,
      output: result,
      executionLog: plan.selectedModels.map((m, i) => ({
        model: m.model.id,
        status: 'success' as const,
        startTime: Date.now(),
        endTime: Date.now(),
        tokensUsed: Math.floor(result.content.length / 4)
      })),
      fallbackUsed: false,
      totalDuration: 0
    };
  }

  /**
   * Tenta modelo de fallback
   */
  private async tryFallback(
    task: TaskDefinition,
    plan: ExecutionPlan,
    cancellationToken: CancellationTokenSource
  ): Promise<ExecutionResult | null> {
    if (!this.config.fallbackEnabled || plan.selectedModels.length < 2) {
      return null;
    }

    // Remove primeiro modelo e tenta próximo
    const fallbackPlan: ExecutionPlan = {
      ...plan,
      selectedModels: plan.selectedModels.slice(1).map((m, i) => ({
        ...m,
        role: i === 0 ? 'primary' : 'fallback',
        order: i
      }))
    };

    if (fallbackPlan.selectedModels.length === 0) {
      return null;
    }

    return this.executePipeline(task, fallbackPlan, cancellationToken);
  }

  /**
   * Pré-processa input
   */
  private async preprocessInput(input: any, context: PipelineContext): Promise<any> {
    // Adiciona contexto da memória se disponível
    const memoryContext = context.task.input.context || [];
    
    return {
      ...input,
      prompt: `${memoryContext.join('\n')}\n\n${input.prompt}`,
      files: context.task.input.files || []
    };
  }

  /**
   * Executa modelo selecionado
   */
  private async executeModel(
    input: any,
    context: PipelineContext,
    plan: ExecutionPlan
  ): Promise<any> {
    const primaryModel = plan.selectedModels[0];
    if (!primaryModel) {
      throw new Error('Nenhum modelo selecionado');
    }

    // Chama provider com modelo selecionado
    const response = await this.provider.sendChatMessage({
      provider: primaryModel.model.provider,
      model: primaryModel.model.id,
      messages: [{ role: 'user', content: input.prompt }],
      stream: false
    });

    return {
      content: response.content,
      metadata: {
        model: primaryModel.model.id,
        provider: primaryModel.model.provider,
        tokensUsed: response.usage?.totalTokens || 0
      }
    };
  }

  /**
   * Valida output
   */
  private async validateOutput(output: any, task: TaskDefinition): Promise<any> {
    if (!this.config.enableValidation) {
      return output;
    }

    // Validações básicas
    if (!output.content || output.content.trim().length === 0) {
      throw new Error('Output vazio');
    }

    // Executa regras de validação registradas
    for (const rule of this.validationRules.values()) {
      const result = await rule.validate(output, task);
      if (!result.valid) {
        throw new Error(`Validação falhou: ${result.errors?.join(', ')}`);
      }
    }

    return output;
  }

  /**
   * Pós-processa output
   */
  private async postprocessOutput(output: any, context: PipelineContext): Promise<any> {
    // Aplica formatação específica baseada no tipo de tarefa
    if (context.task.type === 'code_generation' || context.task.type === 'code_edit') {
      output.content = this.formatCode(output.content);
    }

    return output;
  }

  /**
   * Formata código
   */
  private formatCode(code: string): string {
    // Remove markdown wrappers se presente
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/;
    const match = code.match(codeBlockRegex);
    return match ? match[1].trim() : code.trim();
  }

  /**
   * Estima tempo de execução
   */
  private estimateExecutionTime(task: TaskDefinition, model: ModelCapability): number {
    const baseTime = 1000;
    const tokenEstimate = (task.input.prompt.length + (task.input.context?.join('').length || 0)) / 4;
    const latencyMultiplier = model.latency === 'low' ? 1 : model.latency === 'medium' ? 2 : 3;
    
    return baseTime + (tokenEstimate * 10 * latencyMultiplier);
  }

  /**
   * Verifica cache
   */
  private async checkCache(task: TaskDefinition): Promise<any | null> {
    const key = this.generateCacheKey(task);
    const entry = this.cache.get(key);

    if (entry && Date.now() < entry.expiresAt) {
      entry.hits++;
      return entry.result;
    }

    return null;
  }

  /**
   * Armazena em cache
   */
  private async storeInCache(task: TaskDefinition, result: any): Promise<void> {
    const key = this.generateCacheKey(task);
    const ttlHours = 24;

    this.cache.set(key, {
      key,
      hash: createHash('sha256').update(task.input.prompt).digest('hex'),
      result,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttlHours * 60 * 60 * 1000),
      hits: 0
    });

    // Limpa cache antigo periodicamente
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Gera chave de cache
   */
  private generateCacheKey(task: TaskDefinition): string {
    return `cache:${task.type}:${createHash('sha256').update(task.input.prompt).digest('hex').substring(0, 16)}`;
  }

  /**
   * Limpa cache expirado
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Regra de validação
   */
  registerValidationRule(rule: ValidationRule): void {
    this.validationRules.set(rule.id, rule);
  }

  /**
   * Cancela tarefa
   */
  cancelTask(taskId: string): boolean {
    const token = this.activeTasks.get(taskId);
    if (token) {
      token.cancel();
      this.activeTasks.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Obtém status de tarefas ativas
   */
  getActiveTasks(): string[] {
    return Array.from(this.activeTasks.keys());
  }
}

/**
 * Fonte de Token de Cancelamento
 */
class CancellationTokenSource implements CancellationTokenSource {
  private cancelled: boolean = false;
  private callbacks: Array<() => void> = [];

  isCancelled(): boolean {
    return this.cancelled;
  }

  onCancel(callback: () => void): void {
    this.callbacks.push(callback);
  }

  cancel(): void {
    if (!this.cancelled) {
      this.cancelled = true;
      this.callbacks.forEach(cb => cb());
    }
  }
}

interface CancellationTokenSource {
  isCancelled: () => boolean;
  onCancel: (callback: () => void) => void;
  cancel: () => void;
}
