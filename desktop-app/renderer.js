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
  test: document.getElementById('testView')
};

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const viewName = item.dataset.view;
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    // Update view
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
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
  const clientId = document.getElementById('testClientId').value || '1234567890123456789';
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
  
  const activityData = {
    clientId: document.getElementById('testClientId').value,
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
  currentActivity.innerHTML = '<p class="empty-state">Keine Activity aktiv</p>';
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
  
  setStatus('Ready');
})();
