/**
 * Background Service Worker -- ORGN Discord Bridge
 *
 * Single source of truth for Discord Rich Presence activity.
 * Priority: content script state > tab-title fallback.
 *
 * Architecture:
 *   - Keepalive alarm every 25s: reconnect WebSocket + heartbeat
 *   - Content script sends rich state via 'contentScriptState' messages
 *   - Tab-title fallback only runs when NO content script state exists
 *   - Popup reads activity from chrome.storage.local
 */

const WS_URL = 'ws://127.0.0.1:7890';
const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];
const KEEPALIVE_ALARM = 'keepalive';
const STALE_SESSION_MS = 2 * 60 * 1000;

let ws = null;
let desktopAppConnected = false;
let lastOrgnState = null;
let lastContentScriptState = null;

// ── View Labels ────────────────────────────────────────────────────
// Shared map for converting currentView -> display string.

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

chrome.alarms.create(KEEPALIVE_ALARM, { delayInMinutes: 0.05, periodInMinutes: 25 / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  await chrome.storage.local.set({ orgnLastHeartbeat: Date.now() });
  await ensureConnected();
  await checkActiveTab();
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

// ── Content Script State (primary source) ──────────────────────────

function handleContentScriptState(state, sender) {
  if (!state) return;
  lastContentScriptState = { ...state, receivedAt: Date.now(), tabId: sender?.tab?.id || null };
  chrome.storage.local.set({ orgnContentScriptState: lastContentScriptState });
  updateActivityFromContentScript(state);
}

async function updateActivityFromContentScript(state) {
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

    // Build state string (skip for chat-trial -- already set above)
    if (computed.activity !== 'chat-trial') {
      const parts = [];
      if (computed.projectName) parts.push(computed.projectName);
      if (computed.trialName && computed.trialName !== computed.projectName) parts.push(computed.trialName);
      if (computed.gitBranch) parts.push('branch: ' + computed.gitBranch);
      activityState = parts.join(' / ') || 'ORGN CDE';
    }

    // Deduplicate
    const stateKey = details + '|' + activityState + '|' + (smallImageText || '');
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

    await chrome.storage.local.set({ orgnLastDetails: details, orgnLastState: activityState });

    const activity = {
      details: displayDetails, state: displayState,
      startTimestamp: sessionStart, largeImageKey: 'orgn', largeImageText: 'ORGN CDE', instance: false
    };
    if (smallImageText && !hideNames) activity.smallImageText = smallImageText;
    send({ type: 'setActivity', activity });
  } catch (e) {
    console.warn('[ORGN] Error updating from content script:', e);
  }
}

// ── Tab-Title Fallback (secondary source) ──────────────────────────
// Only used when content script has not sent state recently.

function parseOrgnPage(title, url) {
  const result = { details: '', state: '' };
  if (!title) return result;

  const clean = title
    .replace(/\s*[\u00B7|]\s*Orgn CDE\s*$/i, '')
    .replace(/\s+[-\u2013]\s+Orgn CDE\s*$/i, '')
    .trim();

  if (!clean || clean.toLowerCase() === 'orgn cde') return { details: 'Dashboard', state: 'Browsing' };

  const trialMatch = clean.match(/^(.+?)\s+[-\u2013]\s+Trial$/i);
  if (trialMatch) return { details: 'Working on Trial', state: trialMatch[1].trim() };

  const sepMatch = clean.match(/^(.+?)\s+[-\u2013]\s+(.+)$/);
  if (sepMatch) return { details: sepMatch[1].trim(), state: sepMatch[2].trim() };

  try {
    if (new URL(url).pathname.includes('/projects/')) return { details: clean, state: 'Viewing Project' };
  } catch { /* ignore */ }

  return { details: clean, state: 'Browsing' };
}

async function checkActiveTab() {
  try {
    if (await isTrackingPaused()) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    let hostname;
    try { hostname = new URL(tab.url).hostname; } catch { return; }
    if (!isOrgnDomain(hostname)) return;

    // Defer to content script if it sent state recently (< 30s)
    if (lastContentScriptState) {
      const age = Date.now() - (lastContentScriptState.receivedAt || 0);
      if (age < 30000) return;
    }

    const parsed = parseOrgnPage(tab.title, tab.url);
    const stateKey = parsed.details + '|' + parsed.state;
    if (stateKey === lastOrgnState && desktopAppConnected) return;
    lastOrgnState = stateKey;

    const sessionStart = await ensureSession();
    const hideNames = (await chrome.storage.sync.get(['hideNames'])).hideNames === true;

    let displayDetails = parsed.details || 'ORGN CDE';
    let displayState = parsed.state || 'Active';

    if (hideNames) {
      const safe = ['Dashboard', 'Projects', 'Browsing', 'Active', 'Working on Trial', 'Viewing Project', 'New Project'];
      if (!safe.includes(parsed.state)) displayState = 'VibeCoding';
      if (!safe.includes(parsed.details)) displayDetails = 'VibeCoding';
    }

    await chrome.storage.local.set({ orgnLastDetails: parsed.details, orgnLastState: parsed.state });
    send({
      type: 'setActivity',
      activity: { details: displayDetails, state: displayState, startTimestamp: sessionStart, largeImageKey: 'orgn', largeImageText: 'ORGN CDE', instance: false }
    });
  } catch (e) {
    console.warn('[ORGN] Error checking tab:', e);
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

// ── Event Listeners ────────────────────────────────────────────────

chrome.tabs.onActivated?.addListener(() => checkActiveTab());
chrome.tabs.onUpdated?.addListener((_id, info, tab) => {
  if ((info.status === 'complete' || info.title) && tab.active) checkActiveTab();
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

    case 'getOrgnState': {
      const start = await getSessionStart();
      const s = await chrome.storage.local.get(['orgnLastDetails', 'orgnLastState']);
      return { connected: desktopAppConnected, sessionStart: start, details: s.orgnLastDetails || null, state: s.orgnLastState || null };
    }

    case 'clearActivity':
      lastOrgnState = null;
      await chrome.storage.local.remove(['orgnSessionStart', 'orgnLastDetails', 'orgnLastState', 'orgnLastHeartbeat']);
      send({ type: 'clearActivity' });
      return { success: true };

    case 'getContentScriptState': {
      const cs = await chrome.storage.local.get(['orgnContentScriptState']);
      return { state: cs.orgnContentScriptState || null };
    }

    case 'injectContentScript': {
      if (!msg.tabId) return { success: false, error: 'No tabId provided' };
      try {
        await chrome.scripting.executeScript({ target: { tabId: msg.tabId }, files: ['content-script.js'] });
        return { success: true };
      } catch (e) { return { success: false, error: e.message }; }
    }

    case 'forceRefreshState': {
      // Ask content script directly for fresh state, run through enriched pipeline
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
            const r = await chrome.storage.local.get(['orgnLastDetails', 'orgnLastState']);
            return { success: true, details: r.orgnLastDetails || null, state: r.orgnLastState || null };
          }
        }
      } catch { /* fall through */ }
      // Fallback to tab-title parse
      lastOrgnState = null;
      await checkActiveTab();
      const r = await chrome.storage.local.get(['orgnLastDetails', 'orgnLastState']);
      return { success: true, details: r.orgnLastDetails || null, state: r.orgnLastState || null };
    }

    case 'resetSession': {
      const start = Date.now();
      lastOrgnState = null;
      await chrome.storage.local.set({ orgnSessionStart: start });
      checkActiveTab();
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
      checkActiveTab();
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

clearStaleSession().then(() => ensureConnected()).then(() => checkActiveTab());
