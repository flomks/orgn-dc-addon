#!/usr/bin/env node

/**
 * Optimized Native Messaging Host for Discord Rich Presence
 * 
 * Enhanced version with improved performance, error handling, and modern patterns:
 * - Streaming message parser for better memory efficiency
 * - Message validation and sanitization
 * - Graceful shutdown handling
 * - Enhanced logging and monitoring
 * - Connection state management
 * - Performance optimizations
 */

const DiscordClient = require('../lib/DiscordClient');
const { Transform } = require('stream');

class NativeMessagingHost {
  constructor() {
    this.discordClient = null;
    this.isShuttingDown = false;
    this.messageBuffer = Buffer.alloc(0);
    this.expectedLength = null;
    this.messageQueue = [];
    this.processing = false;
    
    // Statistics for monitoring
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.setupProcess();
    this.initializeDiscordClient();
    this.setupInputStream();
    this.startMainLoop();
  }

  /**
   * Setup process handlers for graceful shutdown
   */
  setupProcess() {
    // Set process title for easier identification
    process.title = 'discord-rpc-native-host';
    
    // Handle process signals gracefully
    const signalHandler = (signal) => {
      this.log('info', `Received ${signal}, shutting down gracefully...`);
      this.shutdown().then(() => process.exit(0));
    };
    
    process.on('SIGINT', signalHandler);
    process.on('SIGTERM', signalHandler);
    process.on('SIGHUP', signalHandler);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.log('error', 'Uncaught exception:', error);
      this.sendMessage({ type: 'error', error: error.message });
      this.shutdown().then(() => process.exit(1));
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.log('error', 'Unhandled rejection at:', promise, 'reason:', reason);
      this.sendMessage({ type: 'error', error: `Unhandled rejection: ${reason}` });
    });

    // Handle stdin end
    process.stdin.on('end', () => {
      this.log('info', 'stdin ended, shutting down...');
      this.shutdown().then(() => process.exit(0));
    });

    process.stdin.on('error', (error) => {
      this.log('error', 'stdin error:', error);
      this.shutdown().then(() => process.exit(1));
    });
  }

  /**
   * Enhanced logging with levels and formatting
   */
  log(level, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [Native Host] [${level.toUpperCase()}]`;
    console.error(prefix, ...args);
  }

  /**
   * Initialize Discord client with enhanced event handlers
   */
  initializeDiscordClient() {
    this.discordClient = new DiscordClient({
      onReady: (user) => {
        this.log('info', `Discord client ready: ${user.username}#${user.discriminator}`);
        this.sendMessage({ type: 'connected', user });
      },
      onDisconnected: () => {
        this.log('warn', 'Discord client disconnected');
        // Don't send message here as it might cause reconnection loops
      },
      onError: (error) => {
        this.log('error', 'Discord client error:', error.message);
        this.sendMessage({ type: 'error', error: error.message });
        this.stats.errors++;
      },
      onActivitySet: (activity) => {
        this.log('info', 'Activity set successfully');
        this.sendMessage({ type: 'activitySet', success: true });
      },
      onActivityCleared: () => {
        this.log('info', 'Activity cleared successfully');
        this.sendMessage({ type: 'activityCleared', success: true });
      },
      onLog: (level, ...args) => {
        this.log(level, '[DiscordClient]', ...args);
      },
      // Health monitoring callback
      onHealthCheck: (status) => {
        this.log('debug', 'Discord client health:', status);
      }
    });
  }

  /**
   * Setup optimized input stream processing
   */
  setupInputStream() {
    // Use readable stream events for better performance
    process.stdin.on('readable', () => {
      this.processInputStream();
    });
  }

  /**
   * Process incoming data stream with buffering
   */
  processInputStream() {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      this.messageBuffer = Buffer.concat([this.messageBuffer, chunk]);
      this.parseMessages();
    }
  }

  /**
   * Parse messages from buffer with proper error handling
   */
  parseMessages() {
    while (this.messageBuffer.length > 0) {
      // Read message length if we don't have it
      if (this.expectedLength === null) {
        if (this.messageBuffer.length < 4) {
          break; // Need more data for length header
        }
        
        this.expectedLength = this.messageBuffer.readUInt32LE(0);
        this.messageBuffer = this.messageBuffer.slice(4);
        
        // Validate message length to prevent memory attacks
        if (this.expectedLength > 1024 * 1024) { // 1MB limit
          this.log('error', `Message too large: ${this.expectedLength} bytes`);
          this.sendMessage({ type: 'error', error: 'Message too large' });
          this.expectedLength = null;
          this.messageBuffer = Buffer.alloc(0);
          return;
        }
      }
      
      // Check if we have the complete message
      if (this.messageBuffer.length < this.expectedLength) {
        break; // Need more data
      }
      
      // Extract message
      const messageBytes = this.messageBuffer.slice(0, this.expectedLength);
      this.messageBuffer = this.messageBuffer.slice(this.expectedLength);
      this.expectedLength = null;
      
      try {
        const messageText = messageBytes.toString('utf-8');
        const message = JSON.parse(messageText);
        this.queueMessage(message);
      } catch (error) {
        this.log('error', 'Failed to parse message:', error.message);
        this.sendMessage({ type: 'error', error: 'Invalid message format' });
        this.stats.errors++;
      }
    }
  }

  /**
   * Queue message for processing to prevent blocking
   */
  queueMessage(message) {
    this.messageQueue.push(message);
    this.stats.messagesReceived++;
    this.processMessageQueue();
  }

  /**
   * Process message queue asynchronously
   */
  async processMessageQueue() {
    if (this.processing || this.messageQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        await this.handleMessage(message);
      }
    } catch (error) {
      this.log('error', 'Error processing message queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Send message to browser extension with enhanced error handling
   */
  sendMessage(message) {
    if (this.isShuttingDown) {
      return;
    }
    
    try {
      // Validate message structure
      if (!message || typeof message !== 'object') {
        throw new Error('Invalid message object');
      }
      
      if (!message.type || typeof message.type !== 'string') {
        throw new Error('Message must have a string type');
      }
      
      const messageJson = JSON.stringify(message);
      const messageBuffer = Buffer.from(messageJson, 'utf-8');
      
      // Check message size
      if (messageBuffer.length > 1024 * 1024) { // 1MB limit
        throw new Error('Response message too large');
      }
      
      const headerBuffer = Buffer.alloc(4);
      headerBuffer.writeUInt32LE(messageBuffer.length, 0);
      
      process.stdout.write(headerBuffer);
      process.stdout.write(messageBuffer);
      
      this.stats.messagesSent++;
      this.log('debug', `Sent message: ${message.type}`);
      
    } catch (error) {
      this.log('error', 'Error sending message:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Validate incoming message structure
   */
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message object');
    }
    
    if (!message.type || typeof message.type !== 'string') {
      throw new Error('Message must have a string type');
    }
    
    // Validate specific message types
    switch (message.type) {
      case 'setActivity':
        if (!message.activity || typeof message.activity !== 'object') {
          throw new Error('setActivity requires activity object');
        }
        break;
      case 'ping':
      case 'clearActivity':
        // These messages don't require additional validation
        break;
      default:
        this.log('warn', `Unknown message type: ${message.type}`);
    }
    
    return true;
  }

  /**
   * Handle incoming message with improved error handling and validation
   */
  async handleMessage(message) {
    this.log('debug', `Received message: ${message.type}`);

    try {
      // Validate message structure
      this.validateMessage(message);
      
      switch (message.type) {
        case 'ping':
          await this.handlePing();
          break;

        case 'setActivity':
          await this.handleSetActivity(message);
          break;

        case 'clearActivity':
          await this.handleClearActivity();
          break;

        case 'getStats':
          await this.handleGetStats();
          break;

        default:
          this.log('warn', `Unknown message type: ${message.type}`);
          this.sendMessage({ 
            type: 'error', 
            error: `Unknown message type: ${message.type}` 
          });
      }
    } catch (error) {
      this.log('error', `Error handling message ${message.type}:`, error.message);
      this.sendMessage({ 
        type: 'error', 
        error: error.message,
        messageType: message.type 
      });
      this.stats.errors++;
    }
  }

  /**
   * Handle ping message with enhanced response
   */
  async handlePing() {
    const response = {
      type: 'pong',
      timestamp: Date.now(),
      stats: this.getBasicStats()
    };
    this.sendMessage(response);
  }

  /**
   * Handle set activity message with validation
   */
  async handleSetActivity(message) {
    const { activity, clientId } = message;
    
    // Use provided clientId or a default one
    const targetClientId = clientId || '1234567890123456789';
    
    const activityData = {
      clientId: targetClientId,
      activity: activity
    };
    
    const result = await this.discordClient.setActivity(activityData);
    
    if (!result.success) {
      this.sendMessage({ type: 'error', error: result.error });
    }
    // Success is handled by the DiscordClient event handler
  }

  /**
   * Handle clear activity message
   */
  async handleClearActivity() {
    const result = await this.discordClient.clearActivity();
    
    if (!result.success) {
      this.sendMessage({ type: 'error', error: result.error });
    }
    // Success is handled by the DiscordClient event handler
  }

  /**
   * Handle stats request
   */
  async handleGetStats() {
    const stats = {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      discord: this.discordClient.getStatus(),
      memory: process.memoryUsage(),
      version: process.version
    };
    
    this.sendMessage({ type: 'stats', stats });
  }

  /**
   * Get basic stats for ping responses
   */
  getBasicStats() {
    return {
      uptime: Date.now() - this.stats.startTime,
      messagesReceived: this.stats.messagesReceived,
      messagesSent: this.stats.messagesSent,
      errors: this.stats.errors,
      connected: this.discordClient.isConnected
    };
  }

  /**
   * Start the main event loop
   */
  startMainLoop() {
    this.log('info', 'Native host started');
    this.log('info', 'Node version:', process.version);
    this.log('info', 'Platform:', process.platform);
    this.log('info', 'Architecture:', process.arch);
    
    // Send initial connected message
    this.sendMessage({ 
      type: 'connected',
      version: '2.0.0',
      capabilities: ['setActivity', 'clearActivity', 'getStats', 'ping']
    });
  }

  /**
   * Graceful shutdown with cleanup
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    this.log('info', 'Shutting down gracefully...');
    
    try {
      // Process any remaining messages
      await this.processMessageQueue();
      
      // Clean up Discord client
      if (this.discordClient) {
        await this.discordClient.destroy();
      }
      
      // Log final stats
      this.log('info', 'Final stats:', this.getBasicStats());
      this.log('info', 'Shutdown complete');
      
    } catch (error) {
      this.log('error', 'Error during shutdown:', error.message);
    }
  }
}

// Create and start the native messaging host
const nativeHost = new NativeMessagingHost();

// Export for testing
module.exports = { NativeMessagingHost };