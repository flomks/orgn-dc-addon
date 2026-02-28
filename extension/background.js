// Background Service Worker - ORGN Discord Bridge
// Focused on tracking ORGN CDE (cde.orgn.com) activity

const WS_URL = 'ws://127.0.0.1:7890';
const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];
const KEEPALIVE_ALARM = 'keepalive';

let ws = null;
let desktopAppConnected = false;
let lastOrgnState = null;

// ── Service Worker Keep-Alive ────────────────────────────────────
// Chrome alarms survive service worker restarts. This fires every ~25s
// to reconnect the WebSocket and re-check the active tab.

chrome.alarms.create(KEEPALIVE_ALARM, {
  delayInMinutes: 0.05,       // first fire in 3 seconds
  periodInMinutes: 25 / 60    // then every 25 seconds
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  await ensureConnected();
  await checkActiveTab();
});

// ── WebSocket Connection ─────────────────────────────────────────

async function ensureConnected() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Already connected - just ping
    try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) { /* ignore */ }
    return;
  }

  // Not connected - try to connect
  if (ws) {
    try { ws.close(); } catch (e) { /* ignore */ }
    ws = null;
  }

  return new Promise((resolve) => {
    try {
      const socket = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        try { socket.close(); } catch (e) { /* ignore */ }
        desktopAppConnected = false;
        resolve();
      }, 3000);

      socket.onopen = () => {
        clearTimeout(timeout);
        ws = socket;
        desktopAppConnected = true;
        setBadge('', '#22c55e');
        resolve();
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'error') console.warn('[ORGN] Desktop error:', msg.error);
        } catch (e) { /* ignore */ }
      };

      socket.onclose = () => {
        if (ws === socket) {
          ws = null;
          desktopAppConnected = false;
          setBadge('!', '#ef4444');
        }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        desktopAppConnected = false;
        setBadge('!', '#ef4444');
        resolve();
      };
    } catch (e) {
      desktopAppConnected = false;
      resolve();
    }
  });
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
 * Parse ORGN CDE page title into structured activity data.
 *
 * Patterns:
 *   "fixes extension - Trial · Orgn CDE"  -> details: "fixes extension", state: "Working on Trial"
 *   "orgn-dc-addon · Orgn CDE"            -> details: "orgn-dc-addon", state: "Viewing Project"  (when URL has /projects/)
 *   "Projects · Orgn CDE"                 -> details: "Projects", state: "Browsing"
 *   "Orgn CDE"                            -> details: "Dashboard", state: "Browsing"
 */
function parseOrgnPage(title, url) {
  const result = { details: '', state: '' };
  if (!title) return result;

  const cleanTitle = title.replace(/\s*[·|]\s*Orgn CDE\s*$/i, '').trim();

  if (!cleanTitle || cleanTitle.toLowerCase() === 'orgn cde') {
    result.details = 'Dashboard';
    result.state = 'Browsing';
    return result;
  }

  // Trial pattern: "name - Trial"
  const trialMatch = cleanTitle.match(/^(.+?)\s*[-–]\s*Trial$/i);
  if (trialMatch) {
    result.details = 'Working on Trial';
    result.state = trialMatch[1].trim();
    return result;
  }

  // Other separator pattern: "name - Type"
  const sepMatch = cleanTitle.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (sepMatch) {
    result.details = sepMatch[1].trim();
    result.state = sepMatch[2].trim();
    return result;
  }

  // URL-based detection
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.includes('/projects/')) {
      result.details = cleanTitle;
      result.state = 'Viewing Project';
      return result;
    }
  } catch (e) { /* ignore */ }

  // Default
  result.details = cleanTitle;
  result.state = 'Browsing';
  return result;
}

// ── Activity Management ──────────────────────────────────────────

async function isTrackingPaused() {
  const stored = await chrome.storage.sync.get(['trackingPaused']);
  return stored.trackingPaused === true;
}

async function checkActiveTab() {
  try {
    // Skip everything if tracking is paused
    if (await isTrackingPaused()) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    let hostname;
    try { hostname = new URL(tab.url).hostname; } catch (e) { return; }

    if (!isOrgnDomain(hostname)) return;

    const parsed = parseOrgnPage(tab.title, tab.url);
    const stateKey = `${parsed.details}|${parsed.state}`;

    // Only send update if something actually changed
    if (stateKey === lastOrgnState && desktopAppConnected) return;
    lastOrgnState = stateKey;

    // Ensure session start exists (persist across SW restarts)
    let sessionStart = await getSessionStart();
    if (!sessionStart) {
      sessionStart = Date.now();
      await chrome.storage.local.set({ orgnSessionStart: sessionStart });
    }

    // Check privacy setting - hide names if disabled
    const privacySettings = await chrome.storage.sync.get(['hideNames']);
    const hideNames = privacySettings.hideNames === true;

    let displayDetails = parsed.details || 'ORGN CDE';
    let displayState = parsed.state || 'Active';

    if (hideNames) {
      // Replace specific names with generic labels
      if (parsed.state && parsed.state !== 'Browsing' && parsed.state !== 'Active') {
        // State contains a name (e.g. trial name) -- hide it
        displayState = 'Working';
      }
      if (parsed.details && !['Dashboard', 'Projects', 'Browsing', 'Working on Trial', 'Viewing Project'].includes(parsed.details)) {
        // Details contains a name -- hide it
        displayDetails = parsed.details.replace(/.+/, () => {
          // Keep the activity type, just hide the name
          if (parsed.details === 'Working on Trial') return 'Working on Trial';
          if (parsed.details === 'Viewing Project') return 'Viewing Project';
          return 'Working';
        });
      }
    }

    // Store current state so popup can read it directly (always store real names for popup)
    await chrome.storage.local.set({
      orgnLastDetails: parsed.details,
      orgnLastState: parsed.state
    });

    send({
      type: 'setActivity',
      activity: {
        details: displayDetails,
        state: displayState,
        startTimestamp: sessionStart,
        largeImageKey: 'orgn',
        largeImageText: 'ORGN CDE',
        instance: false
      }
    });
  } catch (e) {
    console.warn('[ORGN] Error checking tab:', e);
  }
}

async function getSessionStart() {
  const stored = await chrome.storage.local.get(['orgnSessionStart']);
  return stored.orgnSessionStart || null;
}

// Check if any ORGN tabs remain; clear session if none
async function checkOrgnTabsExist() {
  try {
    const tabs = await chrome.tabs.query({});
    const hasOrgn = tabs.some(tab => {
      try { return tab.url && isOrgnDomain(new URL(tab.url).hostname); }
      catch (e) { return false; }
    });

    if (!hasOrgn) {
      lastOrgnState = null;
      await chrome.storage.local.remove([
        'orgnSessionStart', 'orgnLastDetails', 'orgnLastState'
      ]);
      send({ type: 'clearActivity' });
    }
  } catch (e) { /* ignore */ }
}

// ── Event Listeners ──────────────────────────────────────────────

chrome.tabs.onActivated?.addListener(() => checkActiveTab());

chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
  if ((changeInfo.status === 'complete' || changeInfo.title) && tab.active) {
    checkActiveTab();
  }
});

chrome.tabs.onRemoved?.addListener(() => {
  setTimeout(() => checkOrgnTabsExist(), 500);
});

// Messages from popup
chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  handlePopupMessage(message).then(sendResponse);
  return true; // keep channel open for async response
});

async function handlePopupMessage(message) {
  switch (message.type) {
    case 'getConnectionStatus': {
      // Always try to connect first so status is fresh
      await ensureConnected();
      const sessionStart = await getSessionStart();
      return {
        desktopAppConnected,
        orgnSessionActive: !!sessionStart,
        orgnSessionStart: sessionStart,
        lastState: lastOrgnState
      };
    }

    case 'getOrgnState': {
      const sessionStart = await getSessionStart();
      const stored = await chrome.storage.local.get(['orgnLastDetails', 'orgnLastState']);
      return {
        connected: desktopAppConnected,
        sessionStart,
        details: stored.orgnLastDetails || null,
        state: stored.orgnLastState || null
      };
    }

    case 'clearActivity':
      lastOrgnState = null;
      await chrome.storage.local.remove([
        'orgnSessionStart', 'orgnLastDetails', 'orgnLastState'
      ]);
      send({ type: 'clearActivity' });
      return { success: true };

    case 'resetSession': {
      const newStart = Date.now();
      lastOrgnState = null;
      await chrome.storage.local.set({ orgnSessionStart: newStart });
      checkActiveTab();
      return { success: true, orgnSessionStart: newStart };
    }

    case 'pauseTracking':
      await chrome.storage.sync.set({ trackingPaused: true });
      send({ type: 'clearActivity' });
      setBadge('||', '#f59e0b');
      return { success: true };

    case 'resumeTracking':
      await chrome.storage.sync.set({ trackingPaused: false });
      lastOrgnState = null; // force re-send on next check
      setBadge('', '#22c55e');
      checkActiveTab();
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}

// ── Badge ────────────────────────────────────────────────────────

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) { /* ignore */ }
}

// ── Startup ──────────────────────────────────────────────────────

ensureConnected().then(() => checkActiveTab());
