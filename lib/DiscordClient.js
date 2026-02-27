const DiscordRPC = require('discord-rpc');

/**
 * Centralized Discord RPC client for managing lifecycle and activities.
 * 
 * This class encapsulates all Discord RPC connection logic, reconnection handling,
 * activity management, and provides a clean API for both desktop app and native host.
 * 
 * Features:
 * - Automatic connection management
 * - Intelligent reconnection with backoff
 * - Activity lifecycle management
 * - Event-driven architecture
 * - Error handling and logging
 */
class DiscordClient {
  constructor(options = {}) {
    this.client = null;
    this.currentActivity = null;
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.isDestroyed = false;
    
    // Configuration
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectAttempts = 0;
    
    // Event callbacks
    this.onReady = options.onReady || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onError = options.onError || (() => {});
    this.onActivitySet = options.onActivitySet || (() => {});
    this.onActivityCleared = options.onActivityCleared || (() => {});
    this.onLog = options.onLog || console.log;
  }

  /**
   * Get current connection status
   */
  get isConnected() {
    return this.client && this.client.user;
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
   * Connect to Discord with the specified client ID
   * @param {string} clientId - Discord application client ID
   * @returns {Promise<Object>} Discord client instance
   */
  async connect(clientId) {
    if (this.isDestroyed) {
      throw new Error('DiscordClient has been destroyed');
    }

    if (this.isConnecting) {
      this.onLog('info', 'Connection already in progress');
      return this.client;
    }

    if (this.isConnected) {
      this.onLog('info', 'Already connected to Discord');
      return this.client;
    }

    this.isConnecting = true;

    try {
      this.onLog('info', `Connecting to Discord with client ID: ${clientId}`);
      
      // Clean up existing client
      await this._cleanupClient();

      // Create new client
      const client = new DiscordRPC.Client({ transport: 'ipc' });
      
      // Set up event handlers
      this._setupClientEvents(client, clientId);

      // Attempt connection
      await client.login({ clientId });
      
      this.client = client;
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      return client;
    } catch (error) {
      this.isConnecting = false;
      this.client = null;
      this.onLog('error', `Failed to connect to Discord: ${error.message}`);
      this.onError(error);
      throw error;
    }
  }

  /**
   * Set Discord activity/rich presence
   * @param {Object} activityData - Activity configuration
   * @param {string} activityData.clientId - Discord application client ID
   * @param {Object} activityData.activity - Rich presence activity object
   * @returns {Promise<Object>} Result object with success status
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

      this.onLog('info', 'Setting activity:', JSON.stringify(activity));
      this.currentActivity = activityData;

      // Connect if not connected
      const client = await this.connect(clientId);
      
      // Set the activity
      await client.setActivity(activity);
      
      this.onLog('success', 'Activity set successfully');
      this.onActivitySet(activity);
      
      return { success: true };
    } catch (error) {
      this.onLog('error', `Error setting activity: ${error.message}`);
      this.onError(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear current Discord activity
   * @returns {Promise<Object>} Result object with success status
   */
  async clearActivity() {
    if (this.isDestroyed) {
      throw new Error('DiscordClient has been destroyed');
    }

    try {
      this.onLog('info', 'Clearing activity');
      this.currentActivity = null;

      if (this.isConnected) {
        await this.client.clearActivity();
        this.onLog('success', 'Activity cleared');
      }
      
      this.onActivityCleared();
      
      return { success: true };
    } catch (error) {
      this.onLog('error', `Error clearing activity: ${error.message}`);
      this.onError(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from Discord and clean up resources
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.onLog('info', 'Disconnecting from Discord');
    
    // Clear reconnect timer
    this._clearReconnectTimer();
    
    // Clean up client
    await this._cleanupClient();
    
    // Clear state
    this.currentActivity = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Destroy the client and clean up all resources
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.onLog('info', 'Destroying DiscordClient');
    this.isDestroyed = true;
    
    await this.disconnect();
  }

  /**
   * Set up event handlers for the Discord client
   * @private
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
      
      // Schedule reconnection if we have an activity to restore
      this._scheduleReconnect(clientId);
    });

    // Handle other potential events
    client.on('error', (error) => {
      this.onLog('error', `Discord RPC error: ${error.message}`);
      this.onError(error);
    });
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  _scheduleReconnect(clientId) {
    if (this.isDestroyed || !this.currentActivity) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onLog('error', `Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    // Clear existing timer
    this._clearReconnectTimer();
    
    // Calculate delay with exponential backoff
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    
    this.onLog('info', `Scheduling reconnection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      
      try {
        await this.connect(clientId || this.currentActivity.clientId);
        
        // Restore activity if connection successful
        if (this.currentActivity && this.isConnected) {
          await this.client.setActivity(this.currentActivity.activity);
          this.onLog('success', 'Activity restored after reconnection');
        }
      } catch (error) {
        this.onLog('warn', `Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`);
        // The disconnect event will trigger another reconnection attempt
      }
    }, delay);
  }

  /**
   * Clear reconnection timer
   * @private
   */
  _clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Clean up the current client instance
   * @private
   */
  async _cleanupClient() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        // Ignore cleanup errors
        this.onLog('warn', `Error during client cleanup: ${error.message}`);
      }
      this.client = null;
    }
  }

  /**
   * Test connection with a specific client ID
   * @param {string} clientId - Discord application client ID
   * @returns {Promise<Object>} Result object with success status
   */
  async testConnection(clientId = '1234567890123456789') {
    try {
      await this.connect(clientId);
      return { success: true, user: this.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current status information
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      user: this.user,
      activity: this.currentActivity,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      hasReconnectTimer: !!this.reconnectTimer,
      destroyed: this.isDestroyed
    };
  }
}

module.exports = DiscordClient;