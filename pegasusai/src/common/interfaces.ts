/**
 * PegasusAI - Interfaces e Tipos Compartilhados
 * 
 * Define contratos e tipos usados em toda a aplicação.
 */

// ==================== Provider Interfaces ====================

export interface IProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  endpoint: string;
  models: string[];
  isOffline: boolean;
  priority: number;
  
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  listModels(): Promise<string[]>;
  isAvailable(): Promise<boolean>;
}

export interface IProviderConfig {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  endpoint: string;
  models: string[];
  isOffline: boolean;
  priority: number;
}

export interface IProviderRegistry {
  registerProvider(config: IProviderConfig): boolean;
  getProvider(id: string): IProvider | undefined;
  getDefaultProvider(): IProvider | undefined;
  getAvailableProvider(): Promise<IProvider | undefined>;
  listProviders(): IProviderConfig[];
  listAvailableProviders(): Promise<IProviderConfig[]>;
  unregisterProvider(id: string): boolean;
  setDefaultProvider(id: string): boolean;
  callWithFallback<T>(operation: (provider: IProvider) => Promise<T>, preferredProviderId?: string): Promise<T>;
}

// ==================== Chat Interfaces ====================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: number;
  };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  systemPrompt?: string;
  context?: CodeContext[];
}

export interface ChatResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: {
    model: string;
    provider: string;
    duration: number;
  };
}

// ==================== Completion Interfaces ====================

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

// ==================== Code Context Interfaces ====================

export interface CodeContext {
  filePath: string;
  language: string;
  content: string;
  range?: {
    startLine: number;
    endLine: number;
  };
  symbols?: CodeSymbol[];
}

export interface CodeSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'type';
  range: {
    startLine: number;
    endLine: number;
  };
  signature?: string;
  documentation?: string;
}

// ==================== Edit/Apply Interfaces ====================

export interface EditOperation {
  type: 'insert' | 'delete' | 'replace';
  filePath: string;
  range?: {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  };
  content: string;
  description?: string;
}

export interface ApplyResult {
  success: boolean;
  edits: EditOperation[];
  diff?: string;
  error?: string;
  rollback?: () => Promise<void>;
}

export interface SmartApplyOptions {
  mode: 'fast' | 'slow' | 'preview';
  acceptThreshold?: number; // Confiança mínima para auto-apply (0-1)
  createBackup?: boolean;
}

// ==================== Memory Interfaces ====================

export interface MemoryEntry {
  id: string;
  type: 'code' | 'conversation' | 'knowledge' | 'context';
  content: string;
  metadata: {
    createdAt: number;
    updatedAt?: number;
    tags?: string[];
    source?: string;
    relevance?: number;
  };
  embeddings?: number[];
}

export interface MemoryQuery {
  query: string;
  filters?: {
    types?: MemoryEntry['type'][];
    tags?: string[];
    dateRange?: {
      from: number;
      to: number;
    };
  };
  limit?: number;
  includeEmbeddings?: boolean;
}

export interface MemorySearchResult {
  entries: MemoryEntry[];
  scores: number[];
  total: number;
}

export interface IMemoryService {
  store(entry: Omit<MemoryEntry, 'id'>): Promise<MemoryEntry>;
  search(query: MemoryQuery): Promise<MemorySearchResult>;
  delete(id: string): Promise<boolean>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null>;
  getRecent(limit?: number): Promise<MemoryEntry[]>;
  getRelated(entryId: string, limit?: number): Promise<MemoryEntry[]>;
  clear(): Promise<void>;
}

// ==================== Knowledge Graph Interfaces ====================

export interface KnowledgeNode {
  id: string;
  type: 'file' | 'symbol' | 'concept' | 'entity';
  label: string;
  properties: Record<string, any>;
  embeddings?: number[];
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
  properties?: Record<string, any>;
}

export interface KnowledgeGraphQuery {
  nodeIds?: string[];
  types?: KnowledgeNode['type'][];
  relationships?: string[];
  maxDepth?: number;
}

export interface IKnowledgeGraphService {
  addNode(node: KnowledgeNode): Promise<void>;
  removeNode(id: string): Promise<void>;
  addEdge(edge: KnowledgeEdge): Promise<void>;
  removeEdge(source: string, target: string): Promise<void>;
  getNode(id: string): Promise<KnowledgeNode | null>;
  getNeighbors(nodeId: string, depth?: number): Promise<KnowledgeNode[]>;
  search(query: string, limit?: number): Promise<KnowledgeNode[]>;
  findPath(startId: string, endId: string): Promise<KnowledgeNode[]>;
  export(): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }>;
  import(data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }): Promise<void>;
}

// ==================== Orchestrator Interfaces ====================

export interface OrchestratorTask {
  id: string;
  type: 'chat' | 'completion' | 'edit' | 'search' | 'analyze';
  input: any;
  options?: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export interface IOrchestrator {
  submitTask(task: Omit<OrchestratorTask, 'id' | 'status' | 'createdAt'>): Promise<string>;
  getTask(id: string): Promise<OrchestratorTask | null>;
  cancelTask(id: string): Promise<boolean>;
  listTasks(status?: OrchestratorTask['status']): Promise<OrchestratorTask[]>;
  setConcurrency(limit: number): void;
  getStats(): Promise<OrchestratorStats>;
}

export interface OrchestratorStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageDuration: number;
  activeProviders: string[];
}

// ==================== IPC Interfaces ====================

export interface IPCMessage {
  channel: string;
  payload: any;
  messageId: string;
  timestamp: number;
  sender: 'main' | 'renderer';
}

export interface IPCHandler {
  channel: string;
  handler: (payload: any) => Promise<any> | any;
}

export interface IIPCBridge {
  registerHandler(handler: IPCHandler): void;
  unregisterHandler(channel: string): void;
  send(channel: string, payload: any): Promise<any>;
  broadcast(channel: string, payload: any): void;
}

// ==================== Config Interfaces ====================

export interface PegasusConfig {
  version: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  
  ai: {
    defaultProvider: string;
    fallbackEnabled: boolean;
    offlineMode: boolean;
    autoComplete: boolean;
    inlineSuggestions: boolean;
  };
  
  memory: {
    enabled: boolean;
    maxSize: number; // MB
    retentionDays: number;
  };
  
  knowledgeGraph: {
    enabled: boolean;
    autoIndex: boolean;
    indexExtensions: string[];
  };
  
  editor: {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
  };
}

// ==================== Local AI & Offline Mode Interfaces ====================

export interface ILocalModel {
  id: string;
  name: string;
  provider: string;
  format: ModelFormat;
  size: number;
  status: 'loaded' | 'available' | 'downloading' | 'error';
  path?: string;
  capabilities: string[];
}

export interface ILocalProvider {
  id: string;
  name: string;
  port: number;
  status: LocalProviderStatus;
  endpoint: string;
  models: ILocalModel[];
  capabilities: string[];
}

export type LocalProviderStatus = 'ready' | 'unavailable' | 'starting' | 'error';

export enum ModelFormat {
  GGUF = 'gguf',
  ONNX = 'onnx',
  SAFETENSORS = 'safetensors',
  PT = 'pt',
  OTHER = 'other'
}

export type OfflineModeStatus = 'initializing' | 'online-local' | 'offline' | 'error';

export interface IOfflineModeConfig {
  enabled: boolean;
  preferLocal: boolean;
  autoDownloadModels: boolean;
  fallbackToSmallerModel: boolean;
  cacheResponses: boolean;
  maxCacheSize: number;
  allowedProviders: string[];
  defaultModel: string;
  fallbackModel: string;
}

export interface IFallbackStrategy {
  id: string;
  name: string;
  trigger: 'model-unavailable' | 'provider-unavailable' | 'no-connectivity';
  action: (context: any) => Promise<boolean>;
}
