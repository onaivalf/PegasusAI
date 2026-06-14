/**
 * PegasusAI - Smart Apply Engine
 * 
 * Implementa sistema inteligente de aplicação de edições de código,
 * combinando abordagens Fast Apply e Slow Apply do VOID com validações.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EditOperation, ApplyResult, SmartApplyOptions, CodeContext } from '../../common/interfaces';

export class SmartApplyEngine {
  private backupDir: string;
  private maxBackups: number = 10;

  constructor(backupBasePath: string) {
    this.backupDir = path.join(backupBasePath, 'apply-backups');
    this.ensureBackupDir();
  }

  /**
   * Garante que diretório de backups existe
   */
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Cria backup de arquivo antes de edição
   */
  private createBackup(filePath: string): string {
    const timestamp = Date.now();
    const fileName = path.basename(filePath);
    const backupPath = path.join(this.backupDir, `${fileName}.${timestamp}.bak`);
    
    fs.copyFileSync(filePath, backupPath);
    this.cleanupOldBackups(fileName);
    
    return backupPath;
  }

  /**
   * Limpa backups antigos mantendo apenas os mais recentes
   */
  private cleanupOldBackups(fileName: string): void {
    const backups = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith(`${fileName}.`) && f.endsWith('.bak'))
      .sort()
      .reverse();
    
    // Remove backups além do limite
    for (let i = this.maxBackups; i < backups.length; i++) {
      try {
        fs.unlinkSync(path.join(this.backupDir, backups[i]));
      } catch (e) {
        console.warn(`[SmartApply] Falha ao remover backup antigo: ${backups[i]}`);
      }
    }
  }

  /**
   * Aplica edição usando estratégia Fast Apply (rápida, baseada em diff simples)
   */
  private fastApply(edit: EditOperation, content: string): string | null {
    const lines = content.split('\n');
    
    if (!edit.range) {
      // Insert no final se não há range
      if (edit.type === 'insert') {
        return content + (content.endsWith('\n') ? '' : '\n') + edit.content;
      }
      return null;
    }

    const { startLine, endLine, startColumn = 0, endColumn } = edit.range;

    if (edit.type === 'replace' || edit.type === 'delete') {
      // Valida bounds
      if (startLine < 0 || endLine > lines.length) {
        console.warn('[SmartApply] Fast Apply: Range inválido');
        return null;
      }

      if (edit.type === 'delete') {
        // Remove linhas
        lines.splice(startLine, endLine - startLine);
      } else {
        // Replace
        if (startLine === endLine) {
          // Substituição na mesma linha
          const line = lines[startLine];
          const before = startColumn > 0 ? line.substring(0, startColumn) : '';
          const after = endColumn ? line.substring(endColumn) : '';
          lines[startLine] = before + edit.content + after;
        } else {
          // Substituição multi-linha
          const firstLine = lines[startLine].substring(0, startColumn);
          const lastLine = lines[endLine - 1]?.substring(endColumn) || '';
          
          const newLines = [firstLine + edit.content + lastLine];
          lines.splice(startLine, endLine - startLine, ...newLines);
        }
      }
      
      return lines.join('\n');
    }

    if (edit.type === 'insert') {
      // Insert em posição específica
      const insertIndex = startLine;
      const contentToInsert = edit.content.split('\n');
      lines.splice(insertIndex, 0, ...contentToInsert);
      return lines.join('\n');
    }

    return null;
  }

  /**
   * Aplica edição usando estratégia Slow Apply (precisa, com análise de contexto)
   */
  private slowApply(
    edit: EditOperation,
    content: string,
    context?: CodeContext
  ): string | null {
    // Tenta encontrar o trecho exato no conteúdo
    const targetContent = context?.content || edit.content;
    
    // Busca por similaridade para replace
    if (edit.type === 'replace' && context?.content) {
      const index = content.indexOf(context.content);
      if (index !== -1) {
        const before = content.substring(0, index);
        const after = content.substring(index + context.content.length);
        return before + edit.content + after;
      }
    }

    // Fallback para busca por padrão/similaridade
    const lines = content.split('\n');
    const editLines = edit.content.split('\n');
    
    // Tenta encontrar linha similar para replace/insert
    for (let i = 0; i < lines.length; i++) {
      const similarity = this.calculateSimilarity(lines[i], editLines[0]);
      
      if (similarity > 0.8) {
        // Encontrou linha similar
        if (edit.type === 'replace') {
          lines[i] = editLines[0];
          // Adiciona linhas extras se necessário
          for (let j = 1; j < editLines.length; j++) {
            lines.splice(i + j, 0, editLines[j]);
          }
          return lines.join('\n');
        }
        
        if (edit.type === 'insert') {
          // Insert após linha encontrada
          for (let j = editLines.length - 1; j >= 0; j--) {
            lines.splice(i + 1, 0, editLines[j]);
          }
          return lines.join('\n');
        }
      }
    }

    return null;
  }

  /**
   * Calcula similaridade entre duas strings (Levenshtein simplificado)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Distância de Levenshtein para comparação de strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Gera diff unificado entre conteúdo original e modificado
   */
  private generateDiff(original: string, modified: string, filePath: string): string {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    
    let diff = `--- a/${filePath}\n`;
    diff += `+++ b/${filePath}\n`;
    
    // Diff simplificado (em produção usar biblioteca como 'diff')
    const maxLen = Math.max(origLines.length, modLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      const orig = origLines[i];
      const mod = modLines[i];
      
      if (orig !== mod) {
        if (orig !== undefined) {
          diff += `- ${orig}\n`;
        }
        if (mod !== undefined) {
          diff += `+ ${mod}\n`;
        }
      } else {
        diff += `  ${orig}\n`;
      }
    }
    
    return diff;
  }

  /**
   * Aplica edição com rollback em caso de falha
   */
  private async applyWithRollback(
    edit: EditOperation,
    options: SmartApplyOptions
  ): Promise<{ success: boolean; rollback?: () => Promise<void>; error?: string }> {
    const filePath = edit.filePath;
    
    if (!fs.existsSync(filePath)) {
      if (edit.type === 'insert') {
        // Cria arquivo se não existe e é insert
        fs.writeFileSync(filePath, edit.content, 'utf8');
        return { success: true };
      }
      return { success: false, error: `Arquivo não encontrado: ${filePath}` };
    }

    const originalContent = fs.readFileSync(filePath, 'utf8');
    let backupPath: string | undefined;

    if (options.createBackup !== false) {
      backupPath = this.createBackup(filePath);
    }

    try {
      // Tenta Fast Apply primeiro
      let newContent = this.fastApply(edit, originalContent);
      let method = 'fast';

      // Se Fast Apply falhar, tenta Slow Apply
      if (!newContent) {
        newContent = this.slowApply(edit, originalContent);
        method = 'slow';
      }

      if (!newContent) {
        throw new Error('Não foi possível aplicar a edição com nenhum método');
      }

      // Aplica mudança
      fs.writeFileSync(filePath, newContent, 'utf8');

      console.log(`[SmartApply] Edição aplicada com sucesso usando método ${method}`);

      return {
        success: true,
        rollback: async () => {
          if (backupPath && fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, filePath);
            console.log('[SmartApply] Rollback realizado com sucesso');
          }
        },
      };
    } catch (error) {
      // Rollback automático em caso de erro
      if (backupPath && fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Aplica múltiplas edições atomicamente
   */
  async applyEdits(
    edits: EditOperation[],
    options: SmartApplyOptions
  ): Promise<ApplyResult> {
    const results: Array<{ edit: EditOperation; success: boolean; error?: string }> = [];
    const rollbacks: Array<() => Promise<void>> = [];
    const appliedContent: Map<string, string> = new Map();

    // Salva estado original de todos os arquivos
    for (const edit of edits) {
      if (fs.existsSync(edit.filePath)) {
        appliedContent.set(edit.filePath, fs.readFileSync(edit.filePath, 'utf8'));
      }
    }

    // Aplica cada edição
    for (const edit of edits) {
      const result = await this.applyWithRollback(edit, options);
      results.push({ edit, success: result.success, error: result.error });
      
      if (result.success && result.rollback) {
        rollbacks.push(result.rollback);
      } else if (!result.success && options.mode !== 'preview') {
        // Falha crítica - faz rollback de todas as edições anteriores
        for (const rollback of rollbacks.reverse()) {
          await rollback();
        }
        
        return {
          success: false,
          edits: edits.slice(0, results.length),
          error: `Falha ao aplicar edição: ${result.error}`,
        };
      }
    }

    // Gera diff se solicitado
    let diff: string | undefined;
    if (options.mode === 'preview') {
      diff = edits.map(edit => {
        const original = appliedContent.get(edit.filePath) || '';
        return this.generateDiff(original, original, edit.filePath); // Preview não modifica
      }).join('\n');
    }

    return {
      success: results.every(r => r.success),
      edits,
      diff,
      rollback: async () => {
        for (const rollback of rollbacks.reverse()) {
          await rollback();
        }
      },
    };
  }

  /**
   * Valida se edição pode ser aplicada com confiança
   */
  async validateEdit(edit: EditOperation, threshold: number = 0.8): Promise<{
    valid: boolean;
    confidence: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let confidence = 1.0;

    // Verifica se arquivo existe
    if (!fs.existsSync(edit.filePath)) {
      if (edit.type !== 'insert') {
        return { valid: false, confidence: 0, warnings: ['Arquivo não encontrado'] };
      }
    } else {
      const content = fs.readFileSync(edit.filePath, 'utf8');
      
      // Verifica se range é válido
      if (edit.range) {
        const lines = content.split('\n');
        if (edit.range.endLine > lines.length) {
          warnings.push('Range ultrapassa fim do arquivo');
          confidence -= 0.2;
        }
      }

      // Calcula confiança baseada na similaridade
      if (edit.type === 'replace') {
        const testApply = this.fastApply(edit, content);
        if (!testApply) {
          const slowApply = this.slowApply(edit, content);
          confidence = slowApply ? 0.7 : 0.3;
          if (!slowApply) {
            warnings.push('Não foi possível identificar localização exata para replace');
          }
        }
      }
    }

    return {
      valid: confidence >= threshold,
      confidence,
      warnings,
    };
  }
}

// Exporta instância singleton (será inicializada com caminho correto no main process)
export let smartApplyEngine: SmartApplyEngine | null = null;

export function initializeSmartApplyEngine(backupPath: string): SmartApplyEngine {
  smartApplyEngine = new SmartApplyEngine(backupPath);
  return smartApplyEngine;
}
