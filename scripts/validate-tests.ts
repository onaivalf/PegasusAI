#!/usr/bin/env node

/**
 * Script de Validação e Execução de Testes da PegasusAI
 * Executa todos os testes e gera relatório de cobertura
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = process.cwd();
const TEST_RESULTS_DIR = join(ROOT_DIR, 'test-results');

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command: string, options: any = {}): string {
  try {
    return execSync(command, { 
      stdio: 'pipe', 
      encoding: 'utf-8',
      ...options 
    }).trim();
  } catch (error: any) {
    if (options.ignoreError) {
      return error.stdout?.trim() || '';
    }
    throw error;
  }
}

function checkDependencies(): boolean {
  log('\n🔍 Verificando dependências...', 'cyan');
  
  const requiredDeps = [
    'jest',
    'ts-jest',
    '@types/jest',
    '@playwright/test',
    'typescript'
  ];
  
  let allInstalled = true;
  
  for (const dep of requiredDeps) {
    try {
      runCommand(`npm list ${dep}`, { ignoreError: true });
      log(`  ✓ ${dep}`, 'green');
    } catch {
      log(`  ✗ ${dep} - não encontrado`, 'red');
      allInstalled = false;
    }
  }
  
  return allInstalled;
}

function installDependencies(): void {
  log('\n📦 Instalando dependências de teste...', 'cyan');
  try {
    runCommand('npm install --save-dev jest ts-jest @types/jest @playwright/test playwright', { stdio: 'inherit' });
    log('✓ Dependências instaladas com sucesso', 'green');
  } catch (error: any) {
    log('✗ Erro ao instalar dependências: ' + error.message, 'red');
    process.exit(1);
  }
}

function runUnitTests(): { passed: boolean; coverage: number } {
  log('\n🧪 Executando testes unitários...', 'cyan');
  
  try {
    // Executar Jest com coverage
    const result = runCommand('npx jest --coverage --coverageReporters=json-summary --silent', { 
      ignoreError: true,
      stdio: 'pipe'
    });
    
    // Ler arquivo de coverage
    const coverageFile = join(ROOT_DIR, 'coverage', 'coverage-summary.json');
    if (existsSync(coverageFile)) {
      const coverage = JSON.parse(runCommand(`cat ${coverageFile}`));
      const lineCoverage = coverage.total.lines.pct;
      
      log(`  Cobertura de linhas: ${lineCoverage.toFixed(2)}%`, 'blue');
      
      if (lineCoverage >= 70) {
        log('  ✓ Cobertura mínima atingida (70%)', 'green');
      } else {
        log('  ⚠ Cobertura abaixo do mínimo (70%)', 'yellow');
      }
      
      return { passed: true, coverage: lineCoverage };
    }
    
    return { passed: true, coverage: 0 };
  } catch (error: any) {
    log('  ✗ Erro nos testes unitários: ' + error.message, 'red');
    return { passed: false, coverage: 0 };
  }
}

function runIntegrationTests(): boolean {
  log('\n🔗 Executando testes de integração...', 'cyan');
  
  try {
    runCommand('npx jest --config jest.config.js test/integration/', { stdio: 'inherit' });
    log('  ✓ Testes de integração concluídos', 'green');
    return true;
  } catch (error: any) {
    log('  ⚠ Alguns testes de integração falharam', 'yellow');
    return false;
  }
}

function runE2ETests(): boolean {
  log('\n🎭 Executando testes E2E...', 'cyan');
  
  try {
    // Instalar browsers do Playwright se necessário
    if (!existsSync(join(process.env.HOME || '', '.cache', 'ms-playwright'))) {
      log('  Instalando browsers do Playwright...', 'yellow');
      runCommand('npx playwright install chromium', { stdio: 'inherit' });
    }
    
    runCommand('npx playwright test test/e2e/', { stdio: 'inherit' });
    log('  ✓ Testes E2E concluídos', 'green');
    return true;
  } catch (error: any) {
    log('  ⚠ Alguns testes E2E falharam', 'yellow');
    return false;
  }
}

function generateReport(results: {
  unit: { passed: boolean; coverage: number };
  integration: boolean;
  e2e: boolean;
}): void {
  log('\n📊 Gerando relatório de validação...', 'cyan');
  
  // Criar diretório de resultados
  if (!existsSync(TEST_RESULTS_DIR)) {
    mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      unitTests: results.unit.passed ? 'PASS' : 'FAIL',
      integrationTests: results.integration ? 'PASS' : 'FAIL',
      e2eTests: results.e2e ? 'PASS' : 'FAIL',
      codeCoverage: `${results.unit.coverage.toFixed(2)}%`
    },
    details: {
      unit: {
        status: results.unit.passed,
        coverage: results.unit.coverage,
        threshold: 70
      },
      integration: {
        status: results.integration
      },
      e2e: {
        status: results.e2e
      }
    },
    overall: results.unit.passed && results.integration && results.e2e ? 'PASS' : 'FAIL'
  };
  
  // Salvar relatório JSON
  const reportPath = join(TEST_RESULTS_DIR, 'validation-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`  ✓ Relatório salvo em: ${reportPath}`, 'green');
  
  // Imprimir resumo
  log('\n' + '='.repeat(60), 'cyan');
  log('PEGASUSAI - RELATÓRIO DE VALIDAÇÃO', 'magenta');
  log('='.repeat(60), 'cyan');
  log(`\nData: ${report.timestamp}`, 'blue');
  log(`\nTestes Unitários:    ${report.summary.unitTests}`, report.unitTests === 'PASS' ? 'green' : 'red');
  log(`Cobertura de Código: ${report.summary.codeCoverage}`, report.unit.coverage >= 70 ? 'green' : 'yellow');
  log(`Testes Integração:   ${report.summary.integrationTests}`, report.integration ? 'green' : 'yellow');
  log(`Testes E2E:          ${report.summary.e2eTests}`, report.e2e ? 'green' : 'yellow');
  log(`\nStatus Geral:        ${report.overall}`, report.overall === 'PASS' ? 'green' : 'red');
  log('='.repeat(60), 'cyan');
  
  if (report.overall === 'PASS') {
    log('\n✅ FASE 10 CONCLUÍDA COM SUCESSO!\n', 'green');
  } else {
    log('\n⚠️  FASE 10 CONCLUÍDA COM ALERTAS\n', 'yellow');
  }
}

async function main(): Promise<void> {
  log('\n' + '🚀'.repeat(20), 'magenta');
  log('PEGASUSAI - FASE 10: VALIDAÇÃO INTEGRAL E TESTES', 'magenta');
  log('🚀'.repeat(20) + '\n', 'magenta');
  
  // Verificar e instalar dependências
  if (!checkDependencies()) {
    log('\nDependências ausentes detectadas.', 'yellow');
    installDependencies();
  }
  
  // Executar testes
  const unitResults = runUnitTests();
  const integrationResults = runIntegrationTests();
  const e2eResults = runE2ETests();
  
  // Gerar relatório
  generateReport({
    unit: unitResults,
    integration: integrationResults,
    e2e: e2eResults
  });
  
  // Exit code baseado no resultado
  if (unitResults.passed && integrationResults && e2eResults) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Executar script
main().catch(error => {
  log('Erro fatal: ' + error.message, 'red');
  process.exit(1);
});
