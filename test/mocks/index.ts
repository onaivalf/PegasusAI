/**
 * Mocks para testes da PegasusAI
 * Implementações mockadas de serviços externos e dependências
 */

import { jest } from '@jest/globals';

/**
 * Mock para LangChain (usado no Orchestrator)
 */
export const mockLangChain = {
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Mocked AI response' }),
    stream: jest.fn().mockImplementation(async function* () {
      yield { content: 'Streaming ' };
      yield { content: 'response ' };
      yield { content: 'chunks' };
    })
  })),
  
  ChatAnthropic: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Mocked Anthropic response' })
  })),
  
  ChatOllama: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Mocked Ollama response' }),
    endpoint: 'http://localhost:11434'
  })),
  
  PromptTemplate: jest.fn().mockImplementation(() => ({
    format: jest.fn((values: any) => JSON.stringify(values))
  })),
  
  StringOutputParser: jest.fn().mockImplementation(() => ({
    parse: jest.fn((text: string) => text)
  }))
};

/**
 * Mock para SQLite3 com implementação mais realista
 */
export class MockSQLiteDatabase {
  private tables: Map<string, any[]> = new Map();
  private lastID = 0;

  run(sql: string, params: any[], callback: (err: any, thisArg?: any) => void): void {
    this.lastID++;
    // Simula INSERT
    if (sql.toUpperCase().includes('INSERT')) {
      const tableName = sql.match(/INTO\s+(\w+)/i)?.[1];
      if (tableName && this.tables.has(tableName)) {
        this.tables.get(tableName)!.push({ id: this.lastID, params });
      }
      callback.call(null, { lastID: this.lastID, changes: 1 });
    } else {
      callback.call(null, null);
    }
  }

  all(sql: string, params: any[], callback: (err: any, rows?: any[]) => void): void {
    // Simula SELECT
    const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (tableName && this.tables.has(tableName)) {
      callback(null, this.tables.get(tableName)!);
    } else {
      callback(null, []);
    }
  }

  get(sql: string, params: any[], callback: (err: any, row?: any) => void): void {
    const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (tableName && this.tables.has(tableName)) {
      const rows = this.tables.get(tableName)!;
      callback(null, rows.length > 0 ? rows[0] : undefined);
    } else {
      callback(null, undefined);
    }
  }

  close(callback?: (err: any) => void): void {
    if (callback) callback(null);
  }

  serialize(callback: () => void): void {
    callback();
  }
}

export const mockSQLite3 = {
  Database: jest.fn().mockImplementation(() => new MockSQLiteDatabase())
};

/**
 * Mock para Electron IPC com rastreamento de chamadas
 */
export const mockIPCMain = {
  handle: jest.fn((channel: string, listener: Function) => {
    // Registra handler para teste
    (global as any).__mockIPCHandlers = (global as any).__mockIPCHandlers || {};
    (global as any).__mockIPCHandlers[channel] = listener;
  }),
  on: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn()
};

export const mockIPCRenderer = {
  send: jest.fn(),
  invoke: jest.fn().mockImplementation(async (channel: string, ...args: any[]) => {
    // Chama o handler registrado no IPCMain se existir
    const handlers = (global as any).__mockIPCHandlers || {};
    if (handlers[channel]) {
      return await handlers[channel](null, ...args);
    }
    return null;
  }),
  on: jest.fn(),
  removeListener: jest.fn()
};

export const mockElectron = {
  ipcMain: mockIPCMain,
  ipcRenderer: mockIPCRenderer,
  app: {
    getPath: jest.fn((name: string) => `/tmp/pegasusai-test/${name}`),
    getAppPath: jest.fn(() => '/app'),
    getName: jest.fn(() => 'PegasusAI'),
    getVersion: jest.fn(() => '0.1.0')
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn(),
      closeDevTools: jest.fn()
    }
  })),
  dialog: {
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: jest.fn().mockResolvedValue({ canceled: true, filePath: null })
  }
};

/**
 * Mock para fs/promises com sistema de arquivos em memória
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  async readFile(path: string, options?: any): Promise<string | Buffer> {
    if (this.files.has(path)) {
      return this.files.get(path)!;
    }
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
  }

  async writeFile(path: string, data: string | Buffer): Promise<void> {
    this.files.set(path, data.toString());
  }

  async mkdir(path: string, options?: any): Promise<void> {
    this.directories.add(path);
  }

  async access(path: string): Promise<void> {
    if (!this.files.has(path) && !this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
  }

  async stat(path: string): Promise<any> {
    const isDir = this.directories.has(path);
    return {
      isDirectory: () => isDir,
      isFile: () => !isDir
    };
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async readdir(path: string): Promise<string[]> {
    const prefix = path.endsWith('/') ? path : path + '/';
    const paths = Array.from(this.files.keys()).filter(p => p.startsWith(prefix));
    return paths.map(p => p.replace(prefix, '').split('/')[0]);
  }
}

export const mockFsPromises = new MockFileSystem();

/**
 * Mock para TypeScript Compiler API
 */
export const mockTypeScript = {
  createSourceFile: jest.fn().mockReturnValue({
    statements: [],
    forEachChild: jest.fn()
  }),
  
  ScriptTarget: {
    ES2022: 99
  },
  
  ScriptKind: {
    TypeScript: 3
  },
  
  SyntaxKind: {
    ClassDeclaration: 261,
    FunctionDeclaration: 275,
    InterfaceDeclaration: 263,
    VariableStatement: 243,
    ImportDeclaration: 271,
    ExportDeclaration: 273
  },
  
  visitNode: jest.fn(),
  forEachChild: jest.fn()
};

/**
 * Factory para criar entradas de teste
 */
export const testFactories = {
  createMemoryEntry: (overrides: any = {}) => ({
    id: `test-memory-${Date.now()}-${Math.random()}`,
    content: 'Test memory content',
    type: 'code_snippet',
    source: 'test',
    timestamp: new Date().toISOString(),
    tags: ['test'],
    metadata: {},
    ...overrides
  }),

  createTimelineEvent: (overrides: any = {}) => ({
    id: `event-${Date.now()}-${Math.random()}`,
    eventType: 'file_edit',
    timestamp: new Date().toISOString(),
    filePath: '/test/file.ts',
    details: {},
    ...overrides
  }),

  createGraphNode: (overrides: any = {}) => ({
    id: `node-${Date.now()}-${Math.random()}`,
    nodeType: 'function',
    name: 'testFunction',
    filePath: '/test/file.ts',
    startPosition: { line: 1, column: 0 },
    endPosition: { line: 10, column: 0 },
    metadata: {},
    ...overrides
  }),

  createTaskDefinition: (overrides: any = {}) => ({
    id: `task-${Date.now()}-${Math.random()}`,
    type: 'code_generation',
    input: 'Test task input',
    context: {},
    priority: 'normal',
    requirements: {},
    ...overrides
  }),

  createModelInfo: (overrides: any = {}) => ({
    id: `model-${Date.now()}-${Math.random()}`,
    provider: 'ollama',
    name: 'llama2',
    capabilities: ['chat', 'code'],
    isLocal: true,
    isAvailable: true,
    latency: 100,
    ...overrides
  })
};

/**
 * Utilitários para testes assíncronos
 */
export const testUtils = {
  waitFor: (ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)),
  
  retry: async <T>(fn: () => Promise<T>, maxAttempts: number = 3, delay: number = 100): Promise<T> => {
    let lastError: any;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxAttempts - 1) {
          await testUtils.waitFor(delay);
        }
      }
    }
    throw lastError;
  },
  
  createDeferred: <T>() => {
    let resolve: (value: T) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  }
};

// Exportar mocks globais
(global as any).mockLangChain = mockLangChain;
(global as any).mockSQLite3 = mockSQLite3;
(global as any).mockElectron = mockElectron;
(global as any).mockFsPromises = mockFsPromises;
(global as any).mockTypeScript = mockTypeScript;
(global as any).testFactories = testFactories;
(global as any).testUtils = testUtils;
