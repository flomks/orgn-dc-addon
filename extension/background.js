// Background Service Worker - ORGN Discord Bridge
// Focused on tracking ORGN CDE (cde.orgn.com) activity

const WS_URL = 'ws://127.0.0.1:7890';
const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];
const KEEPALIVE_ALARM = 'keepalive';

// If the gap between now and the last heartbeat exceeds this threshold (ms),
// we assume the browser / app was closed and the session timer should reset.
// The keepalive alarm fires every ~25 s, so 2 minutes gives plenty of margin.
const STALE_SESSION_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

let ws = null;
let desktopAppConnected = false;
let lastOrgnState = null;
let lastContentScriptState = null; // Rich state from content script

// ── Service Worker Keep-Alive ────────────────────────────────────
// Chrome alarms survive service worker restarts. This fires every ~25s
// to reconnect the WebSocket and re-check the active tab.

chrome.alarms.create(KEEPALIVE_ALARM, {
  delayInMinutes: 0.05,       // first fire in 3 seconds
  periodInMinutes: 25 / 60    // then every 25 seconds
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  // Record a heartbeat so we can detect stale sessions after browser restart
  await chrome.storage.local.set({ orgnLastHeartbeat: Date.now() });
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
      // Generic page titles that are safe to show (not project/trial names)
      const safeLabels = [
        'Dashboard', 'Projects', 'Browsing', 'Active',
        'Working on Trial', 'Viewing Project', 'New Project'
      ];
      if (parsed.state && !safeLabels.includes(parsed.state)) {
        displayState = 'VibeCoding';
      }
      if (parsed.details && !safeLabels.includes(parsed.details)) {
        displayDetails = 'VibeCoding';
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
        'orgnSessionStart', 'orgnLastDetails', 'orgnLastState',
        'orgnLastHeartbeat'
      ]);
      send({ type: 'clearActivity' });
    }
  } catch (e) { /* ignore */ }
}

// ── Content Script State Handling ─────────────────────────────────

function handleContentScriptState(state, sender) {
  if (!state) return;

  lastContentScriptState = {
    ...state,
    receivedAt: Date.now(),
    tabId: sender?.tab?.id || null
  };

  // Store content script state for popup diagnostics
  chrome.storage.local.set({
    orgnContentScriptState: lastContentScriptState
  });

  // Also trigger an activity update with enriched data
  updateActivityFromContentScript(state);
}

async function updateActivityFromContentScript(state) {
  try {
    if (await isTrackingPaused()) return;

    const computed = state.computed || {};
    const orgn = state.orgn || {};
    const editor = state.editor || {};
    const url = state.url || {};

    // Build enriched details and state strings
    let details = '';
    let activityState = '';
    let smallImageKey = null;
    let smallImageText = null;

    // Determine primary activity
    if (computed.activity === 'editing' && computed.activityTarget) {
      details = 'Editing ' + computed.activityTarget;
      if (computed.language) {
        smallImageText = computed.language;
      }
    } else if (computed.activity === 'terminal') {
      details = 'Using Terminal';
    } else if (computed.activity === 'ide') {
      details = 'In IDE';
      if (orgn.ideType) {
        details += ' (' + orgn.ideType + ')';
      }
    } else {
      // Browsing mode - use current view
      const viewLabels = {
        'dashboard': 'Viewing Dashboard',
        'projects-list': 'Browsing Projects',
        'project-detail': 'Viewing Project',
        'trial': 'Working on Trial',
        'settings': 'In Settings',
        'editor': 'In Editor',
        'other': 'Browsing'
      };
      details = viewLabels[orgn.currentView] || 'Browsing';
    }

    // Build state string (project + trial context)
    const parts = [];
    if (computed.projectName) {
      parts.push(computed.projectName);
    }
    if (computed.trialName && computed.trialName !== computed.projectName) {
      parts.push(computed.trialName);
    }
    if (computed.gitBranch) {
      parts.push('branch: ' + computed.gitBranch);
    }
    activityState = parts.join(' / ') || 'ORGN CDE';

    // Check if this represents an actual change
    const stateKey = `${details}|${activityState}|${smallImageText || ''}`;
    if (stateKey === lastOrgnState && desktopAppConnected) return;
    lastOrgnState = stateKey;

    // Get or create session
    let sessionStart = await getSessionStart();
    if (!sessionStart) {
      sessionStart = Date.now();
      await chrome.storage.local.set({ orgnSessionStart: sessionStart });
    }

    // Apply privacy settings
    const privacySettings = await chrome.storage.sync.get(['hideNames']);
    const hideNames = privacySettings.hideNames === true;

    let displayDetails = details || 'ORGN CDE';
    let displayState = activityState || 'Active';

    if (hideNames) {
      const safeLabels = [
        'Dashboard', 'Browsing', 'Active', 'In IDE', 'In Editor',
        'Using Terminal', 'Browsing Projects', 'In Settings',
        'Viewing Dashboard', 'Working on Trial', 'Viewing Project'
      ];
      if (!safeLabels.some(l => displayDetails.startsWith(l))) {
        displayDetails = 'VibeCoding';
      }
      displayState = 'VibeCoding';
    }

    // Store for popup (always real names)
    await chrome.storage.local.set({
      orgnLastDetails: details,
      orgnLastState: activityState
    });

    // Build activity object
    const activity = {
      details: displayDetails,
      state: displayState,
      startTimestamp: sessionStart,
      largeImageKey: 'orgn',
      largeImageText: 'ORGN CDE',
      instance: false
    };

    if (smallImageKey) {
      activity.smallImageKey = smallImageKey;
    }
    if (smallImageText && !hideNames) {
      activity.smallImageText = smallImageText;
    }

    send({
      type: 'setActivity',
      activity
    });
  } catch (e) {
    console.warn('[ORGN] Error updating from content script:', e);
  }
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

// Messages from popup and content scripts
chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  // Content script state updates (from content-script.js)
  if (message.type === 'contentScriptState') {
    handleContentScriptState(message.state, sender);
    sendResponse({ acknowledged: true });
    return true;
  }

  // All other messages (popup, etc.)
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
        'orgnSessionStart', 'orgnLastDetails', 'orgnLastState',
        'orgnLastHeartbeat'
      ]);
      send({ type: 'clearActivity' });
      return { success: true };

    case 'getContentScriptState': {
      // Return the last state received from the content script
      const csState = await chrome.storage.local.get(['orgnContentScriptState']);
      return {
        state: csState.orgnContentScriptState || null,
        lastContentScriptState: lastContentScriptState
      };
    }

    case 'requestContentScriptDiagnostics': {
      // Ask the content script on the active tab for fresh diagnostics
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          return { error: 'No active tab found' };
        }

        // First: try to reach an already-running content script
        const directResult = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { type: 'getDiagnostics' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve(null); // Content script not loaded yet
            } else {
              resolve(response);
            }
          });
        });

        if (directResult?.state) {
          return directResult;
        }

        // Second: content script is not loaded -- inject it programmatically
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-script.js']
          });

          // Give it a moment to initialize and extract
          await new Promise(r => setTimeout(r, 800));

          // Now try again
          const retryResult = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { type: 'getDiagnostics' }, (response) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(response);
              }
            });
          });

          if (retryResult?.state) {
            return retryResult;
          }
        } catch (injectErr) {
          // scripting.executeScript may fail if tab URL is not permitted
          console.warn('[ORGN] Could not inject content script:', injectErr.message);
        }

        // Third: fall back to last stored state
        const csStored = await chrome.storage.local.get(['orgnContentScriptState']);
        if (csStored.orgnContentScriptState) {
          return { state: csStored.orgnContentScriptState, fromStorage: true };
        }

        // Determine a helpful error message
        let hostname = '';
        try { hostname = new URL(tab.url || '').hostname; } catch (e) { /* ignore */ }
        const onOrgn = isOrgnDomain(hostname);

        if (!onOrgn) {
          return { error: 'not_on_orgn', message: 'Current tab is not on an ORGN domain (' + hostname + ')' };
        }
        return { error: 'injection_failed', message: 'Content script could not be loaded. Try reloading the page.' };
      } catch (e) {
        return { error: 'exception', message: e.message };
      }
    }

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
      console.warn('[ORGN] Unknown popup message type:', message.type);
      return { error: 'unknown_message_type', message: 'Unrecognized: ' + message.type };
  }
}

// ── Badge ────────────────────────────────────────────────────────

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) { /* ignore */ }
}

// ── Stale Session Detection ──────────────────────────────────────
// On service-worker (re)start, check if the previous session's heartbeat
// is too old.  If the gap exceeds STALE_SESSION_THRESHOLD_MS the browser
// (or extension) was likely fully closed, so we reset the timer.

async function clearStaleSession() {
  try {
    const stored = await chrome.storage.local.get([
      'orgnLastHeartbeat',
      'orgnSessionStart'
    ]);

    // Nothing to reset if there is no active session
    if (!stored.orgnSessionStart) return;

    const now = Date.now();
    const lastHeartbeat = stored.orgnLastHeartbeat || 0;
    const gap = now - lastHeartbeat;

    if (lastHeartbeat > 0 && gap > STALE_SESSION_THRESHOLD_MS) {
      // Session is stale – clear it so the timer starts fresh
      lastOrgnState = null;
      await chrome.storage.local.remove([
        'orgnSessionStart',
        'orgnLastDetails',
        'orgnLastState',
        'orgnLastHeartbeat'
      ]);
      console.log(
        '[ORGN] Stale session detected (gap: ' +
          Math.round(gap / 1000) +
          ' s). Timer reset.'
      );
    }

    // Write a fresh heartbeat so the threshold starts counting from now
    await chrome.storage.local.set({ orgnLastHeartbeat: now });
  } catch (e) {
    console.warn('[ORGN] Error checking stale session:', e);
  }
}

// ── Startup ──────────────────────────────────────────────────────

clearStaleSession()
  .then(() => ensureConnected())
  .then(() => checkActiveTab());
