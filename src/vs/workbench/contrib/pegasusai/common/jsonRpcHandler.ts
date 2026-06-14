/*---------------------------------------------------------------------------------------------
 *  PegasusAI - JSON-RPC 2.0 Handler for Production LSP Communication
 *  Copyright (c) PegasusAI Project. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { CancellationToken } from 'vs/base/common/cancellation';

export interface JsonRpcRequest {
	jsonrpc: '2.0';
	id?: string | number;
	method: string;
	params?: any;
}

export interface JsonRpcResponse {
	jsonrpc: '2.0';
	id?: string | number;
	result?: any;
	error?: JsonRpcError;
}

export interface JsonRpcError {
	code: number;
	message: string;
	data?: any;
}

export interface JsonRpcNotification {
	jsonrpc: '2.0';
	method: string;
	params?: any;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export class JsonRpcHandler extends Disposable {
	private readonly _onMessage = this._register(new Emitter<JsonRpcMessage>());
	public readonly onMessage: Event<JsonRpcMessage> = this._onMessage.event;

	private readonly _onError = this._register(new Emitter<{ error: JsonRpcError, context: any }>());
	public readonly onError: Event<{ error: JsonRpcError, context: any }> = this._onError.event;

	private readonly pendingRequests = new Map<string | number, {
		resolve: (result: any) => void;
		reject: (error: JsonRpcError) => void;
		timeoutTimer: NodeJS.Timeout;
	}>();

	private static readonly REQUEST_TIMEOUT_MS = 30000; // 30s timeout padrão para LSP

	constructor() {
		super();
	}

	/**
	 * Processa uma mensagem recebida (string ou objeto)
	 */
	public receive(rawData: string | Buffer): void {
		let messageStr: string;
		if (rawData instanceof Buffer) {
			messageStr = rawData.toString('utf8');
		} else {
			messageStr = rawData;
		}

		try {
			const parsed = JSON.parse(messageStr);
			const messages = Array.isArray(parsed) ? parsed : [parsed];

			for (const msg of messages) {
				this.validateMessage(msg);
				this.handleParsedMessage(msg);
			}
		} catch (err) {
			this._onError.fire({
				error: { code: -32700, message: 'Parse error', data: err },
				context: { rawData: messageStr.substring(0, 100) }
			});
		}
	}

	/**
	 * Envia uma requisição e retorna uma Promise com o resultado
	 */
	public sendRequest<T>(method: string, params?: any, token?: CancellationToken): Promise<T> {
		const id = generateUuid();
		const request: JsonRpcRequest = {
			jsonrpc: '2.0',
			id,
			method,
			params
		};

		return new Promise<T>((resolve, reject) => {
			const timeoutTimer = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject({ code: -32000, message: `Request timeout for method: ${method}` });
			}, JsonRpcHandler.REQUEST_TIMEOUT_MS);

			this.pendingRequests.set(id, { resolve, reject, timeoutTimer });

			// Cancelamento via Token
			if (token) {
				token.onCancellationRequested(() => {
					if (this.pendingRequests.has(id)) {
						this.pendingRequests.delete(id);
						clearTimeout(timeoutTimer);
						reject({ code: -32800, message: 'Request cancelled' });
					}
				});
			}

			this.sendRaw(request);
		});
	}

	/**
	 * Envia uma notificação (sem resposta esperada)
	 */
	public sendNotification(method: string, params?: any): void {
		const notification: JsonRpcNotification = {
			jsonrpc: '2.0',
			method,
			params
		};
		this.sendRaw(notification);
	}

	/**
	 * Envia uma resposta para uma requisição recebida
	 */
	public sendResponse(id: string | number, result: any): void {
		const response: JsonRpcResponse = {
			jsonrpc: '2.0',
			id,
			result
		};
		this.sendRaw(response);
	}

	/**
	 * Envia um erro como resposta
	 */
	public sendError(id: string | number, code: number, message: string, data?: any): void {
		const response: JsonRpcResponse = {
			jsonrpc: '2.0',
			id,
			error: { code, message, data }
		};
		this.sendRaw(response);
	}

	private sendRaw(message: JsonRpcMessage): void {
		const payload = JSON.stringify(message);
		// Em produção, isso seria enviado para o socket/stream do servidor LSP
		// Aqui emitimos um evento para o serviço de transporte lidar
		this._onMessage.fire(message); 
		// Nota: O LspBridgeService deve ouvir onMessage e escrever no stdout do processo filho
	}

	private handleParsedMessage(msg: JsonRpcMessage): void {
		if (this.isResponse(msg)) {
			this.handleResponse(msg);
		} else if (this.isRequest(msg)) {
			this.handleIncomingRequest(msg);
		} else if (this.isNotification(msg)) {
			this._onMessage.fire(msg); // Repassa notificações para quem estiver ouvindo
		}
	}

	private handleResponse(response: JsonRpcResponse): void {
		if (response.id === undefined) return;
		
		const pending = this.pendingRequests.get(response.id);
		if (!pending) {
			console.warn(`[PegasusAI JSON-RPC] Received response for unknown ID: ${response.id}`);
			return;
		}

		clearTimeout(pending.timeoutTimer);
		this.pendingRequests.delete(response.id);

		if (response.error) {
			pending.reject(response.error);
		} else {
			pending.resolve(response.result);
		}
	}

	private handleIncomingRequest(request: JsonRpcRequest): void {
		// Servidores LSP geralmente não recebem requests do cliente, apenas enviam
		// Mas se recebermos, repassamos como evento para o sistema tratar (ex: workspace/applyEdit)
		this._onMessage.fire(request);
	}

	private validateMessage(msg: any): void {
		if (!msg.jsonrpc || msg.jsonrpc !== '2.0') {
			throw new Error('Invalid JSON-RPC version');
		}
		if ('method' in msg && !msg.method) {
			throw new Error('Method is required for requests/notifications');
		}
	}

	private isResponse(msg: any): msg is JsonRpcResponse {
		return 'result' in msg || 'error' in msg;
	}

	private isRequest(msg: any): msg is JsonRpcRequest {
		return 'id' in msg && 'method' in msg;
	}

	private isNotification(msg: any): msg is JsonRpcNotification {
		return !('id' in msg) && 'method' in msg;
	}
}
