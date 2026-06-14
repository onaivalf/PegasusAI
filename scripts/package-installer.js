#!/usr/bin/env node

/**
 * Script de Empacotamento e Geração de Instaladores PegasusAI
 * Invoca o electron-builder com configurações específicas por plataforma
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG = {
    outputDir: 'dist',
    platforms: {
        win: { targets: ['nsis', 'portable'], archs: ['x64', 'ia32'] },
        mac: { targets: ['dmg', 'zip'], archs: ['x64', 'arm64'] },
        linux: { targets: ['AppImage', 'deb', 'rpm'], archs: ['x64', 'arm64'] }
    }
};

function log(message, type = 'info') {
    const prefix = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    console.log(`${prefix[type] || prefix.info} ${message}`);
}

function exec(command) {
    try {
        execSync(command, { stdio: 'inherit', cwd: process.cwd() });
        return true;
    } catch (error) {
        log(`Erro na execução: ${error.message}`, 'error');
        return false;
    }
}

function generateChecksums() {
    log('Gerando checksums SHA256...', 'info');
    
    if (!fs.existsSync(CONFIG.outputDir)) {
        log('Diretório de saída não encontrado. Pulando checksums.', 'warning');
        return;
    }

    const files = fs.readdirSync(CONFIG.outputDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.exe', '.dmg', '.AppImage', '.deb', '.rpm', '.zip'].includes(ext);
    });

    if (files.length === 0) {
        log('Nenhum instalador encontrado para gerar checksum.', 'warning');
        return;
    }

    const checksums = files.map(file => {
        const filePath = path.join(CONFIG.outputDir, file);
        const content = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        return `${hash}  ${file}`;
    });

    fs.writeFileSync(
        path.join(CONFIG.outputDir, 'checksums.txt'),
        checksums.join('\n')
    );

    log(`Checksums gerados para ${files.length} arquivos.`, 'success');
    checksums.forEach(c => log(`  ${c.split('  ')[1]}: ${c.split('  ')[0].substring(0, 16)}...`, 'info'));
}

function build(platform, target, arch) {
    const flag = platform === 'win' ? '--win' : platform === 'mac' ? '--mac' : '--linux';
    const targetFlag = `--${target}`;
    const archFlag = `--${arch}`;
    
    const command = `npx electron-builder ${flag} ${targetFlag} ${archFlag} --config electron-builder.yml`;
    
    log(`Construindo ${platform}/${target}/${arch}...`, 'info');
    return exec(command);
}

async function main() {
    log('🦅 PegasusAI - Empacotador de Instaladores', 'info');
    log('=' .repeat(50), 'info');

    const args = process.argv.slice(2);
    const specificPlatform = args.find(a => ['win', 'mac', 'linux'].includes(a));
    const specificTarget = args.find(a => ['nsis', 'portable', 'dmg', 'zip', 'AppImage', 'deb', 'rpm'].includes(a));
    const specificArch = args.find(a => ['x64', 'ia32', 'arm64'].includes(a));

    const platformsToBuild = specificPlatform ? [specificPlatform] : ['win', 'mac', 'linux'];
    
    let totalBuilt = 0;
    let totalFailed = 0;

    for (const platform of platformsToBuild) {
        const config = CONFIG.platforms[platform];
        const targets = specificTarget ? [specificTarget] : config.targets;
        
        for (const target of targets) {
            const archs = specificArch ? [specificArch] : config.archs;
            
            for (const arch of archs) {
                if (build(platform, target, arch)) {
                    totalBuilt++;
                } else {
                    totalFailed++;
                }
            }
        }
    }

    log('=' .repeat(50), 'info');
    
    if (totalFailed > 0) {
        log(`Construção concluída com ${totalFailed} falha(s).`, 'error');
        process.exit(1);
    }

    generateChecksums();
    
    log('🎉 Todos os instaladores gerados com sucesso!', 'success');
    log(`📂 Diretório de saída: ${path.resolve(CONFIG.outputDir)}`, 'success');
    log('\nPróximos passos:', 'info');
    log('  1. Testar os instaladores em máquinas limpas', 'info');
    log('  2. Assinar digitalmente os executáveis (Windows/macOS)', 'info');
    log('  3. Notarizar o build do macOS (se for distribuir fora da Mac App Store)', 'info');
    log('  4. Publicar no repositório de releases', 'info');
}

main().catch(err => {
    log(`Erro fatal: ${err.message}`, 'error');
    process.exit(1);
});
