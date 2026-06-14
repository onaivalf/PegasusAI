/**
 * PegasusAI - Estratégias de Seleção de Modelos
 * Implementa diferentes estratégias para seleção inteligente de modelos
 */

import { TaskDefinition, ModelCapability, ModelSelectionStrategy } from '../../common/types/orchestrator';

/**
 * Estratégia: Menor Latência
 * Seleciona modelos com menor latência primeiro
 */
export class LowLatencyStrategy implements ModelSelectionStrategy {
  id = 'low-latency';
  name = 'Baixa Latência';
  description = 'Prioriza modelos com resposta mais rápida';

  async select(task: TaskDefinition, availableModels: ModelCapability[]): Promise<ModelCapability[]> {
    return availableModels
      .filter(model => this.meetsRequirements(task, model))
      .sort((a, b) => {
        const latencyOrder = { low: 0, medium: 1, high: 2 };
        return latencyOrder[a.latency] - latencyOrder[b.latency];
      });
  }

  private meetsRequirements(task: TaskDefinition, model: ModelCapability): boolean {
    if (task.requirements.minContextWindow && model.contextWindow < task.requirements.minContextWindow) {
      return false;
    }
    
    if (task.requirements.requiresOffline && !model.offline) {
      return false;
    }

    const capabilityRequired = this.getCapabilityForTaskType(task.type);
    if (capabilityRequired && !model.capabilities[capabilityRequired]) {
      return false;
    }

    return true;
  }

  private getCapabilityForTaskType(taskType: TaskDefinition['type']): keyof ModelCapability['capabilities'] | null {
    switch (taskType) {
      case 'embedding':
        return 'embedding';
      case 'code_generation':
      case 'code_edit':
      case 'refactoring':
      case 'debugging':
      case 'testing':
        return 'codeGeneration';
      default:
        return 'chat';
    }
  }
}

/**
 * Estratégia: Offline First
 * Prioriza modelos locais/offline, fallback para cloud apenas se necessário
 */
export class OfflineFirstStrategy implements ModelSelectionStrategy {
  id = 'offline-first';
  name = 'Offline Primeiro';
  description = 'Usa modelos locais sempre que possível';

  async select(task: TaskDefinition, availableModels: ModelCapability[]): Promise<ModelCapability[]> {
    const offlineModels = availableModels.filter(m => m.offline);
    const cloudModels = availableModels.filter(m => !m.offline);

    // Se requer offline, retorna apenas offline
    if (task.requirements.requiresOffline) {
      return offlineModels.sort((a, b) => b.contextWindow - a.contextWindow);
    }

    // Prioriza offline, mas inclui cloud como fallback
    return [...offlineModels, ...cloudModels].sort((a, b) => {
      if (a.offline && !b.offline) return -1;
      if (!a.offline && b.offline) return 1;
      return b.contextWindow - a.contextWindow;
    });
  }
}

/**
 * Estratégia: Melhor Custo-Benefício
 * Balanceia qualidade e custo
 */
export class CostEffectiveStrategy implements ModelSelectionStrategy {
  id = 'cost-effective';
  name = 'Custo-Benefício';
  description = 'Otimiza relação entre qualidade e custo';

  async select(task: TaskDefinition, availableModels: ModelCapability[]): Promise<ModelCapability[]> {
    const costOrder = { free: 0, low: 1, medium: 2, high: 3 };
    
    return availableModels
      .filter(model => this.meetsRequirements(task, model))
      .sort((a, b) => {
        // Prioriza gratuito/barato, depois contexto maior
        const costDiff = costOrder[a.cost] - costOrder[b.cost];
        if (costDiff !== 0) return costDiff;
        return b.contextWindow - a.contextWindow;
      });
  }

  private meetsRequirements(task: TaskDefinition, model: ModelCapability): boolean {
    if (task.requirements.minContextWindow && model.contextWindow < task.requirements.minContextWindow) {
      return false;
    }
    
    if (task.requirements.requiresOffline && !model.offline) {
      return false;
    }

    return true;
  }
}

/**
 * Estratégia: Máxima Qualidade
 * Seleciona modelos com maior contexto e capacidades
 */
export class MaxQualityStrategy implements ModelSelectionStrategy {
  id = 'max-quality';
  name = 'Máxima Qualidade';
  description = 'Seleciona os modelos mais capazes disponíveis';

  async select(task: TaskDefinition, availableModels: ModelCapability[]): Promise<ModelCapability[]> {
    return availableModels
      .filter(model => this.meetsRequirements(task, model))
      .sort((a, b) => {
        // Prioriza contexto maior, depois streaming, depois visão
        if (b.contextWindow !== a.contextWindow) {
          return b.contextWindow - a.contextWindow;
        }
        if (b.capabilities.streaming !== a.capabilities.streaming) {
          return b.capabilities.streaming ? -1 : 1;
        }
        if (b.capabilities.vision !== a.capabilities.vision) {
          return b.capabilities.vision ? -1 : 1;
        }
        return 0;
      });
  }

  private meetsRequirements(task: TaskDefinition, model: ModelCapability): boolean {
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
  }
}

/**
 * Estratégia: Específica por Tarefa
 * Otimiza seleção baseada no tipo de tarefa
 */
export class TaskSpecificStrategy implements ModelSelectionStrategy {
  id = 'task-specific';
  name = 'Específico por Tarefa';
  description = 'Otimiza seleção baseada no tipo de tarefa';

  async select(task: TaskDefinition, availableModels: ModelCapability[]): Promise<ModelCapability[]> {
    const preferredProviders = this.getPreferredProvidersForTask(task.type);
    
    let candidates = availableModels.filter(model => this.meetsRequirements(task, model));

    // Filtra por providers preferenciais se especificado
    if (preferredProviders.length > 0) {
      const preferred = candidates.filter(m => preferredProviders.includes(m.provider));
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }

    // Ordena por contexto e latência
    return candidates.sort((a, b) => {
      if (task.type === 'embedding') {
        return a.capabilities.embedding ? -1 : 1;
      }
      
      if (task.type === 'code_generation' || task.type === 'code_edit') {
        if (b.capabilities.codeGeneration !== a.capabilities.codeGeneration) {
          return b.capabilities.codeGeneration ? -1 : 1;
        }
      }

      return b.contextWindow - a.contextWindow;
    });
  }

  private meetsRequirements(task: TaskDefinition, model: ModelCapability): boolean {
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
  }

  private getPreferredProvidersForTask(taskType: TaskDefinition['type']): string[] {
    switch (taskType) {
      case 'code_generation':
      case 'code_edit':
      case 'refactoring':
      case 'debugging':
        return ['anthropic', 'openai'];
      case 'documentation':
        return ['anthropic', 'google'];
      case 'testing':
        return ['openai', 'anthropic'];
      case 'embedding':
        return ['ollama', 'openai'];
      default:
        return [];
    }
  }
}

/**
 * Fábrica de Estratégias
 */
export class StrategyFactory {
  private static strategies: Map<string, ModelSelectionStrategy> = new Map([
    ['low-latency', new LowLatencyStrategy()],
    ['offline-first', new OfflineFirstStrategy()],
    ['cost-effective', new CostEffectiveStrategy()],
    ['max-quality', new MaxQualityStrategy()],
    ['task-specific', new TaskSpecificStrategy()]
  ]);

  static getStrategy(id: string): ModelSelectionStrategy | undefined {
    return this.strategies.get(id);
  }

  static getAllStrategies(): ModelSelectionStrategy[] {
    return Array.from(this.strategies.values());
  }

  static registerStrategy(strategy: ModelSelectionStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }
}
