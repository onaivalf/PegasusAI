#!/usr/bin/env node

/**
 * PegasusAI Build Pipeline Orchestrator
 * Executa o processo completo de build: limpeza, compilação e empacotamento.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function exec(command, description) {
    log(`\n🚀 ${description}...`, 'cyan');
    try {
        execSync(command, { stdio: 'inherit', cwd: process.cwd() });
        log(`✅ ${description} concluído!`, 'green');
        return true;
    } catch (error) {
        log(`❌ Erro em ${description}: ${error.message}`, 'red');
        return false;
    }
}

function clean() {
    log('\n🧹 Limpando diretórios anteriores...', 'yellow');
    const dirs = ['out', 'dist', 'build'];
    dirs.forEach(dir => {
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            log(`   🗑️  ${dir} removido`, 'blue');
        }
    });
    log('✅ Limpeza concluída!', 'green');
}

function checkPrerequisites() {
    log('\n🔍 Verificando pré-requisitos...', 'cyan');
    
    // Verificar Node.js
    try {
        const nodeVersion = execSync('node --version').toString().trim();
        log(`   🟢 Node.js: ${nodeVersion}`, 'green');
    } catch (e) {
        log('   🔴 Node.js não encontrado!', 'red');
        return false;
    }

    // Verificar package.json
    if (!fs.existsSync(path.join(process.cwd(), 'package.json'))) {
        log('   🔴 package.json não encontrado!', 'red');
        return false;
    }
    log('   🟢 package.json encontrado', 'green');

    // Verificar electron-builder.yml
    if (!fs.existsSync(path.join(process.cwd(), 'electron-builder.yml'))) {
        log('   🔴 electron-builder.yml não encontrado!', 'red');
        return false;
    }
    log('   🟢 electron-builder.yml encontrado', 'green');

    // Verificar dependências
    if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
        log('   ⚠️  node_modules não encontrado. Executando npm install...', 'yellow');
        if (!exec('npm install', 'Instalando dependências')) {
            return false;
        }
    } else {
        log('   🟢 Dependências instaladas', 'green');
    }

    return true;
}

function compile() {
    log('\n⚙️  Compilando código TypeScript...', 'cyan');
    
    // Compilar Main Process
    if (!exec('npx tsc -p tsconfig.json', 'Compilando Main Process')) {
        return false;
    }

    // Compilar Renderer (se houver config separada)
    if (fs.existsSync('tsconfig.renderer.json')) {
        if (!exec('npx tsc -p tsconfig.renderer.json', 'Compilando Renderer')) {
            return false;
        }
    }

    // Copiar recursos estáticos
    log('\n📦 Copiando recursos estáticos...', 'cyan');
    const resourcesDir = path.join(process.cwd(), 'out', 'resources');
    if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
    }
    
    // Copiar icons se existirem
    const srcIcons = path.join(process.cwd(), 'resources', 'icons');
    if (fs.existsSync(srcIcons)) {
        const destIcons = path.join(process.cwd(), 'out', 'resources', 'icons');
        fs.cpSync(srcIcons, destIcons, { recursive: true });
        log('   🎨 Ícones copiados', 'green');
    }

    return true;
}

function package(platforms = []) {
    log('\n📦 Empacotando aplicação...', 'cyan');
    
    const platformFlags = platforms.length > 0 
        ? `--${platforms.join(' --')}` 
        : '-wml'; // Windows, Mac, Linux por padrão

    const command = `npx electron-builder ${platformFlags} --config electron-builder.yml`;
    
    if (!exec(command, 'Gerando instaladores')) {
        return false;
    }

    return true;
}

function generateChecksums() {
    log('\n🔐 Gerando checksums...', 'cyan');
    
    const distDir = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distDir)) {
        log('   ⚠️  Diretório dist não encontrado. Pulando checksums.', 'yellow');
        return true;
    }

    const files = fs.readdirSync(distDir).filter(f => 
        f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.AppImage') || 
        f.endsWith('.deb') || f.endsWith('.rpm') || f.endsWith('.zip')
    );

    if (files.length === 0) {
        log('   ⚠️  Nenhum instalador encontrado para gerar checksum.', 'yellow');
        return true;
    }

    const crypto = require('crypto');
    const checksums = [];

    files.forEach(file => {
        const filePath = path.join(distDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');
        checksums.push(`${hex}  ${file}`);
        log(`   ✅ SHA256: ${file}`, 'green');
    });

    fs.writeFileSync(path.join(distDir, 'checksums.txt'), checksums.join('\n'));
    log('   📄 checksums.txt gerado com sucesso!', 'green');

    return true;
}

function main() {
    log('\n' + '='.repeat(60), 'bright');
    log('🦅 PEGASUSAI BUILD PIPELINE', 'bright');
    log('='.repeat(60), 'bright');

    const args = process.argv.slice(2);
    const platforms = args.filter(arg => ['win', 'mac', 'linux'].includes(arg));
    const skipClean = args.includes('--skip-clean');
    const skipCompile = args.includes('--skip-compile');
    const onlyPackage = args.includes('--only-package');

    // Step 1: Check Prerequisites
    if (!checkPrerequisites()) {
        log('\n❌ Build falhou na verificação de pré-requisitos.', 'red');
        process.exit(1);
    }

    // Step 2: Clean
    if (!skipClean && !onlyPackage) {
        clean();
    }

    // Step 3: Compile
    if (!skipCompile && !onlyPackage) {
        if (!compile()) {
            log('\n❌ Build falhou na compilação.', 'red');
            process.exit(1);
        }
    }

    // Step 4: Package
    if (!package(platforms)) {
        log('\n❌ Build falhou no empacotamento.', 'red');
        process.exit(1);
    }

    // Step 5: Checksums
    if (!generateChecksums()) {
        log('\n⚠️  Falha ao gerar checksums (não crítico).', 'yellow');
    }

    log('\n' + '='.repeat(60), 'bright');
    log('🎉 BUILD CONCLUÍDO COM SUCESSO!', 'bright');
    log('='.repeat(60), 'bright');
    log('\n📂 Instaladores disponíveis em:', 'cyan');
    log('   ' + path.join(process.cwd(), 'dist'), 'green');
    log('\n✨ Pronto para distribuição!', 'bright');
}

main();
