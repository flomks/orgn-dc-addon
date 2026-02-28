/**
 * Popup controller for ORGN Discord Bridge extension.
 * Manages site configuration, app list, and communication with the background service.
 */
class PopupController {
  constructor() {
    this.currentTab = null;
    this.isLoading = false;
    this.initializePopup();
  }

  // ── Initialization ──────────────────────────────────────────────

  async initializePopup() {
    try {
      this.setLoadingState(true);

      await this.checkDesktopAppConnection();

      await Promise.all([
        this.loadCurrentTab(),
        this.loadAppsList()
      ]);

      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showStatus('Error loading extension', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  setLoadingState(loading) {
    this.isLoading = loading;
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
      indicator.classList.toggle('hidden', !loading);
    }
  }

  async checkDesktopAppConnection() {
    try {
      const response = await this.sendMessage({ type: 'getConnectionStatus' }, 2000);
      if (!response || !response.desktopAppConnected) {
        this.showDesktopAppWarning();
      }
    } catch (error) {
      this.showDesktopAppWarning();
    }
  }

  showDesktopAppWarning() {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.innerHTML = '<strong>Desktop app not running!</strong><br><small>Start the ORGN Discord Bridge app first.</small>';
    el.className = 'status error';
    el.classList.remove('hidden');
  }

  // ── Current Tab ─────────────────────────────────────────────────

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        this.setCurrentSite('No page detected', '');
        return;
      }

      this.currentTab = tab;
      const url = new URL(tab.url);
      this.setCurrentSite(url.hostname, tab.title);
      await this.loadExistingConfig(url.hostname);
    } catch (error) {
      console.error('Error loading current tab:', error);
      this.setCurrentSite('Error', '');
    }
  }

  setCurrentSite(hostname, title) {
    const urlEl = document.getElementById('currentUrl');
    const titleEl = document.getElementById('currentTitle');
    if (urlEl) urlEl.textContent = hostname;
    if (titleEl) titleEl.textContent = title || '';
  }

  async loadExistingConfig(hostname) {
    try {
      const data = await this.getStorage(['apps']);
      const apps = data.apps || {};
      const config = this.findConfig(hostname, apps);
      if (config) {
        this.populateForm(config);
        this.showStatus('Existing configuration loaded', 'info');
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  findConfig(hostname, apps) {
    if (apps[hostname]) return apps[hostname];
    for (const [pattern, config] of Object.entries(apps)) {
      if (hostname.endsWith('.' + pattern) || hostname.includes(pattern) || pattern.includes(hostname)) {
        return config;
      }
    }
    return null;
  }

  populateForm(config) {
    const fields = ['appName', 'details', 'state', 'largeImageKey', 'largeImageText', 'smallImageKey', 'smallImageText'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el && config[id] !== undefined) el.value = config[id];
    });
    const enabled = document.getElementById('enabled');
    if (enabled) enabled.checked = config.enabled !== false;
  }

  // ── Apps List ───────────────────────────────────────────────────

  async loadAppsList() {
    const container = document.getElementById('appsList');
    if (!container) return;

    try {
      const data = await this.getStorage(['apps']);
      const apps = data.apps || {};
      const entries = Object.entries(apps).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''));

      if (entries.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">+</div>
            <div class="empty-state-title">No apps configured yet</div>
            <div class="empty-state-text">Fill in the form above and click "Save" to add this site.</div>
          </div>`;
        return;
      }

      container.innerHTML = entries.map(([pattern, config]) => `
        <div class="app-item" role="listitem">
          <div class="app-item-info">
            <div class="app-item-name">${this.esc(config.name || pattern)}</div>
            <div class="app-item-url">${this.esc(pattern)}</div>
            <div class="app-item-status ${config.enabled !== false ? 'enabled' : 'disabled'}">
              ${config.enabled !== false ? 'Active' : 'Disabled'}
            </div>
          </div>
          <div class="app-item-actions">
            <button class="icon-button" data-action="edit" data-pattern="${this.esc(pattern)}" title="Edit">Edit</button>
            <button class="icon-button danger" data-action="delete" data-pattern="${this.esc(pattern)}" title="Delete">Del</button>
          </div>
        </div>`).join('');

      container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => this.editApp(btn.dataset.pattern));
      });
      container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => this.deleteApp(btn.dataset.pattern));
      });
    } catch (error) {
      console.error('Error loading apps:', error);
      container.innerHTML = '<div class="empty-state">Error loading apps</div>';
    }
  }

  async editApp(pattern) {
    try {
      const data = await this.getStorage(['apps']);
      const apps = data.apps || {};
      const config = apps[pattern];
      if (config) {
        this.populateForm(config);
        this.showStatus(`Editing: ${pattern}`, 'info');
        // Scroll to form
        document.getElementById('appConfigForm')?.scrollIntoView({ behavior: 'smooth' });
        // Expand config section if collapsed
        const header = document.getElementById('configCollapsible');
        const content = document.getElementById('configContent');
        if (header && content && header.classList.contains('collapsed')) {
          header.classList.remove('collapsed');
          content.classList.remove('hidden');
        }
      }
    } catch (error) {
      console.error('Error editing app:', error);
    }
  }

  async deleteApp(pattern) {
    if (!confirm(`Delete "${pattern}"?`)) return;

    try {
      const data = await this.getStorage(['apps']);
      const apps = data.apps || {};
      delete apps[pattern];
      await chrome.storage.sync.set({ apps });
      this.showStatus('App deleted', 'success');
      await this.loadAppsList();

      // Clear activity if this was the current site
      if (this.currentTab?.url) {
        const hostname = new URL(this.currentTab.url).hostname;
        if (hostname.includes(pattern) || pattern.includes(hostname)) {
          await this.sendMessage({ type: 'clearActivity' }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error deleting app:', error);
      this.showStatus('Error deleting app', 'error');
    }
  }

  // ── Save Configuration ──────────────────────────────────────────

  async saveAppConfig() {
    if (!this.currentTab?.url) {
      this.showStatus('No active page found', 'error');
      return;
    }

    try {
      const appName = document.getElementById('appName')?.value.trim();
      if (!appName) {
        this.showStatus('App Name is required', 'error');
        document.getElementById('appName')?.focus();
        return;
      }

      const hostname = new URL(this.currentTab.url).hostname;
      const config = {
        name: appName,
        enabled: document.getElementById('enabled')?.checked !== false
      };

      // Add optional fields (only if non-empty)
      const optionalFields = ['details', 'state', 'largeImageKey', 'largeImageText', 'smallImageKey', 'smallImageText'];
      optionalFields.forEach(id => {
        const val = document.getElementById(id)?.value.trim();
        if (val) config[id] = val;
      });

      // Save to storage
      const data = await this.getStorage(['apps']);
      const apps = data.apps || {};

      // Preserve existing clientId
      if (apps[hostname]?.clientId) {
        config.clientId = apps[hostname].clientId;
      }

      apps[hostname] = config;
      await chrome.storage.sync.set({ apps });

      this.showStatus('Configuration saved!', 'success');
      await Promise.all([
        this.loadAppsList(),
        this.sendMessage({ type: 'updateActivity' }).catch(() => {})
      ]);
    } catch (error) {
      console.error('Error saving config:', error);
      this.showStatus('Error saving: ' + error.message, 'error');
    }
  }

  // ── Event Listeners ─────────────────────────────────────────────

  setupEventListeners() {
    // Form submit
    const form = document.getElementById('appConfigForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveAppConfig();
      });
    }

    // Buttons
    const testBtn = document.getElementById('testConnectionBtn');
    if (testBtn) testBtn.addEventListener('click', () => this.testConnection());

    const clearBtn = document.getElementById('clearActivityBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearActivity());

    // Collapsible sections
    document.querySelectorAll('.collapsible').forEach(header => {
      const contentId = header.id.replace('Collapsible', 'Content');
      const content = document.getElementById(contentId);
      if (!content) return;

      header.addEventListener('click', () => {
        const isCollapsed = header.classList.toggle('collapsed');
        content.classList.toggle('hidden', isCollapsed);
      });
    });
  }

  // ── Actions ─────────────────────────────────────────────────────

  async testConnection() {
    try {
      this.showStatus('Testing connection...', 'info');
      const response = await this.sendMessage({ type: 'testConnection' });

      if (response?.success) {
        this.showStatus('Connected to desktop app!', 'success');
      } else {
        this.showStatus(response?.error || 'Desktop app not running.', 'error', 8000);
      }
    } catch (error) {
      this.showStatus('Desktop app not reachable. Is it running?', 'error', 8000);
    }
  }

  async clearActivity() {
    try {
      const response = await this.sendMessage({ type: 'clearActivity' });
      if (response?.success) {
        this.showStatus('Activity cleared', 'success');
      } else {
        this.showStatus('Error clearing activity', 'error');
      }
    } catch (error) {
      this.showStatus('Error: ' + error.message, 'error');
    }
  }

  // ── Utilities ───────────────────────────────────────────────────

  showStatus(message, type = 'info', duration = 4000) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `status ${type}`;
    el.classList.remove('hidden');
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  async getStorage(keys) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({}), 5000);
      chrome.storage.sync.get(keys, (result) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError);
          resolve({});
        } else {
          resolve(result);
        }
      });
    });
  }

  async sendMessage(message, timeout = 5000) {
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

  esc(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
  new PopupController();
}
