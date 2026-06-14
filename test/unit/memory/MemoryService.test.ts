/**
 * Testes Unitários para MemoryService
 * Validação completa do sistema de memória da PegasusAI
 */

import { MemoryService } from '../../src/main/memory/MemoryService';
import { MemoryEntry, MemoryType, TimelineEventType } from '../../src/common/types/memory';

describe('MemoryService', () => {
  let memoryService: MemoryService;

  beforeEach(async () => {
    // Reset singleton instance
    (MemoryService as any).instance = null;
    memoryService = await MemoryService.getInstance();
  });

  afterEach(async () => {
    await memoryService.shutdown();
    (MemoryService as any).instance = null;
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(memoryService).toBeDefined();
      expect(await memoryService.isReady()).toBe(true);
    });

    it('should create database tables on initialization', async () => {
      const isReady = await memoryService.isReady();
      expect(isReady).toBe(true);
    });
  });

  describe('Memory Operations', () => {
    const testMemory: Partial<MemoryEntry> = {
      content: 'Test code snippet',
      type: 'code_snippet' as MemoryType,
      source: 'user_input',
      tags: ['test', 'unit'],
      metadata: { language: 'typescript' }
    };

    it('should save a memory entry', async () => {
      const saved = await memoryService.saveMemory(testMemory);
      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.content).toBe(testMemory.content);
      expect(saved.type).toBe(testMemory.type);
    });

    it('should retrieve a memory by ID', async () => {
      const saved = await memoryService.saveMemory(testMemory);
      const retrieved = await memoryService.getMemory(saved.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(saved.id);
      expect(retrieved?.content).toBe(testMemory.content);
    });

    it('should update a memory entry', async () => {
      const saved = await memoryService.saveMemory(testMemory);
      const updated = await memoryService.updateMemory(saved.id, {
        content: 'Updated content',
        tags: ['test', 'updated']
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.tags).toContain('updated');
    });

    it('should delete a memory entry', async () => {
      const saved = await memoryService.saveMemory(testMemory);
      await memoryService.deleteMemory(saved.id);
      
      const retrieved = await memoryService.getMemory(saved.id);
      expect(retrieved).toBeNull();
    });

    it('should query memories by type', async () => {
      await memoryService.saveMemory({ ...testMemory, type: 'code_snippet' });
      await memoryService.saveMemory({ ...testMemory, type: 'conversation' });
      
      const codeSnippets = await memoryService.queryMemories({ type: 'code_snippet' });
      expect(codeSnippets.length).toBeGreaterThanOrEqual(1);
      expect(codeSnippets[0].type).toBe('code_snippet');
    });

    it('should query memories by tags', async () => {
      await memoryService.saveMemory({ ...testMemory, tags: ['important', 'test'] });
      await memoryService.saveMemory({ ...testMemory, tags: ['archive'] });
      
      const important = await memoryService.queryMemories({ tags: ['important'] });
      expect(important.length).toBeGreaterThanOrEqual(1);
      expect(important[0].tags).toContain('important');
    });

    it('should link two memories', async () => {
      const mem1 = await memoryService.saveMemory({ ...testMemory, content: 'Memory 1' });
      const mem2 = await memoryService.saveMemory({ ...testMemory, content: 'Memory 2' });
      
      await memoryService.linkMemories(mem1.id, mem2.id, 'related_to');
      
      const linked = await memoryService.getLinkedMemories(mem1.id);
      expect(linked.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Timeline Operations', () => {
    it('should record a timeline event', async () => {
      const event = await memoryService.recordTimelineEvent({
        eventType: 'file_edit' as TimelineEventType,
        filePath: '/test/file.ts',
        details: { linesChanged: 10 }
      });

      expect(event).toBeDefined();
      expect(event.eventType).toBe('file_edit');
      expect(event.filePath).toBe('/test/file.ts');
    });

    it('should get timeline events for a file', async () => {
      const filePath = '/test/timeline-file.ts';
      
      await memoryService.recordTimelineEvent({
        eventType: 'file_edit',
        filePath,
        details: { action: 'create' }
      });
      
      await memoryService.recordTimelineEvent({
        eventType: 'file_edit',
        filePath,
        details: { action: 'modify' }
      });

      const events = await memoryService.getTimelineEvents({ filePath });
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.every(e => e.filePath === filePath)).toBe(true);
    });

    it('should get timeline events by type', async () => {
      await memoryService.recordTimelineEvent({
        eventType: 'file_open',
        filePath: '/test/file1.ts',
        details: {}
      });
      
      await memoryService.recordTimelineEvent({
        eventType: 'file_edit',
        filePath: '/test/file2.ts',
        details: {}
      });

      const edits = await memoryService.getTimelineEvents({ eventType: 'file_edit' });
      expect(edits.length).toBeGreaterThanOrEqual(1);
      expect(edits.every(e => e.eventType === 'file_edit')).toBe(true);
    });
  });

  describe('Graph Operations', () => {
    it('should add a node to the knowledge graph', async () => {
      const node = await memoryService.addNode({
        nodeType: 'function',
        name: 'testFunction',
        filePath: '/test/graph-file.ts',
        startPosition: { line: 1, column: 0 },
        endPosition: { line: 10, column: 0 }
      });

      expect(node).toBeDefined();
      expect(node.nodeType).toBe('function');
      expect(node.name).toBe('testFunction');
    });

    it('should add an edge between nodes', async () => {
      const node1 = await memoryService.addNode({
        nodeType: 'class',
        name: 'TestClass',
        filePath: '/test/class.ts'
      });
      
      const node2 = await memoryService.addNode({
        nodeType: 'method',
        name: 'testMethod',
        filePath: '/test/class.ts'
      });

      const edge = await memoryService.addEdge(node1.id, node2.id, 'contains');
      expect(edge).toBeDefined();
      expect(edge.sourceId).toBe(node1.id);
      expect(edge.targetId).toBe(node2.id);
    });

    it('should query graph nodes by type', async () => {
      await memoryService.addNode({
        nodeType: 'function',
        name: 'func1',
        filePath: '/test/query.ts'
      });
      
      await memoryService.addNode({
        nodeType: 'class',
        name: 'Class1',
        filePath: '/test/query.ts'
      });

      const functions = await memoryService.queryGraph({ nodeType: 'function' });
      expect(functions.nodes.length).toBeGreaterThanOrEqual(1);
      expect(functions.nodes.every(n => n.nodeType === 'function')).toBe(true);
    });

    it('should find path between nodes', async () => {
      const node1 = await memoryService.addNode({
        nodeType: 'file',
        name: 'main.ts',
        filePath: '/test/main.ts'
      });
      
      const node2 = await memoryService.addNode({
        nodeType: 'function',
        name: 'helper',
        filePath: '/test/helper.ts'
      });

      await memoryService.addEdge(node1.id, node2.id, 'imports');

      const path = await memoryService.findPath(node1.id, node2.id);
      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Context Building', () => {
    it('should build context for a file', async () => {
      const filePath = '/test/context-file.ts';
      
      // Add some memories related to the file
      await memoryService.saveMemory({
        content: 'Code snippet 1',
        type: 'code_snippet',
        source: 'file',
        metadata: { filePath }
      });
      
      // Record timeline events
      await memoryService.recordTimelineEvent({
        eventType: 'file_edit',
        filePath,
        details: {}
      });

      const context = await memoryService.buildContextForFile(filePath);
      
      expect(context).toBeDefined();
      expect(context.fileContext).toBeDefined();
      expect(context.relatedMemories).toBeDefined();
      expect(context.timelineEvents).toBeDefined();
    });
  });

  describe('Code Symbol Indexing', () => {
    it('should index code symbols from TypeScript code', async () => {
      const code = `
        export class UserService {
          private db: Database;
          
          constructor(db: Database) {
            this.db = db;
          }
          
          async getUser(id: string): Promise<User> {
            return this.db.findById(id);
          }
          
          async createUser(data: UserData): Promise<User> {
            return this.db.insert(data);
          }
        }
      `;

      const symbols = await memoryService.indexCodeSymbols('/test/service.ts', code, 'typescript');
      
      expect(symbols).toBeDefined();
      expect(symbols.length).toBeGreaterThan(0);
      
      // Should find the class
      const classNode = symbols.find(s => s.nodeType === 'class' && s.name === 'UserService');
      expect(classNode).toBeDefined();
      
      // Should find methods
      const methods = symbols.filter(s => s.nodeType === 'method');
      expect(methods.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent memory gracefully', async () => {
      const result = await memoryService.getMemory('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle invalid update operations', async () => {
      const result = await memoryService.updateMemory('non-existent-id', { content: 'test' });
      expect(result).toBeNull();
    });

    it('should handle query with no results', async () => {
      const result = await memoryService.queryMemories({ tags: ['nonexistent-tag-xyz'] });
      expect(result).toEqual([]);
    });
  });

  describe('Performance', () => {
    it('should handle bulk insert efficiently', async () => {
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          memoryService.saveMemory({
            content: `Bulk memory ${i}`,
            type: 'code_snippet',
            source: 'bulk_test',
            tags: ['bulk', `group-${Math.floor(i / 10)}`]
          })
        );
      }
      
      await Promise.all(promises);
      const endTime = Date.now();
      
      // Should complete 100 inserts in less than 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
      
      const allMemories = await memoryService.queryMemories({ source: 'bulk_test' });
      expect(allMemories.length).toBe(100);
    });
  });
});
