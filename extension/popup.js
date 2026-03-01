const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];
const $ = (id) => document.getElementById(id);
let timerInterval = null;

// ── Init ─────────────────────────────────────────────────────────

async function init() {
  // 1. Read session data directly from storage (survives SW restarts)
  const stored = await chrome.storage.local.get([
    'orgnSessionStart', 'orgnLastDetails', 'orgnLastState'
  ]);

  // 2. Ask background for fresh connection status (this also triggers reconnect)
  let status = null;
  try {
    status = await sendMessage({ type: 'getConnectionStatus' }, 3000);
  } catch (e) {
    // Service worker might be waking up, try once more
    await sleep(500);
    try { status = await sendMessage({ type: 'getConnectionStatus' }, 3000); }
    catch (e2) { /* give up */ }
  }

  setDesktopStatus(status?.desktopAppConnected || false);

  // 3. Check current tab
  let isOnOrgn = false;
  let currentTitle = '';
  let currentUrl = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentUrl = tab.url;
      currentTitle = tab.title || '';
      const hostname = new URL(tab.url).hostname;
      isOnOrgn = ORGN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    }
  } catch (e) { /* ignore */ }

  // 4. Show the right view
  if (isOnOrgn || stored.orgnSessionStart) {
    const details = stored.orgnLastDetails || '--';
    const state = stored.orgnLastState || '--';
    const sessionStart = stored.orgnSessionStart || status?.orgnSessionStart;

    $('actDetails').textContent = details;
    $('actState').textContent = state;

    if (isOnOrgn) {
      try { $('actPage').textContent = new URL(currentUrl).hostname; }
      catch (e) { $('actPage').textContent = '--'; }
      $('actPage').title = currentTitle;
    } else {
      $('actPage').textContent = 'Not in focus';
    }

    setOrgnStatus(isOnOrgn);

    if (sessionStart) {
      startTimer(sessionStart);
    }

    $('activeView').classList.remove('hidden');
    $('inactiveView').classList.add('hidden');
  } else {
    setOrgnStatus(false);
    $('activeView').classList.add('hidden');
    $('inactiveView').classList.remove('hidden');
  }

  // 5. Tracking toggle (persisted in chrome.storage.sync)
  const pauseState = await chrome.storage.sync.get(['trackingPaused']);
  const isPaused = pauseState.trackingPaused === true;
  const toggle = $('trackingToggle');
  toggle.checked = !isPaused;
  updatePauseUI(isPaused);

  toggle.addEventListener('change', async () => {
    const pausing = !toggle.checked;
    try {
      if (pausing) {
        await sendMessage({ type: 'pauseTracking' }, 3000);
      } else {
        await sendMessage({ type: 'resumeTracking' }, 3000);
      }
    } catch (e) {
      // Fallback: write directly to storage if SW is unavailable
      await chrome.storage.sync.set({ trackingPaused: pausing });
    }
    updatePauseUI(pausing);
  });

  // 6. Privacy toggle (persisted in chrome.storage.sync)
  const privacyState = await chrome.storage.sync.get(['hideNames']);
  const namesHidden = privacyState.hideNames === true;
  const privacyToggle = $('privacyToggle');
  privacyToggle.checked = !namesHidden;
  updatePrivacyUI(namesHidden);

  privacyToggle.addEventListener('change', async () => {
    const hiding = !privacyToggle.checked;
    await chrome.storage.sync.set({ hideNames: hiding });
    updatePrivacyUI(hiding);
    // Force activity re-send with new privacy setting
    try { await sendMessage({ type: 'resetSession' }, 3000); } catch (e) { /* ignore */ }
  });

  // 7. Buttons
  $('resetSessionBtn').addEventListener('click', async () => {
    try {
      const result = await sendMessage({ type: 'resetSession' }, 3000);
      if (result?.orgnSessionStart) {
        startTimer(result.orgnSessionStart);
      }
    } catch (e) { /* ignore */ }
  });

  $('clearActivityBtn').addEventListener('click', async () => {
    try { await sendMessage({ type: 'clearActivity' }, 3000); } catch (e) { /* ignore */ }
    stopTimer();
    $('activeView').classList.add('hidden');
    $('inactiveView').classList.remove('hidden');
    setOrgnStatus(false);
  });
}

// ── Pause UI ─────────────────────────────────────────────────────

function updatePauseUI(paused) {
  $('pausedBanner').classList.toggle('hidden', !paused);
  $('toggleSublabel').textContent = paused
    ? 'Discord activity is hidden'
    : 'Activity is shared on Discord';
}

// ── Privacy UI ───────────────────────────────────────────────────

function updatePrivacyUI(hidden) {
  $('privacySublabel').textContent = hidden
    ? 'Only activity type is shown'
    : 'Project and trial names are visible';
}

// ── Status pills ─────────────────────────────────────────────────

function setDesktopStatus(connected) {
  $('desktopStatus').className = connected ? 'status-pill connected' : 'status-pill disconnected';
}

function setOrgnStatus(active) {
  const el = $('orgnStatus');
  const text = $('orgnStatusText');
  if (active) {
    el.className = 'status-pill connected';
    text.textContent = 'ORGN Active';
  } else {
    el.className = 'status-pill inactive';
    text.textContent = 'ORGN';
  }
}

// ── Timer ────────────────────────────────────────────────────────

function startTimer(startTimestamp) {
  stopTimer();
  updateTimer(startTimestamp);
  timerInterval = setInterval(() => updateTimer(startTimestamp), 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  $('sessionTimer').textContent = '00:00:00';
}

function updateTimer(startTimestamp) {
  const elapsed = Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  $('sessionTimer').textContent =
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0');
}

// ── Util ─────────────────────────────────────────────────────────

function sendMessage(message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Diagnostics Panel ────────────────────────────────────────────

let lastDiagState = null; // Holds the last loaded state for export
let diagActiveTab = 'parsed'; // 'parsed' or 'raw'

function initDiagnostics() {
  const toggle = $('diagToggle');
  const panel = $('diagPanel');
  const arrow = $('diagArrow');
  const refreshBtn = $('diagRefresh');
  const exportBtn = $('diagExport');
  const tabParsed = $('diagTabParsed');
  const tabRaw = $('diagTabRaw');

  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const isHidden = panel.classList.toggle('hidden');
    arrow.classList.toggle('open', !isHidden);
    if (!isHidden) {
      loadDiagnostics();
    }
  });

  refreshBtn.addEventListener('click', () => {
    loadDiagnostics();
  });

  exportBtn.addEventListener('click', () => {
    exportStateAsJson();
  });

  // Tab switching
  tabParsed.addEventListener('click', () => {
    diagActiveTab = 'parsed';
    tabParsed.classList.add('active');
    tabRaw.classList.remove('active');
    $('diagContent').classList.remove('hidden');
    $('diagRawContent').classList.add('hidden');
  });

  tabRaw.addEventListener('click', () => {
    diagActiveTab = 'raw';
    tabRaw.classList.add('active');
    tabParsed.classList.remove('active');
    $('diagRawContent').classList.remove('hidden');
    $('diagContent').classList.add('hidden');
  });
}

/**
 * Send a message directly to the content script on the active tab.
 * Returns null if the content script is not reachable.
 */
function sendToContentScript(tabId, message, timeout = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout);
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function loadDiagnostics() {
  const content = $('diagContent');
  const rawContent = $('diagRawContent');
  const exportBtn = $('diagExport');
  if (!content) return;

  content.innerHTML = '<div class="diag-error">Loading...</div>';
  if (rawContent) rawContent.querySelector('.diag-raw-pre').textContent = 'Loading...';
  lastDiagState = null;
  if (exportBtn) exportBtn.disabled = true;

  // 1. Get the active tab
  let tab = null;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab;
  } catch (e) { /* ignore */ }

  if (!tab?.id) {
    content.innerHTML = '<div class="diag-error">No active tab found.</div>';
    return;
  }

  // Check if we are on an ORGN domain
  let hostname = '';
  try { hostname = new URL(tab.url || '').hostname; } catch (e) { /* ignore */ }
  const isOrgn = ORGN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));

  if (!isOrgn) {
    content.innerHTML = '<div class="diag-error">' +
      'Current tab is not on an ORGN domain.<br>' +
      '<span style="color:#52525b;">' + escapeHtml(hostname || 'unknown') + '</span>' +
      '</div>';
    return;
  }

  // 2. Try to reach the content script directly
  let result = await sendToContentScript(tab.id, { type: 'getDiagnostics' });

  // 3. If not reachable, inject it and retry
  if (!result?.state) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      });
      await sleep(600);
      result = await sendToContentScript(tab.id, { type: 'getDiagnostics' });
    } catch (injectErr) {
      // injection failed (e.g. chrome:// page)
    }
  }

  // 4. If still nothing, try cached state from storage
  if (!result?.state) {
    try {
      const stored = await chrome.storage.local.get(['orgnContentScriptState']);
      if (stored.orgnContentScriptState) {
        result = { state: stored.orgnContentScriptState, fromStorage: true };
      }
    } catch (e) { /* ignore */ }
  }

  // 5. Render or show error
  if (result?.state) {
    lastDiagState = result.state;
    if (exportBtn) exportBtn.disabled = false;
    const staleNote = result.fromStorage
      ? '<div class="diag-timestamp" style="color:#f59e0b;">Showing cached data (content script not reachable live)</div>'
      : '';
    renderDiagnostics(content, result.state, staleNote);
    renderRawData(rawContent, result.state);
  } else {
    content.innerHTML = '<div class="diag-error">' +
      'Content script could not be reached.<br>' +
      'Try <strong>reloading the page</strong>, then click Refresh.' +
      '</div>';
    if (rawContent) rawContent.querySelector('.diag-raw-pre').textContent = 'No data available';
  }
}

function exportStateAsJson() {
  if (!lastDiagState) return;

  // Build a descriptive filename from hostname + path
  const url = lastDiagState.url || {};
  const hostname = (url.hostname || 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_');
  const pathname = (url.pathname || '/')
    .replace(/^\//, '')       // strip leading slash
    .replace(/\/$/,  '')       // strip trailing slash
    .replace(/\//g,  '_')     // slashes -> underscores
    .replace(/[^a-zA-Z0-9._-]/g, '_') // sanitize
    || 'root';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = 'orgn-state_' + hostname + '_' + pathname + '_' + timestamp + '.json';

  // Pretty-print the full state
  const json = JSON.stringify(lastDiagState, null, 2);

  // Trigger download via blob URL
  const blob = new Blob([json], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 100);
}

function renderRawData(rawContainer, state) {
  if (!rawContainer) return;
  const pre = rawContainer.querySelector('.diag-raw-pre');
  if (!pre) return;
  try {
    pre.textContent = JSON.stringify(state, null, 2);
  } catch (e) {
    pre.textContent = 'Error serializing state: ' + e.message;
  }
}

function renderDiagnostics(container, state, noteHtml) {
  let html = noteHtml || '';

  // Computed (most important - what Discord will show)
  if (state.computed) {
    html += renderDiagSection('Computed State', {
      'Activity': state.computed.activity,
      'Target': state.computed.activityTarget,
      'Project': state.computed.projectName,
      'Trial': state.computed.trialName,
      'Trial Status': state.computed.trialStatus,
      'Language': state.computed.language,
      'Git Branch': state.computed.gitBranch
    });
  }

  // ORGN-specific
  if (state.orgn) {
    html += renderDiagSection('ORGN CDE', {
      'Project Name': state.orgn.projectName,
      'Trial Name': state.orgn.trialName,
      'Trial Status': state.orgn.trialStatus,
      'Workspace': state.orgn.workspaceName,
      'Current View': state.orgn.currentView,
      'Is IDE': state.orgn.isIDE,
      'IDE Type': state.orgn.ideType,
      'User': state.orgn.userName,
      'Organization': state.orgn.organizationName
    });
  }

  // URL info
  if (state.url) {
    html += renderDiagSection('URL', {
      'Hostname': state.url.hostname,
      'Path': state.url.pathname,
      'Project Slug': state.url.routeInfo?.projectSlug,
      'Trial ID': state.url.routeInfo?.trialId,
      'Workspace ID': state.url.routeInfo?.workspaceId,
      'Is Editor': state.url.routeInfo?.isEditor,
      'Is Settings': state.url.routeInfo?.isSettings,
      'Segments': state.url.pathInfo?.segments?.join(' / ')
    });
  }

  // Title info
  if (state.title) {
    html += renderDiagSection('Title', {
      'Raw': state.title.raw,
      'Clean': state.title.clean,
      'Trial Name': state.title.parts?.trialName,
      'Page Type': state.title.parts?.pageType,
      'Primary': state.title.parts?.primary,
      'Secondary': state.title.parts?.secondary
    });
  }

  // Editor state
  if (state.editor) {
    html += renderDiagSection('Editor', {
      'Has Editor': state.editor.hasEditor,
      'Editor Type': state.editor.editorType,
      'Active File': state.editor.activeFile,
      'Language': state.editor.activeLanguage,
      'Open Tabs': state.editor.openTabs?.length > 0
        ? state.editor.openTabs.slice(0, 5).join(', ') + (state.editor.openTabs.length > 5 ? '...' : '')
        : null,
      'Cursor': state.editor.cursorPosition,
      'VS Code Web': state.editor.isVSCodeWeb,
      'Workspace': state.editor.workspaceName,
      'Has Terminal': state.editor.hasTerminal,
      'Terminal Active': state.editor.terminalActive
    });
  }

  // Status Bar
  if (state.statusBar) {
    html += renderDiagSection('Status Bar', {
      'Visible': state.statusBar.visible,
      'Git': state.statusBar.git,
      'Language': state.statusBar.language,
      'Encoding': state.statusBar.encoding,
      'Items': state.statusBar.items?.length > 0
        ? state.statusBar.items.slice(0, 8).join(' | ')
        : null
    });
  }

  // Sidebar
  if (state.sidebar) {
    html += renderDiagSection('Sidebar', {
      'Visible': state.sidebar.visible,
      'Active Panel': state.sidebar.activePanel,
      'File Tree': state.sidebar.fileTreeVisible,
      'Selected File': state.sidebar.selectedFile
    });
  }

  // Page Elements
  if (state.page) {
    html += renderDiagSection('Page Elements', {
      'Has Navbar': state.page.hasNavbar,
      'Has Breadcrumbs': state.page.hasBreadcrumbs,
      'Has Modal': state.page.hasModal,
      'Has Panel': state.page.hasPanel,
      'Panel Content': state.page.panelContent,
      'Breadcrumbs': state.page.breadcrumbPath?.length > 0
        ? state.page.breadcrumbPath.join(' > ')
        : null,
      'Nav Items': state.page.navItems?.length > 0
        ? state.page.navItems.slice(0, 6).join(', ')
        : null
    });
  }

  // Meta tags (selected)
  if (state.meta) {
    html += renderDiagSection('Meta Tags', {
      'OG Title': state.meta.ogTitle,
      'OG Description': state.meta.ogDescription,
      'OG Site Name': state.meta.ogSiteName,
      'App Name': state.meta.applicationName,
      'Theme Color': state.meta.themeColor,
      'Description': state.meta.description
    });
  }

  // Timestamp
  if (state.timestamp) {
    html += '<div class="diag-timestamp">Extracted: ' + new Date(state.timestamp).toLocaleTimeString() + '</div>';
  }
  if (state.receivedAt) {
    html += '<div class="diag-timestamp">Received by BG: ' + new Date(state.receivedAt).toLocaleTimeString() + '</div>';
  }

  container.innerHTML = html || '<div class="diag-error">No data extracted</div>';
}

function renderDiagSection(title, data) {
  let html = '<div class="diag-section">';
  html += '<div class="diag-section-header">' + escapeHtml(title) + '</div>';

  for (const [key, value] of Object.entries(data)) {
    const displayVal = formatDiagValue(value);
    const valClass = value === true ? ' true' : value === false ? ' false' : (value === null || value === undefined) ? ' null' : '';
    html += '<div class="diag-row">';
    html += '<span class="diag-key">' + escapeHtml(key) + '</span>';
    html += '<span class="diag-val' + valClass + '" title="' + escapeHtml(String(displayVal)) + '">' + escapeHtml(displayVal) + '</span>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function formatDiagValue(value) {
  if (value === null || value === undefined) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number') return String(value);
  return String(value);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Start ────────────────────────────────────────────────────────

init();
initDiagnostics();
