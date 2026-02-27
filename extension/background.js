// Background Service Worker for Native Messaging
const NATIVE_HOST_NAME = "com.discord.richpresence.webapp";

let currentTab = null;
let currentActivity = null;
let nativePort = null;
let reconnectTimer = null;

// Connect to native host
function connectNative() {
  if (nativePort) {
    return;
  }

  console.log('[Background] Connecting to native host...');
  
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    
    nativePort.onMessage.addListener((message) => {
      console.log('[Background] Received from native:', message);
      
      if (message.type === 'connected') {
        console.log('[Background] Native host connected successfully');
        // Restore activity if we had one
        if (currentActivity) {
          sendToNative({ type: 'setActivity', activity: currentActivity });
        }
      } else if (message.type === 'error') {
        console.error('[Background] Native host error:', message.error);
      }
    });
    
    nativePort.onDisconnect.addListener(() => {
      console.log('[Background] Native host disconnected:', chrome.runtime.lastError);
      nativePort = null;
      
      // Try to reconnect after 5 seconds
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        connectNative();
      }, 5000);
    });
  } catch (error) {
    console.error('[Background] Failed to connect to native host:', error);
    nativePort = null;
    
    // Retry connection
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => {
      connectNative();
    }, 5000);
  }
}

// Send message to native host
function sendToNative(message) {
  if (!nativePort) {
    console.log('[Background] Not connected to native host, connecting...');
    connectNative();
    // Queue the message
    setTimeout(() => sendToNative(message), 1000);
    return;
  }
  
  try {
    console.log('[Background] Sending to native:', message);
    nativePort.postMessage(message);
  } catch (error) {
    console.error('[Background] Error sending to native:', error);
    nativePort = null;
  }
}

// Update activity based on current tab
async function updateActivity(tab) {
  if (!tab || !tab.url) {
    return;
  }

  currentTab = tab;
  
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    // Get stored apps configuration
    const result = await chrome.storage.sync.get(['apps']);
    const apps = result.apps || {};
    
    // Check if current site has a configuration
    let appConfig = null;
    for (const [pattern, config] of Object.entries(apps)) {
      if (hostname.includes(pattern) || pattern.includes(hostname)) {
        appConfig = config;
        break;
      }
    }
    
    if (appConfig && appConfig.enabled !== false) {
      // This is a registered app - set activity
      
      // Build activity object
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
      
      currentActivity = {
        clientId: appConfig.clientId || '1234567890123456789',
        activity: activity
      };
      
      console.log('[Background] Setting activity:', currentActivity);
      sendToNative({ type: 'setActivity', activity: currentActivity });
      
      // Update badge to show active
      chrome.action.setBadgeText({ text: '●', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#43b581', tabId: tab.id });
    } else {
      // This is NOT a registered app
      // Don't clear activity - keep the last one active!
      console.log('[Background] Not a registered app, keeping current activity');
      
      // Update badge to show inactive on this tab
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }
  } catch (error) {
    console.error('[Background] Error updating activity:', error);
  }
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateActivity(tab);
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateActivity(tab);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);
  
  if (message.type === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ tab: tabs[0] });
      }
    });
    return true; // Async response
  } else if (message.type === 'updateActivity') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        updateActivity(tabs[0]);
      }
    });
    sendResponse({ success: true });
  } else if (message.type === 'testConnection') {
    sendToNative({ type: 'ping' });
    sendResponse({ success: true });
  } else if (message.type === 'clearActivity') {
    currentActivity = null;
    sendToNative({ type: 'clearActivity' });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.action.setBadgeText({ text: '', tabId: tabs[0].id });
      }
    });
    sendResponse({ success: true });
  }
  
  return false;
});

// Initialize
console.log('[Background] Service worker started');
connectNative();

// Update activity for current tab on startup
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    updateActivity(tabs[0]);
  }
});
