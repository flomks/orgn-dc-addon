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

  // 5. Buttons
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

// ── Start ────────────────────────────────────────────────────────

init();
