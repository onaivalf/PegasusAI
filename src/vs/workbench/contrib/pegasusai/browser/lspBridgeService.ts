/*---------------------------------------------------------------------------------------------
 *  PegasusAI - LSP Bridge Service
 *  Copyright (c) 2024 PegasusAI. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle';
import { Event, Emitter } from '../../../../base/common/event';
import { ILogService } from '../../../../platform/log/common/log';
import { ILanguageService } from '../../../../editor/common/languages/language';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace';
import { URI } from '../../../../base/common/uri';
import { IFileService } from '../../../../platform/files/common/files';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration';
import { CancellationToken } from '../../../../base/common/cancellation';
import { LanguageClientOptions, ServerOptions, TransportKind } from '../../../services/language/common/languageClient';
import { LanguageClient } from '../../../services/language/common/languageClient';
import { IExtensionDescription } from '../../../../platform/extensions/common/extensions';
import { JsonRpcHandler, JsonRpcMessage } from '../common/jsonRpcHandler';

export interface ILSPBridgeService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Set JSON-RPC handler for robust communication
	 */
	setJsonRpcHandler(handler: JsonRpcHandler): void;
	
	/**
	 * Start a language server for a specific language
	 */
	startLanguageServer(languageId: string, serverCommand: string, args?: string[]): Promise<void>;
	
	/**
	 * Stop a language server
	 */
	stopLanguageServer(languageId: string): Promise<void>;
	
	/**
	 * Register a custom language server
	 */
	registerLanguageServer(languageId: string, options: LSPServerOptions): Promise<void>;
	
	/**
	 * Get active language servers
	 */
	getActiveLanguageServers(): string[];
	
	/**
	 * Send custom LSP request
	 */
	sendCustomRequest(method: string, params: any): Promise<any>;
	
	/**
	 * Restart all language servers
	 */
	restartAllLanguageServers(): Promise<void>;
}

export interface LSPServerOptions {
	command: string;
	args?: string[];
	runtime?: string;
	runtimeArgs?: string[];
	documentSelector?: string[];
	initializationOptions?: any;
}

export class LSPBridgeService extends Disposable implements ILSPBridgeService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeActiveServers = this._register(new Emitter<void>());
	readonly onDidChangeActiveServers = this._onDidChangeActiveServers.event;

	private activeServers: Map<string, LanguageClient> = new Map();
	private registeredServers: Map<string, LSPServerOptions> = new Map();
	private jsonRpcHandler: JsonRpcHandler | null = null;

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILanguageService private readonly languageService: ILanguageService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.logService.info('[PegasusAI] LSPBridgeService initialized');
		
		// Load default LSP configurations
		this.loadDefaultLSPConfigurations();
	}

	setJsonRpcHandler(handler: JsonRpcHandler): void {
		this.jsonRpcHandler = handler;
		this.logService.info('[PegasusAI] JSON-RPC Handler attached to LSP Bridge');
		
		// Subscribe to messages for custom handling
		handler.onMessage((msg) => {
			this.handleJsonRpcMessage(msg);
		});
		
		handler.onError((err) => {
			this.logService.error('[PegasusAI] JSON-RPC Error', err);
		});
	}

	private handleJsonRpcMessage(msg: JsonRpcMessage): void {
		// Handle incoming LSP messages from the JSON-RPC handler
		// This allows bidirectional communication with language servers
		if ('method' in msg) {
			this.logService.debug(`[PegasusAI LSP] Received ${msg.method}`);
			// Forward to appropriate handler based on method
		}
	}

	async startLanguageServer(languageId: string, serverCommand: string, args?: string[]): Promise<void> {
		try {
			this.logService.info(`[PegasusAI] Starting LSP server for ${languageId}: ${serverCommand}`);

			// Check if already running
			if (this.activeServers.has(languageId)) {
				this.logService.warn(`[PegasusAI] LSP server for ${languageId} already running`);
				await this.stopLanguageServer(languageId);
			}

			const serverOptions: ServerOptions = {
				command: serverCommand,
				args: args || [],
				transport: TransportKind.stdio
			};

			const clientOptions: LanguageClientOptions = {
				documentSelector: [{ scheme: 'file', language: languageId }],
				synchronize: {
					configurationSection: languageId,
					fileEvents: []
				},
				initializationOptions: this.getInitializationOptions(languageId)
			};

			const client = new LanguageClient(
				languageId,
				`${languageId} Language Server`,
				serverOptions,
				clientOptions
			);

			// Start the client
			const disposable = client.start();
			this._register(disposable);

			// Wait for server to be ready
			await client.onReady();

			this.activeServers.set(languageId, client);
			this._onDidChangeActiveServers.fire();

			this.logService.info(`[PegasusAI] LSP server for ${languageId} started successfully`);
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to start LSP server for ${languageId}`, error);
			throw error;
		}
	}

	async stopLanguageServer(languageId: string): Promise<void> {
		try {
			this.logService.info(`[PegasusAI] Stopping LSP server for ${languageId}`);

			const client = this.activeServers.get(languageId);
			
			if (client) {
				await client.stop();
				client.dispose();
				this.activeServers.delete(languageId);
				this._onDidChangeActiveServers.fire();
				
				this.logService.info(`[PegasusAI] LSP server for ${languageId} stopped`);
			} else {
				this.logService.warn(`[PegasusAI] No LSP server found for ${languageId}`);
			}
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to stop LSP server for ${languageId}`, error);
			throw error;
		}
	}

	async registerLanguageServer(languageId: string, options: LSPServerOptions): Promise<void> {
		try {
			this.logService.info(`[PegasusAI] Registering LSP server for ${languageId}`);

			this.registeredServers.set(languageId, options);
			
			// Auto-start if the language is active in workspace
			const activeLanguages = await this.getActiveLanguagesInWorkspace();
			if (activeLanguages.includes(languageId)) {
				await this.startLanguageServer(languageId, options.command, options.args);
			}

			this.logService.info(`[PegasusAI] LSP server registered for ${languageId}`);
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to register LSP server for ${languageId}`, error);
			throw error;
		}
	}

	getActiveLanguageServers(): string[] {
		return Array.from(this.activeServers.keys());
	}

	async sendCustomRequest(method: string, params: any): Promise<any> {
		try {
			this.logService.info(`[PegasusAI] Sending custom LSP request: ${method}`);

			// Find appropriate server for the request
			for (const [languageId, client] of this.activeServers.entries()) {
				if (client.isRunning()) {
					try {
						const result = await client.sendRequest(method, params, CancellationToken.None);
						this.logService.info(`[PegasusAI] Custom request ${method} succeeded via ${languageId}`);
						return result;
					} catch (error) {
						// Try next server
						continue;
					}
				}
			}

			throw new Error(`No active LSP server can handle request: ${method}`);
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to send custom request: ${method}`, error);
			throw error;
		}
	}

	async restartAllLanguageServers(): Promise<void> {
		try {
			this.logService.info('[PegasusAI] Restarting all LSP servers...');

			const serversToRestart = Array.from(this.activeServers.keys());
			
			// Stop all
			for (const languageId of serversToRestart) {
				await this.stopLanguageServer(languageId);
			}

			// Start all again
			for (const languageId of serversToRestart) {
				const options = this.registeredServers.get(languageId);
				if (options) {
					await this.startLanguageServer(languageId, options.command, options.args);
				}
			}

			this.logService.info('[PegasusAI] All LSP servers restarted');
		} catch (error) {
			this.logService.error('[PegasusAI] Failed to restart LSP servers', error);
			throw error;
		}
	}

	private loadDefaultLSPConfigurations(): void {
		// Default LSP servers for common languages
		const defaultServers: Record<string, LSPServerOptions> = {
			'typescript': {
				command: 'typescript-language-server',
				args: ['--stdio'],
				documentSelector: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact']
			},
			'python': {
				command: 'pylsp',
				args: [],
				documentSelector: ['python']
			},
			'rust': {
				command: 'rust-analyzer',
				args: [],
				documentSelector: ['rust']
			},
			'go': {
				command: 'gopls',
				args: [],
				documentSelector: ['go']
			},
			'java': {
				command: 'jdtls',
				args: [],
				documentSelector: ['java']
			},
			'cpp': {
				command: 'clangd',
				args: [],
				documentSelector: ['cpp', 'c', 'h', 'hpp']
			}
		};

		// Merge with user configuration
		const userConfig = this.configurationService.getValue<Record<string, LSPServerOptions>>('pegasusai.lsp.servers') || {};
		
		for (const [lang, options] of Object.entries({ ...defaultServers, ...userConfig })) {
			this.registeredServers.set(lang, options);
		}

		this.logService.info(`[PegasusAI] Loaded ${this.registeredServers.size} default LSP configurations`);
	}

	private async getActiveLanguagesInWorkspace(): Promise<string[]> {
		try {
			const workspace = this.contextService.getWorkspace();
			const languages = new Set<string>();

			for (const folder of workspace.folders) {
				const files = await this.fileService.resolve(folder.uri, { recursive: true, depth: 1 });
				
				if (files.children) {
					for (const child of files.children) {
						if (child.resource) {
							const languageId = this.languageService.guessLanguageIdByFilepathOrFirstLine(child.resource);
							if (languageId) {
								languages.add(languageId);
							}
						}
					}
				}
			}

			return Array.from(languages);
		} catch (error) {
			this.logService.error('[PegasusAI] Failed to get active languages', error);
			return [];
		}
	}

	private getInitializationOptions(languageId: string): any {
		return this.configurationService.getValue(`[${languageId}]`) || {};
	}
}
