// Content Script - ORGN CDE Website State Extractor
// Runs directly on ORGN CDE pages to extract rich activity data
// for Discord Rich Presence states.

(function () {
  'use strict';

  // Prevent double-injection (manifest + programmatic scripting.executeScript)
  if (window.__orgnBridgeContentScriptLoaded) return;
  window.__orgnBridgeContentScriptLoaded = true;

  const EXTRACT_INTERVAL_MS = 3000; // Re-extract every 3 seconds
  const DEBUG_MODE = true; // Enable console logging for diagnostics

  let lastStateHash = '';
  let extractionInterval = null;
  let mutationObserver = null;

  // ── Logging ──────────────────────────────────────────────────────

  function log(...args) {
    if (DEBUG_MODE) {
      console.log('[ORGN-Bridge Content]', ...args);
    }
  }

  function warn(...args) {
    if (DEBUG_MODE) {
      console.warn('[ORGN-Bridge Content]', ...args);
    }
  }

  // ── URL Analysis ─────────────────────────────────────────────────

  function extractUrlInfo() {
    const url = window.location.href;
    const pathname = window.location.pathname;
    const hostname = window.location.hostname;
    const searchParams = Object.fromEntries(new URLSearchParams(window.location.search));
    const hash = window.location.hash;

    // Parse path segments: e.g. /projects/my-project/trials/abc123
    const segments = pathname.split('/').filter(Boolean);
    const pathInfo = {
      full: pathname,
      segments,
      segmentCount: segments.length
    };

    // Try to extract known ORGN CDE route patterns
    const routeInfo = {};

    // Project detection from URL
    const projectIdx = segments.indexOf('projects');
    if (projectIdx !== -1 && segments[projectIdx + 1]) {
      routeInfo.projectSlug = segments[projectIdx + 1];
    }

    // Trial detection from URL
    const trialIdx = segments.indexOf('trials');
    if (trialIdx !== -1 && segments[trialIdx + 1]) {
      routeInfo.trialId = segments[trialIdx + 1];
    }

    // Workspace detection from URL
    const workspaceIdx = segments.indexOf('workspaces');
    if (workspaceIdx !== -1 && segments[workspaceIdx + 1]) {
      routeInfo.workspaceId = segments[workspaceIdx + 1];
    }

    // Editor/IDE detection from URL
    const editorIdx = segments.indexOf('editor');
    if (editorIdx !== -1) {
      routeInfo.isEditor = true;
    }

    // Settings detection
    const settingsIdx = segments.indexOf('settings');
    if (settingsIdx !== -1) {
      routeInfo.isSettings = true;
    }

    return {
      url,
      hostname,
      pathname,
      hash,
      searchParams,
      pathInfo,
      routeInfo
    };
  }

  // ── Title Analysis ───────────────────────────────────────────────

  function extractTitleInfo() {
    const rawTitle = document.title;

    // Remove common suffixes like " · Orgn CDE", " | Orgn CDE"
    const cleanTitle = rawTitle
      .replace(/\s*[·|]\s*Orgn\s*CDE\s*$/i, '')
      .replace(/\s*[-–]\s*Orgn\s*CDE\s*$/i, '')
      .trim();

    // Try to parse structured titles
    const parts = {};

    // Pattern: "filename - Trial · Orgn CDE"
    const trialMatch = cleanTitle.match(/^(.+?)\s*[-–]\s*Trial$/i);
    if (trialMatch) {
      parts.trialName = trialMatch[1].trim();
      parts.pageType = 'trial';
    }

    // Pattern: "projectname · Orgn CDE" (already cleaned)
    // Pattern: "section - subsection"
    const sepMatch = cleanTitle.match(/^(.+?)\s*[-–]\s*(.+)$/);
    if (sepMatch && !parts.pageType) {
      parts.primary = sepMatch[1].trim();
      parts.secondary = sepMatch[2].trim();
    }

    return {
      raw: rawTitle,
      clean: cleanTitle,
      parts
    };
  }

  // ── Meta Tags ────────────────────────────────────────────────────

  function extractMetaTags() {
    const meta = {};

    // Standard meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });

    // Specific useful meta tags
    return {
      all: meta,
      description: meta['description'] || null,
      ogTitle: meta['og:title'] || null,
      ogDescription: meta['og:description'] || null,
      ogImage: meta['og:image'] || null,
      ogSiteName: meta['og:site-name'] || meta['og:site_name'] || null,
      applicationName: meta['application-name'] || null,
      themeColor: meta['theme-color'] || null,
      viewport: meta['viewport'] || null
    };
  }

  // ── DOM: IDE / Editor State ──────────────────────────────────────

  function extractEditorState() {
    const editorState = {
      hasEditor: false,
      editorType: null,
      activeFile: null,
      activeLanguage: null,
      openTabs: [],
      cursorPosition: null,
      lineCount: null
    };

    // ─── Monaco Editor Detection ───────────────────────────────
    // Monaco is used by VS Code, Gitpod, Codespaces, etc.
    const monacoEditor = document.querySelector('.monaco-editor');
    if (monacoEditor) {
      editorState.hasEditor = true;
      editorState.editorType = 'monaco';

      // Active file from tab
      const activeTab = document.querySelector(
        '.tab.active .label-name, ' +
        '.tab.active .tab-label, ' +
        '.monaco-workbench .tab.active, ' +
        '[class*="tab"][class*="active"] [class*="label"], ' +
        '.editor-group-container .tab.active'
      );
      if (activeTab) {
        editorState.activeFile = activeTab.textContent?.trim() || null;
      }

      // Try to get file from breadcrumb
      if (!editorState.activeFile) {
        const breadcrumb = document.querySelector(
          '.breadcrumbs-container .label-name, ' +
          '.monaco-breadcrumbs .label-name, ' +
          '[class*="breadcrumb"] [class*="label"]'
        );
        if (breadcrumb) {
          editorState.activeFile = breadcrumb.textContent?.trim() || null;
        }
      }

      // Language detection from Monaco
      const langSelector = document.querySelector(
        '.editor-status-mode, ' +
        '[class*="status"][class*="mode"], ' +
        '.statusbar-item [class*="language"]'
      );
      if (langSelector) {
        editorState.activeLanguage = langSelector.textContent?.trim() || null;
      }

      // Open tabs
      const tabs = document.querySelectorAll(
        '.tab .label-name, ' +
        '.tab .tab-label, ' +
        '[class*="tab"]:not([class*="active"]) [class*="label"]'
      );
      tabs.forEach(tab => {
        const name = tab.textContent?.trim();
        if (name && !editorState.openTabs.includes(name)) {
          editorState.openTabs.push(name);
        }
      });

      // Cursor position from status bar
      const cursorInfo = document.querySelector(
        '.editor-status-cursor, ' +
        '[class*="status"][class*="cursor"], ' +
        '.statusbar-item [class*="line"]'
      );
      if (cursorInfo) {
        editorState.cursorPosition = cursorInfo.textContent?.trim() || null;
      }
    }

    // ─── CodeMirror Detection ──────────────────────────────────
    const codeMirror = document.querySelector('.CodeMirror, .cm-editor');
    if (codeMirror && !editorState.hasEditor) {
      editorState.hasEditor = true;
      editorState.editorType = 'codemirror';

      // CodeMirror 6 language detection
      const cmLang = codeMirror.querySelector('[class*="language-"]');
      if (cmLang) {
        const langClass = Array.from(cmLang.classList).find(c => c.startsWith('language-'));
        if (langClass) {
          editorState.activeLanguage = langClass.replace('language-', '');
        }
      }
    }

    // ─── Ace Editor Detection ──────────────────────────────────
    const aceEditor = document.querySelector('.ace_editor');
    if (aceEditor && !editorState.hasEditor) {
      editorState.hasEditor = true;
      editorState.editorType = 'ace';
    }

    // ─── VS Code Web / code-server Detection ──────────────────
    const vscodeWeb = document.querySelector(
      '.monaco-workbench, ' +
      '#workbench\\.parts\\.editor, ' +
      '[id*="workbench"]'
    );
    if (vscodeWeb) {
      editorState.isVSCodeWeb = true;

      // Try to get workspace name from title bar
      const titleBar = document.querySelector(
        '.window-title, ' +
        '[class*="titlebar"] [class*="title"], ' +
        '.title-label'
      );
      if (titleBar) {
        editorState.workspaceName = titleBar.textContent?.trim() || null;
      }
    }

    // ─── Generic: Xterm.js Terminal Detection ──────────────────
    const terminal = document.querySelector('.xterm, .terminal, [class*="xterm"]');
    editorState.hasTerminal = !!terminal;
    if (terminal) {
      // Check if terminal is active/focused
      editorState.terminalActive = terminal.classList.contains('focus') ||
        terminal.querySelector('.xterm-focus') !== null;
    }

    return editorState;
  }

  // ── DOM: File Tree / Sidebar ─────────────────────────────────────

  function extractSidebarState() {
    const sidebar = {
      visible: false,
      activePanel: null,
      fileTreeVisible: false,
      selectedFile: null,
      expandedFolders: []
    };

    // Check for sidebar/explorer visibility
    const sidebarEl = document.querySelector(
      '.sidebar, ' +
      '.explorer-viewlet, ' +
      '[class*="sidebar"], ' +
      '[class*="explorer"], ' +
      '.activitybar'
    );
    sidebar.visible = !!sidebarEl;

    // Activity bar active item (Files, Search, Git, etc.)
    const activeActivityItem = document.querySelector(
      '.activitybar .action-item.checked, ' +
      '.activitybar .action-item.active, ' +
      '[class*="activitybar"] [class*="active"]'
    );
    if (activeActivityItem) {
      sidebar.activePanel = activeActivityItem.getAttribute('aria-label') ||
        activeActivityItem.getAttribute('title') ||
        activeActivityItem.textContent?.trim() || null;
    }

    // File explorer
    const fileTree = document.querySelector(
      '.explorer-folders-view, ' +
      '.tree-explorer-viewlet, ' +
      '[class*="file-tree"], ' +
      '[class*="explorer"][class*="tree"]'
    );
    sidebar.fileTreeVisible = !!fileTree;

    // Selected file in explorer
    const selectedTreeItem = document.querySelector(
      '.explorer-item.selected, ' +
      '.tree-explorer-viewlet .selected .label-name, ' +
      '[class*="tree"] [class*="selected"] [class*="label"]'
    );
    if (selectedTreeItem) {
      sidebar.selectedFile = selectedTreeItem.textContent?.trim() || null;
    }

    return sidebar;
  }

  // ── DOM: Status Bar / Bottom Bar ─────────────────────────────────

  function extractStatusBarInfo() {
    const statusBar = {
      visible: false,
      items: [],
      git: null,
      encoding: null,
      lineEnding: null,
      indentation: null,
      language: null,
      notifications: 0
    };

    const statusBarEl = document.querySelector(
      '.statusbar, ' +
      '[class*="statusbar"], ' +
      '[class*="status-bar"]'
    );
    statusBar.visible = !!statusBarEl;

    if (statusBarEl) {
      // Collect all status bar items
      const items = statusBarEl.querySelectorAll(
        '.statusbar-item, ' +
        '[class*="status-item"], ' +
        '[class*="statusbar"] > *'
      );
      items.forEach(item => {
        const text = item.textContent?.trim();
        if (text) {
          statusBar.items.push(text);
        }
      });

      // Git branch
      const gitItem = statusBarEl.querySelector(
        '[class*="git"], ' +
        '[class*="branch"], ' +
        '[aria-label*="branch"], ' +
        '[title*="branch"]'
      );
      if (gitItem) {
        statusBar.git = gitItem.textContent?.trim() || null;
      }

      // Encoding
      const encodingItem = statusBarEl.querySelector(
        '[class*="encoding"], ' +
        '[aria-label*="encoding"]'
      );
      if (encodingItem) {
        statusBar.encoding = encodingItem.textContent?.trim() || null;
      }

      // Language mode
      const langItem = statusBarEl.querySelector(
        '[class*="mode"], ' +
        '[class*="language"], ' +
        '[aria-label*="language"]'
      );
      if (langItem) {
        statusBar.language = langItem.textContent?.trim() || null;
      }
    }

    // Notification count
    const notifications = document.querySelectorAll(
      '.notification, ' +
      '[class*="notification-count"], ' +
      '.badge'
    );
    statusBar.notifications = notifications.length;

    return statusBar;
  }

  // ── DOM: Page-Level UI Elements ──────────────────────────────────

  function extractPageElements() {
    const page = {
      hasNavbar: false,
      hasBreadcrumbs: false,
      hasModal: false,
      hasPanel: false,
      panelContent: null,
      breadcrumbPath: [],
      navItems: []
    };

    // Navbar / top bar
    const navbar = document.querySelector(
      'nav, ' +
      '.navbar, ' +
      '[class*="navbar"], ' +
      '[class*="topbar"], ' +
      'header'
    );
    page.hasNavbar = !!navbar;

    // Navigation items
    if (navbar) {
      const navLinks = navbar.querySelectorAll('a, button, [role="menuitem"]');
      navLinks.forEach(link => {
        const text = link.textContent?.trim();
        if (text && text.length < 50) {
          page.navItems.push(text);
        }
      });
    }

    // Breadcrumbs
    const breadcrumbs = document.querySelector(
      '.breadcrumbs, ' +
      '[class*="breadcrumb"], ' +
      '[aria-label="breadcrumb"]'
    );
    page.hasBreadcrumbs = !!breadcrumbs;
    if (breadcrumbs) {
      const crumbs = breadcrumbs.querySelectorAll('a, span, li');
      crumbs.forEach(crumb => {
        const text = crumb.textContent?.trim();
        if (text && text.length < 100) {
          page.breadcrumbPath.push(text);
        }
      });
    }

    // Modal / dialog
    const modal = document.querySelector(
      '.modal, ' +
      '[role="dialog"], ' +
      '[class*="modal"][class*="visible"], ' +
      '[class*="dialog"]'
    );
    page.hasModal = !!modal;

    // Bottom panel (terminal, output, etc.)
    const panel = document.querySelector(
      '.panel, ' +
      '[class*="panel"][class*="bottom"], ' +
      '.output-panel'
    );
    page.hasPanel = !!panel;
    if (panel) {
      const panelTitle = panel.querySelector(
        '.panel-title, ' +
        '[class*="panel"] [class*="title"], ' +
        '.tab.active'
      );
      if (panelTitle) {
        page.panelContent = panelTitle.textContent?.trim() || null;
      }
    }

    return page;
  }

  // ── DOM: ORGN CDE Specific Elements ──────────────────────────────

  function extractOrgnSpecific() {
    const orgn = {
      projectName: null,
      trialName: null,
      trialStatus: null,
      workspaceName: null,
      userName: null,
      organizationName: null,
      currentView: null,
      isIDE: false,
      ideType: null
    };

    // Try various selectors that might contain project/trial info
    // These are speculative - the actual ORGN CDE DOM will reveal which work

    // Look for data attributes
    const dataElements = document.querySelectorAll('[data-project], [data-trial], [data-workspace]');
    dataElements.forEach(el => {
      if (el.dataset.project) orgn.projectName = el.dataset.project;
      if (el.dataset.trial) orgn.trialName = el.dataset.trial;
      if (el.dataset.workspace) orgn.workspaceName = el.dataset.workspace;
    });

    // Look for common patterns in ORGN CDE UI
    // Header / top-level project indicators
    const headerTexts = document.querySelectorAll(
      'h1, h2, h3, ' +
      '[class*="project-name"], ' +
      '[class*="projectName"], ' +
      '[class*="trial-name"], ' +
      '[class*="trialName"], ' +
      '[class*="workspace-name"], ' +
      '[class*="workspaceName"]'
    );
    headerTexts.forEach(el => {
      const text = el.textContent?.trim();
      if (!text || text.length > 100) return;

      // Check class hints
      const classes = el.className || '';
      if (/project/i.test(classes) && !orgn.projectName) {
        orgn.projectName = text;
      }
      if (/trial/i.test(classes) && !orgn.trialName) {
        orgn.trialName = text;
      }
      if (/workspace/i.test(classes) && !orgn.workspaceName) {
        orgn.workspaceName = text;
      }
    });

    // User info (avatar area, user menu, etc.)
    const userEl = document.querySelector(
      '[class*="user-name"], ' +
      '[class*="userName"], ' +
      '[class*="avatar"] + span, ' +
      '[class*="user-info"], ' +
      '[class*="profile-name"]'
    );
    if (userEl) {
      orgn.userName = userEl.textContent?.trim() || null;
    }

    // Organization
    const orgEl = document.querySelector(
      '[class*="org-name"], ' +
      '[class*="orgName"], ' +
      '[class*="organization"], ' +
      '[class*="team-name"]'
    );
    if (orgEl) {
      orgn.organizationName = orgEl.textContent?.trim() || null;
    }

    // Trial status (running, stopped, etc.)
    const statusEl = document.querySelector(
      '[class*="trial-status"], ' +
      '[class*="trialStatus"], ' +
      '[class*="status-badge"], ' +
      '[class*="status"][class*="indicator"]'
    );
    if (statusEl) {
      orgn.trialStatus = statusEl.textContent?.trim() || null;
    }

    // Detect if we are in an IDE view (iframe or embedded editor)
    const ideFrame = document.querySelector(
      'iframe[src*="code"], ' +
      'iframe[src*="editor"], ' +
      'iframe[src*="vscode"], ' +
      'iframe[src*="theia"], ' +
      'iframe[src*="jupyter"]'
    );
    if (ideFrame) {
      orgn.isIDE = true;
      const src = ideFrame.getAttribute('src') || '';
      if (/vscode|code-server/i.test(src)) orgn.ideType = 'vscode-web';
      else if (/theia/i.test(src)) orgn.ideType = 'theia';
      else if (/jupyter/i.test(src)) orgn.ideType = 'jupyter';
      else orgn.ideType = 'unknown';
    }

    // Also check if the page itself IS the IDE (not in iframe)
    if (!orgn.isIDE) {
      const isDirectIDE = document.querySelector(
        '.monaco-workbench, ' +
        '#workbench\\.parts\\.editor, ' +
        '.theia-ApplicationShell, ' +
        '#jupyter-main-app'
      );
      if (isDirectIDE) {
        orgn.isIDE = true;
        if (document.querySelector('.theia-ApplicationShell')) orgn.ideType = 'theia';
        else if (document.querySelector('#jupyter-main-app')) orgn.ideType = 'jupyter';
        else orgn.ideType = 'vscode-web';
      }
    }

    // Determine current view from URL and DOM context
    const pathname = window.location.pathname;
    if (/\/editor\b/i.test(pathname) || orgn.isIDE) {
      orgn.currentView = 'editor';
    } else if (/\/projects\/?$/i.test(pathname)) {
      orgn.currentView = 'projects-list';
    } else if (/\/projects\/[^/]+\/?$/i.test(pathname)) {
      orgn.currentView = 'project-detail';
    } else if (/\/trials?\//i.test(pathname)) {
      orgn.currentView = 'trial';
    } else if (/\/settings/i.test(pathname)) {
      orgn.currentView = 'settings';
    } else if (pathname === '/' || pathname === '') {
      orgn.currentView = 'dashboard';
    } else {
      orgn.currentView = 'other';
    }

    return orgn;
  }

  // ── DOM: Detect File Language from Extension ─────────────────────

  function detectLanguageFromFilename(filename) {
    if (!filename) return null;

    const extensionMap = {
      '.js': 'JavaScript', '.jsx': 'React JSX', '.ts': 'TypeScript', '.tsx': 'React TSX',
      '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust',
      '.java': 'Java', '.kt': 'Kotlin', '.scala': 'Scala',
      '.c': 'C', '.cpp': 'C++', '.h': 'C Header', '.hpp': 'C++ Header',
      '.cs': 'C#', '.fs': 'F#',
      '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.less': 'LESS',
      '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
      '.xml': 'XML', '.svg': 'SVG',
      '.md': 'Markdown', '.mdx': 'MDX', '.txt': 'Plain Text',
      '.sh': 'Shell', '.bash': 'Bash', '.zsh': 'Zsh', '.fish': 'Fish',
      '.ps1': 'PowerShell', '.bat': 'Batch',
      '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
      '.dockerfile': 'Dockerfile', '.docker': 'Docker',
      '.vue': 'Vue', '.svelte': 'Svelte', '.astro': 'Astro',
      '.php': 'PHP', '.swift': 'Swift', '.dart': 'Dart',
      '.r': 'R', '.jl': 'Julia', '.lua': 'Lua', '.zig': 'Zig',
      '.tf': 'Terraform', '.hcl': 'HCL',
      '.proto': 'Protocol Buffers', '.wasm': 'WebAssembly',
      '.env': 'Environment', '.gitignore': 'Git Ignore',
      '.lock': 'Lock File', '.config': 'Config'
    };

    // Check full filename first (Dockerfile, Makefile, etc.)
    const lowerName = filename.toLowerCase();
    if (lowerName === 'dockerfile') return 'Dockerfile';
    if (lowerName === 'makefile') return 'Makefile';
    if (lowerName === 'jenkinsfile') return 'Jenkinsfile';
    if (lowerName === '.gitignore') return 'Git Ignore';
    if (lowerName === '.env' || lowerName.startsWith('.env.')) return 'Environment';

    // Match by extension
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex !== -1) {
      const ext = filename.slice(dotIndex).toLowerCase();
      return extensionMap[ext] || null;
    }

    return null;
  }

  // ── Full Extraction ──────────────────────────────────────────────

  function extractFullState() {
    const state = {
      timestamp: Date.now(),
      url: extractUrlInfo(),
      title: extractTitleInfo(),
      meta: extractMetaTags(),
      editor: extractEditorState(),
      sidebar: extractSidebarState(),
      statusBar: extractStatusBarInfo(),
      page: extractPageElements(),
      orgn: extractOrgnSpecific(),
      computed: {} // Computed/derived fields
    };

    // ── Compute derived fields ─────────────────────────────────

    // Best guess at project name
    state.computed.projectName =
      state.orgn.projectName ||
      state.url.routeInfo.projectSlug ||
      state.title.parts.primary ||
      null;

    // Best guess at current activity
    if (state.editor.hasEditor && state.editor.activeFile) {
      state.computed.activity = 'editing';
      state.computed.activityTarget = state.editor.activeFile;
      state.computed.language = state.editor.activeLanguage ||
        detectLanguageFromFilename(state.editor.activeFile);
    } else if (state.editor.hasTerminal && state.editor.terminalActive) {
      state.computed.activity = 'terminal';
      state.computed.activityTarget = 'Terminal';
    } else if (state.orgn.currentView === 'editor') {
      state.computed.activity = 'ide';
      state.computed.activityTarget = state.orgn.ideType || 'IDE';
    } else {
      state.computed.activity = 'browsing';
      state.computed.activityTarget = state.orgn.currentView || 'page';
    }

    // Git branch if available
    state.computed.gitBranch = state.statusBar.git || null;

    // Trial info
    state.computed.trialName =
      state.orgn.trialName ||
      state.title.parts.trialName ||
      state.url.routeInfo.trialId ||
      null;

    state.computed.trialStatus = state.orgn.trialStatus || null;

    return state;
  }

  // ── State Hashing (to detect changes) ────────────────────────────

  function hashState(state) {
    // Create a simple hash from key fields to detect meaningful changes
    const keyFields = [
      state.title.raw,
      state.url.pathname,
      state.computed.activity,
      state.computed.activityTarget,
      state.computed.projectName,
      state.computed.trialName,
      state.computed.language,
      state.computed.gitBranch
    ];
    return keyFields.join('|');
  }

  // ── Message Passing to Background Script ─────────────────────────

  function sendStateToBackground(state) {
    try {
      chrome.runtime.sendMessage({
        type: 'contentScriptState',
        state: state
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Background might not be ready yet, silently ignore
          return;
        }
        if (response?.acknowledged) {
          log('State acknowledged by background');
        }
      });
    } catch (e) {
      // Extension context might be invalidated
      warn('Failed to send state to background:', e.message);
      stopExtraction();
    }
  }

  // ── Extraction Loop ──────────────────────────────────────────────

  function runExtraction() {
    try {
      const state = extractFullState();
      const currentHash = hashState(state);

      // Log full state for diagnostics (always, for testing phase)
      log('=== FULL EXTRACTED STATE ===');
      log('URL:', JSON.stringify(state.url.routeInfo, null, 2));
      log('Title:', JSON.stringify(state.title, null, 2));
      log('Editor:', JSON.stringify(state.editor, null, 2));
      log('ORGN:', JSON.stringify(state.orgn, null, 2));
      log('StatusBar:', JSON.stringify(state.statusBar, null, 2));
      log('Page:', JSON.stringify(state.page, null, 2));
      log('Computed:', JSON.stringify(state.computed, null, 2));
      log('===========================');

      // Only send to background if state changed
      if (currentHash !== lastStateHash) {
        lastStateHash = currentHash;
        log('State changed, sending update to background');
        sendStateToBackground(state);
      }
    } catch (e) {
      warn('Extraction error:', e.message, e.stack);
    }
  }

  // ── MutationObserver for Real-Time Changes ───────────────────────

  function setupMutationObserver() {
    if (mutationObserver) return;

    // Debounce rapid DOM changes
    let debounceTimer = null;

    mutationObserver = new MutationObserver((mutations) => {
      // Filter for relevant mutations (title changes, class changes, etc.)
      const isRelevant = mutations.some(m => {
        // Title changes
        if (m.target.nodeName === 'TITLE') return true;
        // Tab/editor area changes
        if (m.target.closest?.('.tab, .editor, .monaco-editor, .statusbar, [class*="tab"], [class*="editor"]')) return true;
        // Attribute changes on relevant elements
        if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'title')) return true;
        return false;
      });

      if (isRelevant) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          runExtraction();
        }, 500); // Debounce 500ms
      }
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'title', 'data-project', 'data-trial']
    });

    log('MutationObserver active');
  }

  // ── Start / Stop ─────────────────────────────────────────────────

  function startExtraction() {
    log('Starting state extraction (interval: ' + EXTRACT_INTERVAL_MS + 'ms)');

    // Initial extraction
    runExtraction();

    // Periodic extraction
    extractionInterval = setInterval(runExtraction, EXTRACT_INTERVAL_MS);

    // Also watch for DOM changes
    setupMutationObserver();
  }

  function stopExtraction() {
    if (extractionInterval) {
      clearInterval(extractionInterval);
      extractionInterval = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    log('State extraction stopped');
  }

  // ── Listen for Messages from Background/Popup ────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'requestState': {
        // On-demand state extraction
        const state = extractFullState();
        sendResponse({ state });
        return true;
      }

      case 'getDiagnostics': {
        // Return full diagnostics for the popup panel
        const state = extractFullState();
        sendResponse({
          state,
          extractionActive: !!extractionInterval,
          lastHash: lastStateHash,
          debug: DEBUG_MODE
        });
        return true;
      }

      case 'stopExtraction':
        stopExtraction();
        sendResponse({ success: true });
        return true;

      case 'startExtraction':
        startExtraction();
        sendResponse({ success: true });
        return true;
    }
  });

  // ── Title Change Observer (lightweight, always on) ───────────────

  function watchTitleChanges() {
    const titleEl = document.querySelector('title');
    if (!titleEl) return;

    const titleObserver = new MutationObserver(() => {
      log('Title changed:', document.title);
      // Trigger extraction on title change
      runExtraction();
    });

    titleObserver.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true
    });

    log('Title observer active');
  }

  // ── Initialize ───────────────────────────────────────────────────

  function init() {
    log('Content script initialized on:', window.location.href);
    watchTitleChanges();
    startExtraction();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
