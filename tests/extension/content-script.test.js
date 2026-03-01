/**
 * Tests for content-script.js state extraction logic
 *
 * Since the content script runs as an IIFE in a browser context,
 * we extract and test the core logic functions independently.
 */

// We need to re-create the extraction functions here for testing
// since the content script wraps everything in an IIFE.

// ── Helper: detectLanguageFromFilename ─────────────────────────

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

  const lowerName = filename.toLowerCase();
  if (lowerName === 'dockerfile') return 'Dockerfile';
  if (lowerName === 'makefile') return 'Makefile';
  if (lowerName === 'jenkinsfile') return 'Jenkinsfile';
  if (lowerName === '.gitignore') return 'Git Ignore';
  if (lowerName === '.env' || lowerName.startsWith('.env.')) return 'Environment';

  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = filename.slice(dotIndex).toLowerCase();
    return extensionMap[ext] || null;
  }

  return null;
}

// ── Helper: URL route parsing (mirrors content script logic) ───

function parseRouteFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const routeInfo = {};

  const projectIdx = segments.indexOf('projects');
  if (projectIdx !== -1 && segments[projectIdx + 1]) {
    routeInfo.projectSlug = segments[projectIdx + 1];
  }

  const trialIdx = segments.indexOf('trials');
  if (trialIdx !== -1 && segments[trialIdx + 1]) {
    routeInfo.trialId = segments[trialIdx + 1];
  }

  const workspaceIdx = segments.indexOf('workspaces');
  if (workspaceIdx !== -1 && segments[workspaceIdx + 1]) {
    routeInfo.workspaceId = segments[workspaceIdx + 1];
  }

  const editorIdx = segments.indexOf('editor');
  if (editorIdx !== -1) {
    routeInfo.isEditor = true;
  }

  const settingsIdx = segments.indexOf('settings');
  if (settingsIdx !== -1) {
    routeInfo.isSettings = true;
  }

  return routeInfo;
}

// ── Helper: Title parsing (mirrors content script logic) ───────

function parseTitleInfo(rawTitle) {
  const cleanTitle = rawTitle
    .replace(/\s*[·|]\s*Orgn\s*CDE\s*$/i, '')
    .replace(/\s+[-–]\s+Orgn\s*CDE\s*$/i, '')
    .trim();

  const parts = {};

  // Only split on " - " or " – " (with spaces), not bare hyphens in names
  const trialMatch = cleanTitle.match(/^(.+?)\s+[-–]\s+Trial$/i);
  if (trialMatch) {
    parts.trialName = trialMatch[1].trim();
    parts.pageType = 'trial';
  }

  const sepMatch = cleanTitle.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (sepMatch && !parts.pageType) {
    parts.primary = sepMatch[1].trim();
    parts.secondary = sepMatch[2].trim();
  }

  return { raw: rawTitle, clean: cleanTitle, parts };
}

// ── Helper: View detection from pathname ───────────────────────

function detectCurrentView(pathname, isIDE, queryTab) {
  if (/\/editor\b/i.test(pathname) || isIDE) return 'editor';
  if (/\/projects\/?$/i.test(pathname)) return 'projects-list';
  if (/\/projects\/[^/]+\/?$/i.test(pathname)) {
    if (queryTab) return 'project-' + queryTab;
    return 'project-detail';
  }
  if (/\/trials?\//i.test(pathname)) return 'trial';
  if (/\/new\/?$/i.test(pathname)) return 'new-project';
  if (/\/chat\/[^/]+/i.test(pathname)) return 'chat-trial';
  if (/\/chat\/?$/i.test(pathname)) return 'chat';
  if (/\/settings/i.test(pathname)) return 'settings';
  if (pathname === '/' || pathname === '') return 'dashboard';
  return 'other';
}


// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('Content Script - Language Detection', () => {
  it('should detect JavaScript files', () => {
    expect(detectLanguageFromFilename('app.js')).toBe('JavaScript');
    expect(detectLanguageFromFilename('index.jsx')).toBe('React JSX');
  });

  it('should detect TypeScript files', () => {
    expect(detectLanguageFromFilename('app.ts')).toBe('TypeScript');
    expect(detectLanguageFromFilename('Component.tsx')).toBe('React TSX');
  });

  it('should detect Python files', () => {
    expect(detectLanguageFromFilename('main.py')).toBe('Python');
  });

  it('should detect Go files', () => {
    expect(detectLanguageFromFilename('main.go')).toBe('Go');
  });

  it('should detect Rust files', () => {
    expect(detectLanguageFromFilename('lib.rs')).toBe('Rust');
  });

  it('should detect config files', () => {
    expect(detectLanguageFromFilename('config.json')).toBe('JSON');
    expect(detectLanguageFromFilename('config.yaml')).toBe('YAML');
    expect(detectLanguageFromFilename('config.yml')).toBe('YAML');
    expect(detectLanguageFromFilename('config.toml')).toBe('TOML');
  });

  it('should detect web files', () => {
    expect(detectLanguageFromFilename('index.html')).toBe('HTML');
    expect(detectLanguageFromFilename('styles.css')).toBe('CSS');
    expect(detectLanguageFromFilename('styles.scss')).toBe('SCSS');
  });

  it('should detect special filenames', () => {
    expect(detectLanguageFromFilename('Dockerfile')).toBe('Dockerfile');
    expect(detectLanguageFromFilename('Makefile')).toBe('Makefile');
    expect(detectLanguageFromFilename('Jenkinsfile')).toBe('Jenkinsfile');
    expect(detectLanguageFromFilename('.gitignore')).toBe('Git Ignore');
    expect(detectLanguageFromFilename('.env')).toBe('Environment');
    expect(detectLanguageFromFilename('.env.local')).toBe('Environment');
  });

  it('should be case-insensitive for special filenames', () => {
    expect(detectLanguageFromFilename('dockerfile')).toBe('Dockerfile');
    expect(detectLanguageFromFilename('makefile')).toBe('Makefile');
  });

  it('should handle unknown extensions', () => {
    expect(detectLanguageFromFilename('file.xyz')).toBeNull();
    expect(detectLanguageFromFilename('noextension')).toBeNull();
  });

  it('should handle null/undefined input', () => {
    expect(detectLanguageFromFilename(null)).toBeNull();
    expect(detectLanguageFromFilename(undefined)).toBeNull();
    expect(detectLanguageFromFilename('')).toBeNull();
  });

  it('should detect framework-specific files', () => {
    expect(detectLanguageFromFilename('App.vue')).toBe('Vue');
    expect(detectLanguageFromFilename('Page.svelte')).toBe('Svelte');
    expect(detectLanguageFromFilename('page.astro')).toBe('Astro');
  });

  it('should detect shell scripts', () => {
    expect(detectLanguageFromFilename('deploy.sh')).toBe('Shell');
    expect(detectLanguageFromFilename('setup.bash')).toBe('Bash');
    expect(detectLanguageFromFilename('run.ps1')).toBe('PowerShell');
    expect(detectLanguageFromFilename('start.bat')).toBe('Batch');
  });

  it('should detect infrastructure files', () => {
    expect(detectLanguageFromFilename('main.tf')).toBe('Terraform');
    expect(detectLanguageFromFilename('config.hcl')).toBe('HCL');
    expect(detectLanguageFromFilename('schema.proto')).toBe('Protocol Buffers');
  });
});

describe('Content Script - URL Route Parsing', () => {
  it('should extract project slug from URL', () => {
    const route = parseRouteFromPath('/projects/my-awesome-project');
    expect(route.projectSlug).toBe('my-awesome-project');
  });

  it('should extract trial ID from URL', () => {
    const route = parseRouteFromPath('/projects/my-project/trials/abc123');
    expect(route.projectSlug).toBe('my-project');
    expect(route.trialId).toBe('abc123');
  });

  it('should extract workspace ID from URL', () => {
    const route = parseRouteFromPath('/workspaces/ws-456');
    expect(route.workspaceId).toBe('ws-456');
  });

  it('should detect editor path', () => {
    const route = parseRouteFromPath('/projects/my-project/trials/abc123/editor');
    expect(route.projectSlug).toBe('my-project');
    expect(route.trialId).toBe('abc123');
    expect(route.isEditor).toBe(true);
  });

  it('should detect settings path', () => {
    const route = parseRouteFromPath('/settings/account');
    expect(route.isSettings).toBe(true);
  });

  it('should handle root path', () => {
    const route = parseRouteFromPath('/');
    expect(route.projectSlug).toBeUndefined();
    expect(route.trialId).toBeUndefined();
  });

  it('should handle empty path', () => {
    const route = parseRouteFromPath('');
    expect(route.projectSlug).toBeUndefined();
  });

  it('should handle complex nested paths', () => {
    const route = parseRouteFromPath('/projects/big-project/trials/trial-1/workspaces/ws-99/editor');
    expect(route.projectSlug).toBe('big-project');
    expect(route.trialId).toBe('trial-1');
    expect(route.workspaceId).toBe('ws-99');
    expect(route.isEditor).toBe(true);
  });
});

describe('Content Script - Title Parsing', () => {
  it('should parse trial title pattern', () => {
    const result = parseTitleInfo('fixes extension - Trial · Orgn CDE');
    expect(result.clean).toBe('fixes extension - Trial');
    expect(result.parts.trialName).toBe('fixes extension');
    expect(result.parts.pageType).toBe('trial');
  });

  it('should parse project title with separator (spaces around dash)', () => {
    const result = parseTitleInfo('myproject - Dashboard · Orgn CDE');
    expect(result.parts.primary).toBe('myproject');
    expect(result.parts.secondary).toBe('Dashboard');
  });

  it('should NOT split hyphenated names like orgn-dc-addon', () => {
    const result = parseTitleInfo('orgn-dc-addon · Orgn CDE');
    expect(result.clean).toBe('orgn-dc-addon');
    // No primary/secondary because there's no " - " with spaces
    expect(result.parts.primary).toBeUndefined();
    expect(result.parts.secondary).toBeUndefined();
  });

  it('should NOT split multi-hyphen names', () => {
    const result = parseTitleInfo('my-cool-project-name · Orgn CDE');
    expect(result.clean).toBe('my-cool-project-name');
    expect(result.parts.primary).toBeUndefined();
  });

  it('should handle simple title', () => {
    const result = parseTitleInfo('Projects · Orgn CDE');
    expect(result.clean).toBe('Projects');
    expect(result.parts.trialName).toBeUndefined();
  });

  it('should handle bare Orgn CDE title', () => {
    // "Orgn CDE" alone doesn't match the " · Orgn CDE" or " | Orgn CDE" suffix patterns
    // because those expect a separator before "Orgn CDE". This is the actual behavior.
    const result = parseTitleInfo('Orgn CDE');
    expect(result.clean).toBe('Orgn CDE');
  });

  it('should handle title with dot separator to Orgn CDE', () => {
    const result = parseTitleInfo(' · Orgn CDE');
    expect(result.clean).toBe('');
  });

  it('should handle title with pipe separator', () => {
    const result = parseTitleInfo('Dashboard | Orgn CDE');
    expect(result.clean).toBe('Dashboard');
  });

  it('should handle title with en-dash trial pattern', () => {
    const result = parseTitleInfo('my trial name \u2013 Trial \u00B7 Orgn CDE');
    expect(result.parts.trialName).toBe('my trial name');
    expect(result.parts.pageType).toBe('trial');
  });

  it('should preserve raw title', () => {
    const raw = 'Some Complex Title · Orgn CDE';
    const result = parseTitleInfo(raw);
    expect(result.raw).toBe(raw);
  });
});

describe('Content Script - View Detection', () => {
  it('should detect editor view', () => {
    expect(detectCurrentView('/projects/p/trials/t/editor', false)).toBe('editor');
  });

  it('should detect editor when IDE flag is set', () => {
    expect(detectCurrentView('/some/path', true)).toBe('editor');
  });

  it('should detect projects list', () => {
    expect(detectCurrentView('/projects/', false)).toBe('projects-list');
    expect(detectCurrentView('/projects', false)).toBe('projects-list');
  });

  it('should detect project detail', () => {
    expect(detectCurrentView('/projects/my-project', false)).toBe('project-detail');
    expect(detectCurrentView('/projects/my-project/', false)).toBe('project-detail');
  });

  it('should detect project detail with tab query param', () => {
    expect(detectCurrentView('/projects/my-project', false, 'tasks')).toBe('project-tasks');
    expect(detectCurrentView('/projects/my-project', false, 'context')).toBe('project-context');
    expect(detectCurrentView('/projects/my-project', false, 'explorer')).toBe('project-explorer');
    expect(detectCurrentView('/projects/my-project', false, 'features')).toBe('project-features');
    expect(detectCurrentView('/projects/my-project', false, 'security')).toBe('project-security');
    expect(detectCurrentView('/projects/my-project', false, 'integrations')).toBe('project-integrations');
    expect(detectCurrentView('/projects/my-project', false, 'usage')).toBe('project-usage');
    expect(detectCurrentView('/projects/my-project', false, 'settings')).toBe('project-settings');
  });

  it('should detect project detail without tab when tab is null', () => {
    expect(detectCurrentView('/projects/my-project', false, null)).toBe('project-detail');
    expect(detectCurrentView('/projects/my-project', false, undefined)).toBe('project-detail');
  });

  it('should detect trial view', () => {
    expect(detectCurrentView('/projects/p/trials/t123', false)).toBe('trial');
    expect(detectCurrentView('/projects/p/trial/t123', false)).toBe('trial');
  });

  it('should detect new project page', () => {
    expect(detectCurrentView('/new', false)).toBe('new-project');
    expect(detectCurrentView('/new/', false)).toBe('new-project');
  });

  it('should detect chat overview page', () => {
    expect(detectCurrentView('/chat', false)).toBe('chat');
    expect(detectCurrentView('/chat/', false)).toBe('chat');
  });

  it('should detect chat trial page', () => {
    expect(detectCurrentView('/chat/c7df83cb-8873-4d1a-8220-05ce0ec9d2bf', false)).toBe('chat-trial');
    expect(detectCurrentView('/chat/123', false)).toBe('chat-trial');
  });

  it('should detect settings', () => {
    expect(detectCurrentView('/settings', false)).toBe('settings');
    expect(detectCurrentView('/settings/account', false)).toBe('settings');
  });

  it('should detect dashboard', () => {
    expect(detectCurrentView('/', false)).toBe('dashboard');
    expect(detectCurrentView('', false)).toBe('dashboard');
  });

  it('should detect unknown as other', () => {
    expect(detectCurrentView('/unknown/path', false)).toBe('other');
  });
});
