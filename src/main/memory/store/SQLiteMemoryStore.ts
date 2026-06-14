/**
 * SQLite-based implementation of MemoryStore, TimelineStore, and GraphStore
 * Provides persistent storage for PegasusAI memory system
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { 
  MemoryItem, MemoryQuery, MemoryStore,
  TimelineEvent, TimelineQuery, TimelineStore,
  KnowledgeNode, KnowledgeEdge, GraphQuery, GraphStore
} from '../../common/types/memory';

export class SQLiteMemoryStore implements MemoryStore, TimelineStore, GraphStore {
  private db: sqlite3.Database;
  private runAsync: (sql: string, params?: any[]) => Promise<void>;
  private allAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
  private getAsync: <T>(sql: string, params?: any[]) => Promise<T | undefined>;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
    
    // Promisificar métodos do sqlite3
    this.runAsync = promisify(this.db.run).bind(this.db);
    this.allAsync = promisify(this.db.all).bind(this.db);
    this.getAsync = promisify(this.db.get).bind(this.db);
    
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    // Tabela de memórias
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Tabela de eventos da timeline
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        related_file TEXT,
        related_conversation TEXT,
        data TEXT
      )
    `);

    // Tabela de nós do grafo
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Tabela de arestas do grafo
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS knowledge_edges (
        id TEXT PRIMARY KEY,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        weight REAL,
        metadata TEXT,
        FOREIGN KEY (source_node_id) REFERENCES knowledge_nodes(id),
        FOREIGN KEY (target_node_id) REFERENCES knowledge_nodes(id)
      )
    `);

    // Índices para performance
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)`);
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at)`);
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON timeline_events(event_type)`);
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline_events(timestamp)`);
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_timeline_file ON timeline_events(related_file)`);
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_nodes(type)`);
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_edges_source ON knowledge_edges(source_node_id)`);
    await this.runAsync(`CREATE INDEX IF NOT EXISTS idx_edges_target ON knowledge_edges(target_node_id)`);
  }

  // ==================== MEMORY STORE ====================

  async saveMemory(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem> {
    const id = item.id || crypto.randomUUID();
    const now = Date.now();
    const memory: MemoryItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.runAsync(
      `INSERT INTO memories (id, type, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, item.type, item.content, JSON.stringify(item.metadata), now, now]
    );

    return memory;
  }

  async getMemory(id: string): Promise<MemoryItem | null> {
    const row = await this.getAsync<any>(
      `SELECT * FROM memories WHERE id = ?`,
      [id]
    );

    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async queryMemories(query: MemoryQuery): Promise<MemoryItem[]> {
    let sql = `SELECT * FROM memories WHERE 1=1`;
    const params: any[] = [];

    if (query.type) {
      sql += ` AND type = ?`;
      params.push(query.type);
    }

    if (query.timeRange) {
      sql += ` AND created_at >= ? AND created_at <= ?`;
      params.push(query.timeRange.start, query.timeRange.end);
    }

    if (query.searchQuery) {
      sql += ` AND content LIKE ?`;
      params.push(`%${query.searchQuery}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ` OFFSET ?`;
      params.push(query.offset);
    }

    const rows = await this.allAsync<any>(sql, params);

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateMemory(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem> {
    const existing = await this.getMemory(id);
    if (!existing) throw new Error(`Memory ${id} not found`);

    const updated: MemoryItem = {
      ...existing,
      ...updates,
      id,
      updatedAt: Date.now(),
    };

    await this.runAsync(
      `UPDATE memories SET type = ?, content = ?, metadata = ?, updated_at = ? WHERE id = ?`,
      [updated.type, updated.content, JSON.stringify(updated.metadata), updated.updatedAt, id]
    );

    return updated;
  }

  async deleteMemory(id: string): Promise<boolean> {
    const result = await this.runAsync(`DELETE FROM memories WHERE id = ?`, [id]);
    return (result.changes || 0) > 0;
  }

  async getRelatedMemories(id: string, limit: number = 10): Promise<MemoryItem[]> {
    const memory = await this.getMemory(id);
    if (!memory || !memory.metadata.linkedItems || memory.metadata.linkedItems.length === 0) {
      return [];
    }

    const placeholders = memory.metadata.linkedItems.map(() => '?').join(',');
    const sql = `SELECT * FROM memories WHERE id IN (${placeholders}) LIMIT ?`;
    const params = [...memory.metadata.linkedItems, limit];

    const rows = await this.allAsync<any>(sql, params);

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // ==================== TIMELINE STORE ====================

  async addEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
    const id = crypto.randomUUID();
    const timelineEvent: TimelineEvent = { id, ...event };

    await this.runAsync(
      `INSERT INTO timeline_events (id, event_type, description, timestamp, related_file, related_conversation, data) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event.eventType,
        event.description,
        event.timestamp,
        event.relatedFile || null,
        event.relatedConversation || null,
        event.data ? JSON.stringify(event.data) : null,
      ]
    );

    return timelineEvent;
  }

  async getEvents(query: TimelineQuery): Promise<TimelineEvent[]> {
    let sql = `SELECT * FROM timeline_events WHERE 1=1`;
    const params: any[] = [];

    if (query.eventTypes && query.eventTypes.length > 0) {
      const placeholders = query.eventTypes.map(() => '?').join(',');
      sql += ` AND event_type IN (${placeholders})`;
      params.push(...query.eventTypes);
    }

    if (query.timeRange) {
      sql += ` AND timestamp >= ? AND timestamp <= ?`;
      params.push(query.timeRange.start, query.timeRange.end);
    }

    if (query.relatedFile) {
      sql += ` AND related_file = ?`;
      params.push(query.relatedFile);
    }

    sql += ` ORDER BY timestamp DESC`;

    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }

    const rows = await this.allAsync<any>(sql, params);

    return rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      description: row.description,
      timestamp: row.timestamp,
      relatedFile: row.related_file,
      relatedConversation: row.related_conversation,
      data: row.data ? JSON.parse(row.data) : undefined,
    }));
  }

  async getEventsByFile(filePath: string, limit: number = 50): Promise<TimelineEvent[]> {
    return this.getEvents({ relatedFile: filePath, limit });
  }

  async clearEventsBefore(timestamp: number): Promise<number> {
    const result = await this.runAsync(`DELETE FROM timeline_events WHERE timestamp < ?`, [timestamp]);
    return result.changes || 0;
  }

  // ==================== GRAPH STORE ====================

  async addNode(node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeNode> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const knowledgeNode: KnowledgeNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.runAsync(
      `INSERT INTO knowledge_nodes (id, label, type, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, node.label, node.type, JSON.stringify(node.properties), now, now]
    );

    return knowledgeNode;
  }

  async addEdge(edge: Omit<KnowledgeEdge, 'id'>): Promise<KnowledgeEdge> {
    const id = crypto.randomUUID();
    const knowledgeEdge: KnowledgeEdge = { id, ...edge };

    await this.runAsync(
      `INSERT INTO knowledge_edges (id, source_node_id, target_node_id, relationship, weight, metadata) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        edge.sourceNodeId,
        edge.targetNodeId,
        edge.relationship,
        edge.weight || null,
        edge.metadata ? JSON.stringify(edge.metadata) : null,
      ]
    );

    return knowledgeEdge;
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    const row = await this.getAsync<any>(
      `SELECT * FROM knowledge_nodes WHERE id = ?`,
      [id]
    );

    if (!row) return null;

    return {
      id: row.id,
      label: row.label,
      type: row.type,
      properties: JSON.parse(row.properties),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getEdges(sourceNodeId?: string, targetNodeId?: string): Promise<KnowledgeEdge[]> {
    let sql = `SELECT * FROM knowledge_edges WHERE 1=1`;
    const params: any[] = [];

    if (sourceNodeId) {
      sql += ` AND source_node_id = ?`;
      params.push(sourceNodeId);
    }

    if (targetNodeId) {
      sql += ` AND target_node_id = ?`;
      params.push(targetNodeId);
    }

    const rows = await this.allAsync<any>(sql, params);

    return rows.map(row => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      relationship: row.relationship,
      weight: row.weight,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  async queryGraph(query: GraphQuery): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    // Buscar nós
    let nodeSql = `SELECT * FROM knowledge_nodes WHERE 1=1`;
    const nodeParams: any[] = [];

    if (query.nodeTypes && query.nodeTypes.length > 0) {
      const placeholders = query.nodeTypes.map(() => '?').join(',');
      nodeSql += ` AND type IN (${placeholders})`;
      nodeParams.push(...query.nodeTypes);
    }

    const nodeRows = await this.allAsync<any>(nodeSql, nodeParams);
    const nodes = nodeRows.map(row => ({
      id: row.id,
      label: row.label,
      type: row.type,
      properties: JSON.parse(row.properties),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Buscar arestas relacionadas aos nós encontrados
    if (nodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodeIds = nodes.map(n => n.id);
    const placeholders = nodeIds.map(() => '?').join(',');
    
    let edgeSql = `SELECT * FROM knowledge_edges WHERE source_node_id IN (${placeholders}) OR target_node_id IN (${placeholders})`;
    const edgeParams = [...nodeIds, ...nodeIds];

    if (query.relationshipTypes && query.relationshipTypes.length > 0) {
      const relPlaceholders = query.relationshipTypes.map(() => '?').join(',');
      edgeSql += ` AND relationship IN (${relPlaceholders})`;
      edgeParams.push(...query.relationshipTypes);
    }

    const edgeRows = await this.allAsync<any>(edgeSql, edgeParams);
    const edges = edgeRows.map(row => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      relationship: row.relationship,
      weight: row.weight,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));

    return { nodes, edges };
  }

  async removeNode(id: string): Promise<boolean> {
    // Primeiro remover arestas relacionadas
    await this.runAsync(`DELETE FROM knowledge_edges WHERE source_node_id = ? OR target_node_id = ?`, [id, id]);
    
    const result = await this.runAsync(`DELETE FROM knowledge_nodes WHERE id = ?`, [id]);
    return (result.changes || 0) > 0;
  }

  async removeEdge(id: string): Promise<boolean> {
    const result = await this.runAsync(`DELETE FROM knowledge_edges WHERE id = ?`, [id]);
    return (result.changes || 0) > 0;
  }

  async findPath(startNodeId: string, endNodeId: string, maxDepth: number = 5): Promise<KnowledgeEdge[]> {
    // Implementação simplificada de BFS para encontrar caminho
    const visited = new Set<string>();
    const queue: { nodeId: string; path: KnowledgeEdge[] }[] = [
      { nodeId: startNodeId, path: [] }
    ];

    while (queue.length > 0 && queue.length < 1000) { // Limite de segurança
      const { nodeId, path } = queue.shift()!;
      
      if (nodeId === endNodeId) {
        return path;
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Buscar arestas saindo deste nó
      const edges = await this.getEdges(nodeId, undefined);
      
      for (const edge of edges) {
        if (!visited.has(edge.targetNodeId)) {
          queue.push({
            nodeId: edge.targetNodeId,
            path: [...path, edge]
          });
        }
      }
    }

    return []; // Caminho não encontrado
  }

  async close(): Promise<void> {
    await promisify(this.db.close).bind(this.db)();
  }
}
