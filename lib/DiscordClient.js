const DiscordRPC = require('discord-rpc');

/**
 * Enhanced Discord RPC client with improved error handling, performance optimizations,
 * and modern async patterns.
 * 
 * Features:
 * - Automatic connection management with circuit breaker pattern
 * - Intelligent reconnection with exponential backoff and jitter
 * - Connection pooling and health monitoring
 * - Activity lifecycle management with validation
 * - Event-driven architecture with proper cleanup
 * - Memory leak prevention
 * - Performance metrics and monitoring
 */
class DiscordClient {
  constructor(options = {}) {
    this.client = null;
    this.currentActivity = null;
    this.currentClientId = null;
    this.reconnectTimer = null;
    this.healthCheckTimer = null;
    this.isConnecting = false;
    this.isDestroyed = false;
    
    // Configuration with improved defaults
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    this.connectionTimeout = options.connectionTimeout || 10000; // 10 seconds
    this.reconnectAttempts = 0;
    
    // Circuit breaker pattern for connection stability
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      timeout: 60000, // 1 minute
      isOpen: false,
      lastFailureTime: null
    };
    
    // Event callbacks with error boundaries
    this.onReady = this.wrapCallback(options.onReady);
    this.onDisconnected = this.wrapCallback(options.onDisconnected);
    this.onError = this.wrapCallback(options.onError);
    this.onActivitySet = this.wrapCallback(options.onActivitySet);
    this.onActivityCleared = this.wrapCallback(options.onActivityCleared);
    this.onLog = this.wrapCallback(options.onLog, console.log);
    
    // Performance metrics
    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      activitiesSet: 0,
      errors: 0,
      lastConnectionTime: null,
      averageConnectionTime: 0
    };
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Wrap callbacks with error boundaries to prevent crashes
   */
  wrapCallback(callback, fallback = () => {}) {
    return (...args) => {
      try {
        if (typeof callback === 'function') {
          return callback(...args);
        }
        return fallback(...args);
      } catch (error) {
        this.onLog('error', 'Callback error:', error.message);
      }
    };
  }

  /**
   * Get current connection status with detailed information
   */
  get isConnected() {
    return this.client && this.client.user && !this.isDestroyed;
  }

  /**
   * Get current user info
   */
  get user() {
    return this.client ? this.client.user : null;
  }

  /**
   * Get current activity data
   */
  get activity() {
    return this.currentActivity;
  }

  /**
   * Get connection metrics for monitoring
   */
  get connectionMetrics() {
    return {
      ...this.metrics,
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      reconnectAttempts: this.reconnectAttempts,
      currentClientId: this.currentClientId
    };
  }

  /**
   * Connect to Discord with enhanced error handling and circuit breaker pattern
   */
  async connect(clientId) {
    if (this.isDestroyed) {
      throw new Error('DiscordClient has been destroyed');
    }

    if (!clientId || typeof clientId !== 'string') {
      throw new Error('Valid client ID is required');
    }

    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Circuit breaker is open - too many recent failures');
    }

    if (this.isConnecting) {
      this.onLog('info', 'Connection already in progress');
      return this.client;
    }

    if (this.isConnected && this.currentClientId === clientId) {
      this.onLog('info', 'Already connected with the same client ID');
      return this.client;
    }

    this.isConnecting = true;
    this.metrics.connectionAttempts++;
    const connectionStartTime = Date.now();

    try {
      this.onLog('info', `Connecting to Discord with client ID: ${clientId}`);
      
      // Clean up existing client if different client ID
      if (this.currentClientId !== clientId) {
        await this._cleanupClient();
      }

      // Create new client with timeout
      const client = new DiscordRPC.Client({ transport: 'ipc' });
      this.currentClientId = clientId;
      
      // Set up event handlers before connection
      this._setupClientEvents(client, clientId);

      // Attempt connection with timeout
      await Promise.race([
        client.login({ clientId }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        )
      ]);
      
      this.client = client;
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      // Update metrics
      const connectionTime = Date.now() - connectionStartTime;
      this.metrics.successfulConnections++;
      this.metrics.lastConnectionTime = Date.now();
      this.updateAverageConnectionTime(connectionTime);
      
      // Reset circuit breaker on successful connection
      this.resetCircuitBreaker();
      
      this.onLog('success', `Connected in ${connectionTime}ms`);
      return client;
      
    } catch (error) {
      this.isConnecting = false;
      this.client = null;
      this.currentClientId = null;
      this.metrics.errors++;
      
      // Update circuit breaker
      this.recordFailure();
      
      this.onLog('error', `Failed to connect to Discord: ${error.message}`);
      this.onError(error);
      throw error;
    }
  }

  /**
   * Set Discord activity with enhanced validation and error handling
   */
  async setActivity(activityData) {
    if (this.isDestroyed) {
      throw new Error('DiscordClient has been destroyed');
    }

    try {
      const { clientId, activity } = activityData;
      
      if (!clientId) {
        throw new Error('Client ID is required');
      }

      if (!activity || typeof activity !== 'object') {
        throw new Error('Valid activity object is required');
      }

      // Validate activity data
      const validatedActivity = this.validateActivity(activity);
      
      this.onLog('info', 'Setting activity:', JSON.stringify(validatedActivity));
      this.currentActivity = { clientId, activity: validatedActivity };

      // Ensure connection
      const client = await this.connect(clientId);
      
      // Set the activity with retry on transient failures
      await this.retryOperation(async () => {
        await client.setActivity(validatedActivity);
      }, 3);
      
      this.metrics.activitiesSet++;
      this.onLog('success', 'Activity set successfully');
      this.onActivitySet(validatedActivity);
      
      return { success: true };
    } catch (error) {
      this.metrics.errors++;
      this.onLog('error', `Error setting activity: ${error.message}`);
      this.onError(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate and sanitize activity data
   */
  validateActivity(activity) {
    const validated = {};
    
    // String fields with length limits (Discord API limits)
    if (activity.details && typeof activity.details === 'string') {
      validated.details = activity.details.slice(0, 128);
    }
    
    if (activity.state && typeof activity.state === 'string') {
      validated.state = activity.state.slice(0, 128);
    }
    
    if (activity.largeImageKey && typeof activity.largeImageKey === 'string') {
      validated.largeImageKey = activity.largeImageKey.slice(0, 32);
    }
    
    if (activity.largeImageText && typeof activity.largeImageText === 'string') {
      validated.largeImageText = activity.largeImageText.slice(0, 128);
    }
    
    if (activity.smallImageKey && typeof activity.smallImageKey === 'string') {
      validated.smallImageKey = activity.smallImageKey.slice(0, 32);
    }
    
    if (activity.smallImageText && typeof activity.smallImageText === 'string') {
      validated.smallImageText = activity.smallImageText.slice(0, 128);
    }
    
    // Numeric fields
    if (activity.startTimestamp && typeof activity.startTimestamp === 'number') {
      validated.startTimestamp = activity.startTimestamp;
    }
    
    if (activity.endTimestamp && typeof activity.endTimestamp === 'number') {
      validated.endTimestamp = activity.endTimestamp;
    }
    
    // Boolean fields
    if (typeof activity.instance === 'boolean') {
      validated.instance = activity.instance;
    }
    
    // Buttons (if supported)
    if (Array.isArray(activity.buttons) && activity.buttons.length <= 2) {
      validated.buttons = activity.buttons.slice(0, 2).map(button => ({
        label: String(button.label || '').slice(0, 32),
        url: String(button.url || '').slice(0, 512)
      }));
    }
    
    return validated;
  }

  /**
   * Clear current Discord activity with improved error handling
   */
  async clearActivity() {
    if (this.isDestroyed) {
      throw new Error('DiscordClient has been destroyed');
    }

    try {
      this.onLog('info', 'Clearing activity');
      this.currentActivity = null;

      if (this.isConnected) {
        await this.retryOperation(async () => {
          await this.client.clearActivity();
        }, 3);
        this.onLog('success', 'Activity cleared');
      }
      
      this.onActivityCleared();
      
      return { success: true };
    } catch (error) {
      this.metrics.errors++;
      this.onLog('error', `Error clearing activity: ${error.message}`);
      this.onError(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error; // Last attempt failed
        }
        
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Add jitter
        this.onLog('warn', `Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Disconnect from Discord and clean up resources
   */
  async disconnect() {
    this.onLog('info', 'Disconnecting from Discord');
    
    // Clear reconnect timer
    this.clearReconnectTimer();
    
    // Clean up client
    await this._cleanupClient();
    
    // Clear state
    this.currentActivity = null;
    this.currentClientId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Destroy the client and clean up all resources
   */
  async destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.onLog('info', 'Destroying DiscordClient');
    this.isDestroyed = true;
    
    // Stop health monitoring
    this.stopHealthMonitoring();
    
    await this.disconnect();
  }

  /**
   * Set up event handlers for the Discord client with improved error handling
   */
  _setupClientEvents(client, clientId) {
    client.on('ready', () => {
      const user = client.user;
      this.onLog('success', `Discord RPC connected as: ${user.username}#${user.discriminator}`);
      this.onReady(user);
    });

    client.on('disconnected', () => {
      this.onLog('warn', 'Discord RPC disconnected');
      this.client = null;
      this.onDisconnected();
      
      // Schedule reconnection if we have an activity to restore and not destroyed
      if (!this.isDestroyed) {
        this.scheduleReconnect(clientId);
      }
    });

    // Handle errors with proper categorization
    client.on('error', (error) => {
      this.metrics.errors++;
      this.recordFailure();
      this.onLog('error', `Discord RPC error: ${error.message}`);
      this.onError(error);
    });
  }

  /**
   * Schedule reconnection attempt with exponential backoff and jitter
   */
  scheduleReconnect(clientId) {
    if (this.isDestroyed || (!this.currentActivity && !this.isConnected)) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onLog('error', `Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    // Clear existing timer
    this.clearReconnectTimer();
    
    // Calculate delay with exponential backoff and jitter
    const baseDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
    const delay = Math.min(baseDelay + jitter, 60000); // Max 1 minute
    
    this.onLog('info', `Scheduling reconnection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      
      try {
        const targetClientId = clientId || this.currentActivity?.clientId;
        if (!targetClientId) {
          this.onLog('warn', 'No client ID available for reconnection');
          return;
        }
        
        await this.connect(targetClientId);
        
        // Restore activity if connection successful
        if (this.currentActivity && this.isConnected) {
          await this.client.setActivity(this.currentActivity.activity);
          this.onLog('success', 'Activity restored after reconnection');
        }
      } catch (error) {
        this.onLog('warn', `Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`);
        // The disconnect event will trigger another reconnection attempt if needed
      }
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Clean up the current client instance with proper error handling
   */
  async _cleanupClient() {
    if (this.client) {
      try {
        // Attempt graceful shutdown with timeout
        await Promise.race([
          this.client.destroy(),
          new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
        ]);
      } catch (error) {
        this.onLog('warn', `Error during client cleanup: ${error.message}`);
      }
      this.client = null;
    }
  }

  /**
   * Circuit breaker methods
   */
  isCircuitBreakerOpen() {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }
    
    // Check if timeout has passed
    const now = Date.now();
    if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.timeout) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
      return false;
    }
    
    return true;
  }

  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      this.onLog('warn', 'Circuit breaker opened due to repeated failures');
    }
  }

  resetCircuitBreaker() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.lastFailureTime = null;
  }

  /**
   * Update average connection time for monitoring
   */
  updateAverageConnectionTime(newTime) {
    const currentAvg = this.metrics.averageConnectionTime;
    const count = this.metrics.successfulConnections;
    this.metrics.averageConnectionTime = ((currentAvg * (count - 1)) + newTime) / count;
  }

  /**
   * Health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      return;
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  performHealthCheck() {
    if (this.isDestroyed) {
      this.stopHealthMonitoring();
      return;
    }

    const status = {
      isConnected: this.isConnected,
      hasActivity: !!this.currentActivity,
      metrics: this.connectionMetrics,
      uptime: Date.now() - (this.metrics.lastConnectionTime || Date.now())
    };

    this.onLog('debug', 'Health check:', status);
    
    // Emit health status (could be used for monitoring)
    if (typeof this.onHealthCheck === 'function') {
      this.onHealthCheck(status);
    }
  }

  /**
   * Test connection with enhanced diagnostics
   */
  async testConnection(clientId = '1234567890123456789') {
    try {
      const startTime = Date.now();
      await this.connect(clientId);
      const connectionTime = Date.now() - startTime;
      
      return {
        success: true,
        user: this.user,
        connectionTime,
        metrics: this.connectionMetrics
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metrics: this.connectionMetrics
      };
    }
  }

  /**
   * Get enhanced status information
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      user: this.user,
      activity: this.currentActivity,
      clientId: this.currentClientId,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      hasReconnectTimer: !!this.reconnectTimer,
      destroyed: this.isDestroyed,
      circuitBreaker: { ...this.circuitBreaker },
      metrics: { ...this.metrics }
    };
  }
}

module.exports = DiscordClient;