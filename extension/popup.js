const ORGN_DOMAINS = ['orgn.com', 'cde.orgn.com'];

const $ = (id) => document.getElementById(id);
let timerInterval = null;

// ── Init ─────────────────────────────────────────────────────────

async function init() {
  // 1. Check desktop app connection
  try {
    const status = await sendMessage({ type: 'getConnectionStatus' }, 2000);
    setDesktopStatus(status?.desktopAppConnected || false);

    if (status?.orgnSessionActive) {
      showActiveView(status);
    }
  } catch (e) {
    setDesktopStatus(false);
  }

  // 2. Check current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const hostname = new URL(tab.url).hostname;
      const isOrgn = ORGN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));

      if (isOrgn) {
        const orgnState = await sendMessage({ type: 'getOrgnState' }, 2000);
        showActiveView({
          orgnSessionStart: orgnState?.sessionStart,
          lastState: orgnState?.lastState
        });
        setOrgnStatus(true);
        showCurrentPage(tab.title, tab.url);
      } else {
        showInactiveView();
        setOrgnStatus(false);
      }
    }
  } catch (e) {
    showInactiveView();
  }

  // 3. Buttons
  $('resetSessionBtn')?.addEventListener('click', async () => {
    await sendMessage({ type: 'resetSession' });
    init();
  });

  $('clearActivityBtn')?.addEventListener('click', async () => {
    await sendMessage({ type: 'clearActivity' });
    showInactiveView();
    setOrgnStatus(false);
  });
}

// ── Views ────────────────────────────────────────────────────────

function showActiveView(status) {
  $('activeView').classList.remove('hidden');
  $('inactiveView').classList.add('hidden');

  if (status?.lastState) {
    const [details, state] = status.lastState.split('|');
    $('actDetails').textContent = details || '--';
    $('actState').textContent = state || '--';
  }

  if (status?.orgnSessionStart) {
    startTimer(status.orgnSessionStart);
  }
}

function showInactiveView() {
  $('activeView').classList.add('hidden');
  $('inactiveView').classList.remove('hidden');
  stopTimer();
}

function showCurrentPage(title, url) {
  try {
    const hostname = new URL(url).hostname;
    $('actPage').textContent = hostname;
    $('actPage').title = title;
  } catch (e) { /* ignore */ }
}

// ── Status pills ─────────────────────────────────────────────────

function setDesktopStatus(connected) {
  const el = $('desktopStatus');
  const text = $('desktopStatusText');
  el.className = connected ? 'status-pill connected' : 'status-pill disconnected';
  text.textContent = 'Desktop App';
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
}

function updateTimer(startTimestamp) {
  const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  $('sessionTimer').textContent =
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0');
}

// ── Messaging ────────────────────────────────────────────────────

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

// ── Start ────────────────────────────────────────────────────────

init();
