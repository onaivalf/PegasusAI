/*---------------------------------------------------------------------------------------------
 *  Copyright (c) PegasusAI Team. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ipcMain, shell, app } from 'electron';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { createHash } from 'crypto';

/**
 * PegasusAI Security Gate
 * Intercepta todas as chamadas críticas do renderer para o main process.
 * Implementa defesa em profundidade contra Path Traversal, Command Injection e Leaks.
 */
export class SecurityGate {
    private static readonly ALLOWED_ROOTS = new Set<string>();
    private static readonly DANGEROUS_PATTERNS = [
        /\.\./g, // Path traversal
        /[`$(){}]/g, // Command substitution
        /eval\s*\(/i,
        /exec\s*\(/i,
        /spawn\s*\(/i
    ];

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        // Define raízes seguras (workspace do usuário)
        const userDataPath = app.getPath('userData');
        SecurityGate.ALLOWED_ROOTS.add(userDataPath);
        
        // Registra interceptores IPC
        this.registerFileAccessInterceptor();
        this.registerShellInterceptor();
        this.registerSystemInfoInterceptor();
    }

    /**
     * Interceptor de Acesso a Arquivos
     * Valida se o caminho solicitado está dentro de uma pasta permitida.
     */
    private registerFileAccessInterceptor(): void {
        ipcMain.handle('pegasusai:readFile', async (event, filePath: string) => {
            if (!this.validatePath(filePath)) {
                throw new Error(`[SECURITY GATE] Acesso negado: Tentativa de acesso fora do workspace (${filePath})`);
            }
            
            // Verificação extra para arquivos sensíveis do sistema
            if (filePath.includes('.ssh') || filePath.includes('.env') || filePath.includes('passwd')) {
                console.warn(`[SECURITY GATE] Alerta: Leitura de arquivo sensível tentada: ${filePath}`);
                // Em produção estrita, isso poderia ser bloqueado totalmente
            }

            if (!existsSync(filePath)) {
                throw new Error(`Arquivo não encontrado: ${filePath}`);
            }

            return createReadStream(filePath);
        });

        ipcMain.handle('pegasusai:writeFile', async (event, filePath: string, content: string) => {
            if (!this.validatePath(filePath)) {
                throw new Error(`[SECURITY GATE] Escrita negada: Caminho inseguro (${filePath})`);
            }
            // Lógica de escrita segura seria implementada aqui com atomic write
            return true;
        });
    }

    /**
     * Interceptor de Shell (Terminal)
     * Sanitiza comandos antes de passar para o child_process
     */
    private registerShellInterceptor(): void {
        ipcMain.handle('pegasusai:execCommand', async (event, command: string, cwd: string) => {
            if (!this.validatePath(cwd)) {
                throw new Error(`[SECURITY GATE] Diretório de trabalho inválido: ${cwd}`);
            }

            // Detecção de padrões perigosos no comando
            for (const pattern of SecurityGate.DANGEROUS_PATTERNS) {
                if (pattern.test(command)) {
                    // Log de auditoria de segurança
                    console.error(`[SECURITY AUDIT] Comando potencialmente malicioso bloqueado: ${command}`);
                    throw new Error(`[SECURITY GATE] Comando bloqueado por conter padrões perigosos.`);
                }
            }

            // Aqui seria chamado o spawn real com shell: false para segurança máxima
            // const result = await execAsync(command, { cwd, shell: false }); 
            return { output: 'Comando simulado com sucesso (Safe Mode)', exitCode: 0 };
        });
    }

    private registerSystemInfoInterceptor(): void {
        ipcMain.handle('pegasusai:getSystemInfo', async () => {
            // Retorna apenas informações não sensíveis
            return {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                // Nunca expor hostname real ou usuário completo sem permissão explícita
                user: 'sandboxed-user' 
            };
        });
    }

    /**
     * Valida se um caminho está dentro de uma das raízes permitidas
     */
    private validatePath(requestedPath: string): boolean {
        try {
            const resolvedPath = join(requestedPath); // Resolve . e ..
            
            for (const allowedRoot of SecurityGate.ALLOWED_ROOTS) {
                if (resolvedPath.startsWith(allowedRoot)) {
                    return true;
                }
            }
            
            // Permite caminhos absolutos explicitamente adicionados pelo usuário via UI de confiança
            // Por enquanto, estrito ao workspace
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Adiciona uma raiz confiável dinamicamente (ex: quando usuário abre uma pasta D:\Projetos)
     */
    public static addTrustedRoot(path: string): void {
        if (existsSync(path)) {
            this.ALLOWED_ROOTS.add(path);
        }
    }
}

// Inicialização automática quando o módulo é carregado no main process
new SecurityGate();
