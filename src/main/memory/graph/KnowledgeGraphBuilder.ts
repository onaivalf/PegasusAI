/**
 * Knowledge Graph Builder - Automatic extraction and indexing of code structure
 * Analyzes source files to build a semantic graph of code relationships
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { KnowledgeNode, KnowledgeEdge } from '../../common/types/memory';
import { MemoryService } from './MemoryService';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'enum' | 'type_alias';
  lineStart: number;
  lineEnd: number;
  signature?: string;
  docstring?: string;
  dependencies: string[];
  dependents: string[];
  modifiers?: ('public' | 'private' | 'protected' | 'static' | 'async')[];
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
}

export class KnowledgeGraphBuilder {
  private memoryService: MemoryService;
  private supportedLanguages: Set<string>;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
    this.supportedLanguages = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h']);
  }

  /**
   * Analyze a single file and extract symbols
   */
  async analyzeFile(filePath: string): Promise<FileAnalysis | null> {
    const ext = path.extname(filePath).slice(1);
    
    if (!this.supportedLanguages.has(ext)) {
      console.log(`[KnowledgeGraphBuilder] Skipping unsupported language: ${ext}`);
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const language = this.getLanguageName(ext);
      
      let symbols: CodeSymbol[] = [];
      let imports: string[] = [];
      let exports: string[] = [];

      // Análise baseada em regex para diferentes linguagens
      if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
        const result = this.analyzeTypeScript(content);
        symbols = result.symbols;
        imports = result.imports;
        exports = result.exports;
      } else if (ext === 'py') {
        const result = this.analyzePython(content);
        symbols = result.symbols;
        imports = result.imports;
        exports = result.exports;
      } else {
        // Análise genérica para outras linguagens
        const result = this.analyzeGeneric(content);
        symbols = result.symbols;
        imports = result.imports;
        exports = result.exports;
      }

      return {
        filePath,
        language,
        symbols,
        imports,
        exports,
      };
    } catch (error) {
      console.error(`[KnowledgeGraphBuilder] Error analyzing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Index a file into the knowledge graph
   */
  async indexFile(filePath: string): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } | null> {
    const analysis = await this.analyzeFile(filePath);
    
    if (!analysis) {
      return null;
    }

    // Indexar símbolos no serviço de memória
    const symbolData = analysis.symbols.map(s => ({
      name: s.name,
      type: s.type as 'function' | 'class' | 'variable' | 'interface',
      signature: s.signature,
      dependencies: s.dependencies,
    }));

    const result = await this.memoryService.indexCodeSymbols(filePath, symbolData);

    console.log(`[KnowledgeGraphBuilder] Indexed ${analysis.symbols.length} symbols from ${filePath}`);
    
    return result;
  }

  /**
   * Batch index multiple files
   */
  async indexFiles(filePaths: string[]): Promise<{
    totalFiles: number;
    successfulFiles: number;
    totalSymbols: number;
    results: Array<{ filePath: string; success: boolean; symbols?: number }>;
  }> {
    const results: Array<{ filePath: string; success: boolean; symbols?: number }> = [];
    let totalSymbols = 0;
    let successfulFiles = 0;

    for (const filePath of filePaths) {
      try {
        const result = await this.indexFile(filePath);
        
        if (result) {
          successfulFiles++;
          const symbolCount = result.nodes.length - 1; // -1 para o nó do arquivo
          totalSymbols += symbolCount;
          results.push({ filePath, success: true, symbols: symbolCount });
        } else {
          results.push({ filePath, success: false });
        }
      } catch (error) {
        console.error(`[KnowledgeGraphBuilder] Error indexing ${filePath}:`, error);
        results.push({ filePath, success: false });
      }
    }

    return {
      totalFiles: filePaths.length,
      successfulFiles,
      totalSymbols,
      results,
    };
  }

  /**
   * Scan a directory and index all supported files
   */
  async scanDirectory(dirPath: string, options?: {
    recursive?: boolean;
    excludePatterns?: string[];
    maxFiles?: number;
  }): Promise<{
    filesScanned: number;
    filesIndexed: number;
    totalSymbols: number;
  }> {
    const recursive = options?.recursive ?? true;
    const excludePatterns = options?.excludePatterns ?? ['node_modules', '.git', 'dist', 'build', '__pycache__'];
    const maxFiles = options?.maxFiles ?? 1000;

    const filesToIndex: string[] = [];
    let filesScanned = 0;

    const scan = async (currentPath: string): Promise<void> => {
      if (filesToIndex.length >= maxFiles) return;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          // Verificar padrões de exclusão
          if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            if (recursive) {
              await scan(fullPath);
            }
          } else if (entry.isFile()) {
            filesScanned++;
            const ext = path.extname(entry.name).slice(1);
            if (this.supportedLanguages.has(ext)) {
              filesToIndex.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`[KnowledgeGraphBuilder] Error scanning ${currentPath}:`, error);
      }
    };

    await scan(dirPath);

    console.log(`[KnowledgeGraphBuilder] Found ${filesToIndex.length} files to index out of ${filesScanned} scanned`);

    const indexResult = await this.indexFiles(filesToIndex);

    return {
      filesScanned,
      filesIndexed: indexResult.successfulFiles,
      totalSymbols: indexResult.totalSymbols,
    };
  }

  /**
   * Find relationships between symbols across files
   */
  async findCrossFileRelationships(): Promise<KnowledgeEdge[]> {
    console.log('[KnowledgeGraphBuilder] Finding cross-file relationships...');
    
    // Buscar todos os nós do grafo
    const allNodes = await this.memoryService.queryKnowledgeGraph({});
    
    const newEdges: KnowledgeEdge[] = [];
    const nodeMap = new Map(allNodes.nodes.map(n => [n.properties.name, n]));

    // Para cada nó, verificar dependências
    for (const node of allNodes.nodes) {
      if (node.type === 'file') continue; // Pular nós de arquivo

      const dependencies = node.properties.dependencies || [];
      
      for (const depName of dependencies) {
        const depNode = nodeMap.get(depName);
        
        if (depNode && depNode.id !== node.id) {
          // Verificar se aresta já existe
          const existingEdges = await this.memoryService.getKnowledgeEdges(node.id, depNode.id);
          
          if (existingEdges.length === 0) {
            const edge = await this.memoryService.addKnowledgeEdge(
              node.id,
              depNode.id,
              'uses'
            );
            newEdges.push(edge);
          }
        }
      }
    }

    console.log(`[KnowledgeGraphBuilder] Created ${newEdges.length} new cross-file relationships`);
    
    return newEdges;
  }

  /**
   * TypeScript/JavaScript analysis using regex patterns
   */
  private analyzeTypeScript(content: string): { symbols: CodeSymbol[]; imports: string[]; exports: string[] } {
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    const lines = content.split('\n');

    // Extrair imports
    const importRegex = /^import\s+.*\s+from\s+['"](.+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Extrair exports
    const exportRegex = /^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/gm;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Extrair classes
    const classRegex = /^export?\s*(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(.+))?/gm;
    while ((match = classRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const dependencies = [];
      if (match[2]) dependencies.push(match[2]);
      if (match[3]) {
        dependencies.push(...match[3].split(',').map((s: string) => s.trim()));
      }

      symbols.push({
        name: match[1],
        type: 'class',
        lineStart: lineNum,
        lineEnd: lineNum, // Será atualizado posteriormente
        signature: match[0],
        dependencies,
        dependents: [],
      });
    }

    // Extrair funções
    const functionRegex = /^export?\s*(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm;
    while ((match = functionRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      
      symbols.push({
        name: match[1],
        type: 'function',
        lineStart: lineNum,
        lineEnd: lineNum,
        signature: match[0],
        dependencies: this.extractFunctionDependencies(match[0]),
        dependents: [],
      });
    }

    // Extrair interfaces
    const interfaceRegex = /^export?\s*interface\s+(\w+)(?:\s+extends\s+(.+))?/gm;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const dependencies = match[2] ? match[2].split(',').map((s: string) => s.trim()) : [];

      symbols.push({
        name: match[1],
        type: 'interface',
        lineStart: lineNum,
        lineEnd: lineNum,
        signature: match[0],
        dependencies,
        dependents: [],
      });
    }

    // Extrair variáveis/constantes exportadas
    const varRegex = /^export\s+(?:const|let|var)\s+(\w+)\s*=/gm;
    while ((match = varRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;

      symbols.push({
        name: match[1],
        type: 'constant',
        lineStart: lineNum,
        lineEnd: lineNum,
        signature: match[0],
        dependencies: [],
        dependents: [],
      });
    }

    return { symbols, imports, exports };
  }

  /**
   * Python analysis using regex patterns
   */
  private analyzePython(content: string): { symbols: CodeSymbol[]; imports: string[]; exports: string[] } {
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    // Extrair imports
    const importRegex = /^(?:import\s+(\w+)|from\s+(\w+)\s+import\s+)/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }

    // Extrair classes
    const classRegex = /^class\s+(\w+)(?:\(([^)]+)\))?/gm;
    while ((match = classRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const dependencies = match[2] ? match[2].split(',').map((s: string) => s.trim()) : [];

      symbols.push({
        name: match[1],
        type: 'class',
        lineStart: lineNum,
        lineEnd: lineNum,
        signature: match[0],
        dependencies,
        dependents: [],
      });
    }

    // Extrair funções
    const functionRegex = /^def\s+(\w+)\s*\(([^)]*)\)/gm;
    while ((match = functionRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;

      symbols.push({
        name: match[1],
        type: 'function',
        lineStart: lineNum,
        lineEnd: lineNum,
        signature: match[0],
        dependencies: this.extractFunctionDependencies(match[0]),
        dependents: [],
      });
    }

    return { symbols, imports, exports };
  }

  /**
   * Generic analysis for other languages
   */
  private analyzeGeneric(content: string): { symbols: CodeSymbol[]; imports: string[]; exports: string[] } {
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    // Padrões genéricos que funcionam para várias linguagens
    const functionRegex = /(?:function|func|def)\s+(\w+)\s*\(/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      
      symbols.push({
        name: match[1],
        type: 'function',
        lineStart: lineNum,
        lineEnd: lineNum,
        signature: match[0],
        dependencies: [],
        dependents: [],
      });
    }

    return { symbols, imports, exports };
  }

  /**
   * Extract dependencies from a function signature
   */
  private extractFunctionDependencies(signature: string): string[] {
    const dependencies: string[] = [];
    
    // Extrair tipos dos parâmetros
    const typeRegex = /:\s*(\w+)/g;
    let match;
    
    while ((match = typeRegex.exec(signature)) !== null) {
      if (!['string', 'number', 'boolean', 'void', 'null', 'undefined'].includes(match[1])) {
        dependencies.push(match[1]);
      }
    }

    return dependencies;
  }

  /**
   * Get language name from extension
   */
  private getLanguageName(ext: string): string {
    const map: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript React',
      js: 'JavaScript',
      jsx: 'JavaScript React',
      py: 'Python',
      go: 'Go',
      rs: 'Rust',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      h: 'C Header',
    };
    
    return map[ext] || ext.toUpperCase();
  }
}
