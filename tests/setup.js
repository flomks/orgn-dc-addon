// Jest setup file for browser extension tests

// Mock Chrome APIs for testing
const chrome = {
  runtime: {
    connectNative: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    onActivated: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  }
};

// Make chrome API available globally in tests
global.chrome = chrome;

// Mock Node.js process for native host tests
if (typeof process === 'undefined') {
  global.process = {
    stdin: {
      on: jest.fn(),
      read: jest.fn()
    },
    stdout: {
      write: jest.fn()
    },
    stderr: {
      write: jest.fn()
    },
    exit: jest.fn(),
    version: 'v20.0.0',
    platform: 'linux',
    arch: 'x64'
  };
}

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Test utilities
global.createMockTab = (overrides = {}) => ({
  id: 1,
  url: 'https://example.com',
  title: 'Example Site',
  active: true,
  ...overrides
});

global.createMockAppConfig = (overrides = {}) => ({
  name: 'Test App',
  details: 'Test Details',
  state: 'Test State',
  enabled: true,
  ...overrides
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});