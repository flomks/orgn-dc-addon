// ── DOM References ────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const discordStatusBadge = $('discordStatusBadge');
const discordStatusBadgeText = $('discordStatusText');
const extensionStatusBadge = $('extensionStatusBadge');
const extensionStatusBadgeText = $('extensionStatusText');
const discordStatusValue = $('discordStatus');
const discordUserValue = $('discordUser');
const currentActivityEl = $('currentActivity');
const logsContainer = $('logsContainer');
const autoScrollLogs = $('autoScrollLogs');
const logCountEl = $('logCount');
const viewTitle = $('viewTitle');

const views = {
  dashboard: $('dashboardView'),
  logs: $('logsView'),
  test: $('testView'),
  settings: $('settingsView')
};

const viewTitles = {
  dashboard: 'Dashboard',
  logs: 'Logs',
  test: 'Test',
  settings: 'Settings'
};

// ── Navigation ───────────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', async () => {
    const view = item.dataset.view;

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    Object.values(views).forEach(v => v.classList.remove('active'));
    views[view].classList.add('active');
    viewTitle.textContent = viewTitles[view] || view;

    if (view === 'settings') await loadSettingsView();
    if (view === 'test') await loadTestView();
  });
});

// ── Status Badges ────────────────────────────────────────────────

function setDiscordStatus(connected, user) {
  if (connected) {
    discordStatusBadge.className = 'status-badge connected';
    discordStatusBadgeText.textContent = user ? `Discord: ${user.username}` : 'Discord: Connected';
    discordStatusValue.textContent = 'Connected';
    discordUserValue.textContent = user ? `${user.username}#${user.discriminator}` : '—';
  } else {
    discordStatusBadge.className = 'status-badge disconnected';
    discordStatusBadgeText.textContent = 'Discord: Disconnected';
    discordStatusValue.textContent = 'Disconnected';
    discordUserValue.textContent = '—';
  }
}

function setExtensionStatus(connected) {
  if (connected) {
    extensionStatusBadge.className = 'status-badge connected';
    extensionStatusBadgeText.textContent = 'Extension: Connected';
  } else {
    extensionStatusBadge.className = 'status-badge disconnected';
    extensionStatusBadgeText.textContent = 'Extension: Waiting';
  }
}

// ── IPC Event Listeners ──────────────────────────────────────────

window.electron.onLog((log) => {
  addLogEntry(log);
  updateLogCount();
});

window.electron.onDiscordConnected((user) => {
  setDiscordStatus(true, user);
});

window.electron.onDiscordDisconnected(() => {
  setDiscordStatus(false);
});

window.electron.onDiscordError((error) => {
  console.error('Discord error:', error);
});

window.electron.onActivitySet((activity) => {
  // onActivitySet receives the flat activity object { details, state, ... }
  updateActivityDisplay(activity);
});

window.electron.onActivityCleared(() => {
  clearActivityDisplay();
});

window.electron.onActivityError((error) => {
  console.error('Activity error:', error);
});

window.electron.onExtensionMessage((data) => {
  if (data.type === 'connected') {
    setExtensionStatus(true);
  } else if (data.type === 'disconnected') {
    setExtensionStatus(false);
  }
});

// ── Dashboard Buttons ────────────────────────────────────────────

$('clearActivityBtn').addEventListener('click', async () => {
  const result = await window.electron.clearActivity();
  if (!result.success) console.error('Clear failed:', result.error);
});

$('testConnectionBtn').addEventListener('click', async () => {
  let clientId = $('testClientId')?.value?.trim();
  if (!clientId) {
    clientId = await window.electron.getClientId();
    if (!clientId) clientId = '1234567890123456789';
  }
  const result = await window.electron.testConnection(clientId);
  if (!result.success) console.error('Test failed:', result.error);
});

// ── Logs ─────────────────────────────────────────────────────────

$('clearLogsBtn').addEventListener('click', async () => {
  await window.electron.clearLogs();
  logsContainer.innerHTML = '';
  updateLogCount();
});

function addLogEntry(log) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">${log.timestamp}</span>
    <span class="log-level log-level-${log.level}">${log.level}</span>
    <span class="log-message">${escapeHtml(log.message)}</span>
  `;
  logsContainer.appendChild(entry);

  if (autoScrollLogs.checked) {
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  while (logsContainer.children.length > 1000) {
    logsContainer.removeChild(logsContainer.firstChild);
  }
}

function updateLogCount() {
  const count = logsContainer.children.length;
  if (logCountEl) logCountEl.textContent = `${count} log${count !== 1 ? 's' : ''}`;
}

// ── Activity Display ─────────────────────────────────────────────

function updateActivityDisplay(activity) {
  if (!activity) { clearActivityDisplay(); return; }

  currentActivityEl.innerHTML = `
    <div class="info-row"><span class="info-label">Details</span><span class="info-value">${escapeHtml(activity.details || '—')}</span></div>
    <div class="info-row"><span class="info-label">State</span><span class="info-value">${escapeHtml(activity.state || '—')}</span></div>
    <div class="info-row"><span class="info-label">Large Image</span><span class="info-value">${escapeHtml(activity.largeImageKey || '—')}</span></div>
    ${activity.startTimestamp ? `<div class="info-row"><span class="info-label">Started</span><span class="info-value">${new Date(activity.startTimestamp).toLocaleTimeString()}</span></div>` : ''}
  `;
}

function clearActivityDisplay() {
  currentActivityEl.innerHTML = '<div class="empty-state"><div class="empty-state-title">No activity</div></div>';
}

// ── Test Form ────────────────────────────────────────────────────

$('testForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  let clientId = $('testClientId').value.trim();
  if (!clientId) clientId = await window.electron.getClientId();

  const activityData = {
    clientId,
    activity: {
      details: $('testDetails').value,
      state: $('testState').value,
      startTimestamp: Date.now(),
      largeImageKey: $('testLargeImageKey').value,
      largeImageText: $('testLargeImageText').value,
      instance: false
    }
  };

  const result = await window.electron.setActivity(activityData);
  if (!result.success) console.error('Set activity failed:', result.error);
});

$('clearTestActivityBtn').addEventListener('click', async () => {
  await window.electron.clearActivity();
});

async function loadTestView() {
  try {
    const storedId = await window.electron.getClientId();
    const input = $('testClientId');
    if (storedId) {
      input.value = storedId;
    } else {
      input.value = '';
      input.placeholder = 'No ID stored - enter one or set in Settings';
    }
  } catch (e) { console.error('loadTestView error:', e); }
}

// ── Settings ─────────────────────────────────────────────────────

async function loadSettingsView() {
  try {
    const storedId = await window.electron.getClientId();
    $('globalClientId').value = storedId || '';
    $('currentKeyStatus').textContent = storedId ? 'Key stored securely' : 'No key stored';

    const appSettings = await window.electron.getAppSettings();
    $('quitOnClose').checked = appSettings.quitOnClose || false;

    const autostart = await window.electron.getAutostart();
    const toggle = $('autostartToggle');
    if (autostart.isDevelopment) {
      toggle.checked = false;
      toggle.disabled = true;
    } else {
      toggle.disabled = false;
      toggle.checked = autostart.enabled || false;
    }

    const info = await window.electron.getStorageInfo();
    $('encryptionStatus').textContent = info.encryptionAvailable ? 'Available (safeStorage)' : 'Not available (plaintext)';
    $('storageLocation').textContent = info.encryptionAvailable ? 'Encrypted local storage' : 'Plaintext local storage';
  } catch (e) { console.error('loadSettingsView error:', e); }
}

$('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const clientId = $('globalClientId').value.trim();
  if (!clientId) return;
  if (!/^\d{17,19}$/.test(clientId)) return;

  const result = await window.electron.saveClientId(clientId);
  if (result.success) {
    $('currentKeyStatus').textContent = 'Key stored securely';
  }
});

$('clearStoredKeyBtn').addEventListener('click', async () => {
  if (!confirm('Clear the stored Discord Application ID?')) return;
  const result = await window.electron.saveClientId('');
  if (result.success) {
    $('globalClientId').value = '';
    $('currentKeyStatus').textContent = 'No key stored';
  }
});

$('appSettingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await window.electron.saveAppSettings({ quitOnClose: $('quitOnClose').checked });
});

$('autostartToggle').addEventListener('change', async (e) => {
  const result = await window.electron.setAutostart(e.target.checked);
  if (!result.success) e.target.checked = !e.target.checked;
});

// ── Utility ──────────────────────────────────────────────────────

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Extension status polling ─────────────────────────────────────

async function pollExtensionStatus() {
  try {
    const status = await window.electron.getExtensionStatus();
    setExtensionStatus(status.connected && status.clientCount > 0);
  } catch (e) { /* ignore */ }
}

setInterval(pollExtensionStatus, 5000);

// ── Initialize ───────────────────────────────────────────────────

(async () => {
  const status = await window.electron.getStatus();
  setDiscordStatus(status.connected, status.user);
  setExtensionStatus(status.extensionConnected);

  if (status.activity) updateActivityDisplay(status.activity.activity);

  const logs = await window.electron.getLogs();
  logs.forEach(log => addLogEntry(log));
  updateLogCount();

  await loadTestView();
  pollExtensionStatus();
})();
