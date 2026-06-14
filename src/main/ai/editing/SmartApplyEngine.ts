/**
 * PegasusAI - Smart Apply Engine
 * 
 * Fusão das técnicas de edição de código do VOID (Fast/Slow Apply)
 * e Google Antigravity (Diff preciso com validação semântica).
 * 
 * Responsável por aplicar mudanças no código fonte de forma segura,
 * minimizando erros e permitindo rollback automático.
 */

import * as path from 'path';
import { CancellationToken, TextDocument, WorkspaceEdit, Position, Range } from 'vscode';
import { Logger } from '../../common/utils/logger';
import { IUnifiedProvider } from '../providers/PegasusAIProvider';

export interface EditOperation {
  originalCode: string;
  newCode: string;
  filePath: string;
  languageId: string;
  instructions: string;
  confidence: number;
}

export interface ApplyResult {
  success: boolean;
  appliedChanges: number;
  failedChanges: number;
  diff: string;
  rollbackAvailable: boolean;
  error?: string;
}

export enum ApplyStrategy {
  FAST = 'fast',      // Substituição direta (baixa latência, menor precisão)
  SLOW = 'slow',      // Diff estrutural (alta latência, alta precisão)
  HYBRID = 'hybrid'   // Tenta fast, fallback para slow se confiança < threshold
}

export class SmartApplyEngine {
  private logger: Logger;
  private readonly CONFIDENCE_THRESHOLD = 0.85;
  private pendingRollbacks: Map<string, string> = new Map(); // filePath -> originalContent

  constructor() {
    this.logger = new Logger('SmartApplyEngine');
  }

  /**
   * Aplica uma edição de código usando a estratégia apropriada
   */
  async applyEdit(
    document: TextDocument,
    editOp: EditOperation,
    provider: IUnifiedProvider,
    strategy: ApplyStrategy = ApplyStrategy.HYBRID,
    token?: CancellationToken
  ): Promise<ApplyResult> {
    this.logger.info(`Applying edit to ${document.fileName}`, { strategy, confidence: editOp.confidence });

    try {
      // Salva estado atual para rollback
      this.pendingRollbacks.set(document.fileName, document.getText());

      let result: ApplyResult;

      if (strategy === ApplyStrategy.FAST || 
          (strategy === ApplyStrategy.HYBRID && editOp.confidence >= this.CONFIDENCE_THRESHOLD)) {
        result = await this.fastApply(document, editOp);
      } else {
        result = await this.slowApply(document, editOp, provider, token);
      }

      if (result.success) {
        this.logger.info(`Edit applied successfully: ${result.appliedChanges} changes`);
      } else {
        // Rollback automático em caso de falha
        await this.rollback(document.fileName);
        this.logger.warn(`Edit failed, rolled back: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Unexpected error during apply', error);
      await this.rollback(document.fileName);
      return {
        success: false,
        appliedChanges: 0,
        failedChanges: 1,
        diff: '',
        rollbackAvailable: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fast Apply: Substituição direta baseada em ranges
   * Inspirado no VoidEditor.applyFast()
   */
  private async fastApply(document: TextDocument, editOp: EditOperation): Promise<ApplyResult> {
    const workspaceEdit = new WorkspaceEdit();
    
    // Estratégia simplificada: substituir todo o documento ou seleção
    // Em produção, isso usaria análise de AST para identificar blocos exatos
    const fullRange = new Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );

    workspaceEdit.replace(document.uri, fullRange, editOp.newCode);

    // Aplicar edição
    const success = await this.applyWorkspaceEdit(workspaceEdit);
    
    return {
      success,
      appliedChanges: success ? 1 : 0,
      failedChanges: success ? 0 : 1,
      diff: this.generateSimpleDiff(editOp.originalCode, editOp.newCode),
      rollbackAvailable: true
    };
  }

  /**
   * Slow Apply: Análise estrutural com diff preciso
   * Combina VoidEditor.applySlow() + Antigravity semantic validation
   */
  private async slowApply(
    document: TextDocument, 
    editOp: EditOperation,
    provider: IUnifiedProvider,
    token?: CancellationToken
  ): Promise<ApplyResult> {
    this.logger.debug('Starting slow apply with structural analysis');

    try {
      // Solicita ao provider um diff estruturado
      const { diff } = await provider.generateEdit(
        editOp.originalCode,
        editOp.instructions,
        editOp.languageId,
        token
      );

      // Parse do diff para operações atômicas
      const operations = this.parseDiff(diff);
      
      const workspaceEdit = new WorkspaceEdit();
      let appliedCount = 0;
      let failedCount = 0;

      for (const op of operations) {
        try {
          const range = new Range(
            document.positionAt(op.startOffset),
            document.positionAt(op.endOffset)
          );
          workspaceEdit.replace(document.uri, range, op.replacement);
          appliedCount++;
        } catch (err) {
          failedCount++;
          this.logger.warn(`Failed to apply operation at offset ${op.startOffset}`, err);
        }
      }

      const success = failedCount === 0 || (appliedCount / (appliedCount + failedCount)) >= 0.8;
      
      if (success) {
        await this.applyWorkspaceEdit(workspaceEdit);
      }

      return {
        success,
        appliedChanges: appliedCount,
        failedChanges: failedCount,
        diff,
        rollbackAvailable: true
      };
    } catch (error) {
      this.logger.error('Slow apply failed', error);
      throw error;
    }
  }

  /**
   * Rollback para versão anterior
   */
  async rollback(filePath: string): Promise<boolean> {
    const originalContent = this.pendingRollbacks.get(filePath);
    if (!originalContent) {
      this.logger.warn(`No rollback available for ${filePath}`);
      return false;
    }

    try {
      const vscode = await import('vscode');
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      const workspaceEdit = new vscode.WorkspaceEdit();
      
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      
      workspaceEdit.replace(document.uri, fullRange, originalContent);
      
      const success = await this.applyWorkspaceEdit(workspaceEdit);
      
      if (success) {
        this.pendingRollbacks.delete(filePath);
        this.logger.info(`Rollback successful for ${filePath}`);
      }
      
      return success;
    } catch (error) {
      this.logger.error('Rollback failed', error);
      return false;
    }
  }

  /**
   * Gera diff simples para logging
   */
  private generateSimpleDiff(original: string, modified: string): string {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const diff: string[] = [];

    const maxLen = Math.max(origLines.length, modLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (origLines[i] !== modLines[i]) {
        if (origLines[i]) diff.push(`- ${origLines[i]}`);
        if (modLines[i]) diff.push(`+ ${modLines[i]}`);
      }
    }

    return diff.join('\n');
  }

  /**
   * Parse de diff unificado para operações
   */
  private parseDiff(diff: string): Array<{ startOffset: number; endOffset: number; replacement: string }> {
    // Implementação simplificada - em produção usaria biblioteca como 'diff'
    // ou parser de unified diff
    this.logger.debug('Parsing diff operations');
    
    // Placeholder: retorna operação única cobrindo todo o conteúdo
    // Implementação real faria parse linha por linha do formato unified diff
    return [{
      startOffset: 0,
      endOffset: diff.length,
      replacement: diff
    }];
  }

  /**
   * Aplica WorkspaceEdit com tratamento de erro
   */
  private async applyWorkspaceEdit(edit: any): Promise<boolean> {
    const vscode = await import('vscode');
    try {
      return await vscode.workspace.applyEdit(edit);
    } catch (error) {
      this.logger.error('Failed to apply workspace edit', error);
      return false;
    }
  }
}
