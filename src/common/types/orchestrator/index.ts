/**
 * PegasusAI - Tipos do Orchestrator
 * Define as interfaces e tipos para o sistema de orquestração multi-modelo
 */

export interface ModelCapability {
  id: string;
  name: string;
  provider: string;
  capabilities: {
    chat: boolean;
    codeGeneration: boolean;
    codeEdit: boolean;
    embedding: boolean;
    vision: boolean;
    streaming: boolean;
  };
  contextWindow: number;
  latency: 'low' | 'medium' | 'high';
  cost: 'free' | 'low' | 'medium' | 'high';
  offline: boolean;
}

export interface TaskDefinition {
  id: string;
  type: 'chat' | 'code_generation' | 'code_edit' | 'refactoring' | 'debugging' | 'testing' | 'documentation' | 'embedding';
  priority: 'critical' | 'high' | 'normal' | 'low';
  input: {
    prompt: string;
    context?: string[];
    files?: Array<{ path: string; content: string }>;
    constraints?: Record<string, any>;
  };
  requirements: {
    minContextWindow?: number;
    requiresStreaming?: boolean;
    requiresOffline?: boolean;
    preferredLatency?: 'low' | 'medium' | 'high';
    allowedProviders?: string[];
    forbiddenProviders?: string[];
  };
  metadata: {
    timestamp: number;
    source: string;
    userId?: string;
  };
}

export interface ModelSelectionStrategy {
  id: string;
  name: string;
  description: string;
  select: (task: TaskDefinition, availableModels: ModelCapability[]) => Promise<ModelCapability[]>;
}

export interface ExecutionPlan {
  taskId: string;
  selectedModels: Array<{
    model: ModelCapability;
    role: 'primary' | 'fallback' | 'validator' | 'embedder';
    order: number;
  }>;
  executionMode: 'sequential' | 'parallel' | 'hybrid';
  estimatedTime: number;
  fallbackChain: string[];
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  output: {
    content: string;
    metadata: Record<string, any>;
    embeddings?: number[];
    tokensUsed: number;
  };
  executionLog: Array<{
    model: string;
    status: 'pending' | 'running' | 'success' | 'error' | 'timeout';
    startTime: number;
    endTime?: number;
    error?: string;
    tokensUsed?: number;
  }>;
  fallbackUsed: boolean;
  totalDuration: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'preprocessing' | 'model_execution' | 'postprocessing' | 'validation' | 'caching';
  config: Record<string, any>;
  execute: (input: any, context: PipelineContext) => Promise<any>;
}

export interface PipelineContext {
  taskId: string;
  task: TaskDefinition;
  executionPlan: ExecutionPlan;
  state: Record<string, any>;
  cancellationToken: CancellationToken;
}

export interface CancellationToken {
  isCancelled: () => boolean;
  onCancel: (callback: () => void) => void;
  cancel: () => void;
}

export interface OrchestratorConfig {
  enableCaching: boolean;
  enableValidation: boolean;
  maxRetries: number;
  timeoutMs: number;
  parallelExecutionLimit: number;
  fallbackEnabled: boolean;
  telemetryEnabled: boolean;
  modelRegistry: {
    autoDiscovery: boolean;
    refreshIntervalMs: number;
  };
}

export interface CacheEntry {
  key: string;
  hash: string;
  result: any;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export interface ValidationRule {
  id: string;
  name: string;
  validate: (output: any, task: TaskDefinition) => Promise<{ valid: boolean; errors?: string[] }>;
}
