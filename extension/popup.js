/**
 * Optimized popup logic with modern async patterns, better error handling,
 * improved accessibility, and enhanced user experience
 */

class PopupController {
  constructor() {
    this.currentTab = null;
    this.isLoading = false;
    this.validationRules = this.setupValidationRules();
    this.debounceTimers = new Map();
    
    this.initializePopup();
  }

  /**
   * Setup validation rules for form fields
   */
  setupValidationRules() {
    return {
      appName: {
        required: true,
        minLength: 1,
        maxLength: 64,
        message: 'App-Name ist erforderlich (1-64 Zeichen)'
      },
      details: {
        maxLength: 128,
        message: 'Details dürfen maximal 128 Zeichen haben'
      },
      state: {
        maxLength: 128,
        message: 'State darf maximal 128 Zeichen haben'
      },
      largeImageKey: {
        maxLength: 32,
        pattern: /^[a-z0-9_-]*$/i,
        message: 'Large Image Key darf nur Buchstaben, Zahlen, _ und - enthalten (max 32 Zeichen)'
      },
      largeImageText: {
        maxLength: 128,
        message: 'Large Image Text darf maximal 128 Zeichen haben'
      },
      smallImageKey: {
        maxLength: 32,
        pattern: /^[a-z0-9_-]*$/i,
        message: 'Small Image Key darf nur Buchstaben, Zahlen, _ und - enthalten (max 32 Zeichen)'
      },
      smallImageText: {
        maxLength: 128,
        message: 'Small Image Text darf maximal 128 Zeichen haben'
      }
    };
  }

  /**
   * Initialize popup with error boundary
   */
  async initializePopup() {
    try {
      this.setLoadingState(true);
      
      await Promise.all([
        this.loadCurrentTab(),
        this.loadAppsList()
      ]);
      
      this.setupEventListeners();
      this.setupAccessibility();
      this.setupRealTimeValidation();
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showStatus('Fehler beim Laden der Erweiterung', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * Set loading state with visual feedback
   */
  setLoadingState(loading) {
    this.isLoading = loading;
    const loadingIndicator = document.getElementById('loadingIndicator');
    const mainContent = document.getElementById('mainContent');
    
    if (loading) {
      if (loadingIndicator) loadingIndicator.classList.remove('hidden');
      if (mainContent) mainContent.setAttribute('aria-busy', 'true');
    } else {
      if (loadingIndicator) loadingIndicator.classList.add('hidden');
      if (mainContent) mainContent.setAttribute('aria-busy', 'false');
    }
  }

  /**
   * Load current tab with enhanced error handling
   */
  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url) {
        throw new Error('Keine aktive Seite gefunden');
      }

      this.currentTab = tab;
      const url = new URL(tab.url);
      
      this.updateCurrentSiteDisplay(url.hostname, tab.title);
      await this.loadExistingConfig(url.hostname);
      
    } catch (error) {
      console.error('Error loading current tab:', error);
      this.showStatus('Fehler beim Laden der aktuellen Seite', 'error');
      this.updateCurrentSiteDisplay('Unbekannt', 'Fehler beim Laden');
    }
  }

  /**
   * Update current site display with better formatting
   */
  updateCurrentSiteDisplay(hostname, title) {
    const urlElement = document.getElementById('currentUrl');
    const titleElement = document.getElementById('currentTitle');
    
    if (urlElement) {
      urlElement.textContent = hostname;
      urlElement.title = hostname; // Accessibility
    }
    
    if (titleElement) {
      titleElement.textContent = title;
      titleElement.title = title; // Accessibility
    }
  }

  /**
   * Load existing configuration for current site
   */
  async loadExistingConfig(hostname) {
    try {
      const result = await this.getStorageData(['apps'], {});
      const apps = result.apps || {};
      
      const config = this.findMatchingConfig(hostname, apps);
      if (config) {
        this.populateForm(config);
        this.showStatus('Bestehende Konfiguration geladen', 'info');
      }
    } catch (error) {
      console.error('Error loading existing config:', error);
    }
  }

  /**
   * Find matching configuration with improved pattern matching
   */
  findMatchingConfig(hostname, apps) {
    // Try exact match first
    if (apps[hostname]) {
      return apps[hostname];
    }
    
    // Try subdomain match
    for (const [pattern, config] of Object.entries(apps)) {
      if (hostname.endsWith('.' + pattern) || pattern.includes(hostname) || hostname.includes(pattern)) {
        return config;
      }
    }
    
    return null;
  }

  /**
   * Populate form with configuration data
   */
  populateForm(config) {
    const fields = ['appName', 'details', 'state', 'largeImageKey', 'largeImageText', 'smallImageKey', 'smallImageText'];
    
    fields.forEach(field => {
      const element = document.getElementById(field);
      if (element && config[field] !== undefined) {
        element.value = config[field];
        this.validateField(element); // Validate on load
      }
    });
    
    const enabledElement = document.getElementById('enabled');
    if (enabledElement) {
      enabledElement.checked = config.enabled !== false;
    }
  }

  /**
   * Load apps list with better error handling and empty state
   */
  async loadAppsList() {
    try {
      const result = await this.getStorageData(['apps'], {});
      const apps = result.apps || {};
      const appsList = document.getElementById('appsList');
      
      if (!appsList) return;
      
      if (Object.keys(apps).length === 0) {
        this.renderEmptyAppsState(appsList);
        return;
      }
      
      this.renderAppsList(apps, appsList);
      
    } catch (error) {
      console.error('Error loading apps list:', error);
      const appsList = document.getElementById('appsList');
      if (appsList) {
        appsList.innerHTML = '<div class="error-state">Fehler beim Laden der Apps</div>';
      }
    }
  }

  /**
   * Render empty apps state
   */
  renderEmptyAppsState(container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎮</div>
        <div class="empty-state-title">Keine Apps konfiguriert</div>
        <div class="empty-state-text">
          Fügen Sie Ihre erste Web-App hinzu, indem Sie das Formular oben ausfüllen.
        </div>
      </div>
    `;
  }

  /**
   * Render apps list with improved accessibility
   */
  renderAppsList(apps, container) {
    const appsArray = Object.entries(apps).sort((a, b) => a[1].name?.localeCompare(b[1].name) || 0);
    
    container.innerHTML = appsArray.map(([pattern, config]) => `
      <div class="app-item" role="listitem">
        <div class="app-item-info">
          <div class="app-item-name">${this.escapeHtml(config.name || 'Unbenannt')}</div>
          <div class="app-item-url" title="${this.escapeHtml(pattern)}">${this.escapeHtml(pattern)}</div>
          <div class="app-item-status ${config.enabled !== false ? 'enabled' : 'disabled'}">
            ${config.enabled !== false ? '✅ Aktiviert' : '❌ Deaktiviert'}
          </div>
        </div>
        <div class="app-item-actions">
          <button 
            class="icon-button edit" 
            data-pattern="${this.escapeHtml(pattern)}" 
            title="App bearbeiten"
            aria-label="App ${this.escapeHtml(config.name || pattern)} bearbeiten"
          >
            ✏️
          </button>
          <button 
            class="icon-button danger" 
            data-pattern="${this.escapeHtml(pattern)}"
            title="App löschen"
            aria-label="App ${this.escapeHtml(config.name || pattern)} löschen"
          >
            🗑️
          </button>
        </div>
      </div>
    `).join('');
    
    // Add event listeners to buttons
    container.querySelectorAll('.icon-button.edit').forEach(button => {
      button.addEventListener('click', (e) => this.editApp(e.target.dataset.pattern));
    });
    
    container.querySelectorAll('.icon-button.danger').forEach(button => {
      button.addEventListener('click', (e) => this.deleteApp(e.target.dataset.pattern));
    });
  }

  /**
   * Setup comprehensive event listeners
   */
  setupEventListeners() {
    // Form submission with enhanced validation
    const form = document.getElementById('appConfigForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveAppConfig();
      });
    }
    
    // Button event listeners with loading states
    this.setupButtonListeners();
    
    // Collapsible sections
    this.setupCollapsibleSections();
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Setup button listeners with loading states
   */
  setupButtonListeners() {
    const buttons = [
      { id: 'testConnectionBtn', handler: this.testConnection.bind(this) },
      { id: 'clearActivityBtn', handler: this.clearActivity.bind(this) },
      { id: 'exportConfigBtn', handler: this.exportConfig.bind(this) },
      { id: 'importConfigBtn', handler: this.importConfig.bind(this) }
    ];
    
    buttons.forEach(({ id, handler }) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener('click', async (e) => {
          if (this.isLoading) return;
          
          this.setButtonLoading(button, true);
          try {
            await handler();
          } finally {
            this.setButtonLoading(button, false);
          }
        });
      }
    });
  }

  /**
   * Set button loading state
   */
  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = '⏳ Lädt...';
      button.setAttribute('aria-busy', 'true');
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent.replace('⏳ Lädt...', '');
      button.setAttribute('aria-busy', 'false');
    }
  }

  /**
   * Setup real-time field validation
   */
  setupRealTimeValidation() {
    const formFields = document.querySelectorAll('#appConfigForm input, #appConfigForm textarea');
    
    formFields.forEach(field => {
      // Validate on blur and input (with debounce)
      field.addEventListener('blur', () => this.validateField(field));
      field.addEventListener('input', () => this.debounceValidation(field));
      
      // Character counter for text fields
      if (field.maxLength || this.validationRules[field.id]?.maxLength) {
        this.setupCharacterCounter(field);
      }
    });
  }

  /**
   * Debounced validation for input events
   */
  debounceValidation(field) {
    const key = field.id;
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }
    
    const timer = setTimeout(() => {
      this.validateField(field);
      this.debounceTimers.delete(key);
    }, 300);
    
    this.debounceTimers.set(key, timer);
  }

  /**
   * Validate individual field with visual feedback
   */
  validateField(field) {
    const rule = this.validationRules[field.id];
    if (!rule) return true;
    
    const value = field.value.trim();
    let isValid = true;
    let message = '';
    
    // Required validation
    if (rule.required && !value) {
      isValid = false;
      message = rule.message || `${field.id} ist erforderlich`;
    }
    
    // Length validation
    if (isValid && rule.minLength && value.length < rule.minLength) {
      isValid = false;
      message = `Mindestens ${rule.minLength} Zeichen erforderlich`;
    }
    
    if (isValid && rule.maxLength && value.length > rule.maxLength) {
      isValid = false;
      message = `Maximal ${rule.maxLength} Zeichen erlaubt`;
    }
    
    // Pattern validation
    if (isValid && rule.pattern && value && !rule.pattern.test(value)) {
      isValid = false;
      message = rule.message || 'Ungültiges Format';
    }
    
    this.setFieldValidation(field, isValid, message);
    return isValid;
  }

  /**
   * Set field validation state with visual feedback
   */
  setFieldValidation(field, isValid, message) {
    const container = field.closest('.form-group');
    if (!container) return;
    
    // Remove existing validation classes
    container.classList.remove('field-valid', 'field-invalid');
    
    // Remove existing error message
    const existingError = container.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
    
    if (!isValid && message) {
      container.classList.add('field-invalid');
      
      const errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.textContent = message;
      errorElement.setAttribute('role', 'alert');
      
      container.appendChild(errorElement);
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', field.id + '-error');
      errorElement.id = field.id + '-error';
    } else {
      if (field.value.trim()) {
        container.classList.add('field-valid');
      }
      field.setAttribute('aria-invalid', 'false');
      field.removeAttribute('aria-describedby');
    }
  }

  /**
   * Setup character counter for text fields
   */
  setupCharacterCounter(field) {
    const container = field.closest('.form-group');
    if (!container) return;
    
    const maxLength = field.maxLength || this.validationRules[field.id]?.maxLength;
    if (!maxLength) return;
    
    const counter = document.createElement('div');
    counter.className = 'character-counter';
    counter.setAttribute('aria-live', 'polite');
    
    const updateCounter = () => {
      const remaining = maxLength - field.value.length;
      counter.textContent = `${field.value.length}/${maxLength}`;
      counter.className = `character-counter ${remaining < 10 ? 'warning' : ''}`;
    };
    
    field.addEventListener('input', updateCounter);
    updateCounter();
    
    container.appendChild(counter);
  }

  /**
   * Setup accessibility features
   */
  setupAccessibility() {
    // ARIA labels and roles
    const form = document.getElementById('appConfigForm');
    if (form) {
      form.setAttribute('aria-label', 'App-Konfiguration');
    }
    
    const appsList = document.getElementById('appsList');
    if (appsList) {
      appsList.setAttribute('role', 'list');
      appsList.setAttribute('aria-label', 'Liste der konfigurierten Apps');
    }
    
    // Focus management
    this.setupFocusManagement();
    
    // Keyboard navigation
    this.setupKeyboardNavigation();
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.saveAppConfig();
      }
      
      // Escape to clear form
      if (e.key === 'Escape') {
        this.clearForm();
      }
    });
  }

  /**
   * Save app configuration with comprehensive validation
   */
  async saveAppConfig() {
    if (!this.currentTab || !this.currentTab.url) {
      this.showStatus('Keine aktive Seite gefunden', 'error');
      return;
    }
    
    try {
      // Validate all fields
      const formFields = document.querySelectorAll('#appConfigForm input, #appConfigForm textarea');
      let isFormValid = true;
      
      formFields.forEach(field => {
        if (!this.validateField(field)) {
          isFormValid = false;
        }
      });
      
      if (!isFormValid) {
        this.showStatus('Bitte korrigieren Sie die Eingabefehler', 'error');
        return;
      }
      
      const url = new URL(this.currentTab.url);
      const hostname = url.hostname;
      
      const config = this.gatherFormData();
      
      // Save configuration
      await this.saveAppConfigToStorage(hostname, config);
      
      this.showStatus('Konfiguration erfolgreich gespeichert!', 'success');
      
      // Reload apps list and notify background
      await Promise.all([
        this.loadAppsList(),
        this.notifyBackgroundUpdate()
      ]);
      
    } catch (error) {
      console.error('Error saving config:', error);
      this.showStatus('Fehler beim Speichern: ' + error.message, 'error');
    }
  }

  /**
   * Gather form data with validation
   */
  gatherFormData() {
    const config = {
      name: document.getElementById('appName').value.trim(),
      details: document.getElementById('details').value.trim(),
      state: document.getElementById('state').value.trim(),
      largeImageKey: document.getElementById('largeImageKey').value.trim(),
      largeImageText: document.getElementById('largeImageText').value.trim(),
      smallImageKey: document.getElementById('smallImageKey').value.trim(),
      smallImageText: document.getElementById('smallImageText').value.trim(),
      enabled: document.getElementById('enabled').checked
    };
    
    // Remove empty strings
    Object.keys(config).forEach(key => {
      if (config[key] === '') {
        delete config[key];
      }
    });
    
    return config;
  }

  /**
   * Save app configuration to storage
   */
  async saveAppConfigToStorage(hostname, config) {
    const result = await this.getStorageData(['apps'], {});
    const apps = result.apps || {};
    
    // Preserve existing clientId for backward compatibility
    if (apps[hostname] && apps[hostname].clientId) {
      config.clientId = apps[hostname].clientId;
    }
    
    apps[hostname] = config;
    await chrome.storage.sync.set({ apps });
  }

  /**
   * Enhanced storage operations with timeout and error handling
   */
  async getStorageData(keys, defaultValue = {}) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Storage operation timed out');
        resolve(defaultValue);
      }, 5000);
      
      chrome.storage.sync.get(keys, (result) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError);
          resolve(defaultValue);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Test connection with enhanced feedback
   */
  async testConnection() {
    try {
      this.showStatus('Teste Verbindung...', 'info');
      
      const response = await this.sendRuntimeMessage({ type: 'testConnection' });
      
      if (response && response.success) {
        this.showStatus('✅ Verbindung erfolgreich!', 'success');
      } else {
        throw new Error('Keine Antwort vom Background-Script');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      this.showStatus('❌ Verbindungsfehler: ' + error.message, 'error');
    }
  }

  /**
   * Clear activity with confirmation
   */
  async clearActivity() {
    try {
      const response = await this.sendRuntimeMessage({ type: 'clearActivity' });
      
      if (response && response.success) {
        this.showStatus('🧹 Activity gelöscht', 'success');
      } else {
        throw new Error('Fehler beim Löschen der Activity');
      }
    } catch (error) {
      console.error('Error clearing activity:', error);
      this.showStatus('Fehler: ' + error.message, 'error');
    }
  }

  /**
   * Enhanced runtime message sending with timeout
   */
  async sendRuntimeMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);
      
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Delete app with confirmation
   */
  async deleteApp(pattern) {
    if (!confirm(`App "${pattern}" wirklich löschen?`)) {
      return;
    }
    
    try {
      const result = await this.getStorageData(['apps'], {});
      const apps = result.apps || {};
      delete apps[pattern];
      
      await chrome.storage.sync.set({ apps });
      
      this.showStatus('App gelöscht', 'success');
      await this.loadAppsList();
      
      // Clear activity if it was the current site
      if (this.currentTab && this.currentTab.url) {
        const url = new URL(this.currentTab.url);
        if (url.hostname.includes(pattern) || pattern.includes(url.hostname)) {
          await this.sendRuntimeMessage({ type: 'clearActivity' });
        }
      }
    } catch (error) {
      console.error('Error deleting app:', error);
      this.showStatus('Fehler beim Löschen', 'error');
    }
  }

  /**
   * Show enhanced status message with accessibility
   */
  showStatus(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.classList.remove('hidden');
    statusEl.setAttribute('role', 'alert');
    statusEl.setAttribute('aria-live', 'polite');
    
    // Auto-hide after duration
    setTimeout(() => {
      statusEl.classList.add('hidden');
      statusEl.removeAttribute('role');
    }, duration);
  }

  /**
   * Notify background script of updates
   */
  async notifyBackgroundUpdate() {
    try {
      await this.sendRuntimeMessage({ type: 'updateActivity' });
    } catch (error) {
      console.warn('Could not notify background of update:', error);
    }
  }

  /**
   * HTML escape utility
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clear form with confirmation
   */
  clearForm() {
    if (!confirm('Formular wirklich zurücksetzen?')) {
      return;
    }
    
    document.getElementById('appConfigForm').reset();
    
    // Clear validation states
    document.querySelectorAll('.form-group').forEach(group => {
      group.classList.remove('field-valid', 'field-invalid');
    });
    
    document.querySelectorAll('.field-error').forEach(error => {
      error.remove();
    });
  }

  /**
   * Setup collapsible sections with accessibility
   */
  setupCollapsibleSections() {
    const collapsibles = document.querySelectorAll('.collapsible');
    
    collapsibles.forEach(collapsible => {
      const contentId = collapsible.id.replace('Collapsible', 'Content');
      const content = document.getElementById(contentId);
      
      if (content) {
        // Setup ARIA attributes
        collapsible.setAttribute('aria-expanded', !collapsible.classList.contains('collapsed'));
        collapsible.setAttribute('aria-controls', contentId);
        content.setAttribute('aria-labelledby', collapsible.id);
        
        collapsible.addEventListener('click', () => {
          this.toggleCollapsible(collapsible.id, contentId);
        });
      }
    });
  }

  /**
   * Toggle collapsible section with animation and accessibility
   */
  toggleCollapsible(headerId, contentId) {
    const header = document.getElementById(headerId);
    const content = document.getElementById(contentId);
    
    if (!header || !content) return;
    
    const isCollapsed = header.classList.contains('collapsed');
    
    header.classList.toggle('collapsed');
    content.classList.toggle('hidden');
    
    // Update ARIA attributes
    header.setAttribute('aria-expanded', isCollapsed);
    
    // Smooth animation
    if (isCollapsed) {
      content.style.maxHeight = content.scrollHeight + 'px';
      requestAnimationFrame(() => {
        content.style.maxHeight = 'none';
      });
    } else {
      content.style.maxHeight = content.scrollHeight + 'px';
      requestAnimationFrame(() => {
        content.style.maxHeight = '0px';
      });
    }
  }

  /**
   * Setup focus management for better accessibility
   */
  setupFocusManagement() {
    // Focus first input on load
    const firstInput = document.querySelector('#appConfigForm input');
    if (firstInput) {
      firstInput.focus();
    }
    
    // Trap focus in popup
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.handleTabNavigation(e);
      }
    });
  }

  /**
   * Handle tab navigation within popup
   */
  handleTabNavigation(e) {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Setup keyboard navigation for app list
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      const appItems = document.querySelectorAll('.app-item button');
      const currentIndex = Array.from(appItems).indexOf(document.activeElement);
      
      if (currentIndex === -1) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % appItems.length;
          appItems[nextIndex].focus();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + appItems.length) % appItems.length;
          appItems[prevIndex].focus();
          break;
      }
    });
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });
} else {
  new PopupController();
}