/**
 * PegasusAI - Context Awareness Service
 * Fase 3: Sistema de Arquivos + Terminal
 * 
 * Desenvolve "context awareness" do projeto
 * Detecta automaticamente tipo de projeto, estrutura e dependências
 */

import * as fs from 'fs';
import * as path from 'path';
import { PegasusAIService } from './fileSystem/fileSystemService';

export interface ProjectContext {
  type: ProjectType;
  rootPath: string;
  language: string[];
  frameworks: string[];
  dependencies: Record<string, string>;
  structure: DirectoryStructure;
  gitInfo?: GitInfo;
  environment: EnvironmentInfo;
  lastScanned: Date;
}

export type ProjectType = 
  | 'nodejs'
  | 'python'
  | 'java'
  | 'dotnet'
  | 'rust'
  | 'go'
  | 'php'
  | 'ruby'
  | 'frontend'
  | 'fullstack'
  | 'mobile'
  | 'desktop'
  | 'unknown';

export interface DirectoryStructure {
  srcDirs: string[];
  testDirs: string[];
  configFiles: string[];
  entryPoints: string[];
  totalFiles: number;
  totalDirs: number;
}

export interface GitInfo {
  branch: string;
  remote?: string;
  lastCommit?: string;
  hasChanges: boolean;
}

export interface EnvironmentInfo {
  nodeVersion?: string;
  pythonVersion?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry';
  ide?: string;
  os: string;
}

export class PegasusAIContextAwareness {
  private fileService: PegasusAIService;
  private contextCache: Map<string, ProjectContext> = new Map();

  constructor(fileService?: PegasusAIService) {
    this.fileService = fileService || new PegasusAIService();
  }

  /**
   * Analisa projeto e gera contexto completo
   */
  async analyzeProject(rootPath: string): Promise<ProjectContext> {
    const cached = this.contextCache.get(rootPath);
    const cacheAge = cached ? Date.now() - cached.lastScanned.getTime() : Infinity;

    // Retorna cache se tiver menos de 5 minutos
    if (cached && cacheAge < 5 * 60 * 1000) {
      return cached;
    }

    const context: ProjectContext = {
      type: 'unknown',
      rootPath: path.resolve(rootPath),
      language: [],
      frameworks: [],
      dependencies: {},
      structure: {
        srcDirs: [],
        testDirs: [],
        configFiles: [],
        entryPoints: [],
        totalFiles: 0,
        totalDirs: 0,
      },
      environment: {
        os: process.platform,
      },
      lastScanned: new Date(),
    };

    // Detecta tipo de projeto
    await this.detectProjectType(context);
    
    // Detecta linguagens
    await this.detectLanguages(context);
    
    // Detecta frameworks
    await this.detectFrameworks(context);
    
    // Coleta dependências
    await this.collectDependencies(context);
    
    // Analisa estrutura de diretórios
    await this.analyzeStructure(context);
    
    // Coleta informações do Git
    await this.collectGitInfo(context);
    
    // Coleta informações do ambiente
    await this.collectEnvironmentInfo(context);

    this.contextCache.set(rootPath, context);
    return context;
  }

  private async detectProjectType(context: ProjectContext): Promise<void> {
    const root = context.rootPath;

    // Node.js
    if (this.fileExists(path.join(root, 'package.json'))) {
      context.type = 'nodejs';
      
      // Verifica se é frontend ou fullstack
      const pkgContent = await this.fileService.readFile(path.join(root, 'package.json'));
      const pkg = JSON.parse(pkgContent);
      
      const frontendFrameworks = ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'];
      const hasFrontend = frontendFrameworks.some(fw => 
        pkg.dependencies?.[fw] || pkg.devDependencies?.[fw] || 
        Object.keys(pkg).some(k => k.toLowerCase().includes(fw))
      );

      if (hasFrontend) {
        context.type = pkg.scripts?.build ? 'fullstack' : 'frontend';
      }
    }
    
    // Python
    else if (this.fileExists(path.join(root, 'requirements.txt')) || 
             this.fileExists(path.join(root, 'setup.py')) ||
             this.fileExists(path.join(root, 'pyproject.toml'))) {
      context.type = 'python';
    }
    
    // Java
    else if (this.fileExists(path.join(root, 'pom.xml')) || 
             this.fileExists(path.join(root, 'build.gradle'))) {
      context.type = 'java';
    }
    
    // .NET
    else if (this.fileExists(path.join(root, '.csproj')) || 
             this.fileExists(path.join(root, '.sln'))) {
      context.type = 'dotnet';
    }
    
    // Rust
    else if (this.fileExists(path.join(root, 'Cargo.toml'))) {
      context.type = 'rust';
    }
    
    // Go
    else if (this.fileExists(path.join(root, 'go.mod'))) {
      context.type = 'go';
    }
    
    // PHP
    else if (this.fileExists(path.join(root, 'composer.json'))) {
      context.type = 'php';
    }
    
    // Ruby
    else if (this.fileExists(path.join(root, 'Gemfile'))) {
      context.type = 'ruby';
    }
  }

  private async detectLanguages(context: ProjectContext): Promise<void> {
    const extensions = new Set<string>();
    const commonExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
      '.py', '.java', '.cs', '.rs', '.go', '.php', '.rb',
      '.html', '.css', '.scss', '.less',
      '.json', '.yaml', '.yml', '.toml', '.xml',
      '.md', '.sql', '.sh', '.ps1'
    ];

    const scanDir = async (dir: string, depth: number = 0) => {
      if (depth > 3) return;
      
      try {
        const entries = await this.fileService.listDirectory(dir, { maxDepth: 1 });
        
        for (const entry of entries) {
          if (entry.type === 'directory') {
            if (!['node_modules', '.git', 'vendor', 'target', 'build', 'dist'].includes(entry.name)) {
              await scanDir(entry.path, depth + 1);
            }
          } else if (entry.type === 'file') {
            const ext = path.extname(entry.name).toLowerCase();
            if (commonExtensions.includes(ext)) {
              extensions.add(ext);
            }
          }
        }
      } catch (e) {
        // Ignora erros de leitura
      }
    };

    await scanDir(context.rootPath);
    context.language = Array.from(extensions);
  }

  private async detectFrameworks(context: ProjectContext): Promise<void> {
    const root = context.rootPath;
    const frameworks: string[] = [];

    // Frontend
    if (this.fileExists(path.join(root, 'package.json'))) {
      const pkgContent = await this.fileService.readFile(path.join(root, 'package.json'));
      const pkg = JSON.parse(pkgContent);
      
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      const frameworkMap: Record<string, string> = {
        'react': 'React',
        'vue': 'Vue.js',
        'angular': 'Angular',
        'svelte': 'Svelte',
        'next': 'Next.js',
        'nuxt': 'Nuxt.js',
        '@remix-run/react': 'Remix',
        'express': 'Express.js',
        'fastify': 'Fastify',
        'nestjs': 'NestJS',
        'tailwindcss': 'Tailwind CSS',
        'bootstrap': 'Bootstrap',
        '@mui/material': 'Material-UI',
        'antd': 'Ant Design',
      };

      for (const [dep, name] of Object.entries(frameworkMap)) {
        if (allDeps[dep]) {
          frameworks.push(name);
        }
      }
    }

    // Python
    if (this.fileExists(path.join(root, 'requirements.txt'))) {
      const reqContent = await this.fileService.readFile(path.join(root, 'requirements.txt'));
      const pythonFrameworks: Record<string, string> = {
        'django': 'Django',
        'flask': 'Flask',
        'fastapi': 'FastAPI',
        'torch': 'PyTorch',
        'tensorflow': 'TensorFlow',
        'scikit-learn': 'Scikit-learn',
        'pandas': 'Pandas',
        'numpy': 'NumPy',
      };

      for (const [dep, name] of Object.entries(pythonFrameworks)) {
        if (reqContent.toLowerCase().includes(dep)) {
          frameworks.push(name);
        }
      }
    }

    context.frameworks = frameworks;
  }

  private async collectDependencies(context: ProjectContext): Promise<void> {
    const root = context.rootPath;
    const dependencies: Record<string, string> = {};

    // Node.js
    if (this.fileExists(path.join(root, 'package.json'))) {
      const pkgContent = await this.fileService.readFile(path.join(root, 'package.json'));
      const pkg = JSON.parse(pkgContent);
      Object.assign(dependencies, pkg.dependencies || {});
      Object.assign(dependencies, pkg.devDependencies || {});
    }

    // Python
    if (this.fileExists(path.join(root, 'requirements.txt'))) {
      const reqContent = await this.fileService.readFile(path.join(root, 'requirements.txt'));
      reqContent.split('\n').forEach(line => {
        const match = line.match(/^([a-zA-Z0-9_-]+)==([^\s]+)/);
        if (match) {
          dependencies[match[1]] = match[2];
        }
      });
    }

    // Rust
    if (this.fileExists(path.join(root, 'Cargo.toml'))) {
      const cargoContent = await this.fileService.readFile(path.join(root, 'Cargo.toml'));
      // Parse simples de Cargo.toml
      const inDeps = cargoContent.includes('[dependencies]');
      if (inDeps) {
        const depsSection = cargoContent.split('[dependencies]')[1].split('[')[0];
        depsSection.split('\n').forEach(line => {
          const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
          if (match) {
            dependencies[match[1]] = match[2];
          }
        });
      }
    }

    context.dependencies = dependencies;
  }

  private async analyzeStructure(context: ProjectContext): Promise<void> {
    const root = context.rootPath;
    const structure = context.structure;

    const commonSrcDirs = ['src', 'lib', 'app', 'packages', 'modules'];
    const commonTestDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
    const commonConfigFiles = [
      'package.json', 'tsconfig.json', 'jsconfig.json',
      'requirements.txt', 'setup.py', 'pyproject.toml',
      'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod',
      '.eslintrc', '.prettierrc', 'webpack.config.js', 'vite.config.ts',
      'docker-compose.yml', 'Dockerfile', '.env.example'
    ];
    const commonEntryPoints = [
      'index.js', 'index.ts', 'main.js', 'main.ts', 'main.py',
      'app.js', 'app.ts', 'server.js', 'server.ts'
    ];

    try {
      const entries = await this.fileService.listDirectory(root, { recursive: false });
      
      for (const entry of entries) {
        if (entry.type === 'directory') {
          if (commonSrcDirs.includes(entry.name)) {
            structure.srcDirs.push(entry.path);
          }
          if (commonTestDirs.includes(entry.name)) {
            structure.testDirs.push(entry.path);
          }
          structure.totalDirs++;
        } else if (entry.type === 'file') {
          if (commonConfigFiles.includes(entry.name)) {
            structure.configFiles.push(entry.path);
          }
          if (commonEntryPoints.includes(entry.name)) {
            structure.entryPoints.push(entry.path);
          }
          structure.totalFiles++;
        }
      }
    } catch (e) {
      // Ignora erros
    }
  }

  private async collectGitInfo(context: ProjectContext): Promise<void> {
    const root = context.rootPath;
    const gitDir = path.join(root, '.git');

    if (!this.dirExists(gitDir)) {
      return;
    }

    const gitInfo: GitInfo = {
      branch: 'unknown',
      hasChanges: false,
    };

    try {
      // Tenta ler branch atual
      const headFile = path.join(gitDir, 'HEAD');
      if (this.fileExists(headFile)) {
        const headContent = await this.fileService.readFile(headFile);
        const match = headContent.match(/ref: refs\/heads\/(.+)/);
        if (match) {
          gitInfo.branch = match[1];
        }
      }

      // Verifica se há mudanças
      const statusFile = path.join(gitDir, 'index');
      gitInfo.hasChanges = this.fileExists(statusFile);
    } catch (e) {
      // Ignora erros do Git
    }

    context.gitInfo = gitInfo;
  }

  private async collectEnvironmentInfo(context: ProjectContext): Promise<void> {
    const env: EnvironmentInfo = context.environment;

    // Node.js version
    env.nodeVersion = process.version;

    // Python version (se disponível)
    try {
      const { execSync } = require('child_process');
      const pythonVersion = execSync('python --version 2>&1 || python3 --version 2>&1', { encoding: 'utf8' }).trim();
      env.pythonVersion = pythonVersion;
    } catch (e) {
      // Python não disponível
    }

    // Package manager
    if (this.fileExists(path.join(context.rootPath, 'package-lock.json'))) {
      env.packageManager = 'npm';
    } else if (this.fileExists(path.join(context.rootPath, 'yarn.lock'))) {
      env.packageManager = 'yarn';
    } else if (this.fileExists(path.join(context.rootPath, 'pnpm-lock.yaml'))) {
      env.packageManager = 'pnpm';
    } else if (this.fileExists(path.join(context.rootPath, 'requirements.txt'))) {
      env.packageManager = 'pip';
    } else if (this.fileExists(path.join(context.rootPath, 'poetry.lock'))) {
      env.packageManager = 'poetry';
    }
  }

  private fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  private dirExists(dirPath: string): boolean {
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Obtém contexto de arquivo específico
   */
  async getFileContext(filePath: string): Promise<{
    type: string;
    language: string;
    imports: string[];
    exports: string[];
    dependencies: string[];
  }> {
    const resolved = path.resolve(filePath);
    const ext = path.extname(resolved).toLowerCase();
    
    let content = '';
    try {
      content = await this.fileService.readFile(resolved);
    } catch (e) {
      throw new Error(`Não foi possível ler o arquivo: ${filePath}`);
    }

    const fileContext = {
      type: this.getFileType(ext),
      language: this.getLanguageFromExt(ext),
      imports: this.extractImports(content, ext),
      exports: this.extractExports(content, ext),
      dependencies: [],
    };

    return fileContext;
  }

  private getFileType(ext: string): string {
    const typeMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'React TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'React JavaScript',
      '.vue': 'Vue Component',
      '.py': 'Python Module',
      '.java': 'Java Class',
      '.cs': 'C# Class',
      '.rs': 'Rust Module',
      '.go': 'Go Package',
      '.html': 'HTML',
      '.css': 'Stylesheet',
      '.json': 'JSON Config',
      '.yaml': 'YAML Config',
      '.md': 'Markdown',
    };
    return typeMap[ext] || 'Unknown';
  }

  private getLanguageFromExt(ext: string): string {
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.vue': 'vue',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.rs': 'rust',
      '.go': 'go',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.yaml': 'yaml',
      '.md': 'markdown',
    };
    return langMap[ext] || 'unknown';
  }

  private extractImports(content: string, ext: string): string[] {
    const imports: string[] = [];
    
    // JavaScript/TypeScript
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const importRegex = /(?:import|require)\s+.*?from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }
    
    // Python
    else if (ext === '.py') {
      const importRegex = /^(?:import|from)\s+(\S+)/gm;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  private extractExports(content: string, ext: string): string[] {
    const exports: string[] = [];
    
    // JavaScript/TypeScript
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
      let match;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }
    
    // Python
    else if (ext === '.py') {
      const exportRegex = /^(?:def|class)\s+(\w+)/gm;
      let match;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }

    return exports;
  }

  /**
   * Limpa cache de contexto
   */
  clearCache(projectPath?: string): void {
    if (projectPath) {
      this.contextCache.delete(projectPath);
    } else {
      this.contextCache.clear();
    }
  }

  /**
   * Obtém todos os contextos em cache
   */
  getCachedContexts(): Map<string, ProjectContext> {
    return new Map(this.contextCache);
  }
}

// Singleton instance
let contextService: PegasusAIContextAwareness | null = null;

export function getPegasusAIContextAwareness(fileService?: PegasusAIService): PegasusAIContextAwareness {
  if (!contextService) {
    contextService = new PegasusAIContextAwareness(fileService);
  }
  return contextService;
}

export default PegasusAIContextAwareness;
