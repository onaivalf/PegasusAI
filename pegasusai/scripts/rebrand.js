#!/usr/bin/env node

/**
 * Script de Rebranding para PegasusAI
 * 
 * Este script realiza substituições seguras de nomes e marcas
 * em arquivos de configuração e código fonte.
 */

const fs = require('fs');
const path = require('path');

// Configurações de rebranding
const BRANDING_CONFIG = {
  // Substituições em strings (respeitando limites de palavras)
  stringReplacements: [
    { from: /(?<!\w)Visual Studio Code(?!\w)/g, to: 'PegasusAI' },
    { from: /(?<!\w)VSCode(?!\w)/g, to: 'PegasusAI' },
    { from: /(?<!\w)Code - OSS(?!\w)/g, to: 'PegasusAI' },
    { from: /(?<!\w)Microsoft Corporation(?!\w)/g, to: 'PegasusAI Foundation' },
  ],
  
  // Arquivos que devem ser processados
  targetExtensions: ['.json', '.ts', '.tsx', '.js', '.jsx', '.md', '.html', '.css'],
  
  // Diretórios a serem ignorados
  ignoreDirs: ['node_modules', '.git', 'build', 'dist', 'out'],
  
  // Arquivos específicos para processamento prioritário
  priorityFiles: [
    'package.json',
    'product.json',
    'src/main.ts',
    'src/renderer.ts',
  ]
};

/**
 * Verifica se o arquivo deve ser processado
 */
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  return BRANDING_CONFIG.targetExtensions.includes(ext);
}

/**
 * Verifica se o diretório deve ser ignorado
 */
function shouldIgnoreDir(dirName) {
  return BRANDING_CONFIG.ignoreDirs.includes(dirName);
}

/**
 * Realiza substituições em um arquivo
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Aplica substituições
    for (const replacement of BRANDING_CONFIG.stringReplacements) {
      content = content.replace(replacement.from, replacement.to);
    }
    
    // Só escreve se houve mudanças
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Processado: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ Erro ao processar ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Percorre diretório recursivamente
 */
function walkDirectory(dirPath, callback) {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!shouldIgnoreDir(file)) {
        walkDirectory(filePath, callback);
      }
    } else if (shouldProcessFile(filePath)) {
      callback(filePath);
    }
  }
}

/**
 * Função principal
 */
function main() {
  console.log('🚀 Iniciando rebranding para PegasusAI...\n');
  
  const rootDir = process.cwd();
  let processedCount = 0;
  
  // Processa arquivos prioritários primeiro
  console.log('📋 Processando arquivos prioritários...');
  for (const priorityFile of BRANDING_CONFIG.priorityFiles) {
    const filePath = path.join(rootDir, priorityFile);
    if (fs.existsSync(filePath)) {
      if (processFile(filePath)) {
        processedCount++;
      }
    }
  }
  
  // Processa demais arquivos
  console.log('\n🔍 Escaneando diretório...');
  walkDirectory(rootDir, (filePath) => {
    if (processFile(filePath)) {
      processedCount++;
    }
  });
  
  console.log(`\n✅ Rebranding concluído! ${processedCount} arquivo(s) modificado(s).`);
  console.log('\n⚠️  Importante: Revise as mudanças antes de commitar.');
}

// Executa
main();
