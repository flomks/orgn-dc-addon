// Popup logic
let currentTab = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentTab();
  await loadAppsList();
  setupEventListeners();
});

// Load current tab info
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentTab = tab;
      const url = new URL(tab.url);
      document.getElementById('currentUrl').textContent = url.hostname;
      
      // Check if this site is already configured
      const result = await chrome.storage.sync.get(['apps']);
      const apps = result.apps || {};
      
      for (const [pattern, config] of Object.entries(apps)) {
        if (url.hostname.includes(pattern) || pattern.includes(url.hostname)) {
          // Load existing config
          document.getElementById('appName').value = config.name || '';
          document.getElementById('clientId').value = config.clientId || '';
          document.getElementById('details').value = config.details || '';
          document.getElementById('state').value = config.state || '';
          document.getElementById('largeImageKey').value = config.largeImageKey || '';
          document.getElementById('largeImageText').value = config.largeImageText || '';
          document.getElementById('smallImageKey').value = config.smallImageKey || '';
          document.getElementById('smallImageText').value = config.smallImageText || '';
          document.getElementById('enabled').checked = config.enabled !== false;
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error loading current tab:', error);
    showStatus('Fehler beim Laden der aktuellen Seite', 'error');
  }
}

// Load apps list
async function loadAppsList() {
  try {
    const result = await chrome.storage.sync.get(['apps']);
    const apps = result.apps || {};
    const appsList = document.getElementById('appsList');
    
    if (Object.keys(apps).length === 0) {
      appsList.innerHTML = '<div style="text-align: center; color: #72767d; padding: 16px;">Keine Apps konfiguriert</div>';
      return;
    }
    
    appsList.innerHTML = '';
    for (const [pattern, config] of Object.entries(apps)) {
      const appItem = document.createElement('div');
      appItem.className = 'app-item';
      appItem.innerHTML = `
        <div class="app-item-info">
          <div class="app-item-name">${config.name || 'Unbenannt'}</div>
          <div class="app-item-url">${pattern}</div>
        </div>
        <div class="app-item-actions">
          <button class="icon-button danger" data-pattern="${pattern}">Löschen</button>
        </div>
      `;
      
      appItem.querySelector('.icon-button').addEventListener('click', async (e) => {
        const pattern = e.target.dataset.pattern;
        await deleteApp(pattern);
      });
      
      appsList.appendChild(appItem);
    }
  } catch (error) {
    console.error('Error loading apps list:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Form submission
  document.getElementById('appConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveAppConfig();
  });
  
  // Test connection button
  document.getElementById('testConnectionBtn').addEventListener('click', async () => {
    await testConnection();
  });
  
  // Clear activity button
  document.getElementById('clearActivityBtn').addEventListener('click', async () => {
    await clearActivity();
  });
  
  // Collapsible sections
  document.getElementById('configCollapsible').addEventListener('click', () => {
    toggleCollapsible('configCollapsible', 'configContent');
  });
  
  document.getElementById('appsCollapsible').addEventListener('click', () => {
    toggleCollapsible('appsCollapsible', 'appsContent');
  });
}

// Toggle collapsible section
function toggleCollapsible(headerId, contentId) {
  const header = document.getElementById(headerId);
  const content = document.getElementById(contentId);
  
  header.classList.toggle('collapsed');
  content.classList.toggle('hidden');
}

// Save app configuration
async function saveAppConfig() {
  if (!currentTab || !currentTab.url) {
    showStatus('Keine aktive Seite gefunden', 'error');
    return;
  }
  
  try {
    const url = new URL(currentTab.url);
    const hostname = url.hostname;
    
    const config = {
      name: document.getElementById('appName').value,
      clientId: document.getElementById('clientId').value,
      details: document.getElementById('details').value,
      state: document.getElementById('state').value,
      largeImageKey: document.getElementById('largeImageKey').value,
      largeImageText: document.getElementById('largeImageText').value,
      smallImageKey: document.getElementById('smallImageKey').value,
      smallImageText: document.getElementById('smallImageText').value,
      enabled: document.getElementById('enabled').checked
    };
    
    // Validation
    if (!config.name) {
      showStatus('Bitte gib einen App-Namen ein', 'error');
      return;
    }
    
    if (!config.clientId) {
      showStatus('Bitte gib eine Discord Application ID ein', 'error');
      return;
    }
    
    // Save to storage
    const result = await chrome.storage.sync.get(['apps']);
    const apps = result.apps || {};
    apps[hostname] = config;
    
    await chrome.storage.sync.set({ apps });
    
    showStatus('Konfiguration gespeichert!', 'success');
    
    // Reload apps list
    await loadAppsList();
    
    // Notify background to update activity
    chrome.runtime.sendMessage({ type: 'updateActivity' });
    
  } catch (error) {
    console.error('Error saving config:', error);
    showStatus('Fehler beim Speichern: ' + error.message, 'error');
  }
}

// Delete app configuration
async function deleteApp(pattern) {
  try {
    const result = await chrome.storage.sync.get(['apps']);
    const apps = result.apps || {};
    delete apps[pattern];
    
    await chrome.storage.sync.set({ apps });
    
    showStatus('App gelöscht', 'success');
    await loadAppsList();
    
    // Clear activity if it was the current site
    if (currentTab && currentTab.url) {
      const url = new URL(currentTab.url);
      if (url.hostname.includes(pattern) || pattern.includes(url.hostname)) {
        chrome.runtime.sendMessage({ type: 'clearActivity' });
      }
    }
  } catch (error) {
    console.error('Error deleting app:', error);
    showStatus('Fehler beim Löschen', 'error');
  }
}

// Test connection to native host
async function testConnection() {
  try {
    showStatus('Teste Verbindung...', 'info');
    
    chrome.runtime.sendMessage({ type: 'testConnection' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Verbindungsfehler: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('Verbindung erfolgreich!', 'success');
      }
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    showStatus('Verbindungsfehler: ' + error.message, 'error');
  }
}

// Clear activity
async function clearActivity() {
  try {
    chrome.runtime.sendMessage({ type: 'clearActivity' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Fehler beim Löschen', 'error');
      } else {
        showStatus('Activity gelöscht', 'success');
      }
    });
  } catch (error) {
    console.error('Error clearing activity:', error);
    showStatus('Fehler: ' + error.message, 'error');
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
  
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 3000);
}
