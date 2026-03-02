/**
 * Background Service Worker -- ORGN Discord Bridge
 *
 * The content script is the SOLE source of activity state.
 * This worker handles: WebSocket to desktop app, session management,
 * keepalive, and message routing between popup/content script.
 *
 * There is NO tab-title fallback parser. If the content script is not
 * running, no activity is shown -- which is the correct behavior.
 */

const WS_URL = 'ws://127.0.0.1:7890';
const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];
const KEEPALIVE_ALARM = 'keepalive';
const STALE_SESSION_MS = 2 * 60 * 1000;

let ws = null;
let desktopAppConnected = false;
let lastOrgnState = null;

// ── View Labels ────────────────────────────────────────────────────

const VIEW_LABELS = {
  'dashboard': 'Viewing Dashboard',
  'projects-list': 'Browsing Projects',
  'project-detail': 'Viewing Project',
  'project-tasks': 'Viewing Tasks',
  'project-context': 'Viewing Context',
  'project-explorer': 'Browsing Files',
  'project-features': 'Viewing Features',
  'project-security': 'Viewing Security',
  'project-integrations': 'Viewing Integrations',
  'project-usage': 'Viewing Usage',
  'project-settings': 'Project Settings',
  'new-project': 'Creating Project',
  'chat': 'In Chat',
  'chat-trial': 'Working on Trial',
  'trial': 'Working on Trial',
  'settings': 'In Settings',
  'editor': 'In Editor',
  'other': 'Browsing'
};

// ── Keepalive ──────────────────────────────────────────────────────

// Keep the service worker alive and the WebSocket connected.
// 20-second period stays well under Chrome's ~30s shutdown threshold.
chrome.alarms.create(KEEPALIVE_ALARM, { delayInMinutes: 0.05, periodInMinutes: 20 / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  await chrome.storage.local.set({ orgnLastHeartbeat: Date.now() });
  await ensureConnected();
  // Also refresh the active tab so the latest state is re-sent after
  // any period of inactivity where the WebSocket may have dropped.
  refreshActiveTab();
});

// ── WebSocket ──────────────────────────────────────────────────────

async function ensureConnected() {
  if (ws?.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
    return;
  }
  if (ws) { try { ws.close(); } catch { /* ignore */ } ws = null; }

  return new Promise((resolve) => {
    try {
      const socket = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        try { socket.close(); } catch { /* ignore */ }
        desktopAppConnected = false;
        resolve();
      }, 3000);

      socket.onopen = () => { clearTimeout(timeout); ws = socket; desktopAppConnected = true; setBadge('', '#22c55e'); resolve(); };
      socket.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'error') console.warn('[ORGN] Desktop:', m.error); } catch { /* ignore */ } };
      socket.onclose = () => { if (ws === socket) { ws = null; desktopAppConnected = false; setBadge('!', '#ef4444'); } };
      socket.onerror = () => { clearTimeout(timeout); desktopAppConnected = false; setBadge('!', '#ef4444'); resolve(); };
    } catch { desktopAppConnected = false; resolve(); }
  });
}

function send(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try { ws.send(JSON.stringify(msg)); return true; } catch { return false; }
}

// ── Domain Check ───────────────────────────────────────────────────

function isOrgnDomain(hostname) {
  return ORGN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
}

// ── Storage Helpers ────────────────────────────────────────────────

async function isTrackingPaused() {
  return (await chrome.storage.sync.get(['trackingPaused'])).trackingPaused === true;
}

async function getSessionStart() {
  return (await chrome.storage.local.get(['orgnSessionStart'])).orgnSessionStart || null;
}

async function ensureSession() {
  let start = await getSessionStart();
  if (!start) {
    start = Date.now();
    await chrome.storage.local.set({ orgnSessionStart: start });
  }
  return start;
}

// ── Content Script State Handler ───────────────────────────────────
// This is the ONLY path that writes activity to storage and Discord.

function handleContentScriptState(state, sender) {
  if (!state) return;
  chrome.storage.local.set({ orgnContentScriptState: { ...state, receivedAt: Date.now(), tabId: sender?.tab?.id || null } });
  updateActivity(state);
}

async function updateActivity(state) {
  try {
    if (await isTrackingPaused()) return;

    const computed = state.computed || {};
    const orgn = state.orgn || {};
    let details = '';
    let activityState = '';
    let smallImageText = null;

    // Build Discord activity strings
    if (computed.activity === 'chat-trial') {
      details = computed.activityTarget || computed.trialName || 'Chat';
      activityState = 'Trial \u00B7 Editing';
    } else if (computed.activity === 'editing' && computed.activityTarget) {
      details = 'Editing ' + computed.activityTarget;
      smallImageText = computed.language || null;
    } else if (computed.activity === 'terminal') {
      details = 'Using Terminal';
    } else if (computed.activity === 'ide') {
      details = orgn.ideType ? 'In IDE (' + orgn.ideType + ')' : 'In IDE';
    } else if (computed.activity === 'tab' && computed.activityTarget) {
      details = computed.activityTarget;
    } else {
      details = VIEW_LABELS[orgn.currentView] || 'Browsing';
    }

    if (computed.activity !== 'chat-trial') {
      const parts = [];
      if (computed.projectName) parts.push(computed.projectName);
      if (computed.trialName && computed.trialName !== computed.projectName) parts.push(computed.trialName);
      if (computed.gitBranch) parts.push('branch: ' + computed.gitBranch);
      activityState = parts.join(' / ') || 'ORGN CDE';
    }

    // Deduplicate -- include the page URL so switching between two tabs
    // that produce the same activity strings still triggers an update.
    const pageUrl = (state.url && state.url.url) || '';
    const stateKey = pageUrl + '|' + details + '|' + activityState + '|' + (smallImageText || '');
    if (stateKey === lastOrgnState && desktopAppConnected) return;
    lastOrgnState = stateKey;

    const sessionStart = await ensureSession();
    const hideNames = (await chrome.storage.sync.get(['hideNames'])).hideNames === true;

    let displayDetails = details || 'ORGN CDE';
    let displayState = activityState || 'Active';

    if (hideNames) {
      const safe = ['Dashboard', 'Browsing', 'Active', 'In IDE', 'In Editor', 'Using Terminal',
        'Browsing Projects', 'In Settings', 'Viewing Dashboard', 'Working on Trial', 'Viewing Project'];
      if (!safe.some(l => displayDetails.startsWith(l))) displayDetails = 'VibeCoding';
      displayState = 'VibeCoding';
    }

    // Write to storage (popup reads this)
    await chrome.storage.local.set({ orgnLastDetails: details, orgnLastState: activityState });

    // Ensure WebSocket is connected before sending.
    // The service worker may have been asleep and lost the connection.
    await ensureConnected();

    // Send to desktop app
    const activity = {
      details: displayDetails, state: displayState,
      startTimestamp: sessionStart, largeImageKey: 'orgn', largeImageText: 'ORGN CDE', instance: false
    };
    if (smallImageText && !hideNames) activity.smallImageText = smallImageText;
    send({ type: 'setActivity', activity });
  } catch (e) {
    console.warn('[ORGN] Error updating activity:', e);
  }
}

// ── Tab Cleanup ────────────────────────────────────────────────────

async function checkOrgnTabsExist() {
  try {
    const tabs = await chrome.tabs.query({});
    const hasOrgn = tabs.some(t => { try { return t.url && isOrgnDomain(new URL(t.url).hostname); } catch { return false; } });
    if (!hasOrgn) {
      lastOrgnState = null;
      await chrome.storage.local.remove(['orgnSessionStart', 'orgnLastDetails', 'orgnLastState', 'orgnLastHeartbeat']);
      send({ type: 'clearActivity' });
    }
  } catch { /* ignore */ }
}

// ── Active Tab Refresh ─────────────────────────────────────────────
// When the user switches tabs or a page finishes loading, ask the
// content script on the new active tab for fresh state.
//
// IMPORTANT: In Manifest V3, the service worker can be killed at any
// time unless a Chrome API call is pending.  Every async step must
// therefore be anchored to a chrome.* API call (e.g. storage.local.set)
// to extend the SW lifetime.  Plain setTimeout() does NOT keep the
// worker alive.

function requestContentScriptState(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type: 'requestState' }, (resp) => {
        if (chrome.runtime.lastError || !resp?.state) resolve(null);
        else resolve(resp.state);
      });
    } catch { resolve(null); }
  });
}

// Delay that keeps the service worker alive by anchoring to a chrome
// storage write.  Plain setTimeout can be killed by Chrome mid-wait.
function keepAliveDelay(ms) {
  return new Promise((resolve) => {
    setTimeout(async () => {
      // Touch storage to signal Chrome that we're still doing work
      await chrome.storage.local.set({ _swPing: Date.now() });
      resolve();
    }, ms);
  });
}

async function refreshActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;

    let hostname;
    try { hostname = new URL(tab.url).hostname; } catch { return; }
    if (!isOrgnDomain(hostname)) return;

    // Attempt 1: immediate
    let state = await requestContentScriptState(tab.id);
    if (state) { handleContentScriptState(state, { tab }); return; }

    // Attempt 2: wait 250ms for frozen tab to thaw (anchored to chrome API)
    await keepAliveDelay(250);
    state = await requestContentScriptState(tab.id);
    if (state) { handleContentScriptState(state, { tab }); return; }

    // Attempt 3: wait another 500ms
    await keepAliveDelay(500);
    state = await requestContentScriptState(tab.id);
    if (state) { handleContentScriptState(state, { tab }); return; }

    // Content script still unreachable -- try re-injection
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-script.js'] });
      await keepAliveDelay(500);
      state = await requestContentScriptState(tab.id);
      if (state) { handleContentScriptState(state, { tab }); return; }
    } catch { /* injection failed */ }

    // Last resort: build a minimal state from the tab's URL and title
    // so Discord still updates even if the content script is completely dead.
    const fallbackState = buildFallbackState(tab.url, tab.title || '');
    if (fallbackState) {
      handleContentScriptState(fallbackState, { tab });
    }
  } catch { /* ignore */ }
}

// ── Fallback State Builder ─────────────────────────────────────────
// Constructs a minimal state object from tab URL and title, mirroring
// the content script's extraction logic.  Used when the CS is frozen
// or otherwise unreachable after tab switch.

function buildFallbackState(url, title) {
  try {
    const loc = new URL(url);
    const segments = loc.pathname.split('/').filter(Boolean);
    const params = Object.fromEntries(new URLSearchParams(loc.search));

    const segmentAfter = (name) => {
      const i = segments.indexOf(name);
      return i !== -1 && segments[i + 1] ? segments[i + 1] : null;
    };

    // Determine current view
    const pathname = loc.pathname;
    const qTab = params.tab || null;
    let currentView = 'other';
    if (/\/editor\b/i.test(pathname))                   currentView = 'editor';
    else if (/\/projects\/?$/i.test(pathname))           currentView = 'projects-list';
    else if (/\/projects\/[^/]+\/?$/i.test(pathname))    currentView = qTab ? 'project-' + qTab : 'project-detail';
    else if (/\/trials?\//i.test(pathname))              currentView = 'trial';
    else if (/\/new\/?$/i.test(pathname))                currentView = 'new-project';
    else if (/\/chat\/[^/]+/i.test(pathname))            currentView = 'chat-trial';
    else if (/\/chat\/?$/i.test(pathname))               currentView = 'chat';
    else if (/\/settings/i.test(pathname))               currentView = 'settings';
    else if (pathname === '/' || pathname === '')         currentView = 'dashboard';

    // Clean title (strip " · Orgn CDE" etc.)
    const cleanTitle = title
      .replace(/\s*[\u00B7|]\s*Orgn\s*CDE\s*$/i, '')
      .replace(/\s+[-\u2013]\s+Orgn\s*CDE\s*$/i, '')
      .trim();

    // Project name from URL slug
    const slug = segmentAfter('projects');
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const projectName = slug && !UUID_RE.test(slug) ? slug : null;

    // Trial name from title
    const trialMatch = cleanTitle.match(/^(.+?)\s+[-\u2013]\s+Trial$/i);
    const trialName = trialMatch ? trialMatch[1].trim() : (segmentAfter('trials') || null);

    // Build computed
    const computed = {
      projectName,
      trialName,
      activeTab: qTab,
      activeSubtab: params.subtab || null,
      gitBranch: null,
      language: null
    };

    if (currentView === 'chat-trial') {
      computed.activity = 'chat-trial';
      computed.activityTarget = cleanTitle || 'Chat';
    } else if (qTab) {
      const TAB_LABELS = { tasks: 'Viewing Tasks', context: 'Viewing Context', explorer: 'Browsing Files',
        features: 'Viewing Features', security: 'Viewing Security', integrations: 'Viewing Integrations',
        usage: 'Viewing Usage', settings: 'Project Settings' };
      computed.activity = 'tab';
      computed.activityTarget = TAB_LABELS[qTab] || ('Viewing ' + qTab.charAt(0).toUpperCase() + qTab.slice(1));
    } else {
      computed.activity = 'browsing';
      computed.activityTarget = currentView || 'page';
    }

    return {
      timestamp: Date.now(),
      url: { url, hostname: loc.hostname, pathname: loc.pathname },
      title: { raw: title, clean: cleanTitle, parts: {} },
      orgn: { currentView, projectName, trialName, trialStatus: null, isIDE: false, ideType: null, activeTab: qTab, activeSubtab: params.subtab || null },
      computed,
      editor: { hasEditor: false },
      statusBar: { visible: false },
      meta: {},
      _fallback: true
    };
  } catch { return null; }
}

// ── Event Listeners ────────────────────────────────────────────────

chrome.tabs.onActivated?.addListener(() => {
  // Always clear dedup cache on tab switch so the new tab's state goes through,
  // even if it produces the same stateKey as the previous tab.
  lastOrgnState = null;
  refreshActiveTab();
});
chrome.tabs.onUpdated?.addListener((_id, info, tab) => {
  if ((info.status === 'complete' || info.title) && tab.active) refreshActiveTab();
});
chrome.tabs.onRemoved?.addListener(() => setTimeout(checkOrgnTabsExist, 500));

// ── Message Router ─────────────────────────────────────────────────

chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  if (message.type === 'contentScriptState') {
    handleContentScriptState(message.state, sender);
    sendResponse({ acknowledged: true });
    return true;
  }
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(msg) {
  switch (msg.type) {
    case 'getConnectionStatus': {
      await ensureConnected();
      const start = await getSessionStart();
      return { desktopAppConnected, orgnSessionActive: !!start, orgnSessionStart: start, lastState: lastOrgnState };
    }

    case 'clearActivity':
      lastOrgnState = null;
      await chrome.storage.local.remove(['orgnSessionStart', 'orgnLastDetails', 'orgnLastState', 'orgnLastHeartbeat']);
      send({ type: 'clearActivity' });
      return { success: true };

    case 'injectContentScript': {
      if (!msg.tabId) return { success: false, error: 'No tabId provided' };
      try {
        await chrome.scripting.executeScript({ target: { tabId: msg.tabId }, files: ['content-script.js'] });
        return { success: true };
      } catch (e) { return { success: false, error: e.message }; }
    }

    case 'forceRefreshState': {
      // Ask content script directly, run through the activity pipeline
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const csState = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { type: 'requestState' }, (resp) => {
              if (chrome.runtime.lastError) resolve(null);
              else resolve(resp?.state || null);
            });
          });
          if (csState) {
            handleContentScriptState(csState, { tab });
          }
        }
      } catch { /* ignore */ }
      const r = await chrome.storage.local.get(['orgnLastDetails', 'orgnLastState']);
      return { success: true, details: r.orgnLastDetails || null, state: r.orgnLastState || null };
    }

    case 'resetSession': {
      const start = Date.now();
      lastOrgnState = null;
      await chrome.storage.local.set({ orgnSessionStart: start });
      // Immediately re-scrape active tab and push to Discord
      // (needed when privacy toggle changes so the new hideNames value takes effect)
      refreshActiveTab();
      return { success: true, orgnSessionStart: start };
    }

    case 'pauseTracking':
      await chrome.storage.sync.set({ trackingPaused: true });
      send({ type: 'clearActivity' });
      setBadge('||', '#f59e0b');
      return { success: true };

    case 'resumeTracking':
      await chrome.storage.sync.set({ trackingPaused: false });
      lastOrgnState = null;
      setBadge('', '#22c55e');
      // Immediately re-scrape active tab and push to Discord
      refreshActiveTab();
      return { success: true };

    default:
      return { error: 'unknown_type', message: msg.type };
  }
}

// ── Badge ──────────────────────────────────────────────────────────

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch { /* ignore */ }
}

// ── Stale Session Detection ────────────────────────────────────────

async function clearStaleSession() {
  try {
    const s = await chrome.storage.local.get(['orgnLastHeartbeat', 'orgnSessionStart']);
    if (!s.orgnSessionStart) return;
    const gap = Date.now() - (s.orgnLastHeartbeat || 0);
    if (s.orgnLastHeartbeat > 0 && gap > STALE_SESSION_MS) {
      lastOrgnState = null;
      await chrome.storage.local.remove(['orgnSessionStart', 'orgnLastDetails', 'orgnLastState', 'orgnLastHeartbeat']);
    }
    await chrome.storage.local.set({ orgnLastHeartbeat: Date.now() });
  } catch (e) {
    console.warn('[ORGN] Stale session check error:', e);
  }
}

// ── Startup ────────────────────────────────────────────────────────

clearStaleSession().then(() => ensureConnected());
