/**
 * ORGN Bridge Popup
 *
 * Displays current Discord Rich Presence activity, session timer,
 * tracking/privacy controls, and a diagnostics panel for debugging.
 */

const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];
const $ = (id) => document.getElementById(id);
let timerInterval = null;

// ── Init ─────────────────────────────────────────────────────────

async function init() {
  const stored = await chrome.storage.local.get(['orgnSessionStart', 'orgnLastDetails', 'orgnLastState']);

  // Connection status (also wakes the service worker)
  let status = null;
  try {
    status = await sendMessage({ type: 'getConnectionStatus' }, 3000);
  } catch {
    await sleep(500);
    try { status = await sendMessage({ type: 'getConnectionStatus' }, 3000); } catch { /* give up */ }
  }
  setDesktopStatus(status?.desktopAppConnected || false);

  // Current tab
  let isOnOrgn = false;
  let currentUrl = '';
  let currentTitle = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentUrl = tab.url;
      currentTitle = tab.title || '';
      const hostname = new URL(tab.url).hostname;
      isOnOrgn = ORGN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    }
  } catch { /* ignore */ }

  // Force-refresh state from content script if on ORGN
  if (isOnOrgn) {
    try {
      await sendMessage({ type: 'forceRefreshState' }, 2000);
      const fresh = await chrome.storage.local.get(['orgnLastDetails', 'orgnLastState', 'orgnSessionStart']);
      if (fresh.orgnLastDetails) stored.orgnLastDetails = fresh.orgnLastDetails;
      if (fresh.orgnLastState) stored.orgnLastState = fresh.orgnLastState;
      if (fresh.orgnSessionStart) stored.orgnSessionStart = fresh.orgnSessionStart;
    } catch { /* ignore */ }
  }

  // Show the right view
  if (isOnOrgn || stored.orgnSessionStart) {
    $('actDetails').textContent = stored.orgnLastDetails || '--';
    $('actState').textContent = stored.orgnLastState || '--';

    if (isOnOrgn) {
      try { $('actPage').textContent = new URL(currentUrl).hostname; } catch { $('actPage').textContent = '--'; }
      $('actPage').title = currentTitle;
    } else {
      $('actPage').textContent = 'Not in focus';
    }

    setOrgnStatus(isOnOrgn);
    const sessionStart = stored.orgnSessionStart || status?.orgnSessionStart;
    if (sessionStart) startTimer(sessionStart);

    $('activeView').classList.remove('hidden');
    $('inactiveView').classList.add('hidden');
  } else {
    setOrgnStatus(false);
    $('activeView').classList.add('hidden');
    $('inactiveView').classList.remove('hidden');
  }

  // Tracking toggle
  const isPaused = (await chrome.storage.sync.get(['trackingPaused'])).trackingPaused === true;
  const toggle = $('trackingToggle');
  toggle.checked = !isPaused;
  updatePauseUI(isPaused);

  toggle.addEventListener('change', async () => {
    const pausing = !toggle.checked;
    try { await sendMessage({ type: pausing ? 'pauseTracking' : 'resumeTracking' }, 3000); }
    catch { await chrome.storage.sync.set({ trackingPaused: pausing }); }
    updatePauseUI(pausing);
  });

  // Privacy toggle
  const namesHidden = (await chrome.storage.sync.get(['hideNames'])).hideNames === true;
  const privacyToggle = $('privacyToggle');
  privacyToggle.checked = !namesHidden;
  updatePrivacyUI(namesHidden);

  privacyToggle.addEventListener('change', async () => {
    const hiding = !privacyToggle.checked;
    await chrome.storage.sync.set({ hideNames: hiding });
    updatePrivacyUI(hiding);
    try { await sendMessage({ type: 'resetSession' }, 3000); } catch { /* ignore */ }
  });

  // Buttons
  $('resetSessionBtn').addEventListener('click', async () => {
    try {
      const r = await sendMessage({ type: 'resetSession' }, 3000);
      if (r?.orgnSessionStart) startTimer(r.orgnSessionStart);
    } catch { /* ignore */ }
  });

  $('clearActivityBtn').addEventListener('click', async () => {
    try { await sendMessage({ type: 'clearActivity' }, 3000); } catch { /* ignore */ }
    stopTimer();
    $('activeView').classList.add('hidden');
    $('inactiveView').classList.remove('hidden');
    setOrgnStatus(false);
  });
}

// ── UI Helpers ───────────────────────────────────────────────────

function updatePauseUI(paused) {
  $('pausedBanner').classList.toggle('hidden', !paused);
  $('toggleSublabel').textContent = paused ? 'Discord activity is hidden' : 'Activity is shared on Discord';
}

function updatePrivacyUI(hidden) {
  $('privacySublabel').textContent = hidden ? 'Only activity type is shown' : 'Project and trial names are visible';
}

function setDesktopStatus(connected) {
  $('desktopStatus').className = connected ? 'status-pill connected' : 'status-pill disconnected';
}

function setOrgnStatus(active) {
  $('orgnStatus').className = active ? 'status-pill connected' : 'status-pill inactive';
  $('orgnStatusText').textContent = active ? 'ORGN Active' : 'ORGN';
}

// ── Timer ────────────────────────────────────────────────────────

function startTimer(start) {
  stopTimer();
  const update = () => {
    const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
    $('sessionTimer').textContent =
      String(Math.floor(s / 3600)).padStart(2, '0') + ':' +
      String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' +
      String(s % 60).padStart(2, '0');
  };
  update();
  timerInterval = setInterval(update, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  $('sessionTimer').textContent = '00:00:00';
}

// ── Messaging ───────────────────────────────────────────────────

function sendMessage(msg, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    chrome.runtime.sendMessage(msg, (resp) => {
      clearTimeout(timer);
      chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(resp);
    });
  });
}

function sendToContentScript(tabId, msg, timeout = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ response: null, error: 'timeout' }), timeout);
    try {
      chrome.tabs.sendMessage(tabId, msg, (resp) => {
        clearTimeout(timer);
        chrome.runtime.lastError
          ? resolve({ response: null, error: chrome.runtime.lastError.message })
          : resolve({ response: resp, error: null });
      });
    } catch (e) { clearTimeout(timer); resolve({ response: null, error: e.message }); }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Diagnostics Panel ───────────────────────────────────────────

let lastDiagState = null;

function initDiagnostics() {
  const toggle = $('diagToggle');
  const panel = $('diagPanel');
  const arrow = $('diagArrow');

  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const hidden = panel.classList.toggle('hidden');
    arrow.classList.toggle('open', !hidden);
    if (!hidden) loadDiagnostics();
  });

  $('diagRefresh').addEventListener('click', loadDiagnostics);
  $('diagExport').addEventListener('click', exportStateAsJson);

  $('diagTabParsed').addEventListener('click', () => setDiagTab('parsed'));
  $('diagTabRaw').addEventListener('click', () => setDiagTab('raw'));
}

function setDiagTab(tab) {
  const isParsed = tab === 'parsed';
  $('diagTabParsed').classList.toggle('active', isParsed);
  $('diagTabRaw').classList.toggle('active', !isParsed);
  $('diagContent').classList.toggle('hidden', !isParsed);
  $('diagRawContent').classList.toggle('hidden', isParsed);
}

async function loadDiagnostics() {
  const content = $('diagContent');
  const rawContent = $('diagRawContent');
  const exportBtn = $('diagExport');

  content.innerHTML = '<div class="diag-error">Loading...</div>';
  rawContent.querySelector('.diag-raw-pre').textContent = 'Loading...';
  lastDiagState = null;
  exportBtn.disabled = true;

  // Get active tab
  let tab = null;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { /* ignore */ }
  if (!tab?.id) { content.innerHTML = '<div class="diag-error">No active tab found.</div>'; return; }

  // Try content script directly
  let result = await sendToContentScript(tab.id, { type: 'getDiagnostics' });

  // Inject and retry if needed
  if (!result.response?.state) {
    try {
      const inject = await sendMessage({ type: 'injectContentScript', tabId: tab.id }, 5000);
      if (inject?.success) {
        await sleep(800);
        result = await sendToContentScript(tab.id, { type: 'getDiagnostics' });
      }
    } catch { /* ignore */ }
  }

  // Storage fallback
  if (!result.response?.state) {
    try {
      const stored = await chrome.storage.local.get(['orgnContentScriptState']);
      if (stored.orgnContentScriptState) {
        result = { response: { state: stored.orgnContentScriptState }, error: null };
      }
    } catch { /* ignore */ }
  }

  // Render
  if (result.response?.state) {
    lastDiagState = result.response.state;
    exportBtn.disabled = false;
    renderDiagnostics(content, result.response.state);
    renderRawData(rawContent, result.response.state);
  } else {
    content.innerHTML = '<div class="diag-error">Content script not reachable.<br>Reload the ORGN page and try again.</div>';
    rawContent.querySelector('.diag-raw-pre').textContent = 'No data available.';
  }
}

function exportStateAsJson() {
  if (!lastDiagState) return;
  const u = lastDiagState.url || {};
  const host = (u.hostname || 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = (u.pathname || '/').replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '_').replace(/[^a-zA-Z0-9._-]/g, '_') || 'root';
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = 'orgn-state_' + host + '_' + path + '_' + ts + '.json';

  const blob = new Blob([JSON.stringify(lastDiagState, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function renderRawData(container, state) {
  const pre = container?.querySelector('.diag-raw-pre');
  if (pre) { try { pre.textContent = JSON.stringify(state, null, 2); } catch (e) { pre.textContent = 'Error: ' + e.message; } }
}

function renderDiagnostics(container, state) {
  let html = '';

  if (state.computed) {
    html += renderSection('Computed State', {
      'Activity': state.computed.activity, 'Target': state.computed.activityTarget,
      'Project': state.computed.projectName, 'Active Tab': state.computed.activeTab,
      'Active Subtab': state.computed.activeSubtab, 'Trial': state.computed.trialName,
      'Trial Status': state.computed.trialStatus, 'Language': state.computed.language,
      'Git Branch': state.computed.gitBranch
    });
  }

  if (state.orgn) {
    html += renderSection('ORGN CDE', {
      'Project Name': state.orgn.projectName, 'Trial Name': state.orgn.trialName,
      'Trial Status': state.orgn.trialStatus, 'Workspace': state.orgn.workspaceName,
      'Current View': state.orgn.currentView, 'Active Tab': state.orgn.activeTab,
      'Active Subtab': state.orgn.activeSubtab, 'Is IDE': state.orgn.isIDE,
      'IDE Type': state.orgn.ideType, 'User': state.orgn.userName,
      'Organization': state.orgn.organizationName
    });
  }

  if (state.url) {
    const params = state.url.searchParams ? Object.entries(state.url.searchParams) : [];
    html += renderSection('URL', {
      'Full URL': state.url.url, 'Hostname': state.url.hostname, 'Path': state.url.pathname,
      'Query Params': params.length > 0 ? params.map(([k, v]) => k + '=' + v).join(', ') : null,
      'Project Slug': state.url.routeInfo?.projectSlug, 'Trial ID': state.url.routeInfo?.trialId,
      'Segments': state.url.pathInfo?.segments?.join(' / ')
    });
  }

  if (state.title) {
    html += renderSection('Title', {
      'Raw': state.title.raw, 'Clean': state.title.clean,
      'Trial Name': state.title.parts?.trialName, 'Page Type': state.title.parts?.pageType,
      'Primary': state.title.parts?.primary, 'Secondary': state.title.parts?.secondary
    });
  }

  if (state.editor) {
    html += renderSection('Editor', {
      'Has Editor': state.editor.hasEditor, 'Editor Type': state.editor.editorType,
      'Active File': state.editor.activeFile, 'Language': state.editor.activeLanguage,
      'Open Tabs': state.editor.openTabs?.length > 0 ? state.editor.openTabs.slice(0, 5).join(', ') : null,
      'Cursor': state.editor.cursorPosition, 'VS Code Web': state.editor.isVSCodeWeb,
      'Has Terminal': state.editor.hasTerminal, 'Terminal Active': state.editor.terminalActive
    });
  }

  if (state.statusBar?.visible) {
    html += renderSection('Status Bar', {
      'Git': state.statusBar.git, 'Language': state.statusBar.language, 'Encoding': state.statusBar.encoding
    });
  }

  if (state.meta) {
    html += renderSection('Meta Tags', {
      'Description': state.meta.description, 'OG Title': state.meta.ogTitle,
      'OG Site Name': state.meta.ogSiteName, 'Theme Color': state.meta.themeColor
    });
  }

  if (state.timestamp) {
    html += '<div class="diag-timestamp">Extracted: ' + new Date(state.timestamp).toLocaleTimeString() + '</div>';
  }

  container.innerHTML = html || '<div class="diag-error">No data extracted</div>';
}

function renderSection(title, data) {
  let html = '<div class="diag-section"><div class="diag-section-header">' + esc(title) + '</div>';
  for (const [key, value] of Object.entries(data)) {
    const display = value === null || value === undefined ? 'null' : String(value);
    const cls = value === true ? ' true' : value === false ? ' false' : (value == null) ? ' null' : '';
    html += '<div class="diag-row"><span class="diag-key">' + esc(key) + '</span>' +
      '<span class="diag-val' + cls + '" title="' + esc(display) + '">' + esc(display) + '</span></div>';
  }
  return html + '</div>';
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ── Start ────────────────────────────────────────────────────────

init();
initDiagnostics();
