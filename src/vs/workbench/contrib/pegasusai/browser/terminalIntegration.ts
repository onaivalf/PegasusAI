/*--------------------------------------------------------------------------------------
 *  Copyright 2025 PegasusAI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Integração com Terminal para Execução de Comandos Locais

import { Emitter } from '../../../../base/common/event.js';
import { PermissionService, OperationType, PermissionRequest } from './permissionService.js';

export interface TerminalCommand {
	command: string;
	workingDirectory?: string;
	env?: Record<string, string>;
	timeout?: number; // ms
}

export interface TerminalExecutionResult {
	success: boolean;
	output: string;
	error?: string;
	exitCode?: number;
	duration: number;
}

export interface TerminalStreamEvent {
	type: 'stdout' | 'stderr' | 'error';
	data: string;
	timestamp: number;
}

export class TerminalIntegration {
	private readonly _onOutput = new Emitter<TerminalStreamEvent>();
	public readonly onOutput = this._onOutput.event;

	private readonly _onExecutionStart = new Emitter<TerminalCommand>();
	public readonly onExecutionStart = this._onExecutionStart.event;

	private readonly _onExecutionEnd = new Emitter<TerminalExecutionResult>();
	public readonly onExecutionEnd = this._onExecutionEnd.event;

	private permissionService: PermissionService;
	private isExecuting = false;

	constructor(permissionService: PermissionService) {
		this.permissionService = permissionService;
	}

	/**
	 * Executa comando no terminal com validação de segurança
	 */
	async executeCommand(cmd: TerminalCommand): Promise<TerminalExecutionResult> {
		const startTime = Date.now();

		// Validação de segurança
		const permRequest: PermissionRequest = {
			operation: OperationType.COMMAND_EXECUTE,
			command: cmd.command,
			description: `Executar: ${cmd.command}`,
			riskLevel: this.assessRisk(cmd.command)
		};

		const permResult = this.permissionService.checkPermission(permRequest);
		
		if (!permResult.allowed) {
			return {
				success: false,
				output: '',
				error: permResult.reason || 'Comando bloqueado por políticas de segurança',
				exitCode: -1,
				duration: 0
			};
		}

		// Emite evento de início
		this._onExecutionStart.fire(cmd);

		try {
			// Em ambiente real, isso usaria child_process ou terminal nativo
			// Aqui simulamos a execução
			const result = await this.simulateCommandExecution(cmd);
			
			const duration = Date.now() - startTime;
			const executionResult: TerminalExecutionResult = {
				...result,
				duration
			};

			// Emite output em tempo real (simulado)
			if (result.output) {
				this._onOutput.fire({
					type: 'stdout',
					data: result.output,
					timestamp: Date.now()
				});
			}

			if (result.error) {
				this._onOutput.fire({
					type: 'stderr',
					data: result.error,
					timestamp: Date.now()
				});
			}

			this._onExecutionEnd.fire(executionResult);
			return executionResult;

		} catch (error) {
			const duration = Date.now() - startTime;
			const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
			
			const result: TerminalExecutionResult = {
				success: false,
				output: '',
				error: errorMsg,
				exitCode: -1,
				duration
			};

			this._onOutput.fire({
				type: 'error',
				data: errorMsg,
				timestamp: Date.now()
			});

			this._onExecutionEnd.fire(result);
			return result;
		}
	}

	/**
	 * Executa múltiplos comandos em sequência
	 */
	async executeCommands(commands: TerminalCommand[]): Promise<TerminalExecutionResult[]> {
		const results: TerminalExecutionResult[] = [];

		for (const cmd of commands) {
			const result = await this.executeCommand(cmd);
			results.push(result);

			// Para se um comando falhar (opcional)
			if (!result.success) {
				console.warn(`Comando falhou: ${cmd.command}`, result.error);
				// Pode-se optar por continuar ou parar aqui
			}
		}

		return results;
	}

	/**
	 * Executa script em background (não bloqueante)
	 */
	async executeInBackground(cmd: TerminalCommand): Promise<{ pid?: number; error?: string }> {
		// Validação de segurança
		const permRequest: PermissionRequest = {
			operation: OperationType.COMMAND_EXECUTE,
			command: cmd.command,
			description: `Executar em background: ${cmd.command}`,
			riskLevel: this.assessRisk(cmd.command)
		};

		const permResult = this.permissionService.checkPermission(permRequest);
		
		if (!permResult.allowed) {
			return { error: permResult.reason };
		}

		// Em implementação real, iniciaria processo em background
		// e retornaria o PID
		console.log('Executando em background:', cmd.command);
		
		// Simulação
		setTimeout(() => {
			this.executeCommand(cmd);
		}, 0);

		return { pid: Math.floor(Math.random() * 10000) }; // PID simulado
	}

	/**
	 * Avalia risco do comando
	 */
	private assessRisk(command: string): 'low' | 'medium' | 'high' | 'critical' {
		const cmd = command.toLowerCase();

		// Comandos críticos
		if (['format', 'fdisk', 'mkfs', 'dd if=/dev'].some(c => cmd.includes(c))) {
			return 'critical';
		}

		// Comandos de alto risco
		if (['rm -rf', 'del /s', 'rmdir /s', 'sudo', 'su'].some(c => cmd.includes(c))) {
			return 'high';
		}

		// Comandos de médio risco
		if (['chmod', 'chown', 'kill', 'pkill'].some(c => cmd.includes(c))) {
			return 'medium';
		}

		// Baixo risco
		return 'low';
	}

	/**
	 * Simula execução de comando (para demonstração)
	 * Em produção, usar child_process ou API nativa do terminal
	 */
	private async simulateCommandExecution(cmd: TerminalCommand): Promise<TerminalExecutionResult> {
		// Simulação básica - em produção isso seria implementação real
		return new Promise((resolve) => {
			setTimeout(() => {
				// Simula sucesso para comandos seguros
				if (cmd.command.startsWith('echo')) {
					const output = cmd.command.substring(5).replace(/['"]/g, '');
					resolve({
						success: true,
						output: output,
						exitCode: 0,
						duration: 100
					});
				} else if (cmd.command.startsWith('ls') || cmd.command.startsWith('dir')) {
					resolve({
						success: true,
						output: 'file1.txt\nfile2.ts\nsrc/\ndist/',
						exitCode: 0,
						duration: 150
					});
				} else {
					// Para outros comandos, simula execução
					resolve({
						success: true,
						output: `Executado: ${cmd.command}`,
						exitCode: 0,
						duration: 200
					});
				}
			}, 100);
		});
	}

	/**
	 * Cancela execução em andamento
	 */
	cancelExecution(): void {
		if (this.isExecuting) {
			console.log('Cancelando execução...');
			// Implementação real enviaria SIGINT/SIGTERM
			this.isExecuting = false;
		}
	}

	/**
	 * Obtém histórico de comandos executados
	 */
	getExecutionHistory(): TerminalCommand[] {
		// TODO: Implementar histórico persistente
		return [];
	}

	dispose(): void {
		this._onOutput.dispose();
		this._onExecutionStart.dispose();
		this._onExecutionEnd.dispose();
	}
}
