// Background Service Worker for Native Messaging - Optimized Version
const NATIVE_HOST_NAME = "com.discord.richpresence.webapp";

/**
 * Background service state management
 */
class BackgroundService {
  constructor() {
    this.currentTab = null;
    this.currentActivity = null;
    this.nativePort = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.baseReconnectDelay = 2000; // Start with 2 seconds
    this.messageQueue = [];
    this.isReconnecting = false;
    
    this.initializeEventListeners();
    this.connectNative();
  }

  /**
   * Initialize all event listeners with proper error handling
   */
  initializeEventListeners() {
    // Tab activation listener
    chrome.tabs?.onActivated?.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        await this.updateActivity(tab);
      } catch (error) {
        console.warn('[Background] Error handling tab activation:', error);
      }
    });

    // Tab update listener
    chrome.tabs?.onUpdated?.addListener(async (tabId, changeInfo, tab) => {
      try {
        if (changeInfo.status === 'complete' && tab.active) {
          await this.updateActivity(tab);
        }
      } catch (error) {
        console.warn('[Background] Error handling tab update:', error);
      }
    });

    // Runtime message listener
    chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Service worker lifecycle events
    if (typeof self !== 'undefined' && self.addEventListener) {
      self.addEventListener('install', () => {
        console.log('[Background] Service worker installed');
      });

      self.addEventListener('activate', () => {
        console.log('[Background] Service worker activated');
      });
    }
  }

  /**
   * Connect to native host with exponential backoff retry logic
   */
  async connectNative() {
    if (this.nativePort || this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    console.log('[Background] Connecting to native host...');
    
    try {
      this.nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      this.setupNativePortHandlers();
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      
      // Process any queued messages
      await this.processMessageQueue();
      
    } catch (error) {
      console.error('[Background] Failed to connect to native host:', error);
      this.nativePort = null;
      this.isReconnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Setup native port event handlers
   */
  setupNativePortHandlers() {
    if (!this.nativePort) return;

    this.nativePort.onMessage.addListener((message) => {
      console.log('[Background] Received from native:', message);
      this.handleNativeMessage(message);
    });
    
    this.nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.log('[Background] Native host disconnected:', error?.message || 'Unknown reason');
      this.nativePort = null;
      this.scheduleReconnect();
    });
  }

  /**
   * Handle messages from native host
   */
  handleNativeMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log('[Background] Native host connected successfully');
        // Restore activity if we had one
        if (this.currentActivity) {
          this.sendToNative({ type: 'setActivity', activity: this.currentActivity });
        }
        break;
      case 'error':
        console.error('[Background] Native host error:', message.error);
        break;
      case 'activitySet':
        console.log('[Background] Activity set successfully');
        break;
      case 'activityCleared':
        console.log('[Background] Activity cleared successfully');
        break;
      default:
        console.log('[Background] Unknown message type from native:', message.type);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Background] Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`[Background] Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connectNative();
    }, delay);
  }

  /**
   * Send message to native host with queueing
   */
  async sendToNative(message) {
    if (!this.nativePort) {
      console.log('[Background] Queuing message - not connected to native host');
      this.messageQueue.push(message);
      
      // Try to reconnect
      if (!this.isReconnecting) {
        await this.connectNative();
      }
      return;
    }
    
    try {
      console.log('[Background] Sending to native:', message);
      this.nativePort.postMessage(message);
    } catch (error) {
      console.error('[Background] Error sending to native:', error);
      this.nativePort = null;
      this.messageQueue.push(message);
      this.scheduleReconnect();
    }
  }

  /**
   * Process queued messages
   */
  async processMessageQueue() {
    while (this.messageQueue.length > 0 && this.nativePort) {
      const message = this.messageQueue.shift();
      await this.sendToNative(message);
      // Small delay between messages to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Update activity based on current tab with improved caching and error handling
   */
  async updateActivity(tab) {
    if (!tab || !tab.url) {
      return;
    }

    this.currentTab = tab;
    
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      
      // Skip non-web URLs
      if (!url.protocol.startsWith('http')) {
        return;
      }
      
      // Get stored apps configuration with timeout
      const apps = await this.getStorageWithTimeout('apps', {});
      
      // Find matching configuration with improved pattern matching
      const appConfig = this.findMatchingAppConfig(hostname, apps);
      
      if (appConfig && appConfig.enabled !== false) {
        await this.setActivityForApp(tab, url, appConfig);
      } else {
        // Clear badge for non-configured sites
        await this.setBadge(tab.id, '', '');
        console.log('[Background] Not a registered app, keeping current activity');
      }
    } catch (error) {
      console.error('[Background] Error updating activity:', error);
    }
  }

  /**
   * Find matching app configuration with improved pattern matching
   */
  findMatchingAppConfig(hostname, apps) {
    for (const [pattern, config] of Object.entries(apps)) {
      // Exact match
      if (hostname === pattern) {
        return config;
      }
      
      // Subdomain match (e.g., music.youtube.com matches youtube.com)
      if (hostname.endsWith('.' + pattern)) {
        return config;
      }
      
      // Pattern contains hostname (backward compatibility)
      if (hostname.includes(pattern) || pattern.includes(hostname)) {
        return config;
      }
    }
    return null;
  }

  /**
   * Set activity for a configured app
   */
  async setActivityForApp(tab, url, appConfig) {
    const activity = {
      details: appConfig.details || tab.title,
      state: appConfig.state || url.hostname,
      startTimestamp: Date.now(),
      largeImageKey: appConfig.largeImageKey || 'default',
      largeImageText: appConfig.largeImageText || appConfig.name || tab.title,
      smallImageKey: appConfig.smallImageKey,
      smallImageText: appConfig.smallImageText,
      instance: false,
    };
    
    this.currentActivity = { activity };
    const messageData = { type: 'setActivity', activity };
    
    // Include clientId if configured
    if (appConfig.clientId) {
      messageData.clientId = appConfig.clientId;
      this.currentActivity.clientId = appConfig.clientId;
      console.log('[Background] Setting activity with site-specific client ID:', messageData);
    } else {
      console.log('[Background] Setting activity (using host app default client ID):', messageData);
    }
    
    await this.sendToNative(messageData);
    await this.setBadge(tab.id, '●', '#43b581');
  }

  /**
   * Set extension badge with error handling
   */
  async setBadge(tabId, text, color) {
    try {
      await chrome.action.setBadgeText({ text, tabId });
      if (color) {
        await chrome.action.setBadgeBackgroundColor({ color, tabId });
      }
    } catch (error) {
      console.warn('[Background] Error setting badge:', error);
    }
  }

  /**
   * Get storage data with timeout to prevent hanging
   */
  async getStorageWithTimeout(key, defaultValue, timeout = 5000) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn(`[Background] Storage timeout for key: ${key}`);
        resolve(defaultValue);
      }, timeout);

      chrome.storage.sync.get([key], (result) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          console.warn('[Background] Storage error:', chrome.runtime.lastError);
          resolve(defaultValue);
        } else {
          resolve(result[key] || defaultValue);
        }
      });
    });
  }

  /**
   * Handle runtime messages with improved error handling
   */
  async handleRuntimeMessage(message, sender, sendResponse) {
    console.log('[Background] Received message:', message);
    
    try {
      switch (message.type) {
        case 'getCurrentTab':
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          sendResponse({ tab: tab || null });
          break;
          
        case 'updateActivity':
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (currentTab) {
            await this.updateActivity(currentTab);
          }
          sendResponse({ success: true });
          break;
          
        case 'testConnection':
          await this.sendToNative({ type: 'ping' });
          sendResponse({ success: true });
          break;
          
        case 'clearActivity':
          this.currentActivity = null;
          await this.sendToNative({ type: 'clearActivity' });
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab) {
            await this.setBadge(activeTab.id, '', '');
          }
          sendResponse({ success: true });
          break;
          
        case 'pageVisible':
        case 'titleChanged':
          // Handle content script notifications
          if (sender.tab) {
            await this.updateActivity(sender.tab);
          }
          sendResponse({ success: true });
          break;
          
        default:
          console.warn('[Background] Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Background] Error handling runtime message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Initialize the background service on startup
   */
  async initialize() {
    console.log('[Background] Service worker started');
    
    // Update activity for current tab on startup
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await this.updateActivity(tab);
      }
    } catch (error) {
      console.warn('[Background] Error initializing current tab activity:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.nativePort) {
      try {
        this.nativePort.disconnect();
      } catch (error) {
        console.warn('[Background] Error disconnecting native port:', error);
      }
      this.nativePort = null;
    }
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();
backgroundService.initialize();

// Handle service worker lifecycle
if (typeof self !== 'undefined') {
  self.addEventListener('beforeunload', () => {
    backgroundService.cleanup();
  });
}

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BackgroundService };
}