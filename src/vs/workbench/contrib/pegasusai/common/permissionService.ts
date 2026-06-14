/*--------------------------------------------------------------------------------------
 *  Copyright 2025 PegasusAI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Sistema de Permissões e Segurança para Operações de Arquivo

import { URI } from '../../../../base/common/uri.js';
import { Emitter } from '../../../../base/common/event.js';

export enum PermissionLevel {
	AUTOMATIC = 'automatic',      // Aprovação automática para operações seguras
	SEMI_AUTOMATIC = 'semi-auto', // Aprovação apenas para operações destrutivas
	MANUAL = 'manual'             // Toda operação requer aprovação
}

export enum OperationType {
	FILE_READ = 'file_read',
	FILE_WRITE = 'file_write',
	FILE_DELETE = 'file_delete',
	FILE_CREATE = 'file_create',
	DIRECTORY_READ = 'directory_read',
	DIRECTORY_CREATE = 'directory_create',
	DIRECTORY_DELETE = 'directory_delete',
	COMMAND_EXECUTE = 'command_execute',
	TERMINAL_ACCESS = 'terminal_access'
}

export interface PermissionRule {
	pattern: string; // Pattern glob ou caminho absoluto
	allowedOperations: OperationType[];
	deniedOperations: OperationType[];
	requireApproval: boolean;
}

export interface PermissionConfig {
	level: PermissionLevel;
	allowedDirectories: string[]; // Whitelist de diretórios
	blockedDirectories: string[]; // Blacklist de diretórios
	customRules: PermissionRule[];
	blockedCommands: string[]; // Comandos bloqueados no terminal
	warnedCommands: string[];  // Comandos que geram warning
}

export interface PermissionRequest {
	operation: OperationType;
	path?: string;
	command?: string;
	description: string;
	riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PermissionResult {
	allowed: boolean;
	requiresApproval: boolean;
	reason?: string;
}

export class PermissionService {
	private readonly _onPermissionRequested = new Emitter<PermissionRequest>();
	public readonly onPermissionRequested = this._onPermissionRequested.event;

	private readonly _onPermissionDenied = new Emitter<PermissionRequest>();
	public readonly onPermissionDenied = this._onPermissionDenied.event;

	private config: PermissionConfig;

	constructor() {
		this.config = this.getDefaultConfig();
	}

	private getDefaultConfig(): PermissionConfig {
		return {
			level: PermissionLevel.SEMI_AUTOMATIC,
			allowedDirectories: [],
			blockedDirectories: [
				'C:\\Windows',
				'C:\\Program Files',
				'C:\\Program Files (x86)',
				'/etc',
				'/bin',
				'/sbin',
				'/usr/bin',
				'/usr/sbin',
				'/System',
				'/Library'
			],
			customRules: [],
			blockedCommands: [
				'rm -rf /',
				'del /f /s /q c:\\*.*',
				'format',
				'dd if=/dev/zero',
				':(){ :|:& };:',
				'mkfs',
				'fdisk',
				'parted'
			],
			warnedCommands: [
				'rm -rf',
				'del /s',
				'rmdir /s',
				'remove-item -recurse -force',
				'sudo',
				'su',
				'chmod 777',
				'chown'
			]
		};
	}

	/**
	 * Configura diretórios permitidos
	 */
	setAllowedDirectories(dirs: string[]): void {
		this.config.allowedDirectories = dirs.map(d => this.normalizePath(d));
	}

	/**
	 * Adiciona um diretório à whitelist
	 */
	addAllowedDirectory(dir: string): void {
		const normalized = this.normalizePath(dir);
		if (!this.config.allowedDirectories.includes(normalized)) {
			this.config.allowedDirectories.push(normalized);
		}
	}

	/**
	 * Remove um diretório da whitelist
	 */
	removeAllowedDirectory(dir: string): void {
		const normalized = this.normalizePath(dir);
		this.config.allowedDirectories = 
			this.config.allowedDirectories.filter(d => d !== normalized);
	}

	/**
	 * Define o nível de permissão
	 */
	setPermissionLevel(level: PermissionLevel): void {
		this.config.level = level;
	}

	/**
	 * Verifica se uma operação é permitida
	 */
	checkPermission(request: PermissionRequest): PermissionResult {
		// Verifica se o caminho está em diretório bloqueado
		if (request.path) {
			const normalizedPath = this.normalizePath(request.path);
			
			for (const blocked of this.config.blockedDirectories) {
				if (normalizedPath.startsWith(this.normalizePath(blocked))) {
					return {
						allowed: false,
						requiresApproval: false,
						reason: `Acesso negado: ${blocked} é um diretório protegido do sistema.`
					};
				}
			}

			// Verifica se está em diretório permitido (se houver whitelist)
			if (this.config.allowedDirectories.length > 0) {
				const isAllowed = this.config.allowedDirectories.some(allowed => 
					normalizedPath.startsWith(this.normalizePath(allowed))
				);
				
				if (!isAllowed) {
					return {
						allowed: false,
						requiresApproval: true,
						reason: `O arquivo está fora dos diretórios permitidos. Adicione "${this.getParentDirectory(normalizedPath)}" à whitelist?`
					};
				}
			}
		}

		// Verifica comandos bloqueados
		if (request.operation === OperationType.COMMAND_EXECUTE && request.command) {
			const cmd = request.command.toLowerCase();
			
			for (const blocked of this.config.blockedCommands) {
				if (cmd.includes(blocked.toLowerCase())) {
					return {
						allowed: false,
						requiresApproval: false,
						reason: `Comando bloqueado por segurança: ${blocked}`
					};
				}
			}

			// Verifica comandos que geram warning
			for (const warned of this.config.warnedCommands) {
				if (cmd.includes(warned.toLowerCase())) {
					request.riskLevel = 'high';
					break;
				}
			}
		}

		// Verifica regras customizadas
		for (const rule of this.config.customRules) {
			if (this.matchesPattern(request.path || '', rule.pattern)) {
				if (rule.deniedOperations.includes(request.operation)) {
					return {
						allowed: false,
						requiresApproval: false,
						reason: `Operação negada por regra customizada: ${rule.pattern}`
					};
				}
			}
		}

		// Decide baseado no nível de permissão
		switch (this.config.level) {
			case PermissionLevel.AUTOMATIC:
				// Apenas operações críticas requerem aprovação
				if (request.riskLevel === 'critical') {
					return { allowed: true, requiresApproval: true };
				}
				return { allowed: true, requiresApproval: false };

			case PermissionLevel.SEMI_AUTOMATIC:
				// Operações destrutivas requerem aprovação
				if ([OperationType.FILE_DELETE, OperationType.DIRECTORY_DELETE, 
				     OperationType.COMMAND_EXECUTE].includes(request.operation)) {
					return { allowed: true, requiresApproval: true };
				}
				return { allowed: true, requiresApproval: false };

			case PermissionLevel.MANUAL:
				// Tudo requer aprovação
				return { allowed: true, requiresApproval: true };

			default:
				return { allowed: true, requiresApproval: false };
		}
	}

	/**
	 * Solicita permissão ao usuário (via UI)
	 */
	async requestPermission(request: PermissionRequest): Promise<boolean> {
		const result = this.checkPermission(request);
		
		if (!result.allowed) {
			this._onPermissionDenied.fire(request);
			return false;
		}

		if (result.requiresApproval) {
			// Emite evento para a UI mostrar diálogo de confirmação
			this._onPermissionRequested.fire(request);
			// A UI deve retornar a decisão do usuário via promise
			// Esta implementação básica retorna true, mas na prática espera resposta da UI
			return new Promise(resolve => {
				// TODO: Integrar com UI para obter resposta do usuário
				console.log('Permissão solicitada:', request);
				resolve(true); // Placeholder - na prática espera input do usuário
			});
		}

		return true;
	}

	/**
	 * Valida comando de terminal antes da execução
	 */
	validateCommand(command: string): { valid: boolean; warning?: string } {
		const cmd = command.toLowerCase();
		
		// Verifica comandos bloqueados
		for (const blocked of this.config.blockedCommands) {
			if (cmd.includes(blocked.toLowerCase())) {
				return {
					valid: false,
					warning: `Comando bloqueado: ${blocked}`
				};
			}
		}

		// Verifica comandos perigosos
		for (const warned of this.config.warnedCommands) {
			if (cmd.includes(warned.toLowerCase())) {
				return {
					valid: true,
					warning: `⚠️ Cuidado: Este comando pode ser perigoso (${warned})`
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Normaliza caminho para comparação consistente
	 */
	private normalizePath(path: string): string {
		return path.replace(/\\/g, '/').toLowerCase();
	}

	/**
	 * Obtém diretório pai de um caminho
	 */
	private getParentDirectory(path: string): string {
		const normalized = this.normalizePath(path);
		const parts = normalized.split('/');
		parts.pop();
		return parts.join('/') || '/';
	}

	/**
	 * Verifica se caminho corresponde a pattern glob
	 */
	private matchesPattern(path: string, pattern: string): boolean {
		// Implementação simplificada de glob matching
		const regexPattern = pattern
			.replace(/\./g, '\\.')
			.replace(/\*/g, '.*')
			.replace(/\?/g, '.');
		
		const regex = new RegExp(`^${regexPattern}$`, 'i');
		return regex.test(this.normalizePath(path));
	}

	/**
	 * Exporta configuração atual
	 */
	exportConfig(): PermissionConfig {
		return { ...this.config };
	}

	/**
	 * Importa configuração
	 */
	importConfig(config: Partial<PermissionConfig>): void {
		this.config = { ...this.config, ...config };
	}

	dispose(): void {
		this._onPermissionRequested.dispose();
		this._onPermissionDenied.dispose();
	}
}
