/**
 * Memory Service - High-level API for PegasusAI Memory System
 * Orchestrates memory storage, timeline tracking, and knowledge graph operations
 */

import { 
  MemoryItem, MemoryQuery, 
  TimelineEvent, TimelineQuery,
  KnowledgeNode, KnowledgeEdge, GraphQuery,
  MemoryStore, TimelineStore, GraphStore
} from '../../common/types/memory';
import { SQLiteMemoryStore } from './store/SQLiteMemoryStore';

export class MemoryService {
  private store: MemoryStore & TimelineStore & GraphStore;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.store = new SQLiteMemoryStore(dbPath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // Schema já é inicializado no construtor do SQLiteMemoryStore
    this.initialized = true;
    console.log('[MemoryService] Initialized with SQLite storage');
  }

  // ==================== MEMORY OPERATIONS ====================

  /**
   * Save a new memory item
   */
  async saveMemory(
    type: MemoryItem['type'],
    content: string,
    metadata?: MemoryItem['metadata']
  ): Promise<MemoryItem> {
    await this.ensureInitialized();
    
    return this.store.saveMemory({
      type,
      content,
      metadata: metadata || {},
    });
  }

  /**
   * Retrieve a specific memory by ID
   */
  async getMemory(id: string): Promise<MemoryItem | null> {
    await this.ensureInitialized();
    return this.store.getMemory(id);
  }

  /**
   * Query memories with filters
   */
  async queryMemories(query: MemoryQuery): Promise<MemoryItem[]> {
    await this.ensureInitialized();
    return this.store.queryMemories(query);
  }

  /**
   * Update an existing memory
   */
  async updateMemory(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem> {
    await this.ensureInitialized();
    return this.store.updateMemory(id, updates);
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.store.deleteMemory(id);
  }

  /**
   * Get memories related to a specific memory
   */
  async getRelatedMemories(id: string, limit?: number): Promise<MemoryItem[]> {
    await this.ensureInitialized();
    return this.store.getRelatedMemories(id, limit);
  }

  // ==================== TIMELINE OPERATIONS ====================

  /**
   * Record a timeline event
   */
  async recordEvent(
    eventType: TimelineEvent['eventType'],
    description: string,
    options?: {
      relatedFile?: string;
      relatedConversation?: string;
      data?: Record<string, any>;
    }
  ): Promise<TimelineEvent> {
    await this.ensureInitialized();
    
    return this.store.addEvent({
      eventType,
      description,
      timestamp: Date.now(),
      ...options,
    });
  }

  /**
   * Get timeline events with filters
   */
  async getTimelineEvents(query: TimelineQuery): Promise<TimelineEvent[]> {
    await this.ensureInitialized();
    return this.store.getEvents(query);
  }

  /**
   * Get all events related to a specific file
   */
  async getFileTimeline(filePath: string, limit?: number): Promise<TimelineEvent[]> {
    await this.ensureInitialized();
    return this.store.getEventsByFile(filePath, limit);
  }

  /**
   * Clean old timeline events
   */
  async cleanupOldEvents(beforeTimestamp: number): Promise<number> {
    await this.ensureInitialized();
    return this.store.clearEventsBefore(beforeTimestamp);
  }

  // ==================== KNOWLEDGE GRAPH OPERATIONS ====================

  /**
   * Add a node to the knowledge graph
   */
  async addKnowledgeNode(
    label: string,
    type: KnowledgeNode['type'],
    properties: KnowledgeNode['properties']
  ): Promise<KnowledgeNode> {
    await this.ensureInitialized();
    
    return this.store.addNode({
      label,
      type,
      properties,
    });
  }

  /**
   * Add an edge to the knowledge graph
   */
  async addKnowledgeEdge(
    sourceNodeId: string,
    targetNodeId: string,
    relationship: KnowledgeEdge['relationship'],
    options?: {
      weight?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<KnowledgeEdge> {
    await this.ensureInitialized();
    
    return this.store.addEdge({
      sourceNodeId,
      targetNodeId,
      relationship,
      ...options,
    });
  }

  /**
   * Get a specific node by ID
   */
  async getKnowledgeNode(id: string): Promise<KnowledgeNode | null> {
    await this.ensureInitialized();
    return this.store.getNode(id);
  }

  /**
   * Get edges connected to nodes
   */
  async getKnowledgeEdges(sourceNodeId?: string, targetNodeId?: string): Promise<KnowledgeEdge[]> {
    await this.ensureInitialized();
    return this.store.getEdges(sourceNodeId, targetNodeId);
  }

  /**
   * Query the knowledge graph
   */
  async queryKnowledgeGraph(query: GraphQuery): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    await this.ensureInitialized();
    return this.store.queryGraph(query);
  }

  /**
   * Remove a node and its connected edges
   */
  async removeKnowledgeNode(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.store.removeNode(id);
  }

  /**
   * Remove an edge
   */
  async removeKnowledgeEdge(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.store.removeEdge(id);
  }

  /**
   * Find a path between two nodes in the graph
   */
  async findKnowledgePath(startNodeId: string, endNodeId: string, maxDepth?: number): Promise<KnowledgeEdge[]> {
    await this.ensureInitialized();
    return this.store.findPath(startNodeId, endNodeId, maxDepth);
  }

  // ==================== ADVANCED OPERATIONS ====================

  /**
   * Build context for AI based on current file and recent activity
   */
  async buildContextForFile(filePath: string, options?: {
    includeRecentEvents?: boolean;
    eventLimit?: number;
    includeRelatedMemories?: boolean;
    memoryLimit?: number;
    includeGraphNeighbors?: boolean;
    graphDepth?: number;
  }): Promise<{
    timeline: TimelineEvent[];
    memories: MemoryItem[];
    graphContext?: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
  }> {
    await this.ensureInitialized();

    const timeline = await this.getFileTimeline(filePath, options?.eventLimit || 50);
    
    let memories: MemoryItem[] = [];
    if (options?.includeRelatedMemories) {
      memories = await this.queryMemories({
        searchQuery: filePath.split('/').pop() || '',
        limit: options.memoryLimit || 20,
      });
    }

    let graphContext: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } | undefined;
    if (options?.includeGraphNeighbors) {
      // Tentar encontrar nó relacionado ao arquivo
      const graphResult = await this.queryKnowledgeGraph({
        nodeTypes: ['file'],
      });
      
      const fileNode = graphResult.nodes.find(n => n.properties.path === filePath);
      
      if (fileNode) {
        graphContext = await this.queryKnowledgeGraph({
          startNodeId: fileNode.id,
          depth: options.graphDepth || 2,
        });
      }
    }

    return { timeline, memories, graphContext };
  }

  /**
   * Link memories together
   */
  async linkMemories(sourceId: string, targetIds: string[]): Promise<void> {
    await this.ensureInitialized();
    
    const source = await this.getMemory(sourceId);
    if (!source) throw new Error(`Memory ${sourceId} not found`);

    const linkedItems = [...(source.metadata.linkedItems || []), ...targetIds];
    await this.updateMemory(sourceId, {
      metadata: {
        ...source.metadata,
        linkedItems,
      },
    });
  }

  /**
   * Extract and index code symbols into knowledge graph
   */
  async indexCodeSymbols(filePath: string, symbols: Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'interface';
    signature?: string;
    dependencies?: string[];
  }>): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    await this.ensureInitialized();

    // Criar nó para o arquivo
    const fileNode = await this.addKnowledgeNode(
      filePath.split('/').pop() || filePath,
      'file',
      { name: filePath, path: filePath }
    );

    const createdNodes: KnowledgeNode[] = [fileNode];
    const createdEdges: KnowledgeEdge[] = [];

    // Criar nós para cada símbolo
    for (const symbol of symbols) {
      const symbolNode = await this.addKnowledgeNode(
        symbol.name,
        symbol.type,
        {
          name: symbol.name,
          path: filePath,
          signature: symbol.signature,
          language: filePath.split('.').pop(),
          dependencies: symbol.dependencies,
        }
      );
      createdNodes.push(symbolNode);

      // Criar aresta do arquivo para o símbolo
      const edge = await this.addKnowledgeEdge(
        fileNode.id,
        symbolNode.id,
        'related_to'
      );
      createdEdges.push(edge);

      // Criar arestas para dependências se existirem
      if (symbol.dependencies) {
        for (const dep of symbol.dependencies) {
          // Tentar encontrar nó existente para dependência
          const existingGraph = await this.queryKnowledgeGraph({
            nodeTypes: ['function', 'class', 'variable', 'interface'],
          });
          
          const depNode = existingGraph.nodes.find(n => n.properties.name === dep);
          
          if (depNode) {
            const depEdge = await this.addKnowledgeEdge(
              symbolNode.id,
              depNode.id,
              'uses'
            );
            createdEdges.push(depEdge);
          }
        }
      }
    }

    return { nodes: createdNodes, edges: createdEdges };
  }

  // ==================== UTILITIES ====================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async close(): Promise<void> {
    if (this.store instanceof SQLiteMemoryStore) {
      await this.store.close();
    }
    this.initialized = false;
  }
}

// Singleton instance (will be initialized by main process)
let memoryServiceInstance: MemoryService | null = null;

export function getMemoryService(dbPath?: string): MemoryService {
  if (!memoryServiceInstance && dbPath) {
    memoryServiceInstance = new MemoryService(dbPath);
  } else if (!memoryServiceInstance) {
    throw new Error('MemoryService not initialized. Call with dbPath first.');
  }
  return memoryServiceInstance;
}
