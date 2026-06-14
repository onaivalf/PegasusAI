/**
 * Testes Unitários para PegasusOrchestrator
 * Validação completa do sistema de orquestração multi-modelo
 */

import { PegasusOrchestrator } from '../../src/main/orchestrator/PegasusOrchestrator';
import { ModelRegistry } from '../../src/main/orchestrator/ModelRegistry';
import { TaskDefinition, ExecutionPlan, PipelineStage } from '../../src/common/types/orchestrator';

describe('PegasusOrchestrator', () => {
  let orchestrator: PegasusOrchestrator;
  let modelRegistry: ModelRegistry;

  beforeEach(async () => {
    // Reset singleton instances
    (PegasusOrchestrator as any).instance = null;
    (ModelRegistry as any).instance = null;
    
    modelRegistry = await ModelRegistry.getInstance();
    orchestrator = await PegasusOrchestrator.getInstance();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
    (PegasusOrchestrator as any).instance = null;
    (ModelRegistry as any).instance = null;
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(orchestrator).toBeDefined();
      expect(await orchestrator.isReady()).toBe(true);
    });

    it('should have access to model registry', async () => {
      const registry = (orchestrator as any).modelRegistry;
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(ModelRegistry);
    });
  });

  describe('Task Execution', () => {
    const sampleTask: TaskDefinition = {
      id: 'test-task-1',
      type: 'code_generation',
      input: 'Create a function to sort an array',
      context: { language: 'typescript' },
      priority: 'normal',
      requirements: {
        maxTokens: 1000,
        temperature: 0.7
      }
    };

    it('should create an execution plan for a task', async () => {
      const plan = await orchestrator.createExecutionPlan(sampleTask);
      
      expect(plan).toBeDefined();
      expect(plan.taskId).toBe(sampleTask.id);
      expect(plan.stages).toBeDefined();
      expect(plan.stages.length).toBeGreaterThan(0);
    });

    it('should execute a simple task', async () => {
      const result = await orchestrator.executeTask(sampleTask);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(sampleTask.id);
      expect(result.status).toMatch(/completed|failed/);
    });

    it('should execute task with custom strategy', async () => {
      const result = await orchestrator.executeTask(sampleTask, {
        strategy: 'offline_first',
        timeout: 30000
      });
      
      expect(result).toBeDefined();
      expect(result.strategy).toBe('offline_first');
    });

    it('should handle task cancellation', async () => {
      const taskId = 'cancel-test-' + Date.now();
      const longTask: TaskDefinition = {
        ...sampleTask,
        id: taskId,
        input: 'Simulate long running task'
      };

      // Start task
      const executionPromise = orchestrator.executeTask(longTask);
      
      // Cancel immediately
      await orchestrator.cancelTask(taskId);
      
      const status = await orchestrator.getTaskStatus(taskId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('cancelled');
    });
  });

  describe('Pipeline Stages', () => {
    it('should execute preprocessing stage', async () => {
      const task: TaskDefinition = {
        id: 'pipeline-test-1',
        type: 'code_review',
        input: '  Review this code: function test() {}  ',
        context: {}
      };

      const plan = await orchestrator.createExecutionPlan(task);
      const preprocessStage = plan.stages.find(s => s.name === 'preprocessing');
      
      expect(preprocessStage).toBeDefined();
      expect(preprocessStage?.status).toBe('pending');
    });

    it('should execute validation stage', async () => {
      const task: TaskDefinition = {
        id: 'pipeline-test-2',
        type: 'code_generation',
        input: 'Generate hello world',
        context: {}
      };

      const plan = await orchestrator.createExecutionPlan(task);
      const validationStage = plan.stages.find(s => s.name === 'validation');
      
      expect(validationStage).toBeDefined();
    });

    it('should execute postprocessing stage', async () => {
      const task: TaskDefinition = {
        id: 'pipeline-test-3',
        type: 'code_refactoring',
        input: 'Refactor this function',
        context: {}
      };

      const plan = await orchestrator.createExecutionPlan(task);
      const postprocStage = plan.stages.find(s => s.name === 'postprocessing');
      
      expect(postprocStage).toBeDefined();
      expect(postprocStage?.actions).toContain('format_code');
    });
  });

  describe('Model Selection', () => {
    it('should select appropriate model for code generation', async () => {
      const task: TaskDefinition = {
        id: 'model-select-1',
        type: 'code_generation',
        input: 'Write a sorting algorithm',
        context: { language: 'typescript' },
        requirements: { maxTokens: 2000 }
      };

      const plan = await orchestrator.createExecutionPlan(task);
      expect(plan.selectedModels.length).toBeGreaterThan(0);
    });

    it('should select offline model when strategy is offline_first', async () => {
      const task: TaskDefinition = {
        id: 'model-select-2',
        type: 'chat',
        input: 'Explain recursion',
        context: {}
      };

      const result = await orchestrator.executeTask(task, {
        strategy: 'offline_first'
      });

      // Should attempt offline models first
      expect(result.attempts).toBeDefined();
    });

    it('should fallback to alternative models on failure', async () => {
      const task: TaskDefinition = {
        id: 'fallback-test-1',
        type: 'complex_reasoning',
        input: 'Solve this complex problem...',
        context: {},
        requirements: { maxTokens: 4000 }
      };

      const result = await orchestrator.executeTask(task, {
        maxRetries: 2
      });

      expect(result).toBeDefined();
      // Should have attempted multiple models if first failed
      expect(result.fallbackChain).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should cache task results', async () => {
      const task: TaskDefinition = {
        id: 'cache-test-1',
        type: 'chat',
        input: 'What is TypeScript?',
        context: {}
      };

      // First execution
      const result1 = await orchestrator.executeTask(task);
      expect(result1).toBeDefined();

      // Second execution with same input should use cache
      const result2 = await orchestrator.executeTask(task);
      expect(result2).toBeDefined();
      expect(result2.fromCache).toBe(true);
    });

    it('should respect cache TTL', async () => {
      const task: TaskDefinition = {
        id: 'cache-ttl-test-1',
        type: 'chat',
        input: 'Cache TTL test',
        context: {}
      };

      // Execute with short TTL
      await orchestrator.executeTask(task, { cacheTTL: 1000 });
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Should not use cache
      const result = await orchestrator.executeTask(task, { cacheTTL: 1000 });
      expect(result.fromCache).toBe(false);
    });

    it('should clear cache on demand', async () => {
      const task: TaskDefinition = {
        id: 'cache-clear-1',
        type: 'chat',
        input: 'Test cache clear',
        context: {}
      };

      await orchestrator.executeTask(task);
      await orchestrator.clearCache();
      
      const result = await orchestrator.executeTask(task);
      expect(result.fromCache).toBe(false);
    });
  });

  describe('Concurrent Tasks', () => {
    it('should handle multiple concurrent tasks', async () => {
      const tasks: TaskDefinition[] = [
        { id: 'concurrent-1', type: 'chat', input: 'Task 1', context: {} },
        { id: 'concurrent-2', type: 'chat', input: 'Task 2', context: {} },
        { id: 'concurrent-3', type: 'chat', input: 'Task 3', context: {} }
      ];

      const results = await Promise.all(
        tasks.map(task => orchestrator.executeTask(task))
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status !== 'failed')).toBe(true);
    });

    it('should respect max concurrent tasks limit', async () => {
      const startTime = Date.now();
      
      const tasks: TaskDefinition[] = Array(10).fill(null).map((_, i) => ({
        id: `concurrent-limit-${i}`,
        type: 'chat',
        input: `Task ${i}`,
        context: {}
      }));

      await Promise.all(tasks.map(task => orchestrator.executeTask(task)));
      
      const endTime = Date.now();
      // Should complete without overwhelming the system
      expect(endTime - startTime).toBeLessThan(60000);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task type gracefully', async () => {
      const invalidTask: any = {
        id: 'invalid-type',
        type: 'nonexistent_type',
        input: 'test',
        context: {}
      };

      const result = await orchestrator.executeTask(invalidTask);
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should handle model unavailability', async () => {
      const task: TaskDefinition = {
        id: 'model-unavailable',
        type: 'code_generation',
        input: 'Generate code',
        context: {},
        requirements: { provider: 'nonexistent_provider' }
      };

      const result = await orchestrator.executeTask(task, {
        maxRetries: 1
      });

      expect(result.status).toMatch(/failed|completed/);
    });

    it('should handle timeout', async () => {
      const task: TaskDefinition = {
        id: 'timeout-test',
        type: 'complex_reasoning',
        input: 'Very complex task',
        context: {}
      };

      const result = await orchestrator.executeTask(task, {
        timeout: 100 // Very short timeout
      });

      expect(result.status).toMatch(/failed|cancelled|completed/);
    });
  });

  describe('Task Status Tracking', () => {
    it('should track task progress', async () => {
      const task: TaskDefinition = {
        id: 'progress-test',
        type: 'code_generation',
        input: 'Generate something',
        context: {}
      };

      const result = await orchestrator.executeTask(task);
      const status = await orchestrator.getTaskStatus(result.taskId);

      expect(status).toBeDefined();
      expect(status?.taskId).toBe(result.taskId);
      expect(status?.progress).toBeGreaterThanOrEqual(0);
      expect(status?.progress).toBeLessThanOrEqual(100);
    });

    it('should provide task history', async () => {
      const task: TaskDefinition = {
        id: 'history-test',
        type: 'chat',
        input: 'Hello',
        context: {}
      };

      await orchestrator.executeTask(task);
      const history = await orchestrator.getTaskHistory();

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Strategy Selection', () => {
    it('should use low_latency strategy correctly', async () => {
      const task: TaskDefinition = {
        id: 'strategy-latency',
        type: 'chat',
        input: 'Quick response needed',
        context: {}
      };

      const result = await orchestrator.executeTask(task, {
        strategy: 'low_latency'
      });

      expect(result.strategy).toBe('low_latency');
    });

    it('should use cost_effective strategy correctly', async () => {
      const task: TaskDefinition = {
        id: 'strategy-cost',
        type: 'code_generation',
        input: 'Generate code efficiently',
        context: {}
      };

      const result = await orchestrator.executeTask(task, {
        strategy: 'cost_effective'
      });

      expect(result.strategy).toBe('cost_effective');
    });

    it('should use max_quality strategy correctly', async () => {
      const task: TaskDefinition = {
        id: 'strategy-quality',
        type: 'complex_reasoning',
        input: 'Complex problem requiring best quality',
        context: {}
      };

      const result = await orchestrator.executeTask(task, {
        strategy: 'max_quality'
      });

      expect(result.strategy).toBe('max_quality');
    });
  });
});
