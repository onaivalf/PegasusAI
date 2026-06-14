/**
 * PegasusAI - VS Code Core Adapter
 * 
 * Camada de adaptação para garantir compatibilidade com a API do VS Code
 * sem acoplamento direto ao Code-OSS. Permite que componentes do VOID,
 * OPIDE e Antigravity funcionem no contexto PegasusAI.
 * 
 * Estratégias:
 * - Shim para APIs não disponíveis
 * - Polyfill para funções do VS Code interno
 * - Wrappers para extensão host
 */

import { Logger } from '../../common/utils/logger';

export interface VSCodeAPI {
  // Workspace
  workspace: {
    openTextDocument: (uri: any) => Promise<any>;
    applyEdit: (edit: any) => Promise<boolean>;
    getWorkspaceFolder: (uri: any) => any;
    textDocuments: any[];
  };
  
  // Window
  window: {
    activeTextEditor: any;
    visibleTextEditors: any[];
    showInformationMessage: (msg: string) => void;
    showWarningMessage: (msg: string) => void;
    showErrorMessage: (msg: string) => void;
    createWebviewPanel: (...args: any[]) => any;
  };
  
  // Commands
  commands: {
    executeCommand: (cmd: string, ...args: any[]) => Promise<any>;
    registerCommand: (cmd: string, callback: (...args: any[]) => any) => any;
  };
  
  // Extensions
  extensions: {
    getExtension: (id: string) => any;
    all: any[];
  };
  
  // Languages
  languages: {
    createDiagnosticCollection: (name: string) => any;
    registerCompletionItemProvider: (...args: any[]) => any;
    registerHoverProvider: (...args: any[]) => any;
  };
  
  // Uri
  Uri: {
    file: (path: string) => any;
    parse: (value: string) => any;
    joinPath: (...args: any[]) => any;
  };
  
  // Range, Position, etc.
  Range: any;
  Position: any;
  CancellationTokenSource: any;
}

/**
 * Adapter que expõe API compatível com VS Code
 * Usado por componentes integrados que esperam 'vscode' module
 */
export class VSCodeAdapter implements VSCodeAPI {
  private logger: Logger;
  private vscodeModule: any = null;

  constructor() {
    this.logger = new Logger('VSCodeAdapter');
  }

  /**
   * Inicializa o adapter carregando módulo vscode real se disponível
   */
  async initialize(): Promise<void> {
    try {
      // Tenta carregar vscode module (disponível em extension context)
      this.vscodeModule = await import('vscode');
      this.logger.info('VSCode module loaded successfully');
    } catch (error) {
      this.logger.warn('VSCode module not available, using shim mode', error);
    }
  }

  get workspace() {
    if (this.vscodeModule) {
      return this.vscodeModule.workspace;
    }
    
    // Shim fallback
    return {
      openTextDocument: async (uri: any) => {
        this.logger.warn('workspace.openTextDocument called in shim mode');
        throw new Error('Not available in shim mode');
      },
      applyEdit: async (edit: any) => {
        this.logger.warn('workspace.applyEdit called in shim mode');
        return false;
      },
      getWorkspaceFolder: (uri: any) => null,
      textDocuments: []
    };
  }

  get window() {
    if (this.vscodeModule) {
      return this.vscodeModule.window;
    }
    
    return {
      activeTextEditor: null,
      visibleTextEditors: [],
      showInformationMessage: (msg: string) => console.log(`[INFO] ${msg}`),
      showWarningMessage: (msg: string) => console.warn(`[WARN] ${msg}`),
      showErrorMessage: (msg: string) => console.error(`[ERROR] ${msg}`),
      createWebviewPanel: (...args: any[]) => {
        this.logger.warn('createWebviewPanel called in shim mode');
        return null;
      }
    };
  }

  get commands() {
    if (this.vscodeModule) {
      return this.vscodeModule.commands;
    }
    
    return {
      executeCommand: async (cmd: string, ...args: any[]) => {
        this.logger.debug(`Command executed (shim): ${cmd}`);
        return null;
      },
      registerCommand: (cmd: string, callback: (...args: any[]) => any) => {
        this.logger.debug(`Command registered (shim): ${cmd}`);
        return { dispose: () => {} };
      }
    };
  }

  get extensions() {
    if (this.vscodeModule) {
      return this.vscodeModule.extensions;
    }
    
    return {
      getExtension: (id: string) => null,
      all: []
    };
  }

  get languages() {
    if (this.vscodeModule) {
      return this.vscodeModule.languages;
    }
    
    return {
      createDiagnosticCollection: (name: string) => ({
        set: () => {},
        clear: () => {},
        dispose: () => {}
      }),
      registerCompletionItemProvider: (...args: any[]) => ({ dispose: () => {} }),
      registerHoverProvider: (...args: any[]) => ({ dispose: () => {} })
    };
  }

  get Uri() {
    if (this.vscodeModule) {
      return this.vscodeModule.Uri;
    }
    
    return {
      file: (path: string) => ({ fsPath: path, scheme: 'file' }),
      parse: (value: string) => ({ toString: () => value }),
      joinPath: (...args: any[]) => args.join('/')
    };
  }

  get Range() {
    return this.vscodeModule?.Range || class Range {};
  }

  get Position() {
    return this.vscodeModule?.Position || class Position {};
  }

  get CancellationTokenSource() {
    return this.vscodeModule?.CancellationTokenSource || class CancellationTokenSource {
      cancel() {}
      dispose() {}
    };
  }
}

/**
 * Shim para Extension Host
 * Permite carregar extensões VS Code em contexto isolado
 */
export class ExtensionHostShim {
  private logger: Logger;
  private loadedExtensions: Map<string, any> = new Map();

  constructor() {
    this.logger = new Logger('ExtensionHostShim');
  }

  /**
   * Carrega extensão pelo ID
   */
  async loadExtension(extensionId: string, extensionPath: string): Promise<boolean> {
    try {
      this.logger.info(`Loading extension: ${extensionId}`);
      
      // Em produção, isso faria require() do package.json e main entry point
      // Aqui é um placeholder para a lógica real de loading
      
      const mockExtension = {
        id: extensionId,
        isActive: true,
        exports: {},
        activate: async () => {
          this.logger.debug(`Extension ${extensionId} activated`);
        }
      };
      
      this.loadedExtensions.set(extensionId, mockExtension);
      return true;
    } catch (error) {
      this.logger.error(`Failed to load extension ${extensionId}`, error);
      return false;
    }
  }

  /**
   * Obtém extensão carregada
   */
  getExtension(extensionId: string): any {
    return this.loadedExtensions.get(extensionId);
  }

  /**
   * Lista todas as extensões carregadas
   */
  getAllExtensions(): any[] {
    return Array.from(this.loadedExtensions.values());
  }

  /**
   * Descarrega extensão
   */
  async unloadExtension(extensionId: string): Promise<boolean> {
    const ext = this.loadedExtensions.get(extensionId);
    if (!ext) return false;

    try {
      if (ext.deactivate) {
        await ext.deactivate();
      }
      this.loadedExtensions.delete(extensionId);
      this.logger.info(`Extension unloaded: ${extensionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unload extension ${extensionId}`, error);
      return false;
    }
  }
}

// Singleton instances
export const vscodeAdapter = new VSCodeAdapter();
export const extensionHostShim = new ExtensionHostShim();
