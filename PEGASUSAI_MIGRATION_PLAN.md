# 🚀 PegasusAI - Plano de Migração Completo
## Transformando Void em PegasusAI com 100% LLM Local + Google Agent Skills

---

## 📋 VISÃO GERAL

**Objetivo:** Criar um fork 100% funcional chamado **PegasusAI**, removendo completamente a marca "Void", com suporte nativo a LLMs locais e integração com o sistema de skills do Google AntiGravity.

**Status Atual:** 
- ✅ Código base: PegasusAI (fork do VS Code)
- ❌ Nome "Void" presente em ~26,511 ocorrências
- ❌ Sem configuração padrão para LLM local
- ❌ Sem integração com Google Agent Skills

---

## 🎯 FASE 1: Renomeação Void → PegasusAI

### 1.1 Arquivos de Configuração Principal

#### `product.json` - Substituições Críticas
```json
// DE:
"applicationName": "void"
"dataFolderName": ".pegasusai"
"win32MutexName": "pegasusai"
"serverApplicationName": "void-server"
"serverDataFolderName": ".void-server"
"tunnelApplicationName": "void-tunnel"
"darwinBundleIdentifier": "com.pegasusai.code"
"linuxIconName": "pegasusai"
"urlProtocol": "void"

// PARA:
"applicationName": "pegasusai"
"dataFolderName": ".pegasusai"
"win32MutexName": "pegasusaieditor"
"serverApplicationName": "pegasusai-server"
"serverDataFolderName": ".pegasusai-server"
"tunnelApplicationName": "pegasusai-tunnel"
"darwinBundleIdentifier": "com.pegasusai.code"
"linuxIconName": "pegasusai-editor"
"urlProtocol": "pegasusai"
```

#### URLs e Links
```json
// DE:
"https://pegasusai.com"
"https://pegasusai.dev"
"https://github.com/pegasusai/void"
"reportIssueUrl": "https://github.com/pegasusai/void/issues/new"
"licenseUrl": "https://github.com/pegasusai/void/blob/main/LICENSE.txt"

// PARA:
"https://pegasusai.dev"
"https://github.com/pegasusai/pegasusai"
"reportIssueUrl": "https://github.com/pegasusai/pegasusai/issues/new"
"licenseUrl": "https://github.com/pegasusai/pegasusai/blob/main/LICENSE.txt"
```

### 1.2 Estrutura de Diretórios

**Renomear diretórios:**
```bash
# Pasta de ícones
mv /workspace/void_icons /workspace/pegasusai_icons

# Pasta principal do módulo void
mv /workspace/src/vs/workbench/contrib/void /workspace/src/vs/workbench/contrib/pegasusai

# Pastas React internas
mv /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/void-onboarding /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/pegasusai-onboarding
mv /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/void-settings-tsx /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/pegasusai-settings-tsx
mv /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/pegasusai-widgets-tsx /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/pegasusai-editor-widgets-tsx
mv /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/void-tooltip /workspace/src/vs/workbench/contrib/pegasusai/browser/react/src/pegasusai-tooltip
```

### 1.3 Scripts e Comandos

**`package.json` - Build scripts:**
```json
// DE:
"buildreact": "cd ./src/vs/workbench/contrib/void/browser/react/ && node build.js && cd ../../../../../../../"
"watchreact": "cd ./src/vs/workbench/contrib/void/browser/react/ && node build.js --watch && cd ../../../../../../../"

// PARA:
"buildreact": "cd ./src/vs/workbench/contrib/pegasusai/browser/react/ && node build.js && cd ../../../../../../../"
"watchreact": "cd ./src/vs/workbench/contrib/pegasusai/browser/react/ && node build.js --watch && cd ../../../../../../../"
```

### 1.4 CLI (Command Line Interface)

**Arquivos Rust em `/workspace/cli/`:**
- `Cargo.toml`: package name, binary names
- `src/`: todas as referências a "void" em strings, logs, help text

### 1.5 Documentação

**Arquivos para atualizar:**
- `README.md` - Título, descrição, todos os links
- `HOW_TO_CONTRIBUTE.md` - Menções ao projeto
- `VOID_CODEBASE_GUIDE.md` → Renomear para `PEGASUSAI_CODEBASE_GUIDE.md`
- `.github/` - Templates de issue, workflows, actions
- `.vscode/` - Configurações, launch configs

### 1.6 Recursos Visuais

**Ícones e Assets:**
- `resources/` - Ícones do aplicativo, logos
- `void_icons/` → `pegasusai_icons/`
- Nomes de arquivos de ícone no Linux/macOS

### 1.7 Código TypeScript/JavaScript

**Substituições em código:**
- Strings em UI: "Void" → "PegasusAI"
- Nomes de classes: `VoidService` → `PegasusAIService`
- Variáveis: `voidConfig` → `pegasusaiConfig`
- Comentários e logs

---

## 🔧 FASE 2: Configuração 100% LLM Local

### 2.1 Provedores Locais Suportados

**Configuração padrão no `product.json`:**
```json
"pegasusaiDefaults": {
  "defaultProvider": "ollama",
  "defaultEndpoint": "http://127.0.0.1:11434",
  "defaultChatMode": "agent",
  "localModelsEnabled": true
}
```

### 2.2 Modelos Recomendados (via Ollama)

**Script de instalação automática:**
```bash
#!/bin/bash
# install-local-models.sh

echo "🦙 Instalando Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

echo "📥 Baixando modelos especializados em código..."

# Modelo principal (Google open weights)
ollama pull gemma2:27b

# Modelos alternativos para código
ollama pull qwen2.5-coder:32b
ollama pull deepseek-coder:33b
ollama pull codellama:34b

# Modelo leve para tarefas rápidas
ollama pull phi3:mini

echo "✅ Modelos instalados!"
ollama list
```

### 2.3 Configuração do Provider Ollama

**Arquivo: `/workspace/src/vs/workbench/contrib/pegasusai/common/providers/ollama-provider.ts`**
```typescript
export const OllamaProviderConfig = {
  id: 'ollama',
  name: 'Ollama (Local)',
  endpoint: 'http://127.0.0.1:11434',
  requiresApiKey: false,
  supportsStreaming: true,
  defaultModel: 'gemma2:27b',
  availableModels: [
    'gemma2:27b',
    'qwen2.5-coder:32b',
    'deepseek-coder:33b',
    'codellama:34b',
    'phi3:mini'
  ]
};
```

### 2.4 vLLM Support (Opcional para GPU NVIDIA)

**Configuração adicional:**
```typescript
export const VLLMProviderConfig = {
  id: 'vllm',
  name: 'vLLM (Local GPU)',
  endpoint: 'http://localhost:8000/v1',
  requiresApiKey: false,
  openAICompatible: true
};
```

---

## 🤖 FASE 3: Integração Google Agent Skills (AntiGravity)

### 3.1 Estrutura de Skills

**Inspirado em: https://github.com/Dokhacgiakhoa/Agent-skills-setup-for-AntiGravity**

**Criar diretório:**
```
/workspace/.pegasusai/
├── skills/
│   ├── core/
│   │   ├── file-management.skill
│   │   ├── code-analysis.skill
│   │   ├── testing.skill
│   │   └── refactoring.skill
│   ├── languages/
│   │   ├── python.skill
│   │   ├── typescript.skill
│   │   └── rust.skill
│   └── workflows/
│       ├── debug-loop.skill
│       ├── tdd-cycle.skill
│       └── code-review.skill
├── memory/
│   ├── engrams/
│   └── context/
└── config.yaml
```

### 3.2 Sistema de Memória (Inspirado OPIDE)

**Implementar 3-tier memory:**
```typescript
interface PegasusAIMemory {
  // Tier 1: Working Memory (RAM)
  workingMemory: {
    currentFile: string;
    recentChanges: Change[];
    activeContext: Context[];
  };
  
  // Tier 2: Engram Memory (SSD-like)
  engrams: {
    projectStructure: ASTIndex;
    codePatterns: Pattern[];
    userPreferences: Preferences;
  };
  
  // Tier 3: Long-term Memory (HDD-like)
  longTerm: {
    historicalDecisions: Decision[];
    learnedPatterns: Pattern[];
    projectKnowledge: KnowledgeBase;
  };
}
```

### 3.3 AST Indexing (tree-sitter)

**Instalar tree-sitter:**
```bash
npm install tree-sitter tree-sitter-typescript tree-sitter-python tree-sitter-rust
```

**Implementar indexer:**
```typescript
// /workspace/src/vs/workbench/contrib/pegasusai/common/ast-indexer.ts
import Parser from 'tree-sitter';

export class PegasusAIASTIndexer {
  private parser: Parser;
  
  async indexFile(filePath: string): Promise<ASTNode[]> {
    const code = await fs.readFile(filePath, 'utf-8');
    const tree = this.parser.parse(code);
    return this.extractNodes(tree.rootNode);
  }
  
  async searchSymbol(symbol: string): Promise<Location[]> {
    // Busca em todo o índice AST
  }
}
```

---

## 📅 CRONOGRAMA DE IMPLEMENTAÇÃO

### Semana 1: Renomeação Void → PegasusAI
- [ ] Dia 1-2: `product.json`, `package.json`, configs principais
- [ ] Dia 3: Renomear diretórios (`void` → `pegasusai`)
- [ ] Dia 4: CLI Rust (`/workspace/cli/`)
- [ ] Dia 5: Documentação (`README.md`, guides)
- [ ] Dia 6-7: Ícones e recursos visuais

### Semana 2: Limpeza de Código
- [ ] Dia 1-3: Substituir strings em TypeScript/JavaScript
- [ ] Dia 4-5: Renomear classes, variáveis, funções
- [ ] Dia 6-7: Testar build após renomeação

### Semana 3: Configuração LLM Local
- [ ] Dia 1: Setup Ollama provider como default
- [ ] Dia 2: Script de instalação de modelos
- [ ] Dia 3: Configurar vLLM support
- [ ] Dia 4-5: UI para seleção de modelos locais
- [ ] Dia 6-7: Testar com diferentes modelos

### Semana 4: Google Agent Skills
- [ ] Dia 1-2: Estrutura `.pegasusai/skills/`
- [ ] Dia 3-4: Implementar parser de skills
- [ ] Dia 5-7: Migrar 573 skills do AntiGravity

### Semana 5: Sistema de Memória
- [ ] Dia 1-2: Working memory implementation
- [ ] Dia 3-4: Engram memory (inspirado OPIDE)
- [ ] Dia 5-7: Long-term memory + persistência

### Semana 6: AST Indexing + Polimento
- [ ] Dia 1-3: tree-sitter integration
- [ ] Dia 4-5: Search e navigation features
- [ ] Dia 6-7: Testes finais e documentação

---

## 🛠️ SCRIPTS DE AUTOMAÇÃO

### Script 1: Renomeação Automática (Parcial)

```bash
#!/bin/bash
# rename-void-to-pegasusai.sh

echo "🔄 Iniciando renomeação Void → PegasusAI..."

# 1. Renomear diretórios
find /workspace -type d -name "*void*" -not -path "*/\.git/*" | while read dir; do
  new_name=$(echo "$dir" | sed 's/void/pegasusai/g')
  echo "Renomeando diretório: $dir → $new_name"
  mv "$dir" "$new_name"
done

# 2. Substituir em arquivos de configuração
for file in product.json package.json; do
  if [ -f "/workspace/$file" ]; then
    echo "Atualizando $file..."
    sed -i 's/void/pegasusai/gi' "/workspace/$file"
    sed -i 's/Void/PegasusAI/g' "/workspace/$file"
    sed -i 's/VOID/PEGASUSAI/g' "/workspace/$file"
  fi
done

# 3. Atualizar README
sed -i 's/Void/PegasusAI/g' /workspace/README.md
sed -i 's/pegasusai/pegasusai/g' /workspace/README.md

echo "✅ Renomeação concluída!"
echo "⚠️  Atenção: Revise manualmente o código TypeScript/JavaScript"
```

### Script 2: Setup LLM Local

```bash
#!/bin/bash
# setup-local-llm.sh

echo "🦙 Configurando LLM Local para PegasusAI..."

# Verificar se Ollama está instalado
if ! command -v ollama &> /dev/null; then
  echo "Instalando Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

# Iniciar Ollama
ollama serve &

# Aguardar inicialização
sleep 5

# Baixar modelos
echo "📥 Baixando modelos..."
ollama pull gemma2:27b
ollama pull qwen2.5-coder:32b

echo "✅ Setup concluído!"
echo "Modelos disponíveis:"
ollama list
```

---

## ⚠️ DESAFIOS E SOLUÇÕES

### Desafio 1: Referências Cruzadas
**Problema:** 26,511 ocorrências de "void" podem incluir falsos positivos (ex: tipo `void` em TypeScript)

**Solução:**
- Usar regex inteligente: `\b[Vv]oid\b` (word boundaries)
- Excluir palavras-chave da linguagem: `void` (tipo), `avoid`, `revoid`
- Revisão manual de cada categoria de arquivo

### Desafio 2: Builds Quebrados
**Problema:** Mudanças podem quebrar o build

**Solução:**
- Commitar após cada mudança significativa
- Testar build incrementalmente
- Manter backup do estado original

### Desafio 3: Dependências Externas
**Problema:** Links externos apontam para repositório Void

**Solução:**
- Criar organização GitHub `@pegasusai`
- Fazer fork oficial antes de começar
- Usar URLs relativas quando possível

---

## 📊 MATRIZ DE RASTREAMENTO

| Categoria | Arquivos | Ocorrências | Status | Prioridade |
|-----------|----------|-------------|--------|------------|
| Config JSON | ~10 | ~200 | ❌ Pendente | 🔴 Alta |
| TypeScript | ~500 | ~5,000 | ❌ Pendente | 🔴 Alta |
| JavaScript | ~50 | ~500 | ❌ Pendente | 🟡 Média |
| Markdown | ~20 | ~300 | ❌ Pendente | 🟡 Média |
| Rust (CLI) | ~30 | ~400 | ❌ Pendente | 🔴 Alta |
| Ícones/Assets | ~50 | ~100 | ❌ Pendente | 🟢 Baixa |
| GitHub Actions | ~10 | ~200 | ❌ Pendente | 🟡 Média |
| **TOTAL** | **~670** | **~26,511** | ❌ | - |

---

## 🚀 PRÓXIMOS PASSOS IMEDIATOS

1. **[ ] Aprovar este plano** - Confirmar escopo e cronograma
2. **[ ] Criar organização GitHub** - `@pegasusai` ou usuário dedicado
3. **[ ] Fazer fork do repositório** - Base limpa para trabalhar
4. **[ ] Executar script de renomeação** - Fase 1 automatizada
5. **[ ] Revisão manual** - Categoria por categoria
6. **[ ] Testar build** - Garantir que compila
7. **[ ] Configurar LLM local** - Fase 2
8. **[ ] Integrar skills** - Fase 3

---

## 📞 SUPORTE E RECURSOS

### Documentação de Referência
- [Void Codebase Guide](./VOID_CODEBASE_GUIDE.md) → Será `PEGASUSAI_CODEBASE_GUIDE.md`
- [OPIDE Architecture](https://github.com/OpenPawz/OPIDE)
- [AntiGravity Skills](https://github.com/Dokhacgiakhoa/Agent-skills-setup-for-AntiGravity)

### Ferramentas Úteis
- `grep -ri "void" --include="*.ts"` - Buscar ocorrências
- `sed -i 's/void/pegasusai/gi' file.ts` - Substituição em massa
- `git diff` - Revisar mudanças antes de commitar

---

**Status do Plano:** 📋 Aguardando aprovação para início da execução

**Próxima Ação:** Executar Fase 1 (Renomeação) ou ajustar plano conforme feedback?
