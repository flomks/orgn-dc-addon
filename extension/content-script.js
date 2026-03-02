/**
 * ORGN CDE Content Script -- Website State Extractor
 *
 * Runs on ORGN CDE pages to extract rich activity data for Discord Rich
 * Presence.  Communicates with the background service worker via
 * chrome.runtime messaging.
 *
 * Architecture:
 *   1. Periodic extraction (every EXTRACT_INTERVAL_MS)
 *   2. MutationObserver for real-time DOM/title changes
 *   3. On-demand extraction via 'requestState' / 'getDiagnostics' messages
 *   4. Only sends updates to background when state hash changes
 */
(function () {
  'use strict';

  // ── Version guard ────────────────────────────────────────────────
  // Prevents double-injection within the same version while allowing
  // re-injection after extension updates.
  const SCRIPT_VERSION = 6;
  if (window.__orgnBridgeVersion === SCRIPT_VERSION) return;
  window.__orgnBridgeVersion = SCRIPT_VERSION;

  // ── Constants ────────────────────────────────────────────────────
  const EXTRACT_INTERVAL_MS = 3000;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const GENERIC_TITLES = /^(projects?|dashboard|settings|new|orgn cde|new project|chat)$/i;
  const SPACED_SEPARATOR = /^(.+?)\s+[-\u2013]\s+(.+)$/;

  // ── Mutable state ────────────────────────────────────────────────
  let lastStateHash = '';
  let extractionInterval = null;
  let mutationObserver = null;

  // ── Language map ─────────────────────────────────────────────────
  const LANGUAGE_MAP = {
    '.js': 'JavaScript', '.jsx': 'React JSX', '.ts': 'TypeScript', '.tsx': 'React TSX',
    '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust',
    '.java': 'Java', '.kt': 'Kotlin', '.scala': 'Scala',
    '.c': 'C', '.cpp': 'C++', '.h': 'C Header', '.hpp': 'C++ Header',
    '.cs': 'C#', '.fs': 'F#',
    '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.less': 'LESS',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
    '.xml': 'XML', '.svg': 'SVG',
    '.md': 'Markdown', '.mdx': 'MDX', '.txt': 'Plain Text',
    '.sh': 'Shell', '.bash': 'Bash', '.zsh': 'Zsh',
    '.ps1': 'PowerShell', '.bat': 'Batch',
    '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
    '.vue': 'Vue', '.svelte': 'Svelte', '.astro': 'Astro',
    '.php': 'PHP', '.swift': 'Swift', '.dart': 'Dart',
    '.r': 'R', '.jl': 'Julia', '.lua': 'Lua', '.zig': 'Zig',
    '.tf': 'Terraform', '.hcl': 'HCL', '.proto': 'Protocol Buffers',
    '.env': 'Environment', '.gitignore': 'Git Ignore',
    '.dockerfile': 'Dockerfile', '.docker': 'Docker'
  };

  const SPECIAL_FILENAMES = {
    'dockerfile': 'Dockerfile',
    'makefile': 'Makefile',
    'jenkinsfile': 'Jenkinsfile',
    '.gitignore': 'Git Ignore'
  };

  const TAB_LABELS = {
    tasks: 'Viewing Tasks',
    context: 'Viewing Context',
    explorer: 'Browsing Files',
    features: 'Viewing Features',
    security: 'Viewing Security',
    integrations: 'Viewing Integrations',
    usage: 'Viewing Usage',
    settings: 'Project Settings'
  };

  // ── Helpers ──────────────────────────────────────────────────────

  function detectLanguage(filename) {
    if (!filename) return null;
    const lower = filename.toLowerCase();

    // Special filenames (Dockerfile, Makefile, etc.)
    if (SPECIAL_FILENAMES[lower]) return SPECIAL_FILENAMES[lower];
    if (lower === '.env' || lower.startsWith('.env.')) return 'Environment';

    // Extension-based lookup
    const dot = filename.lastIndexOf('.');
    return dot !== -1 ? (LANGUAGE_MAP[filename.slice(dot).toLowerCase()] || null) : null;
  }

  function queryFirst(selectors) {
    return document.querySelector(selectors);
  }

  function textOf(selectors) {
    const el = queryFirst(selectors);
    return el?.textContent?.trim() || null;
  }

  // ── URL Extraction ───────────────────────────────────────────────

  function extractUrl() {
    const loc = window.location;
    const params = Object.fromEntries(new URLSearchParams(loc.search));
    const segments = loc.pathname.split('/').filter(Boolean);

    // Route detection
    const route = {};
    const segmentAfter = (name) => {
      const i = segments.indexOf(name);
      return i !== -1 && segments[i + 1] ? segments[i + 1] : null;
    };

    route.projectSlug = segmentAfter('projects');
    route.trialId = segmentAfter('trials');
    route.workspaceId = segmentAfter('workspaces');
    route.chatTrialId = segmentAfter('chat');
    route.isEditor = segments.includes('editor');
    route.isSettings = segments.includes('settings');
    route.isNewProject = segments.includes('new');
    route.isChat = segments.includes('chat');
    route.activeTab = params.tab || null;
    route.activeSubtab = params.subtab || null;

    return {
      url: loc.href,
      hostname: loc.hostname,
      pathname: loc.pathname,
      hash: loc.hash,
      searchParams: params,
      pathInfo: { full: loc.pathname, segments, segmentCount: segments.length },
      routeInfo: route
    };
  }

  // ── Title Extraction ─────────────────────────────────────────────

  function extractTitle() {
    const raw = document.title;

    // Strip platform suffix -- require spaces around dashes to preserve
    // hyphenated names like "orgn-dc-addon"
    const clean = raw
      .replace(/\s*[\u00B7|]\s*Orgn\s*CDE\s*$/i, '')
      .replace(/\s+[-\u2013]\s+Orgn\s*CDE\s*$/i, '')
      .trim();

    const parts = {};
    const trialMatch = clean.match(/^(.+?)\s+[-\u2013]\s+Trial$/i);
    if (trialMatch) {
      parts.trialName = trialMatch[1].trim();
      parts.pageType = 'trial';
    } else {
      const sepMatch = clean.match(SPACED_SEPARATOR);
      if (sepMatch) {
        parts.primary = sepMatch[1].trim();
        parts.secondary = sepMatch[2].trim();
      }
    }

    return { raw, clean, parts };
  }

  // ── Meta Extraction ──────────────────────────────────────────────

  function extractMeta() {
    const all = {};
    document.querySelectorAll('meta').forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content) all[name] = content;
    });

    return {
      all,
      description: all['description'] || null,
      ogTitle: all['og:title'] || null,
      ogDescription: all['og:description'] || null,
      ogImage: all['og:image'] || null,
      ogSiteName: all['og:site-name'] || all['og:site_name'] || null,
      applicationName: all['application-name'] || null,
      themeColor: all['theme-color'] || null
    };
  }

  // ── Editor State ─────────────────────────────────────────────────

  function extractEditor() {
    const state = {
      hasEditor: false,
      editorType: null,
      activeFile: null,
      activeLanguage: null,
      openTabs: [],
      cursorPosition: null,
      isVSCodeWeb: false,
      workspaceName: null,
      hasTerminal: false,
      terminalActive: false
    };

    // Monaco (VS Code, Gitpod, Codespaces)
    if (queryFirst('.monaco-editor')) {
      state.hasEditor = true;
      state.editorType = 'monaco';
      state.activeFile = textOf(
        '.tab.active .label-name, .tab.active .tab-label, ' +
        '[class*="tab"][class*="active"] [class*="label"]'
      ) || textOf(
        '.breadcrumbs-container .label-name, .monaco-breadcrumbs .label-name'
      );
      state.activeLanguage = textOf('.editor-status-mode, [class*="status"][class*="mode"]');
      state.cursorPosition = textOf('.editor-status-cursor, [class*="status"][class*="cursor"]');

      document.querySelectorAll('.tab .label-name, .tab .tab-label').forEach(el => {
        const name = el.textContent?.trim();
        if (name && !state.openTabs.includes(name)) state.openTabs.push(name);
      });
    }

    // CodeMirror
    const cm = queryFirst('.CodeMirror, .cm-editor');
    if (cm && !state.hasEditor) {
      state.hasEditor = true;
      state.editorType = 'codemirror';
      const langEl = cm.querySelector('[class*="language-"]');
      if (langEl) {
        const cls = Array.from(langEl.classList).find(c => c.startsWith('language-'));
        if (cls) state.activeLanguage = cls.replace('language-', '');
      }
    }

    // Ace
    if (queryFirst('.ace_editor') && !state.hasEditor) {
      state.hasEditor = true;
      state.editorType = 'ace';
    }

    // VS Code Web detection
    if (queryFirst('.monaco-workbench, #workbench\\.parts\\.editor')) {
      state.isVSCodeWeb = true;
      state.workspaceName = textOf('.window-title, [class*="titlebar"] [class*="title"]');
    }

    // Terminal
    const term = queryFirst('.xterm, .terminal, [class*="xterm"]');
    state.hasTerminal = !!term;
    if (term) {
      state.terminalActive = term.classList.contains('focus') ||
        !!term.querySelector('.xterm-focus');
    }

    return state;
  }

  // ── Sidebar State ────────────────────────────────────────────────

  function extractSidebar() {
    return {
      visible: !!queryFirst('.sidebar, .explorer-viewlet, [class*="sidebar"], .activitybar'),
      activePanel: textOf('.activitybar .action-item.checked, .activitybar .action-item.active') ||
        queryFirst('.activitybar .action-item.checked')?.getAttribute('aria-label') || null,
      fileTreeVisible: !!queryFirst('.explorer-folders-view, [class*="file-tree"]'),
      selectedFile: textOf('.explorer-item.selected, [class*="tree"] [class*="selected"] [class*="label"]')
    };
  }

  // ── Status Bar ───────────────────────────────────────────────────

  function extractStatusBar() {
    const el = queryFirst('.statusbar, [class*="statusbar"], [class*="status-bar"]');
    const state = { visible: !!el, items: [], git: null, encoding: null, language: null, notifications: 0 };

    if (el) {
      el.querySelectorAll('.statusbar-item, [class*="status-item"]').forEach(item => {
        const t = item.textContent?.trim();
        if (t) state.items.push(t);
      });
      state.git = textOf('[class*="git"], [class*="branch"], [aria-label*="branch"], [title*="branch"]');
      state.encoding = textOf('[class*="encoding"], [aria-label*="encoding"]');
      state.language = textOf('[class*="mode"], [class*="language"], [aria-label*="language"]');
    }

    state.notifications = document.querySelectorAll('.notification, [class*="notification-count"], .badge').length;
    return state;
  }

  // ── Page Elements ────────────────────────────────────────────────

  function extractPage() {
    const navbar = queryFirst('nav, .navbar, [class*="navbar"], [class*="topbar"], header');
    const breadcrumbs = queryFirst('.breadcrumbs, [class*="breadcrumb"], [aria-label="breadcrumb"]');
    const panel = queryFirst('.panel, [class*="panel"][class*="bottom"]');

    const page = {
      hasNavbar: !!navbar,
      hasBreadcrumbs: !!breadcrumbs,
      hasModal: !!queryFirst('.modal, [role="dialog"], [class*="dialog"]'),
      hasPanel: !!panel,
      panelContent: null,
      breadcrumbPath: [],
      navItems: []
    };

    if (navbar) {
      navbar.querySelectorAll('a, button, [role="menuitem"]').forEach(el => {
        const t = el.textContent?.trim();
        if (t && t.length < 50) page.navItems.push(t);
      });
    }

    if (breadcrumbs) {
      breadcrumbs.querySelectorAll('a, span, li').forEach(el => {
        const t = el.textContent?.trim();
        if (t && t.length < 100) page.breadcrumbPath.push(t);
      });
    }

    if (panel) {
      page.panelContent = textOf('.panel-title, [class*="panel"] [class*="title"]');
    }

    return page;
  }

  // ── ORGN-Specific State ──────────────────────────────────────────

  function extractOrgn() {
    const orgn = {
      projectName: null, trialName: null, trialStatus: null,
      workspaceName: null, userName: null, organizationName: null,
      currentView: null, activeTab: null, activeSubtab: null,
      isIDE: false, ideType: null
    };

    // Data attributes
    document.querySelectorAll('[data-project], [data-trial], [data-workspace]').forEach(el => {
      if (el.dataset.project) orgn.projectName = el.dataset.project;
      if (el.dataset.trial) orgn.trialName = el.dataset.trial;
      if (el.dataset.workspace) orgn.workspaceName = el.dataset.workspace;
    });

    // Class-based detection
    document.querySelectorAll(
      'h1, h2, h3, [class*="project-name"], [class*="projectName"], ' +
      '[class*="trial-name"], [class*="trialName"]'
    ).forEach(el => {
      const text = el.textContent?.trim();
      if (!text || text.length > 100) return;
      const cls = el.className || '';
      if (/project/i.test(cls) && !orgn.projectName) orgn.projectName = text;
      if (/trial/i.test(cls) && !orgn.trialName) orgn.trialName = text;
    });

    orgn.userName = textOf('[class*="user-name"], [class*="userName"], [class*="user-info"]');
    orgn.organizationName = textOf('[class*="org-name"], [class*="orgName"], [class*="organization"]');
    orgn.trialStatus = textOf('[class*="trial-status"], [class*="trialStatus"], [class*="status-badge"]');

    // IDE detection (iframe)
    const ideFrame = queryFirst(
      'iframe[src*="code"], iframe[src*="editor"], iframe[src*="vscode"], ' +
      'iframe[src*="theia"], iframe[src*="jupyter"]'
    );
    if (ideFrame) {
      orgn.isIDE = true;
      const src = ideFrame.getAttribute('src') || '';
      if (/vscode|code-server/i.test(src)) orgn.ideType = 'vscode-web';
      else if (/theia/i.test(src)) orgn.ideType = 'theia';
      else if (/jupyter/i.test(src)) orgn.ideType = 'jupyter';
      else orgn.ideType = 'unknown';
    }

    // IDE detection (direct)
    if (!orgn.isIDE && queryFirst('.monaco-workbench, #workbench\\.parts\\.editor, .theia-ApplicationShell, #jupyter-main-app')) {
      orgn.isIDE = true;
      if (queryFirst('.theia-ApplicationShell')) orgn.ideType = 'theia';
      else if (queryFirst('#jupyter-main-app')) orgn.ideType = 'jupyter';
      else orgn.ideType = 'vscode-web';
    }

    // Current view from URL + query params
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const qTab = params.get('tab');

    if (/\/editor\b/i.test(pathname) || orgn.isIDE) {
      orgn.currentView = 'editor';
    } else if (/\/projects\/?$/i.test(pathname)) {
      orgn.currentView = 'projects-list';
    } else if (/\/projects\/[^/]+\/?$/i.test(pathname)) {
      orgn.currentView = qTab ? 'project-' + qTab : 'project-detail';
    } else if (/\/trials?\//i.test(pathname)) {
      orgn.currentView = 'trial';
    } else if (/\/new\/?$/i.test(pathname)) {
      orgn.currentView = 'new-project';
    } else if (/\/chat\/[^/]+/i.test(pathname)) {
      orgn.currentView = 'chat-trial';
    } else if (/\/chat\/?$/i.test(pathname)) {
      orgn.currentView = 'chat';
    } else if (/\/settings/i.test(pathname)) {
      orgn.currentView = 'settings';
    } else if (pathname === '/' || pathname === '') {
      orgn.currentView = 'dashboard';
    } else {
      orgn.currentView = 'other';
    }

    orgn.activeTab = qTab || null;
    orgn.activeSubtab = params.get('subtab') || null;

    return orgn;
  }

  // ── Full State Extraction ────────────────────────────────────────

  function extractFullState() {
    const url = extractUrl();
    const title = extractTitle();
    const meta = extractMeta();
    const editor = extractEditor();
    const sidebar = extractSidebar();
    const statusBar = extractStatusBar();
    const page = extractPage();
    const orgn = extractOrgn();

    // ── Computed fields ──────────────────────────────────────────
    const computed = {};
    const view = orgn.currentView || '';
    const titleClean = title.clean || null;

    // Project name resolution (priority order)
    const metaMatch = (meta.description || '').match(/^Project\s+(.+?)\s+in\s+Orgn\s*CDE$/i);
    const metaProjectName = metaMatch ? metaMatch[1].trim() : null;
    const isProjectPage = view.startsWith('project');
    const titleName = isProjectPage && titleClean && !GENERIC_TITLES.test(titleClean) ? titleClean : null;
    const slug = url.routeInfo.projectSlug;

    computed.projectName = orgn.projectName || metaProjectName || titleName ||
      (slug && !UUID_RE.test(slug) ? slug : null) || null;

    // Active tab/subtab
    computed.activeTab = orgn.activeTab || url.routeInfo.activeTab || null;
    computed.activeSubtab = orgn.activeSubtab || url.routeInfo.activeSubtab || null;

    // Activity detection
    if (editor.hasEditor && editor.activeFile) {
      computed.activity = 'editing';
      computed.activityTarget = editor.activeFile;
      computed.language = editor.activeLanguage || detectLanguage(editor.activeFile);
    } else if (editor.hasTerminal && editor.terminalActive) {
      computed.activity = 'terminal';
      computed.activityTarget = 'Terminal';
    } else if (view === 'editor') {
      computed.activity = 'ide';
      computed.activityTarget = orgn.ideType || 'IDE';
    } else if (view === 'chat-trial') {
      computed.activity = 'chat-trial';
      computed.activityTarget = titleClean || 'Chat';
    } else if (computed.activeTab) {
      const label = TAB_LABELS[computed.activeTab] ||
        ('Viewing ' + computed.activeTab.charAt(0).toUpperCase() + computed.activeTab.slice(1));
      computed.activity = 'tab';
      computed.activityTarget = label;
    } else {
      computed.activity = 'browsing';
      computed.activityTarget = view || 'page';
    }

    // Git / trial
    computed.gitBranch = statusBar.git || null;
    computed.trialName = orgn.trialName || title.parts.trialName || url.routeInfo.trialId || null;
    computed.trialStatus = orgn.trialStatus || null;

    if (view === 'chat-trial') {
      computed.trialId = url.routeInfo.chatTrialId || null;
      if (!computed.trialName && titleClean && !GENERIC_TITLES.test(titleClean)) {
        computed.trialName = titleClean;
      }
    }

    return { timestamp: Date.now(), url, title, meta, editor, sidebar, statusBar, page, orgn, computed };
  }

  // ── State hash ───────────────────────────────────────────────────

  function hashState(s) {
    return [
      s.title.raw, s.url.url, s.computed.activity, s.computed.activityTarget,
      s.computed.projectName, s.computed.trialName, s.computed.activeTab,
      s.computed.activeSubtab, s.computed.language, s.computed.gitBranch
    ].join('|');
  }

  // ── Communication ────────────────────────────────────────────────

  function sendToBackground(state) {
    try {
      chrome.runtime.sendMessage({ type: 'contentScriptState', state }, () => {
        if (chrome.runtime.lastError) { /* background not ready */ }
      });
    } catch {
      stopExtraction();
    }
  }

  // ── Extraction loop ──────────────────────────────────────────────

  function runExtraction() {
    try {
      const state = extractFullState();
      const hash = hashState(state);
      if (hash !== lastStateHash) {
        lastStateHash = hash;
        sendToBackground(state);
      }
    } catch (e) {
      console.warn('[ORGN Bridge] Extraction error:', e.message);
    }
  }

  // ── Observers ────────────────────────────────────────────────────

  function setupObservers() {
    // Title observer
    const titleEl = document.querySelector('title');
    if (titleEl) {
      new MutationObserver(() => runExtraction()).observe(titleEl, {
        childList: true, characterData: true, subtree: true
      });
    }

    // DOM observer (debounced)
    let debounce = null;
    mutationObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some(m =>
        m.target.nodeName === 'TITLE' ||
        m.target.closest?.('.tab, .editor, .monaco-editor, .statusbar') ||
        (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'title'))
      );
      if (relevant) {
        clearTimeout(debounce);
        debounce = setTimeout(runExtraction, 500);
      }
    });

    mutationObserver.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'title', 'data-project', 'data-trial']
    });
  }

  // ── Start / Stop ─────────────────────────────────────────────────

  function startExtraction() {
    runExtraction();
    extractionInterval = setInterval(runExtraction, EXTRACT_INTERVAL_MS);
    setupObservers();
  }

  function stopExtraction() {
    if (extractionInterval) { clearInterval(extractionInterval); extractionInterval = null; }
    if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
  }

  // ── Message handler ──────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'requestState' || message.type === 'getDiagnostics') {
      const state = extractFullState();
      sendResponse(message.type === 'getDiagnostics'
        ? { state, extractionActive: !!extractionInterval, lastHash: lastStateHash }
        : { state }
      );
      return true;
    }
    if (message.type === 'stopExtraction') { stopExtraction(); sendResponse({ success: true }); return true; }
    if (message.type === 'startExtraction') { startExtraction(); sendResponse({ success: true }); return true; }
  });

  // ── Init ─────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExtraction);
  } else {
    startExtraction();
  }
})();
