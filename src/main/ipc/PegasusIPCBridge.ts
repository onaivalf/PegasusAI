/**
 * PegasusAI - IPC Bridge Unificado
 * 
 * Ponte de comunicação segura entre processos Main e Renderer.
 * Substitui chamadas diretas por eventos tipados, prevenindo conflitos
 * entre os códigos do VOID, OPIDE e Antigravity.
 * 
 * Inspirado em:
 * - void/electron/ipc.ts (VOID)
 * - antigravity/src/main/ipc/ (Antigravity)
 * - Code-OSS src/vs/base/parts/ipc/
 */

import { ipcMain, ipcRenderer, webContents } from 'electron';
import { Logger } from '../../common/utils/logger';

// Tipos de canais IPC registrados
export enum IPCChannel {
  // Chat & LLM
  LLM_CHAT_REQUEST = 'pegasus:llm:chat',
  LLM_CHAT_RESPONSE = 'pegasus:llm:response',
  LLM_CHAT_ERROR = 'pegasus:llm:error',
  LLM_CANCEL = 'pegasus:llm:cancel',
  
  // Edição de Código
  CODE_EDIT_REQUEST = 'pegasus:code:edit',
  CODE_EDIT_APPLY = 'pegasus:code:apply',
  CODE_EDIT_ROLLBACK = 'pegasus:code:rollback',
  
  // Provider Management
  PROVIDER_LIST = 'pegasus:provider:list',
  PROVIDER_SET_ACTIVE = 'pegasus:provider:setActive',
  PROVIDER_HEALTH = 'pegasus:provider:health',
  
  // Memória & Contexto
  MEMORY_INDEX = 'pegasus:memory:index',
  MEMORY_QUERY = 'pegasus:memory:query',
  MEMORY_TIMELINE = 'pegasus:memory:timeline',
  
  // Sistema
  APP_READY = 'pegasus:app:ready',
  APP_CONFIG = 'pegasus:app:config',
  LOG_MESSAGE = 'pegasus:log:message'
}

export interface IPCMessage<T = any> {
  channel: IPCChannel;
  payload: T;
  requestId?: string;
  timestamp: number;
}

type HandlerFunction = (payload: any) => Promise<any> | any;

/**
 * Registry centralizado de handlers IPC
 * Previne duplicação e conflitos de nomes entre integrações
 */
export class HandlersRegistry {
  private static instance: HandlersRegistry;
  private handlers: Map<IPCChannel, HandlerFunction> = new Map();
  private logger: Logger;

  private constructor() {
    this.logger = new Logger('HandlersRegistry');
  }

  static getInstance(): HandlersRegistry {
    if (!HandlersRegistry.instance) {
      HandlersRegistry.instance = new HandlersRegistry();
    }
    return HandlersRegistry.instance;
  }

  register(channel: IPCChannel, handler: HandlerFunction): void {
    if (this.handlers.has(channel)) {
      this.logger.warn(`Handler already registered for ${channel}, overriding`);
    }
    this.handlers.set(channel, handler);
    this.logger.debug(`Handler registered for ${channel}`);
  }

  getHandler(channel: IPCChannel): HandlerFunction | undefined {
    return this.handlers.get(channel);
  }

  hasHandler(channel: IPCChannel): boolean {
    return this.handlers.has(channel);
  }

  getAllChannels(): IPCChannel[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Ponte IPC Principal (Processo Main)
 */
export class PegasusIPCBridge {
  private logger: Logger;
  private registry: HandlersRegistry;

  constructor() {
    this.logger = new Logger('PegasusIPCBridge');
    this.registry = HandlersRegistry.getInstance();
  }

  /**
   * Inicializa todos os listeners IPC no processo main
   */
  initialize(): void {
    this.logger.info('Initializing IPC Bridge in Main process');

    // Registrar handler genérico que roteia para handlers específicos
    ipcMain.handle('pegasus:invoke', async (event, message: IPCMessage) => {
      const handler = this.registry.getHandler(message.channel);
      
      if (!handler) {
        const error = `No handler registered for channel: ${message.channel}`;
        this.logger.error(error);
        throw new Error(error);
      }

      try {
        this.logger.debug(`Handling request for ${message.channel}`, { requestId: message.requestId });
        const result = await handler(message.payload);
        return {
          success: true,
          data: result,
          requestId: message.requestId,
          timestamp: Date.now()
        };
      } catch (error) {
        this.logger.error(`Handler error for ${message.channel}`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: message.requestId,
          timestamp: Date.now()
        };
      }
    });

    // Listener para logs do renderer
    ipcMain.on('pegasus:log:message', (event, data: { level: string; message: string }) => {
      this.logger.log(data.level, `[Renderer] ${data.message}`);
    });

    this.logger.info('IPC Bridge initialized successfully');
  }

  /**
   * Envia mensagem para um renderer específico
   */
  sendToRenderer(webContentsId: number, channel: IPCChannel, payload: any): void {
    const contents = webContents.fromId(webContentsId);
    if (!contents) {
      this.logger.warn(`WebContents not found for id: ${webContentsId}`);
      return;
    }

    const message: IPCMessage = {
      channel,
      payload,
      timestamp: Date.now()
    };

    contents.send('pegasus:message', message);
    this.logger.debug(`Sent to renderer ${webContentsId}: ${channel}`);
  }

  /**
   * Broadcast para todos os renderers
   */
  broadcast(channel: IPCChannel, payload: any): void {
    const allContents = webContents.getAllWebContents();
    
    for (const contents of allContents) {
      this.sendToRenderer(contents.id, channel, payload);
    }
    
    this.logger.debug(`Broadcasted to ${allContents.length} renderers: ${channel}`);
  }

  /**
   * Registra um handler para um canal específico
   */
  registerHandler(channel: IPCChannel, handler: HandlerFunction): void {
    this.registry.register(channel, handler);
  }
}

/**
 * Cliente IPC para Processo Renderer
 */
export class PegasusIPCClient {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('PegasusIPCClient');
  }

  /**
   * Invoca um handler no processo main
   */
  async invoke<T = any>(channel: IPCChannel, payload: any): Promise<T> {
    const { ipcRenderer } = await import('electron');

    const message: IPCMessage = {
      channel,
      payload,
      requestId: this.generateRequestId(),
      timestamp: Date.now()
    };

    try {
      const result = await ipcRenderer.invoke('pegasus:invoke', message);
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error from main process');
      }

      return result.data as T;
    } catch (error) {
      this.logger.error(`IPC invoke failed for ${channel}`, error);
      throw error;
    }
  }

  /**
   * Escuta mensagens do processo main
   */
  on(channel: IPCChannel, callback: (payload: any) => void): () => void {
    const { ipcRenderer } = require('electron');

    const listener = (event: any, message: IPCMessage) => {
      if (message.channel === channel) {
        callback(message.payload);
      }
    };

    ipcRenderer.on('pegasus:message', listener);

    // Retorna função de cleanup
    return () => {
      ipcRenderer.removeListener('pegasus:message', listener);
    };
  }

  /**
   * Envia log para o processo main
   */
  sendLog(level: string, message: string): void {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('pegasus:log:message', { level, message });
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instances
export const mainBridge = new PegasusIPCBridge();
export const rendererClient = new PegasusIPCClient();
