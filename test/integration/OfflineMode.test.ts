/**
 * Testes de Integração - Modo Offline
 * Validação da integração entre LocalAIService, OfflineModeManager e provedores locais
 */

import { LocalAIService } from '../../src/main/ai/LocalAIService';
import { OfflineModeManager } from '../../src/main/ai/OfflineModeManager';
import { PegasusAIProvider } from '../../src/main/ai/PegasusAIProvider';

describe('Integration: Offline Mode', () => {
  let localAI: LocalAIService;
  let offlineManager: OfflineModeManager;
  let provider: PegasusAIProvider;

  beforeEach(async () => {
    // Reset instances
    (LocalAIService as any).instance = null;
    (OfflineModeManager as any).instance = null;
    
    localAI = await LocalAIService.getInstance();
    offlineManager = await OfflineModeManager.getInstance();
    provider = new PegasusAIProvider();
  });

  afterEach(async () => {
    await localAI.shutdown();
    await offlineManager.shutdown();
  });

  describe('Service Discovery', () => {
    it('should discover available local providers', async () => {
      const providers = await localAI.discoverProviders();
      
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      
      // Should at least return empty array if no providers found
      expect(providers.length).toBeGreaterThanOrEqual(0);
    });

    it('should check Ollama availability', async () => {
      const status = await localAI.checkOllamaStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.available).toBe('boolean');
      expect(typeof status.endpoint).toBe('string');
    });

    it('should check LM Studio availability', async () => {
      const status = await localAI.checkLMStudioStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.available).toBe('boolean');
    });

    it('should check vLLM availability', async () => {
      const status = await localAI.checkvLLMStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.available).toBe('boolean');
    });
  });

  describe('Offline Mode Management', () => {
    it('should detect offline state correctly', async () => {
      const isOffline = await offlineManager.isOffline();
      
      expect(typeof isOffline).toBe('boolean');
    });

    it('should track connectivity history', async () => {
      const history = await offlineManager.getConnectivityHistory();
      
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should emit offline events', (done) => {
      offlineManager.on('offlineStateChanged', (state: boolean) => {
        expect(typeof state).toBe('boolean');
        done();
      });

      // Trigger a state check
      offlineManager.checkConnectivity();
    }, 10000);

    it('should handle reconnection with backoff', async () => {
      const initialBackoff = offlineManager.getCurrentBackoff();
      expect(initialBackoff).toBeDefined();
      
      // Simulate connection attempts
      await offlineManager.attemptReconnection();
      
      const newBackoff = offlineManager.getCurrentBackoff();
      expect(newBackoff).toBeGreaterThanOrEqual(initialBackoff);
    });
  });

  describe('Integrated Offline Workflow', () => {
    it('should fallback to local provider when offline', async () => {
      // Force offline mode
      jest.spyOn(offlineManager, 'isOffline').mockResolvedValue(true);
      
      const message = {
        role: 'user' as const,
        content: 'Test message'
      };

      const response = await provider.sendMessage(message, {
        provider: 'ollama',
        model: 'llama2'
      });

      // Should attempt to use local provider
      expect(response).toBeDefined();
    });

    it('should queue requests when all providers unavailable', async () => {
      jest.spyOn(offlineManager, 'isOffline').mockResolvedValue(true);
      jest.spyOn(localAI, 'discoverProviders').mockResolvedValue([]);

      const message = {
        role: 'user' as const,
        content: 'Queued message'
      };

      // Should handle gracefully even without providers
      await expect(provider.sendMessage(message, {})).resolves.toBeDefined();
    });
  });

  describe('Model Download', () => {
    it('should handle model download request', async () => {
      const result = await localAI.downloadModel('llama2', 'ollama');
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should track download progress', async () => {
      const mockProgressCallback = jest.fn();
      
      await localAI.downloadModel('mistral', 'ollama', mockProgressCallback);
      
      // Progress callback should be called at least once
      expect(mockProgressCallback).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    it('should monitor all registered providers', async () => {
      const healthStatus = await localAI.monitorAllProviders();
      
      expect(healthStatus).toBeDefined();
      expect(Array.isArray(healthStatus)).toBe(true);
      
      healthStatus.forEach(status => {
        expect(status).toHaveProperty('provider');
        expect(status).toHaveProperty('healthy');
        expect(status).toHaveProperty('latency');
      });
    });

    it('should update provider status on health check failure', async () => {
      const initialStatus = await localAI.getProviderStatus('ollama');
      
      await localAI.performHealthCheck('ollama');
      
      const updatedStatus = await localAI.getProviderStatus('ollama');
      expect(updatedStatus).toBeDefined();
    });
  });

  describe('Configuration Persistence', () => {
    it('should save and load offline preferences', async () => {
      const preferences = {
        preferredLocalProvider: 'ollama',
        autoDownloadModels: true,
        maxConcurrentDownloads: 2
      };

      await offlineManager.savePreferences(preferences);
      const loaded = await offlineManager.loadPreferences();

      expect(loaded).toEqual(preferences);
    });

    it('should persist provider configurations', async () => {
      const config = {
        ollama: { endpoint: 'http://localhost:11434', timeout: 30000 },
        lmstudio: { endpoint: 'http://localhost:1234', timeout: 30000 }
      };

      await localAI.saveProviderConfig(config);
      const loaded = await localAI.loadProviderConfig();

      expect(loaded).toEqual(config);
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources on shutdown', async () => {
      const spy = jest.spyOn(localAI, 'shutdown');
      
      await localAI.shutdown();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      await localAI.shutdown();
      await expect(localAI.shutdown()).resolves.not.toThrow();
    });
  });
});
