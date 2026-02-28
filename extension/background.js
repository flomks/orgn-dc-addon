// Background Service Worker - WebSocket Communication with Desktop App
const WS_URL = 'ws://127.0.0.1:7890';

/**
 * Background service that communicates with the ORGN Discord Bridge desktop app
 * via WebSocket. The desktop app must be running for the extension to work.
 */
class BackgroundService {
  constructor() {
    this.currentTab = null;
    this.currentActivity = null;
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = -1; // Unlimited - keep trying forever
    this.baseReconnectDelay = 3000;
    this.desktopAppConnected = false;
    
    this.initializeEventListeners();
    this.connectToDesktopApp();
  }

  /**
   * Initialize all event listeners
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

    // Runtime message listener (from popup)
    chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse);
      return true;
    });
  }

  /**
   * Connect to the desktop app via WebSocket
   */
  connectToDesktopApp() {
    if (this.ws && this.ws.readyState <= 1) {
      return; // Already connected or connecting
    }

    console.log('[Background] Connecting to desktop app...');
    
    try {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log('[Background] Connected to desktop app');
        this.desktopAppConnected = true;
        this.reconnectAttempts = 0;
        
        // Update badge to show connected state
        this.setGlobalBadge('', '#43b581');
        
        // Check current tab and set activity if needed
        this.refreshCurrentTab();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleDesktopMessage(message);
        } catch (error) {
          console.error('[Background] Failed to parse message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('[Background] Disconnected from desktop app');
        this.ws = null;
        this.desktopAppConnected = false;
        
        // Update badge to show disconnected state
        this.setGlobalBadge('!', '#f04747');
        
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.warn('[Background] WebSocket error');
        // onclose will fire after this, which handles reconnection
      };
      
    } catch (error) {
      console.error('[Background] Failed to create WebSocket:', error);
      this.ws = null;
      this.desktopAppConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle messages from the desktop app
   */
  handleDesktopMessage(message) {
    switch (message.type) {
      case 'welcome':
        console.log('[Background] Desktop app welcome:', 
          message.discordConnected ? 'Discord connected' : 'Discord not connected');
        break;
      case 'pong':
        console.log('[Background] Pong received');
        break;
      case 'activitySet':
        console.log('[Background] Activity set successfully');
        break;
      case 'activityCleared':
        console.log('[Background] Activity cleared');
        break;
      case 'discordConnected':
        console.log('[Background] Discord connected:', message.user?.username);
        break;
      case 'discordDisconnected':
        console.log('[Background] Discord disconnected');
        break;
      case 'error':
        console.error('[Background] Desktop app error:', message.error);
        break;
      default:
        console.log('[Background] Unknown message:', message.type);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff: 3s, 6s, 12s, max 30s, then keep retrying at 30s
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );

    console.log(`[Background] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connectToDesktopApp();
    }, delay);
  }

  /**
   * Send message to desktop app via WebSocket
   */
  sendToDesktopApp(message) {
    if (!this.ws || this.ws.readyState !== 1) {
      console.warn('[Background] Cannot send - not connected to desktop app');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[Background] Error sending message:', error);
      return false;
    }
  }

  /**
   * Refresh current tab activity
   */
  async refreshCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await this.updateActivity(tab);
      }
    } catch (error) {
      console.warn('[Background] Error refreshing current tab:', error);
    }
  }

  /**
   * Update activity based on current tab
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
      
      // Get stored apps configuration
      const apps = await this.getStorageWithTimeout('apps', {});
      
      // Find matching configuration
      const appConfig = this.findMatchingAppConfig(hostname, apps);
      
      if (appConfig && appConfig.enabled !== false) {
        await this.setActivityForApp(tab, url, appConfig);
      } else {
        await this.setBadge(tab.id, '', '');
      }
    } catch (error) {
      console.error('[Background] Error updating activity:', error);
    }
  }

  /**
   * Find matching app configuration
   */
  findMatchingAppConfig(hostname, apps) {
    for (const [pattern, config] of Object.entries(apps)) {
      if (hostname === pattern) {
        return config;
      }
      if (hostname.endsWith('.' + pattern)) {
        return config;
      }
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
    
    if (appConfig.clientId) {
      messageData.clientId = appConfig.clientId;
      this.currentActivity.clientId = appConfig.clientId;
    }
    
    const sent = this.sendToDesktopApp(messageData);
    
    if (sent) {
      await this.setBadge(tab.id, '●', '#43b581');
    } else {
      await this.setBadge(tab.id, '!', '#f04747');
    }
  }

  /**
   * Set extension badge for a specific tab
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
   * Set global badge (no tabId)
   */
  async setGlobalBadge(text, color) {
    try {
      await chrome.action.setBadgeText({ text });
      if (color) {
        await chrome.action.setBadgeBackgroundColor({ color });
      }
    } catch (error) {
      console.warn('[Background] Error setting global badge:', error);
    }
  }

  /**
   * Get storage data with timeout
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
   * Handle runtime messages from popup
   */
  async handleRuntimeMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'getCurrentTab': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          sendResponse({ tab: tab || null });
          break;
        }
        
        case 'getConnectionStatus':
          sendResponse({
            desktopAppConnected: this.desktopAppConnected,
            reconnectAttempts: this.reconnectAttempts
          });
          break;
          
        case 'updateActivity': {
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (currentTab) {
            await this.updateActivity(currentTab);
          }
          sendResponse({ success: true });
          break;
        }
        
        case 'testConnection':
          if (this.desktopAppConnected) {
            this.sendToDesktopApp({ type: 'ping' });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Desktop app is not running. Please start it first.' });
          }
          break;
          
        case 'clearActivity':
          this.currentActivity = null;
          if (this.desktopAppConnected) {
            this.sendToDesktopApp({ type: 'clearActivity' });
          }
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab) {
            await this.setBadge(activeTab.id, '', '');
          }
          sendResponse({ success: true });
          break;
          
        default:
          console.warn('[Background] Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Background] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
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
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.warn('[Background] Error closing WebSocket:', error);
      }
      this.ws = null;
    }
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Handle service worker lifecycle
if (typeof self !== 'undefined') {
  self.addEventListener('beforeunload', () => {
    backgroundService.cleanup();
  });
}
