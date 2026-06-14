/**
 * PegasusAI - Terminal Integration Service
 * Fase 3: Sistema de Arquivos + Terminal
 * 
 * Integração completa com terminal (PowerShell, bash, cmd)
 * Execução segura de comandos com validação de risco
 */

import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';

export interface TerminalConfig {
  defaultShell: string;
  allowedCommands: string[];
  blockedCommands: string[];
  maxExecutionTime: number; // ms
  enableLogging: boolean;
  requireConfirmationForDangerous: boolean;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
  timestamp: Date;
}

export interface TerminalSession {
  id: string;
  shell: string;
  cwd: string;
  process?: ChildProcess;
  active: boolean;
  createdAt: Date;
}

export enum RiskLevel {
  SAFE = 'safe',
  MEDIUM = 'medium',
  DANGEROUS = 'dangerous',
  BLOCKED = 'blocked',
}

export class PegasusAITerminal extends EventEmitter {
  private config: TerminalConfig;
  private sessions: Map<string, TerminalSession> = new Map();
  private commandHistory: CommandResult[] = [];
  private riskPatterns: { pattern: RegExp; level: RiskLevel }[] = [
    { pattern: /^(rm|del|rmdir)\s+-rf?\s+\/?$/i, level: RiskLevel.BLOCKED },
    { pattern: /^(format|diskpart|mkfs)/i, level: RiskLevel.BLOCKED },
    { pattern: /^(sudo|runas).*\b(rm|del|format)\b/i, level: RiskLevel.BLOCKED },
    { pattern: /chmod\s+[0-7]{3,4}\s+\//i, level: RiskLevel.DANGEROUS },
    { pattern: /curl.*\|\s*(bash|sh|powershell)/i, level: RiskLevel.DANGEROUS },
    { pattern: /wget.*\|\s*(bash|sh|powershell)/i, level: RiskLevel.DANGEROUS },
    { pattern: /^(git|npm|yarn|pnpm|node|python|pip)/i, level: RiskLevel.SAFE },
    { pattern: /^(ls|dir|cd|pwd|echo|cat|type)/i, level: RiskLevel.SAFE },
  ];

  constructor(config?: Partial<TerminalConfig>) {
    super();
    this.config = {
      defaultShell: this.getDefaultShell(),
      allowedCommands: ['*'], // Todos permitidos por padrão, mas validados por risco
      blockedCommands: [],
      maxExecutionTime: 60000, // 1 minuto
      enableLogging: true,
      requireConfirmationForDangerous: true,
      ...config,
    };
  }

  private getDefaultShell(): string {
    const platform = process.platform;
    
    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    } else if (platform === 'darwin') {
      return '/bin/zsh';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * Avalia o nível de risco de um comando
   */
  assessRisk(command: string): RiskLevel {
    for (const { pattern, level } of this.riskPatterns) {
      if (pattern.test(command)) {
        return level;
      }
    }

    // Verifica se está na lista de bloqueados
    if (this.config.blockedCommands.some(cmd => command.startsWith(cmd))) {
      return RiskLevel.BLOCKED;
    }

    // Verifica se está na lista de permitidos
    if (this.config.allowedCommands.includes('*') || 
        this.config.allowedCommands.some(cmd => command.startsWith(cmd))) {
      return RiskLevel.MEDIUM;
    }

    return RiskLevel.MEDIUM;
  }

  /**
   * Executa comando único com segurança
   */
  async executeCommand(
    command: string, 
    options?: { 
      cwd?: string; 
      timeout?: number; 
      shell?: string;
      env?: Record<string, string>;
    }
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const risk = this.assessRisk(command);

    // Bloqueia comandos perigosos
    if (risk === RiskLevel.BLOCKED) {
      throw new Error(`Comando bloqueado por segurança: ${command}`);
    }

    // Requer confirmação para comandos perigosos
    if (risk === RiskLevel.DANGEROUS && this.config.requireConfirmationForDangerous) {
      this.emit('confirmationRequired', { command, risk });
      // Aguarda confirmação via evento
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout na confirmação')), 30000);
        
        const onConfirm = (confirmed: boolean) => {
          clearTimeout(timeout);
          if (confirmed) resolve();
          else reject(new Error('Comando cancelado pelo usuário'));
        };

        this.once('confirmationResponse', onConfirm);
      });
    }

    const shell = options?.shell || this.config.defaultShell;
    const cwd = options?.cwd || process.cwd();
    const timeout = options?.timeout || this.config.maxExecutionTime;

    return new Promise((resolve, reject) => {
      const args = shell.includes('cmd') ? ['/c', command] : ['-c', command];
      
      const spawnOptions: SpawnOptions = {
        cwd,
        shell: true,
        env: { ...process.env, ...options?.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn(shell, args, spawnOptions);
      
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        reject(new Error(`Timeout após ${timeout}ms`));
      }, timeout);

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        this.emit('stdout', chunk);
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.emit('stderr', chunk);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        
        if (timedOut) return;

        const duration = Date.now() - startTime;
        const result: CommandResult = {
          exitCode: code || 0,
          stdout,
          stderr,
          command,
          duration,
          timestamp: new Date(),
        };

        if (this.config.enableLogging) {
          this.commandHistory.push(result);
          if (this.commandHistory.length > 1000) {
            this.commandHistory.shift();
          }
        }

        this.emit('commandComplete', result);
        resolve(result);
      });
    });
  }

  /**
   * Cria sessão de terminal interativo
   */
  createSession(options?: { cwd?: string; shell?: string }): TerminalSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shell = options?.shell || this.config.defaultShell;
    const cwd = options?.cwd || process.cwd();

    const session: TerminalSession = {
      id: sessionId,
      shell,
      cwd,
      active: true,
      createdAt: new Date(),
    };

    const spawnOptions: SpawnOptions = {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    const child = spawn(shell, [], spawnOptions);
    session.process = child;

    child.stdout?.on('data', (data) => {
      this.emit('sessionOutput', { sessionId, data: data.toString() });
    });

    child.stderr?.on('data', (data) => {
      this.emit('sessionError', { sessionId, data: data.toString() });
    });

    child.on('close', () => {
      session.active = false;
      this.emit('sessionClosed', { sessionId });
    });

    this.sessions.set(sessionId, session);
    this.emit('sessionCreated', session);

    return session;
  }

  /**
   * Envia input para sessão de terminal
   */
  sendToSession(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.process || !session.active) {
      throw new Error(`Sessão não encontrada ou inativa: ${sessionId}`);
    }

    session.process.stdin?.write(input + '\n');
    this.emit('inputSent', { sessionId, input });
  }

  /**
   * Fecha sessão de terminal
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (!session) return;

    if (session.process) {
      session.process.kill('SIGTERM');
    }

    session.active = false;
    this.sessions.delete(sessionId);
    this.emit('sessionClosed', { sessionId });
  }

  /**
   * Lista sessões ativas
   */
  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(s => s.active);
  }

  /**
   * Obtém histórico de comandos
   */
  getCommandHistory(limit?: number): CommandResult[] {
    return limit 
      ? this.commandHistory.slice(-limit) 
      : [...this.commandHistory];
  }

  /**
   * Limpa histórico de comandos
   */
  clearCommandHistory(): void {
    this.commandHistory = [];
    this.emit('historyCleared');
  }

  /**
   * Detecta tipo de shell baseado no comando
   */
  detectShell(command: string): string {
    if (/^(powershell|ps|pwsh)\b/i.test(command)) {
      return 'powershell';
    } else if (/^(bash|sh|zsh)\b/i.test(command)) {
      return process.platform === 'win32' ? 'git-bash' : 'bash';
    } else if (/^cmd\b/i.test(command)) {
      return 'cmd';
    }
    return this.config.defaultShell;
  }

  /**
   * Executa múltiplos comandos em sequência
   */
  async executeSequence(
    commands: string[], 
    options?: { 
      stopOnError?: boolean;
      cwd?: string;
    }
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    const stopOnError = options?.stopOnError ?? true;
    const cwd = options?.cwd;

    for (const command of commands) {
      try {
        const result = await this.executeCommand(command, { cwd });
        results.push(result);

        if (result.exitCode !== 0 && stopOnError) {
          break;
        }
      } catch (error) {
        if (stopOnError) {
          throw error;
        }
        results.push({
          exitCode: -1,
          stdout: '',
          stderr: (error as Error).message,
          command,
          duration: 0,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Valida e sanitiza comando
   */
  sanitizeCommand(command: string): string {
    // Remove caracteres perigosos
    return command.replace(/[;&|`$(){}[\]<>\\]/g, '');
  }

  getConfig(): TerminalConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<TerminalConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }
}

// Singleton instance
let terminalService: PegasusAITerminal | null = null;

export function getPegasusAITerminal(config?: Partial<TerminalConfig>): PegasusAITerminal {
  if (!terminalService) {
    terminalService = new PegasusAITerminal(config);
  }
  return terminalService;
}

export default PegasusAITerminal;
