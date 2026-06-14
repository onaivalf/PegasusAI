/*--------------------------------------------------------------------------------------
 *  Copyright 2025 PegasusAI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Engine de Edição Local com Validação Segura de Diffs

import { URI } from '../../../../base/common/uri.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IPegasusAIModelService } from './pegasusaiModelService.js';
import { Emitter } from '../../../../base/common/event.js';

export interface DiffChange {
	searchText: string;
	replaceText: string;
	context?: number; // Linhas de contexto para validação
	lineNumber?: number; // Linha exata (opcional)
}

export interface ApplyEditOptions {
	filePath: string;
	diffType: 'unified' | 'search-replace' | 'json-patch';
	changes: DiffChange[];
	requireApproval: boolean;
	autoRollbackOnError?: boolean;
}

export interface EditPreview {
	canApply: boolean;
	conflicts: ConflictInfo[];
	preview: string;
	numChanges: number;
}

export interface ConflictInfo {
	lineNumber: number;
	expected: string;
	actual: string;
	message: string;
}

export class LocalEditEngine {
	private readonly _onEditApplied = new Emitter<{ filePath: string; success: boolean }>();
	public readonly onEditApplied = this._onEditApplied.event;

	constructor(
		private readonly modelService: IPegasusAIModelService
	) {}

	/**
	 * Valida se um diff pode ser aplicado ao arquivo atual
	 */
	async validateDiff(options: ApplyEditOptions): Promise<EditPreview> {
		const uri = URI.file(options.filePath);
		const modelInfo = await this.modelService.getModelSafe(uri);
		
		if (!modelInfo.model) {
			return {
				canApply: false,
				conflicts: [],
				preview: 'Modelo não encontrado',
				numChanges: 0
			};
		}

		const currentValue = modelInfo.model.getValue();
		const conflicts: ConflictInfo[] = [];
		let canApply = true;

		for (const change of options.changes) {
			const searchIndex = currentValue.indexOf(change.searchText);
			
			if (searchIndex === -1) {
				canApply = false;
				conflicts.push({
					lineNumber: change.lineNumber || 0,
					expected: change.searchText.substring(0, 100),
					actual: 'Texto não encontrado no arquivo',
					message: `O texto a ser substituído não foi encontrado. O arquivo pode ter sido modificado.`
				});
			}
		}

		const preview = this.generatePreview(currentValue, options.changes);

		return {
			canApply,
			conflicts,
			preview,
			numChanges: options.changes.length
		};
	}

	/**
	 * Aplica edições ao arquivo com validação prévia
	 */
	async applyEdit(options: ApplyEditOptions): Promise<{ success: boolean; error?: string }> {
		try {
			// Validação prévia
			const validation = await this.validateDiff(options);
			
			if (!validation.canApply) {
				const errorMsg = `Não é possível aplicar edição: ${validation.conflicts.length} conflitos encontrados`;
				console.error(errorMsg, validation.conflicts);
				return { success: false, error: errorMsg };
			}

			// Se requer aprovação, emite evento para UI mostrar preview
			if (options.requireApproval) {
				// A UI deve escutar onEditApplied para mostrar o preview
				this._onEditApplied.fire({ 
					filePath: options.filePath, 
					success: false // Ainda não aplicou, só preview
				});
				return { success: true }; // Retorna true pois o preview foi gerado
			}

			// Aplica as mudanças
			const uri = URI.file(options.filePath);
			const modelInfo = await this.modelService.getModelSafe(uri);
			
			if (!modelInfo.model) {
				return { success: false, error: 'Modelo não disponível' };
			}

			const currentValue = modelInfo.model.getValue();
			let newValue = currentValue;

			// Aplica cada mudança na ordem inversa para preservar line numbers
			for (const change of options.changes.reverse()) {
				const searchIndex = newValue.indexOf(change.searchText);
				if (searchIndex !== -1) {
					newValue = 
						newValue.substring(0, searchIndex) + 
						change.replaceText + 
						newValue.substring(searchIndex + change.searchText.length);
				}
			}

			// Atualiza o modelo
			modelInfo.model.setValue(newValue);
			
			// Salva o arquivo
			await this.modelService.saveModel(uri);

			this._onEditApplied.fire({ filePath: options.filePath, success: true });
			
			return { success: true };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
			
			// Rollback automático se habilitado
			if (options.autoRollbackOnError !== false) {
				await this.rollback(options.filePath);
			}
			
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Gera preview das mudanças
	 */
	private generatePreview(currentValue: string, changes: DiffChange[]): string {
		let preview = '';
		
		for (let i = 0; i < changes.length; i++) {
			const change = changes[i];
			preview += `\n--- Mudança ${i + 1} ---\n`;
			preview += `- ${change.searchText.substring(0, 200)}\n`;
			preview += `+ ${change.replaceText.substring(0, 200)}\n`;
		}
		
		return preview;
	}

	/**
	 * Rollback para versão anterior (implementação básica)
	 */
	private async rollback(filePath: string): Promise<void> {
		// TODO: Implementar sistema de snapshot para rollback
		console.warn('Rollback solicitado mas ainda não implementado para:', filePath);
	}

	/**
	 * Converte unified diff para formato aplicável
	 */
	parseUnifiedDiff(diffText: string): DiffChange[] {
		const changes: DiffChange[] = [];
		const lines = diffText.split('\n');
		
		let currentSearch = '';
		let currentReplace = '';
		let inHunk = false;
		let isAddition = false;

		for (const line of lines) {
			if (line.startsWith('@@')) {
				// Nova seção de diff
				if (currentSearch && currentReplace) {
					changes.push({
						searchText: currentSearch.trim(),
						replaceText: currentReplace.trim()
					});
				}
				currentSearch = '';
				currentReplace = '';
				inHunk = true;
				isAddition = false;
			} else if (inHunk) {
				if (line.startsWith('-')) {
					currentSearch += line.substring(1) + '\n';
				} else if (line.startsWith('+')) {
					currentReplace += line.substring(1) + '\n';
					isAddition = true;
				} else if (line.startsWith(' ')) {
					// Contexto
					const contextLine = line.substring(1) + '\n';
					currentSearch += contextLine;
					if (isAddition) {
						currentReplace += contextLine;
					}
				}
			}
		}

		// Adiciona última mudança
		if (currentSearch && currentReplace) {
			changes.push({
				searchText: currentSearch.trim(),
				replaceText: currentReplace.trim()
			});
		}

		return changes;
	}

	dispose(): void {
		this._onEditApplied.dispose();
	}
}
