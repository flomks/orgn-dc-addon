/**
 * Tests for DiscordClient class
 */

const DiscordClient = require('../DiscordClient');

// Mock discord-rpc module
jest.mock('discord-rpc', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      login: jest.fn(),
      setActivity: jest.fn(),
      clearActivity: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      user: { username: 'TestUser', discriminator: '1234', id: '123456789' }
    }))
  };
});

describe('DiscordClient', () => {
  let client;
  let mockCallbacks;

  beforeEach(() => {
    mockCallbacks = {
      onReady: jest.fn(),
      onDisconnected: jest.fn(),
      onError: jest.fn(),
      onActivitySet: jest.fn(),
      onActivityCleared: jest.fn(),
      onLog: jest.fn()
    };

    client = new DiscordClient(mockCallbacks);
  });

  afterEach(async () => {
    if (client && !client.isDestroyed) {
      await client.destroy();
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultClient = new DiscordClient();
      expect(defaultClient.reconnectDelay).toBe(3000);
      expect(defaultClient.maxReconnectAttempts).toBe(10);
      expect(defaultClient.isDestroyed).toBe(false);
    });

    it('should initialize with custom options', () => {
      const customClient = new DiscordClient({
        reconnectDelay: 5000,
        maxReconnectAttempts: 5
      });
      expect(customClient.reconnectDelay).toBe(5000);
      expect(customClient.maxReconnectAttempts).toBe(5);
    });

    it('should wrap callbacks with error boundaries', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      
      const clientWithErrorCallback = new DiscordClient({
        onReady: errorCallback
      });

      // This should not throw
      expect(() => {
        clientWithErrorCallback.onReady();
      }).not.toThrow();
    });
  });

  describe('connection status', () => {
    it('should report disconnected initially', () => {
      expect(client.isConnected).toBeFalsy();
    });

    it('should report connecting state', () => {
      client.isConnecting = true;
      expect(client.isConnecting).toBe(true);
    });
  });

  describe('activity validation', () => {
    it('should validate and sanitize activity data', () => {
      const activity = {
        details: 'x'.repeat(200), // Too long
        state: 'Valid state',
        largeImageKey: 'valid_key',
        invalidField: 'should be removed'
      };

      const validated = client.validateActivity(activity);
      
      expect(validated.details).toHaveLength(128);
      expect(validated.state).toBe('Valid state');
      expect(validated.largeImageKey).toBe('valid_key');
      expect(validated.invalidField).toBeUndefined();
    });

    it('should handle empty activity data', () => {
      const validated = client.validateActivity({});
      expect(Object.keys(validated)).toHaveLength(0);
    });

    it('should validate buttons array', () => {
      const activity = {
        buttons: [
          { label: 'Button 1', url: 'https://example.com' },
          { label: 'Button 2', url: 'https://example.org' },
          { label: 'Button 3', url: 'https://example.net' } // Should be removed
        ]
      };

      const validated = client.validateActivity(activity);
      expect(validated.buttons).toBeDefined();
      expect(validated.buttons).toHaveLength(2);
    });
  });

  describe('setActivity', () => {
    it('should reject without clientId', async () => {
      const result = await client.setActivity({ activity: {} });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Client ID is required');
    });

    it('should reject without activity', async () => {
      const result = await client.setActivity({ clientId: '123456789' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Valid activity object is required');
    });
  });

  describe('clearActivity', () => {
    it('should return success when not connected', async () => {
      const result = await client.clearActivity();
      expect(result.success).toBe(true);
      expect(client.currentActivity).toBe(null);
    });
  });

  describe('circuit breaker', () => {
    it('should be closed initially', () => {
      expect(client.isCircuitBreakerOpen()).toBe(false);
    });

    it('should open after threshold failures', () => {
      for (let i = 0; i < client.circuitBreaker.threshold; i++) {
        client.recordFailure();
      }
      expect(client.isCircuitBreakerOpen()).toBe(true);
    });

    it('should close after timeout', () => {
      // Open circuit breaker
      for (let i = 0; i < client.circuitBreaker.threshold; i++) {
        client.recordFailure();
      }
      expect(client.isCircuitBreakerOpen()).toBe(true);

      // Simulate timeout passing
      client.circuitBreaker.lastFailureTime = Date.now() - client.circuitBreaker.timeout - 1000;
      expect(client.isCircuitBreakerOpen()).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should track connection attempts', () => {
      expect(client.metrics.connectionAttempts).toBe(0);
      expect(client.metrics.successfulConnections).toBe(0);
      expect(client.metrics.errors).toBe(0);
    });

    it('should provide connection metrics', () => {
      const metrics = client.connectionMetrics;
      expect(metrics).toHaveProperty('isConnected');
      expect(metrics).toHaveProperty('isConnecting');
      expect(metrics).toHaveProperty('circuitBreakerOpen');
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', async () => {
      client.healthCheckTimer = setTimeout(() => {}, 1000);
      client.reconnectTimer = setTimeout(() => {}, 1000);

      await client.destroy();
      
      expect(client.isDestroyed).toBe(true);
      expect(client.healthCheckTimer).toBe(null);
      expect(client.reconnectTimer).toBe(null);
    });

    it('should be idempotent', async () => {
      await client.destroy();
      await client.destroy(); // Should not throw
      expect(client.isDestroyed).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('should use default client ID', async () => {
      const connectSpy = jest.spyOn(client, 'connect').mockResolvedValue({});
      client.client = { user: { username: 'test', discriminator: '1234' } };

      const result = await client.testConnection();
      expect(connectSpy).toHaveBeenCalledWith('1234567890123456789');
      expect(result.success).toBe(true);
    });
  });
});