/**
 * Setup file for Jest tests
 * Configurações globais e mocks para todos os testes
 */

import { jest } from '@jest/globals';

// Mock para SQLite (usado no MemoryService)
jest.mock('sqlite3', () => ({
  Database: jest.fn().mockImplementation(() => ({
    run: jest.fn((sql, params, callback) => {
      if (typeof callback === 'function') {
        callback.call({ lastID: 1, changes: 1 }, null);
      }
    }),
    all: jest.fn((sql, params, callback) => {
      callback(null, []);
    }),
    get: jest.fn((sql, params, callback) => {
      callback(null, null);
    }),
    close: jest.fn((callback) => {
      if (callback) callback(null);
    }),
    serialize: jest.fn()
  }))
}));

// Mock para Electron IPC
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn()
  },
  ipcRenderer: {
    send: jest.fn(),
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  },
  app: {
    getPath: jest.fn(() => '/tmp/pegasusai-test'),
    getAppPath: jest.fn(() => '/app')
  }
}));

// Mock para fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('mock file content'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ isDirectory: () => true, isFile: () => true })
}));

// Mock para path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn((p) => p.includes('.') ? '.' + p.split('.').pop() : '')
}));

// Global test utilities
global.testUtils = {
  createMockMemoryEntry: (overrides = {}) => ({
    id: 'test-id-' + Date.now(),
    content: 'Test memory content',
    type: 'code_snippet',
    source: 'test',
    timestamp: new Date().toISOString(),
    tags: ['test'],
    metadata: {},
    ...overrides
  }),
  
  createMockTimelineEvent: (overrides = {}) => ({
    id: 'event-' + Date.now(),
    eventType: 'file_edit',
    timestamp: new Date().toISOString(),
    filePath: '/test/file.ts',
    details: {},
    ...overrides
  }),
  
  createMockGraphNode: (overrides = {}) => ({
    id: 'node-' + Date.now(),
    nodeType: 'function',
    name: 'testFunction',
    filePath: '/test/file.ts',
    startPosition: { line: 1, column: 0 },
    endPosition: { line: 10, column: 0 },
    metadata: {},
    ...overrides
  })
};

// Silence console during tests (optional - uncomment to enable)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn()
// };
