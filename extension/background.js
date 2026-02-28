// Background Service Worker - ORGN Discord Bridge
// Focused on tracking ORGN CDE (cde.orgn.com) activity

const WS_URL = 'ws://127.0.0.1:7890';
const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];
const KEEPALIVE_ALARM = 'keepalive';
const KEEPALIVE_INTERVAL = 0.4; // minutes (~24 seconds, under Chrome's 30s limit)

let ws = null;
let desktopAppConnected = false;
let reconnectTimer = null;
let reconnectAttempts = 0;

// Persistent session start time - survives page switches within ORGN
let orgnSessionStart = null;
let lastOrgnState = null;

// ── Service Worker Keep-Alive ────────────────────────────────────
// Chrome kills service workers after ~30s of inactivity.
// An alarm fires periodically to keep it alive and check the WebSocket.

chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_INTERVAL });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // Reconnect if needed
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectToDesktopApp();
    } else {
      // Ping to keep connection alive
      try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) { /* ignore */ }
    }
    // Re-check the active tab
    checkActiveTab();
  }
});

// ── WebSocket Connection ─────────────────────────────────────────

function connectToDesktopApp() {
  if (ws && ws.readyState <= WebSocket.OPEN) return;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[ORGN] Connected to desktop app');
      desktopAppConnected = true;
      reconnectAttempts = 0;
      setBadge('', '#22c55e');
      checkActiveTab();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'error') console.warn('[ORGN] Desktop error:', msg.error);
      } catch (e) { /* ignore */ }
    };

    ws.onclose = () => {
      ws = null;
      desktopAppConnected = false;
      setBadge('!', '#ef4444');
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires after this
    };
  } catch (e) {
    ws = null;
    desktopAppConnected = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000);
  reconnectTimer = setTimeout(() => {
    reconnectAttempts++;
    connectToDesktopApp();
  }, delay);
}

function send(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (e) {
    return false;
  }
}

// ── ORGN Page Detection ──────────────────────────────────────────

function isOrgnDomain(hostname) {
  return ORGN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
}

/**
 * Parse an ORGN CDE page title and URL into structured activity data.
 *
 * Title patterns observed:
 *   "fixes extension - Trial · Orgn CDE"     -> Trial view
 *   "orgn-dc-addon · Orgn CDE"               -> Project overview
 *   "Projects · Orgn CDE"                     -> Projects list
 *   "Orgn CDE"                                -> Dashboard / home
 *
 * URL patterns:
 *   /projects/<uuid>                          -> Project page
 *   /trials/<uuid> or similar                 -> Trial page
 */
function parseOrgnPage(title, url) {
  const result = {
    appName: 'ORGN CDE',
    details: '',
    state: '',
    project: null,
    context: null
  };

  if (!title) return result;

  // Remove the " · Orgn CDE" suffix
  const cleanTitle = title.replace(/\s*·\s*Orgn CDE\s*$/i, '').trim();

  if (!cleanTitle || cleanTitle.toLowerCase() === 'orgn cde') {
    // Dashboard / home
    result.details = 'Dashboard';
    result.state = 'Browsing';
    return result;
  }

  // Check for Trial pattern: "name - Trial"
  const trialMatch = cleanTitle.match(/^(.+?)\s*[-–]\s*Trial$/i);
  if (trialMatch) {
    result.details = trialMatch[1].trim();
    result.state = 'Working on Trial';
    result.context = 'trial';
    return result;
  }

  // Check for other patterns with separator: "name - Type"
  const separatorMatch = cleanTitle.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (separatorMatch) {
    result.details = separatorMatch[1].trim();
    result.state = separatorMatch[2].trim();
    return result;
  }

  // Check URL for project page
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.includes('/projects/')) {
      result.details = cleanTitle;
      result.state = 'Viewing Project';
      result.context = 'project';
      result.project = cleanTitle;
      return result;
    }
  } catch (e) { /* ignore */ }

  // Simple title like "Projects" or a project name
  if (cleanTitle.toLowerCase() === 'projects') {
    result.details = 'Projects';
    result.state = 'Browsing';
  } else {
    // Likely a project name or other page
    result.details = cleanTitle;
    result.state = 'Browsing';
  }

  return result;
}

// ── Activity Management ──────────────────────────────────────────

async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = new URL(tab.url);

    if (!isOrgnDomain(url.hostname)) {
      // Not on ORGN - clear activity but keep session alive
      // (user might just be checking another tab briefly)
      return;
    }

    const parsed = parseOrgnPage(tab.title, tab.url);
    const stateKey = `${parsed.details}|${parsed.state}`;

    // Only send update if something changed
    if (stateKey === lastOrgnState) return;
    lastOrgnState = stateKey;

    // Start session timer if not already running
    if (!orgnSessionStart) {
      // Try to restore from storage first
      const stored = await chrome.storage.local.get(['orgnSessionStart']);
      if (stored.orgnSessionStart) {
        orgnSessionStart = stored.orgnSessionStart;
      } else {
        orgnSessionStart = Date.now();
        await chrome.storage.local.set({ orgnSessionStart });
      }
    }

    // Send activity to desktop app
    send({
      type: 'setActivity',
      activity: {
        details: parsed.details || 'ORGN CDE',
        state: parsed.state || 'Active',
        startTimestamp: orgnSessionStart,
        largeImageKey: 'orgn',
        largeImageText: 'ORGN CDE',
        instance: false
      }
    });

  } catch (e) {
    console.warn('[ORGN] Error checking tab:', e);
  }
}

// Clear session when all ORGN tabs are closed
async function checkOrgnTabsExist() {
  try {
    const tabs = await chrome.tabs.query({});
    const hasOrgn = tabs.some(tab => {
      try {
        return tab.url && isOrgnDomain(new URL(tab.url).hostname);
      } catch (e) { return false; }
    });

    if (!hasOrgn && orgnSessionStart) {
      // No ORGN tabs open - clear session
      orgnSessionStart = null;
      lastOrgnState = null;
      await chrome.storage.local.remove(['orgnSessionStart']);
      send({ type: 'clearActivity' });
    }
  } catch (e) { /* ignore */ }
}

// ── Event Listeners ──────────────────────────────────────────────

chrome.tabs.onActivated?.addListener(() => {
  checkActiveTab();
});

chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    checkActiveTab();
  }
  // Also check title changes (SPAs update title without navigation)
  if (changeInfo.title && tab.active) {
    checkActiveTab();
  }
});

chrome.tabs.onRemoved?.addListener(() => {
  // Check if any ORGN tabs remain
  setTimeout(() => checkOrgnTabsExist(), 500);
});

// Handle messages from popup
chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  if (message.type === 'getConnectionStatus') {
    sendResponse({
      desktopAppConnected,
      orgnSessionActive: !!orgnSessionStart,
      orgnSessionStart,
      lastState: lastOrgnState
    });
  } else if (message.type === 'getOrgnState') {
    sendResponse({
      connected: desktopAppConnected,
      sessionStart: orgnSessionStart,
      lastState: lastOrgnState
    });
  } else if (message.type === 'clearActivity') {
    orgnSessionStart = null;
    lastOrgnState = null;
    chrome.storage.local.remove(['orgnSessionStart']);
    send({ type: 'clearActivity' });
    sendResponse({ success: true });
  } else if (message.type === 'resetSession') {
    orgnSessionStart = Date.now();
    lastOrgnState = null;
    chrome.storage.local.set({ orgnSessionStart });
    checkActiveTab();
    sendResponse({ success: true });
  }
  return true;
});

// ── Badge ────────────────────────────────────────────────────────

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) { /* ignore */ }
}

// ── Startup ──────────────────────────────────────────────────────

// Restore session on service worker restart
(async () => {
  const stored = await chrome.storage.local.get(['orgnSessionStart']);
  if (stored.orgnSessionStart) {
    orgnSessionStart = stored.orgnSessionStart;
  }
  connectToDesktopApp();
})();
