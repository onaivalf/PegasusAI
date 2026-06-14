/**
 * PegasusAI - Advanced File System Service
 * Fase 3: Sistema de Arquivos + Terminal
 * 
 * Permite leitura/escrita em qualquer pasta do sistema (ex: D:\projetos)
 * com segurança, permissões e auditoria completa.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { PermissionLevel, AuditLog, SecurityContext } from './permissionService';

export interface FileSystemConfig {
  allowedRoots: string[];
  blockedPatterns: RegExp[];
  maxFileSize: number; // bytes
  enableAudit: boolean;
  requireConfirmationForWrite: boolean;
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'rename' | 'mkdir' | 'list';
  path: string;
  content?: string;
  timestamp: Date;
  userId?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  modified?: Date;
  permissions?: string;
}

export class PegasusAIService extends EventEmitter {
  private config: FileSystemConfig;
  private auditLog: AuditLog[] = [];
  private securityContext: SecurityContext;

  constructor(config?: Partial<FileSystemConfig>) {
    super();
    this.config = {
      allowedRoots: this.getDefaultAllowedRoots(),
      blockedPatterns: [
        /\/\.[^/]+$/, // Arquivos ocultos
        /\/(node_modules|\.git|\.vscode)/,
        /\/(Windows|System32|Program Files)\//i,
      ],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      enableAudit: true,
      requireConfirmationForWrite: false,
      ...config,
    };
    this.securityContext = new SecurityContext();
  }

  private getDefaultAllowedRoots(): string[] {
    const roots = [
      os.homedir(),
      path.join(os.homedir(), 'projects'),
      path.join(os.homedir(), 'dev'),
      path.join(os.homedir(), 'code'),
    ];

    // Adicionar raízes comuns no Windows
    if (process.platform === 'win32') {
      ['C', 'D', 'E'].forEach(drive => {
        const drivePath = `${drive}:\\`;
        if (fs.existsSync(drivePath)) {
          roots.push(
            path.join(drivePath, 'projetos'),
            path.join(drivePath, 'projects'),
            path.join(drivePath, 'dev'),
            path.join(drivePath, 'code')
          );
        }
      });
    }

    return roots;
  }

  /**
   * Valida se o caminho é seguro para operação
   */
  validatePath(targetPath: string, operation: string): boolean {
    const resolved = path.resolve(targetPath);
    
    // Verifica padrões bloqueados
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(resolved)) {
        this.logAudit({
          type: operation as any,
          path: resolved,
          timestamp: new Date(),
        }, 'BLOCKED_PATTERN', false);
        return false;
      }
    }

    // Verifica se está em uma raiz permitida
    const isAllowed = this.config.allowedRoots.some(root => 
      resolved === root || resolved.startsWith(root + path.sep)
    );

    if (!isAllowed) {
      this.logAudit({
        type: operation as any,
        path: resolved,
        timestamp: new Date(),
      }, 'OUTSIDE_ALLOWED_ROOTS', false);
      return false;
    }

    return true;
  }

  /**
   * Lê arquivo com segurança
   */
  async readFile(filePath: string, options?: { encoding?: string; maxLines?: number }): Promise<string> {
    const resolved = path.resolve(filePath);
    
    if (!this.validatePath(resolved, 'read')) {
      throw new Error(`Acesso negado: ${resolved}`);
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`Arquivo não encontrado: ${resolved}`);
    }

    const stats = fs.statSync(resolved);
    if (stats.size > this.config.maxFileSize) {
      throw new Error(`Arquivo muito grande: ${stats.size} bytes (máx: ${this.config.maxFileSize})`);
    }

    const content = fs.readFileSync(resolved, { 
      encoding: options?.encoding || 'utf-8' 
    });

    this.logAudit({
      type: 'read',
      path: resolved,
      timestamp: new Date(),
    }, 'SUCCESS', true);

    this.emit('fileRead', { path: resolved, size: stats.size });
    return content;
  }

  /**
   * Escreve arquivo com segurança e backup
   */
  async writeFile(
    filePath: string, 
    content: string, 
    options?: { createBackup?: boolean; encoding?: string }
  ): Promise<void> {
    const resolved = path.resolve(filePath);
    
    if (!this.validatePath(resolved, 'write')) {
      throw new Error(`Acesso negado: ${resolved}`);
    }

    // Criar diretório pai se não existir
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Backup se solicitado
    if (options?.createBackup !== false && fs.existsSync(resolved)) {
      const backupPath = `${resolved}.backup.${Date.now()}`;
      fs.copyFileSync(resolved, backupPath);
      this.emit('backupCreated', { original: resolved, backup: backupPath });
    }

    // Escrita atômica
    const tempPath = `${resolved}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tempPath, content, { encoding: options?.encoding || 'utf-8' });
      fs.renameSync(tempPath, resolved);
      
      this.logAudit({
        type: 'write',
        path: resolved,
        content,
        timestamp: new Date(),
      }, 'SUCCESS', true);

      this.emit('fileWritten', { path: resolved, size: content.length });
    } catch (error) {
      // Cleanup em caso de erro
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * Lista diretório com detalhes
   */
  async listDirectory(dirPath: string, options?: { recursive?: boolean; maxDepth?: number }): Promise<DirectoryEntry[]> {
    const resolved = path.resolve(dirPath);
    
    if (!this.validatePath(resolved, 'list')) {
      throw new Error(`Acesso negado: ${resolved}`);
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Diretório inválido: ${resolved}`);
    }

    const entries: DirectoryEntry[] = [];
    
    const scanDir = (currentPath: string, depth: number) => {
      if (options?.maxDepth && depth > options.maxDepth) return;
      
      const items = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);
        
        if (!this.validatePath(itemPath, 'list')) continue;

        let entry: DirectoryEntry = {
          name: item.name,
          path: itemPath,
          type: item.isFile() ? 'file' : item.isDirectory() ? 'directory' : 'symlink',
        };

        try {
          const stats = fs.statSync(itemPath);
          entry.size = stats.size;
          entry.modified = stats.mtime;
          entry.permissions = stats.mode.toString(8);
        } catch (e) {
          // Ignora erros de stat
        }

        entries.push(entry);

        if (options?.recursive && item.isDirectory()) {
          scanDir(itemPath, depth + 1);
        }
      }
    };

    scanDir(resolved, 0);

    this.logAudit({
      type: 'list',
      path: resolved,
      timestamp: new Date(),
    }, 'SUCCESS', true);

    return entries;
  }

  /**
   * Cria diretório
   */
  async createDirectory(dirPath: string, options?: { recursive?: boolean }): Promise<string> {
    const resolved = path.resolve(dirPath);
    
    if (!this.validatePath(resolved, 'mkdir')) {
      throw new Error(`Acesso negado: ${resolved}`);
    }

    fs.mkdirSync(resolved, { recursive: options?.recursive !== false });
    
    this.logAudit({
      type: 'mkdir',
      path: resolved,
      timestamp: new Date(),
    }, 'SUCCESS', true);

    this.emit('directoryCreated', { path: resolved });
    return resolved;
  }

  /**
   * Deleta arquivo ou diretório
   */
  async delete(targetPath: string, options?: { recursive?: boolean }): Promise<void> {
    const resolved = path.resolve(targetPath);
    
    if (!this.validatePath(resolved, 'delete')) {
      throw new Error(`Acesso negado: ${resolved}`);
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`Não existe: ${resolved}`);
    }

    const stats = fs.statSync(resolved);
    
    if (stats.isDirectory()) {
      fs.rmSync(resolved, { recursive: options?.recursive !== false, force: true });
    } else {
      fs.unlinkSync(resolved);
    }

    this.logAudit({
      type: 'delete',
      path: resolved,
      timestamp: new Date(),
    }, 'SUCCESS', true);

    this.emit('deleted', { path: resolved, wasDirectory: stats.isDirectory() });
  }

  /**
   * Renomeia/move arquivo ou diretório
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    const oldResolved = path.resolve(oldPath);
    const newResolved = path.resolve(newPath);
    
    if (!this.validatePath(oldResolved, 'rename') || !this.validatePath(newResolved, 'rename')) {
      throw new Error(`Acesso negado para renomeação`);
    }

    if (!fs.existsSync(oldResolved)) {
      throw new Error(`Origem não existe: ${oldResolved}`);
    }

    fs.renameSync(oldResolved, newResolved);

    this.logAudit({
      type: 'rename',
      path: `${oldResolved} -> ${newResolved}`,
      timestamp: new Date(),
    }, 'SUCCESS', true);

    this.emit('renamed', { oldPath: oldResolved, newPath: newResolved });
  }

  /**
   * Busca arquivos por padrão
   */
  async searchFiles(
    rootPath: string, 
    pattern: string | RegExp, 
    options?: { maxResults?: number; excludeDirs?: string[] }
  ): Promise<DirectoryEntry[]> {
    const results: DirectoryEntry[] = [];
    const maxResults = options?.maxResults || 100;
    const excludeDirs = options?.excludeDirs || ['node_modules', '.git', '.vscode'];

    const scan = (currentPath: string) => {
      if (results.length >= maxResults) return;

      const entries = this.listDirectory(currentPath).catch(() => []);
      
      entries.then(items => {
        for (const item of items) {
          if (item.type === 'directory' && excludeDirs.includes(item.name)) {
            continue;
          }

          const matches = typeof pattern === 'string' 
            ? item.name.includes(pattern)
            : pattern.test(item.name);

          if (matches) {
            results.push(item);
            if (results.length >= maxResults) break;
          }

          if (item.type === 'directory') {
            scan(item.path);
          }
        }
      });
    };

    scan(rootPath);
    return results;
  }

  private logAudit(operation: FileOperation, status: string, success: boolean): void {
    if (!this.config.enableAudit) return;

    const log: AuditLog = {
      ...operation,
      status,
      success,
      userId: operation.userId || 'system',
    };

    this.auditLog.push(log);

    // Manter apenas últimos 1000 logs na memória
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    this.emit('audit', log);
  }

  getAuditLog(limit?: number): AuditLog[] {
    return limit 
      ? this.auditLog.slice(-limit) 
      : [...this.auditLog];
  }

  addAllowedRoot(rootPath: string): void {
    const resolved = path.resolve(rootPath);
    if (!this.config.allowedRoots.includes(resolved)) {
      this.config.allowedRoots.push(resolved);
      this.emit('allowedRootAdded', { path: resolved });
    }
  }

  removeAllowedRoot(rootPath: string): void {
    const resolved = path.resolve(rootPath);
    this.config.allowedRoots = this.config.allowedRoots.filter(r => r !== resolved);
    this.emit('allowedRootRemoved', { path: resolved });
  }

  getConfig(): FileSystemConfig {
    return { ...this.config };
  }
}

// Singleton instance
let fileSystemService: PegasusAIService | null = null;

export function getPegasusAIService(config?: Partial<FileSystemConfig>): PegasusAIService {
  if (!fileSystemService) {
    fileSystemService = new PegasusAIService(config);
  }
  return fileSystemService;
}

export default PegasusAIService;
