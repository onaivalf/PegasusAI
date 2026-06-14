/**
 * PegasusAI Memory System - Type Definitions
 * Defines the core interfaces for Memory, Timeline, and Knowledge Graph
 */

export interface MemoryItem {
  id: string;
  type: 'code_snippet' | 'conversation' | 'file_change' | 'user_note' | 'error_log' | 'ai_suggestion';
  content: string;
  metadata: {
    timestamp: number;
    source?: string; // file path or conversation ID
    tags?: string[];
    relevanceScore?: number;
    linkedItems?: string[];
    context?: Record<string, any>;
  };
  createdAt: number;
  updatedAt: number;
}

export interface TimelineEvent {
  id: string;
  eventType: 'file_open' | 'file_save' | 'chat_message' | 'code_edit' | 'build_start' | 'build_end' | 'debug_start' | 'debug_end';
  description: string;
  timestamp: number;
  relatedFile?: string;
  relatedConversation?: string;
  data?: Record<string, any>;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'concept' | 'error' | 'solution';
  properties: {
    name: string;
    path?: string;
    signature?: string;
    description?: string;
    language?: string;
    dependencies?: string[];
    dependents?: string[];
  };
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: 'imports' | 'calls' | 'extends' | 'implements' | 'uses' | 'related_to' | 'caused_by' | 'fixed_by';
  weight?: number;
  metadata?: Record<string, any>;
}

export interface MemoryQuery {
  type?: MemoryItem['type'];
  tags?: string[];
  timeRange?: { start: number; end: number };
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface TimelineQuery {
  eventTypes?: TimelineEvent['eventType'][];
  timeRange?: { start: number; end: number };
  relatedFile?: string;
  limit?: number;
}

export interface GraphQuery {
  nodeTypes?: KnowledgeNode['type'][];
  startNodeId?: string;
  depth?: number;
  relationshipTypes?: KnowledgeEdge['relationship'][];
}

export interface MemoryStore {
  saveMemory(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem>;
  getMemory(id: string): Promise<MemoryItem | null>;
  queryMemories(query: MemoryQuery): Promise<MemoryItem[]>;
  updateMemory(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem>;
  deleteMemory(id: string): Promise<boolean>;
  getRelatedMemories(id: string, limit?: number): Promise<MemoryItem[]>;
}

export interface TimelineStore {
  addEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent>;
  getEvents(query: TimelineQuery): Promise<TimelineEvent[]>;
  getEventsByFile(filePath: string, limit?: number): Promise<TimelineEvent[]>;
  clearEventsBefore(timestamp: number): Promise<number>;
}

export interface GraphStore {
  addNode(node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeNode>;
  addEdge(edge: Omit<KnowledgeEdge, 'id'>): Promise<KnowledgeEdge>;
  getNode(id: string): Promise<KnowledgeNode | null>;
  getEdges(sourceNodeId?: string, targetNodeId?: string): Promise<KnowledgeEdge[]>;
  queryGraph(query: GraphQuery): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }>;
  removeNode(id: string): Promise<boolean>;
  removeEdge(id: string): Promise<boolean>;
  findPath(startNodeId: string, endNodeId: string, maxDepth?: number): Promise<KnowledgeEdge[]>;
}
