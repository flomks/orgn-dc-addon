// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const connectionStatusText = connectionStatus.querySelector('.status-text');
const discordStatus = document.getElementById('discordStatus');
const discordUser = document.getElementById('discordUser');
const currentActivity = document.getElementById('currentActivity');
const logsContainer = document.getElementById('logsContainer');
const autoScrollLogs = document.getElementById('autoScrollLogs');
const statusMessage = document.getElementById('statusMessage');
const logCount = document.getElementById('logCount');

// Views
const views = {
  dashboard: document.getElementById('dashboardView'),
  logs: document.getElementById('logsView'),
  test: document.getElementById('testView'),
  settings: document.getElementById('settingsView')
};

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', async () => {
    const viewName = item.dataset.view;
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    // Update view
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
    
    // Handle view-specific activation logic
    if (viewName === 'settings') {
      await loadSettingsView();
    } else if (viewName === 'test') {
      await loadTestView();
    }
  });
});

// Buttons
document.getElementById('clearActivityBtn').addEventListener('click', async () => {
  setStatus('Clearing activity...');
  const result = await window.electron.clearActivity();
  if (result.success) {
    setStatus('Activity cleared');
  } else {
    setStatus('Failed to clear activity: ' + result.error, 'error');
  }
});

document.getElementById('testConnectionBtn').addEventListener('click', async () => {
  setStatus('Testing connection...');
  
  // Use input value or fall back to stored client ID
  let clientId = document.getElementById('testClientId').value.trim();
  if (!clientId) {
    const storedClientId = await window.electron.getClientId();
    clientId = storedClientId || '1234567890123456789';
  }
  
  const result = await window.electron.testConnection(clientId);
  if (result.success) {
    setStatus('Connection successful!');
  } else {
    setStatus('Connection failed: ' + result.error, 'error');
  }
});

document.getElementById('clearLogsBtn').addEventListener('click', async () => {
  await window.electron.clearLogs();
  logsContainer.innerHTML = '';
  updateLogCount();
  setStatus('Logs cleared');
});

// Test Form
document.getElementById('testForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Use input value or fall back to stored client ID
  let clientId = document.getElementById('testClientId').value.trim();
  if (!clientId) {
    const storedClientId = await window.electron.getClientId();
    clientId = storedClientId;
  }
  
  const activityData = {
    clientId: clientId,
    activity: {
      details: document.getElementById('testDetails').value,
      state: document.getElementById('testState').value,
      startTimestamp: Date.now(),
      largeImageKey: document.getElementById('testLargeImageKey').value,
      largeImageText: document.getElementById('testLargeImageText').value,
      instance: false
    }
  };
  
  setStatus('Setting test activity...');
  const result = await window.electron.setActivity(activityData);
  
  if (result.success) {
    setStatus('Test activity set! Check your Discord profile.');
  } else {
    setStatus('Failed to set activity: ' + result.error, 'error');
  }
});

document.getElementById('clearTestActivityBtn').addEventListener('click', async () => {
  const result = await window.electron.clearActivity();
  if (result.success) {
    setStatus('Activity cleared');
  } else {
    setStatus('Failed to clear activity: ' + result.error, 'error');
  }
});

// Extension communication buttons
document.getElementById('waitForExtensionBtn').addEventListener('click', async () => {
  const extensionStatus = document.getElementById('extensionStatus');
  const extensionStatusText = document.getElementById('extensionStatusText');
  
  extensionStatus.style.display = 'block';
  extensionStatusText.innerHTML = '⏳ Waiting for Extension to send a message...<br><small>Open a registered website in your browser</small>';
  
  setStatus('Waiting for Extension ping...');
});

document.getElementById('checkExtensionBtn').addEventListener('click', async () => {
  const status = await window.electron.getExtensionStatus();
  const extensionStatus = document.getElementById('extensionStatus');
  const extensionStatusText = document.getElementById('extensionStatusText');
  
  extensionStatus.style.display = 'block';
  
  if (status.isNativeMessagingMode) {
    if (status.connected && status.lastPing) {
      const timeSince = Math.round(status.timeSinceLastPing / 1000);
      extensionStatusText.innerHTML = `
        ✅ <strong>Extension Connected</strong><br>
        <small>Last message: ${timeSince} seconds ago</small><br>
        <small>Time: ${new Date(status.lastPing).toLocaleTimeString()}</small>
      `;
    } else {
      extensionStatusText.innerHTML = `
        ⚠️ <strong>Extension Not Connected</strong><br>
        <small>Running in Native Messaging Mode but no messages received yet</small><br>
        <small>Try opening a registered website in your browser</small>
      `;
    }
  } else {
    extensionStatusText.innerHTML = `
      ℹ️ <strong>Standalone Mode</strong><br>
      <small>Desktop app was started manually (npm run app)</small><br>
      <small>Extension cannot connect in this mode</small><br>
      <small>Extension starts the app automatically when needed</small>
    `;
  }
  
  setStatus('Extension status checked');
});

// Listen to logs
window.electron.onLog((log) => {
  addLogEntry(log);
  updateLogCount();
});

// Listen to Discord events
window.electron.onDiscordConnected((user) => {
  updateConnectionStatus(true, user);
  setStatus(`Connected as ${user.username}#${user.discriminator}`);
});

window.electron.onDiscordDisconnected(() => {
  updateConnectionStatus(false);
  setStatus('Disconnected from Discord', 'warn');
});

window.electron.onDiscordError((error) => {
  setStatus('Discord error: ' + error, 'error');
});

// Listen to Activity events
window.electron.onActivitySet((activity) => {
  updateActivityDisplay(activity);
  setStatus('Activity updated');
});

window.electron.onActivityCleared(() => {
  clearActivityDisplay();
  setStatus('Activity cleared');
});

window.electron.onActivityError((error) => {
  setStatus('Activity error: ' + error, 'error');
});

// Listen to Extension messages
window.electron.onExtensionMessage((data) => {
  const extensionStatus = document.getElementById('extensionStatus');
  const extensionStatusText = document.getElementById('extensionStatusText');
  
  if (extensionStatus.style.display !== 'none') {
    extensionStatusText.innerHTML = `
      ✅ <strong>Extension Message Received!</strong><br>
      <small>Type: ${data.type}</small><br>
      <small>Time: ${new Date(data.timestamp).toLocaleTimeString()}</small><br>
      <small>Check the Logs tab for details</small>
    `;
  }
  
  setStatus(`Extension sent: ${data.type}`);
});

// Functions
function updateConnectionStatus(connected, user = null) {
  if (connected) {
    connectionStatus.classList.remove('disconnected');
    connectionStatus.classList.add('connected');
    connectionStatusText.textContent = 'Connected';
    discordStatus.textContent = 'Verbunden';
    if (user) {
      discordUser.textContent = `${user.username}#${user.discriminator}`;
    }
  } else {
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    connectionStatusText.textContent = 'Disconnected';
    discordStatus.textContent = 'Nicht verbunden';
    discordUser.textContent = '—';
  }
}

function updateActivityDisplay(activity) {
  if (!activity) {
    clearActivityDisplay();
    return;
  }
  
  const html = `
    <div class="activity-item">
      <span class="activity-label">Details:</span>
      <span class="activity-value">${activity.details || '—'}</span>
    </div>
    <div class="activity-item">
      <span class="activity-label">State:</span>
      <span class="activity-value">${activity.state || '—'}</span>
    </div>
    <div class="activity-item">
      <span class="activity-label">Large Image:</span>
      <span class="activity-value">${activity.largeImageKey || '—'}</span>
    </div>
    <div class="activity-item">
      <span class="activity-label">Large Image Text:</span>
      <span class="activity-value">${activity.largeImageText || '—'}</span>
    </div>
    ${activity.startTimestamp ? `
    <div class="activity-item">
      <span class="activity-label">Started:</span>
      <span class="activity-value">${new Date(activity.startTimestamp).toLocaleTimeString()}</span>
    </div>
    ` : ''}
  `;
  
  currentActivity.innerHTML = html;
}

function clearActivityDisplay() {
  currentActivity.innerHTML = '<p class="empty-state">No activity active</p>';
}

function addLogEntry(log) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  entry.innerHTML = `
    <span class="log-timestamp">${log.timestamp}</span>
    <span class="log-level ${log.level}">${log.level}</span>
    <span class="log-message">${escapeHtml(log.message)}</span>
  `;
  
  logsContainer.appendChild(entry);
  
  // Auto scroll
  if (autoScrollLogs.checked) {
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }
  
  // Limit logs in DOM
  while (logsContainer.children.length > 1000) {
    logsContainer.removeChild(logsContainer.firstChild);
  }
}

function updateLogCount() {
  const count = logsContainer.children.length;
  logCount.textContent = `${count} log${count !== 1 ? 's' : ''}`;
}

function setStatus(message, type = 'info') {
  statusMessage.textContent = message;
  
  // Clear after 5 seconds
  setTimeout(() => {
    if (statusMessage.textContent === message) {
      statusMessage.textContent = 'Ready';
    }
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Test View Functions
async function loadTestView() {
  try {
    // Load stored client ID and pre-fill the field
    const storedClientId = await window.electron.getClientId();
    const clientIdInput = document.getElementById('testClientId');
    
    if (storedClientId) {
      clientIdInput.value = storedClientId;
      clientIdInput.placeholder = storedClientId;
    } else {
      clientIdInput.value = '';
      clientIdInput.placeholder = 'Keine ID in Settings gespeichert';
    }
  } catch (error) {
    console.error('Error loading test view:', error);
  }
}

// Settings View Functions
async function loadSettingsView() {
  try {
    // Load current stored client ID
    const storedClientId = await window.electron.getClientId();
    const clientIdInput = document.getElementById('globalClientId');
    
    if (storedClientId) {
      clientIdInput.value = storedClientId;
      document.getElementById('currentKeyStatus').textContent = 'Key stored securely';
    } else {
      clientIdInput.value = '';
      document.getElementById('currentKeyStatus').textContent = 'No key stored';
    }
    
    // Load app settings
    const appSettings = await window.electron.getAppSettings();
    document.getElementById('quitOnClose').checked = appSettings.quitOnClose || false;
    
    // Load autostart setting
    const autostartResult = await window.electron.getAutostart();
    const autostartToggle = document.getElementById('autostartToggle');
    
    if (autostartResult.isDevelopment) {
      // Development mode - show warning and disable toggle
      autostartToggle.checked = false;
      autostartToggle.disabled = true;
      showAutostartStatus(autostartResult.message || 'Autostart only available in installed version', 'info');
    } else {
      // Production mode - enable toggle and set current state
      autostartToggle.disabled = false;
      autostartToggle.checked = autostartResult.enabled || false;
      hideAutostartStatus();
    }
    
    // Update storage information
    updateStorageInfo();
    
    // Clear any previous status messages (except autostart which we might have set)
    hideSettingsStatus();
    
  } catch (error) {
    console.error('Error loading settings:', error);
    showSettingsStatus('Error loading settings: ' + error.message, 'error');
  }
}

async function updateStorageInfo() {
  try {
    const info = await window.electron.getStorageInfo();
    
    if (info.encryptionAvailable) {
      document.getElementById('encryptionStatus').textContent = 'Available (using safeStorage)';
      document.getElementById('storageLocation').textContent = 'Encrypted local storage';
    } else {
      document.getElementById('encryptionStatus').textContent = 'Not available (using plaintext)';
      document.getElementById('storageLocation').textContent = 'Plaintext local storage';
    }
  } catch (error) {
    document.getElementById('encryptionStatus').textContent = 'Error checking encryption';
    document.getElementById('storageLocation').textContent = 'Unknown';
  }
}

function showSettingsStatus(message, type = 'info') {
  const statusEl = document.getElementById('settingsStatus');
  statusEl.textContent = message;
  statusEl.className = `settings-status ${type}`;
  statusEl.classList.remove('hidden');
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      hideSettingsStatus();
    }, 3000);
  }
}

function hideSettingsStatus() {
  const statusEl = document.getElementById('settingsStatus');
  statusEl.classList.add('hidden');
  statusEl.className = 'settings-status hidden';
}

function showAutostartStatus(message, type = 'info') {
  const statusEl = document.getElementById('autostartStatus');
  statusEl.textContent = message;
  statusEl.className = `settings-status ${type}`;
  statusEl.classList.remove('hidden');
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      hideAutostartStatus();
    }, 3000);
  }
}

function hideAutostartStatus() {
  const statusEl = document.getElementById('autostartStatus');
  statusEl.classList.add('hidden');
  statusEl.className = 'settings-status hidden';
}

// Settings Form Handler
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const clientIdInput = document.getElementById('globalClientId');
  const clientId = clientIdInput.value.trim();
  
  if (!clientId) {
    showSettingsStatus('Please enter a Discord Application ID', 'error');
    return;
  }
  
  // Basic validation - Discord client IDs are 18-19 digit numbers
  if (!/^\d{17,19}$/.test(clientId)) {
    showSettingsStatus('Discord Application ID must be a 17-19 digit number', 'error');
    return;
  }
  
  try {
    showSettingsStatus('Saving settings...', 'info');
    
    const result = await window.electron.saveClientId(clientId);
    
    if (result.success) {
      showSettingsStatus('Settings saved successfully!', 'success');
      document.getElementById('currentKeyStatus').textContent = 'Key stored securely';
    } else {
      showSettingsStatus('Failed to save settings: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showSettingsStatus('Error saving settings: ' + error.message, 'error');
  }
});

// Client ID visibility toggle
document.getElementById('toggleClientIdVisibility').addEventListener('click', () => {
  const input = document.getElementById('globalClientId');
  const button = document.getElementById('toggleClientIdVisibility');
  
  if (input.type === 'password') {
    input.type = 'text';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m15 18-.722-3.25"></path>
        <path d="m2 8 14.5 13"></path>
        <path d="M9.585 4.157A10.958 10.958 0 0 1 12 3.5c7 0 11 8 11 8a13.16 13.16 0 0 1-2.708 2.658"></path>
        <path d="M6.808 5.808A10.95 10.95 0 0 0 1 12s4 8 11 8c.454 0 .896-.02 1.324-.058"></path>
        <path d="M12 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path>
        <path d="m8 16 5.5-5.5"></path>
      </svg>
    `;
    button.title = 'Hide Client ID';
  } else {
    input.type = 'password';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    button.title = 'Show Client ID';
  }
});

// Clear stored key button
document.getElementById('clearStoredKeyBtn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear the stored Discord Application ID? This will require you to re-enter it or use site-specific IDs.')) {
    return;
  }
  
  try {
    const result = await window.electron.saveClientId('');
    
    if (result.success) {
      document.getElementById('globalClientId').value = '';
      document.getElementById('currentKeyStatus').textContent = 'No key stored';
      showSettingsStatus('Stored key cleared', 'success');
    } else {
      showSettingsStatus('Failed to clear key: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error clearing key:', error);
    showSettingsStatus('Error clearing key: ' + error.message, 'error');
  }
});

// App Settings Form Handler
document.getElementById('appSettingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const quitOnClose = document.getElementById('quitOnClose').checked;
    
    const result = await window.electron.saveAppSettings({ quitOnClose });
    
    if (result.success) {
      showSettingsStatus('Application settings saved!', 'success');
    } else {
      showSettingsStatus('Error saving: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error saving app settings:', error);
    showSettingsStatus('Error saving: ' + error.message, 'error');
  }
});

// Autostart Toggle Handler
document.getElementById('autostartToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  
  try {
    showAutostartStatus(`${enabled ? 'Enabling' : 'Disabling'} autostart...`, 'info');
    
    const result = await window.electron.setAutostart(enabled);
    
    if (result.success) {
      showAutostartStatus(`Autostart ${enabled ? 'enabled' : 'disabled'}!`, 'success');
    } else {
      showAutostartStatus('Failed to update autostart: ' + result.error, 'error');
      // Revert the toggle on failure
      e.target.checked = !enabled;
    }
  } catch (error) {
    console.error('Error updating autostart:', error);
    showAutostartStatus('Error updating autostart: ' + error.message, 'error');
    // Revert the toggle on failure
    e.target.checked = !enabled;
  }
});

// Initialize
(async () => {
  // Load initial status
  const status = await window.electron.getStatus();
  
  if (status.connected && status.user) {
    updateConnectionStatus(true, status.user);
  }
  
  if (status.activity) {
    updateActivityDisplay(status.activity.activity);
  }
  
  // Load existing logs
  const logs = await window.electron.getLogs();
  logs.forEach(log => addLogEntry(log));
  updateLogCount();
  
  // Pre-load stored client ID for test view
  await loadTestView();
  
  setStatus('Ready');
})();
