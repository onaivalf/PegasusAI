# Instruções para Gerar o Executável Windows da PegasusAI

Este documento fornece um passo a passo completo para gerar o instalador executável (.exe) da IDE PegasusAI para Windows.

## Pré-requisitos

### 1. Ambiente de Desenvolvimento

- **Sistema Operacional**: Windows 10/11 (64-bit) ou ambiente Linux/macOS com ferramentas de cross-compilation
- **Node.js**: Versão especificada no arquivo `.nvmrc` (geralmente v20.x ou superior)
- **npm**: Versão mais recente compatível com o Node.js instalado
- **Python 3.x**: Necessário para alguns scripts de build
- **Git**: Para clonar e gerenciar o repositório

### 2. Ferramentas Específicas para Windows

- **Inno Setup**: Compilador de scripts .iss para criar instaladores Windows
  - Download: https://jrsoftware.org/isdl.php
  - Instale a versão mais recente (6.x ou superior)
  
- **Visual Studio Build Tools** (opcional, para compilação de módulos nativos):
  - Download: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
  - Instale o workload "C++ build tools"

### 3. Variáveis de Ambiente

Certifique-se de que as seguintes variáveis de ambiente estejam configuradas:

```bash
# Adicionar caminhos ao PATH (Windows)
set PATH=%PATH%;C:\Program Files (x86)\Inno Setup 6
```

## Passo a Passo para Build

### Passo 1: Clonar o Repositório (se ainda não tiver)

```bash
git clone https://github.com/pegasusai/pegasusai.git
cd pegasusai
```

### Passo 2: Instalar Dependências

```bash
# Instalar dependências do npm
npm install

# Nota: O script preinstall e postinstall serão executados automaticamente
```

### Passo 3: Configurar o Registry NPM (se necessário)

Se estiver usando um registry privado:

```bash
node build/setup-npm-registry.js <NPM_REGISTRY_URL>
```

Para uso padrão com npm público:

```bash
npm config set registry https://registry.npmjs.org/
```

### Passo 4: Compilar o Código Fonte

```bash
# Compilar o código TypeScript para JavaScript
npm run compile
```

Ou use o gulp diretamente:

```bash
npm run gulp compile
```

### Passo 5: Build das Extensões

```bash
# Compilar extensões
npm run gulp compile-extensions-build
```

### Passo 6: Build Principal para Windows

#### Opção A: Build Completo via Gulp

```bash
# Para arquitetura x64
npm run gulp vscode-win32-x64

# Para arquitetura ARM64
npm run gulp vscode-win32-arm64
```

#### Opção B: Usando Electron diretamente

```bash
# Baixar e preparar o Electron
npm run electron
```

### Passo 7: Criar o Instalador Inno Setup

Após o build principal, gere o instalador:

```bash
# Para x64 - Instalação para todos os usuários (system)
npm run gulp vscode-win32-x64-system-setup

# Para x64 - Instalação apenas para usuário atual (user)
npm run gulp vscode-win32-x64-user-setup

# Para ARM64 - Instalação para todos os usuários (system)
npm run gulp vscode-win32-arm64-system-setup

# Para ARM64 - Instalação apenas para usuário atual (user)
npm run gulp vscode-win32-arm64-user-setup
```

### Passo 8: Build com Debug (Opcional)

Para habilitar modo debug no instalador:

```bash
npm run gulp vscode-win32-x64-system-setup -- --debug-inno
```

### Passo 9: Assinar o Executável (Opcional, para produção)

Se possuir certificado de assinatura de código:

```bash
npm run gulp vscode-win32-x64-system-setup -- --sign
```

## Localização dos Arquivos Gerados

Após o build completo, os arquivos serão encontrados em:

### Build Principal
```
.build/win32-x64/VSCode-win32-x64/
  └── PegasusAI.exe (executável principal)
```

### Instalador
```
.build/win32-x64/system-setup/VSCodeSetup-x64.exe
.build/win32-x64/user-setup/VSCodeSetup-x64-user.exe
.build/win32-arm64/system-setup/VSCodeSetup-arm64.exe
.build/win32-arm64/user-setup/VSCodeSetup-arm64-user.exe
```

## Comandos Úteis

### Limpar Build Anterior

```bash
# Limpar diretórios de build
npm run gulp clean

# Ou manualmente
rm -rf .build/
rm -rf out/
```

### Watch Mode (Desenvolvimento)

```bash
# Compilar e observar mudanças
npm run watch

# Apenas cliente
npm run watch-client

# Apenas extensões
npm run watch-extensions
```

### Testes

```bash
# Testes unitários node
npm run test-node

# Testes unitários browser
npm run test-browser

# Testes de extensão
npm run test-extension

# Smoke tests
npm run smoketest
```

## Configurações Específicas da PegasusAI

### Arquivo product.json

O arquivo `product.json` contém as configurações específicas da PegasusAI:

```json
{
  "nameShort": "PegasusAI",
  "nameLong": "PegasusAI",
  "applicationName": "pegasusai",
  "dataFolderName": ".pegasusai",
  "win32DirName": "PegasusAI",
  "win32NameVersion": "PegasusAI",
  "win32RegValueName": "PegasusAI",
  "win32AppUserModelId": "PegasusAI.Editor",
  "win32ShellNameShort": "&PegasusAI",
  "win32MutexName": "pegasusai"
}
```

### Script Inno Setup

O arquivo `build/win32/code.iss` é o script do Inno Setup que define:
- Nome do aplicativo
- Ícones
- Associações de arquivo
- Registro do Windows
- Desinstalador

## Solução de Problemas

### Erro: "Inno Setup not found"

**Solução**: Certifique-se de que o Inno Setup está instalado e no PATH:

```bash
# Verificar instalação
where ISCC  # Windows
which iscc  # Linux/Mac

# Adicionar ao PATH manualmente se necessário
export PATH="$PATH:/c/Program Files (x86)/Inno Setup 6"
```

### Erro: "Module compilation failed"

**Solução**: Reinstale as dependências:

```bash
rm -rf node_modules
npm cache clean --force
npm install
```

### Erro: "Electron download failed"

**Solução**: Verifique conexão com internet ou use mirror:

```bash
export ELECTRON_MIRROR="https://github.com/electron/electron/releases/download/"
npm run electron
```

### Erro: "Python not found"

**Solução**: Instale Python 3.x e adicione ao PATH:

```bash
# Windows
python --version

# Se não encontrado, instale do https://www.python.org/downloads/
```

### Build lento ou travando

**Solução**: Aumente a memória disponível para Node.js:

```bash
# Linux/Mac
export NODE_OPTIONS="--max-old-space-size=8192"

# Windows
set NODE_OPTIONS=--max-old-space-size=8192
```

## Pipeline de CI/CD (Azure DevOps)

Para builds automatizados, consulte os arquivos de pipeline:

- `build/azure-pipelines/win32/product-build-win32.yml` - Build principal
- `build/azure-pipelines/win32/product-build-win32-test.yml` - Testes
- `build/azure-pipelines/win32/product-build-win32-cli-sign.yml` - Assinatura

## Notas Importantes

1. **Primeiro Build**: O primeiro build pode demorar significativamente devido ao download do Electron e compilação de módulos nativos.

2. **Espaço em Disco**: Reserve pelo menos 5GB de espaço livre para o build completo.

3. **Cross-Compilation**: Builds para Windows a partir de Linux/macOS requerem configuração adicional (Wine, etc.).

4. **Assinatura de Código**: Para distribuição pública, considere assinar digitalmente o executável para evitar alertas de segurança do Windows.

5. **Versões**: Mantenha sempre a versão do Node.js conforme especificado no `.nvmrc` para evitar incompatibilidades.

## Links Úteis

- [Documentação do Inno Setup](https://jrsoftware.org/ishelp/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Gulp Documentation](https://gulpjs.com/docs)
- [Repositório PegasusAI](https://github.com/pegasusai/pegasusai)

## Suporte

Para issues relacionadas ao build, abra uma issue no repositório:
https://github.com/pegasusai/pegasusai/issues

---

**Última atualização**: Junho 2024
**Versão do documento**: 1.0
