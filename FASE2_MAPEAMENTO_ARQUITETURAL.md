# FASE 2: MAPEAMENTO ARQUITETURAL DETALHADO

## Objetivo
Mapear componente por componente, arquivo por arquivo, serviço por serviço, definindo:
- Origem (qual repositório base)
- Destino (onde será integrado na PegasusAI)
- Dependências cruzadas
- Pontos de integração crítica
- Estratégia de fusão

---

## 1. MAPA DE COMPONENTES POR CAMADA

### 1.1 Camada Core (Code-OSS Base)

| Componente | Arquivos Chave | Origem | Ação | Prioridade |
|------------|----------------|--------|------|------------|
| Workbench | `src/vs/workbench/**` | Code-OSS | Base + adaptações | CRÍTICA |
| Editor Core | `src/vs/editor/**` | Code-OSS | Base + VoidApply | CRÍTICA |
| Extension Host | `src/vs/workbench/api/worker/**` | Code-OSS | Preservar 100% | CRÍTICA |
| IPC System | `src/vs/base/parts/ipc/**` | Code-OSS | Estender para LLM | ALTA |
| Configuration | `src/vs/platform/configuration/**` | Code-OSS | Unificar com VoidSettings | ALTA |
| Storage | `src/vs/platform/storage/**` | Code-OSS | Adicionar KnowledgeGraph | MÉDIA |
| Telemetry | `src/vs/platform/telemetry/**` | Code-OSS | **DESATIVAR** | CRÍTICA |

### 1.2 Camada AI/LLM (VOID + OPIDE)

| Componente | Arquivos Chave | Origem | Ação | Prioridade |
|------------|----------------|--------|------|------------|
| LLM Provider Manager | `void/core/llm/providers/**` | VOID | Adaptar + Expandir | CRÍTICA |
| EditCodeService | `void/core/editCodeService.ts` | VOID | Integrar no Editor Core | CRÍTICA |
| ChatService | `void/core/chatService.ts` | VOID | Unificar com OPIDE Chat | ALTA |
| ContextService | `void/core/contextService.ts` | VOID | Adicionar RAG local | ALTA |
| FastApply | `void/core/fastApply.ts` | VOID | Otimizar para TS | ALTA |
| SlowApply | `void/core/slowApply.ts` | VOID | Manter para refatorações | MÉDIA |
| OPIDE Chat UI | `opide/src/chat/**` | OPIDE | Fundir com Void Chat | ALTA |
| OPIDE Agents | `opide/src/agents/**` | OPIDE | Implementar como extensão | MÉDIA |

### 1.3 Camada Electron (VOID + Code-OSS)

| Componente | Arquivos Chave | Origem | Ação | Prioridade |
|------------|----------------|--------|------|------------|
| Main Process | `electron-main/main.ts` | VOID | Mesclar com Code-OSS main | CRÍTICA |
| Preload | `electron/preload.ts` | Code-OSS + VOID | Unificar IPCs | CRÍTICA |
| IPC Handlers (LLM) | `void/electron-main/llmIpc.ts` | VOID | Criar handlers dedicados | CRÍTICA |
| Window Management | `src/vs/platform/windows/**` | Code-OSS | Preservar | ALTA |
| Protocol Registration | `electron-main/protocol.ts` | VOID | Adaptar para pegasus:// | ALTA |

### 1.4 Camada UI/UX (Rebranding + VOID + OPIDE)

| Componente | Arquivos Chave | Origem | Ação | Prioridade |
|------------|----------------|--------|------|------------|
| Activity Bar Icons | `src/vs/workbench/browser/media/**/*.svg` | Code-OSS | Substituir por Pegasus | CRÍTICA |
| Chat View Container | `void/webview/chat/**` | VOID | Integrar como Viewlet | ALTA |
| Inline Chat Widget | `src/vs/workbench/contrib/chat/**` | Code-OSS + VOID | Fundir implementações | ALTA |
| Status Bar Items | `src/vs/workbench/statusBar/**` | Code-OSS | Adicionar status LLM | MÉDIA |
| Theme System | `src/vs/platform/theme/**` | Code-OSS | Adicionar temas Pegasus | MÉDIA |
| Welcome Page | `src/vs/workbench/contrib/welcome/**` | Code-OSS | Rebrand + QuickStart IA | MÉDIA |

### 1.5 Camada Offline/Local (VOID + Continue.dev)

| Componente | Arquivos Chave | Origem | Ação | Prioridade |
|------------|----------------|--------|------|------------|
| Ollama Integration | `void/core/llm/providers/ollama.ts` | VOID | Otimizar + Auto-start | CRÍTICA |
| LM Studio Integration | `void/core/llm/providers/lmstudio.ts` | VOID | Manter | ALTA |
| vLLM Integration | `void/core/llm/providers/vllm.ts` | VOID | Manter | ALTA |
| Local Embeddings | `continue/core/embeddings/**` | Continue.dev | Implementar | ALTA |
| Vector Store (SQLite) | `continue/core/index/**` | Continue.dev | Implementar com SQL.js | ALTA |
| Model Downloader | `void/scripts/download-models.ts` | VOID | Criar UI dedicada | MÉDIA |

### 1.6 Camada Memória & Conhecimento (Nova - PegasusAI)

| Componente | Arquivos Chave | Origem | Ação | Prioridade |
|------------|----------------|--------|------|------------|
| Timeline Service | `pegasus/core/timelineService.ts` | NOVO | Implementar do zero | ALTA |
| Knowledge Graph | `pegasus/core/knowledgeGraph.ts` | NOVO | Implementar com Neo4j embedded | ALTA |
| Session Memory | `pegasus/core/sessionMemory.ts` | NOVO | Implementar | MÉDIA |
| Project Context Indexer | `pegasus/core/projectIndexer.ts` | NOVO + Continue.dev | Adaptar | ALTA |
| Semantic Search | `pegasus/core/semanticSearch.ts` | NOVO + Continue.dev | Implementar | ALTA |

### 1.7 Camada Orchestrator (Nova - PegasusAI)

| Componente | Arquivos Chave | Origem | Ação | Prioridade |
|------------|----------------|--------|------|------------|
| Multi-Model Router | `pegasus/core/orchestrator/router.ts` | NOVO | Implementar | CRÍTICA |
| Fallback Handler | `pegasus/core/orchestrator/fallback.ts` | NOVO | Implementar | CRÍTICA |
| Cost Optimizer | `pegasus/core/orchestrator/costOptimizer.ts` | NOVO | Implementar | MÉDIA |
| Latency Monitor | `pegasus/core/orchestrator/latencyMonitor.ts` | NOVO | Implementar | ALTA |
| Model Registry | `pegasus/core/orchestrator/modelRegistry.ts` | NOVO | Implementar | ALTA |

---

## 2. MATRIZ DE DEPENDÊNCIAS CRUZADAS

### 2.1 Dependências do Editor Core

```
Editor Core
├── Workbench (Code-OSS)
├── Extension Host (Code-OSS)
├── EditCodeService (VOID) ← INJEÇÃO CRÍTICA
├── LLM Provider Manager (VOID)
└── IPC System (Code-OSS + extensões VOID)
```

### 2.2 Dependências do LLM Provider Manager

```
LLM Provider Manager
├── IPC System (para comunicar com renderer)
├── Configuration (Code-OSS unificado com VoidSettings)
├── Storage (para cache de respostas)
├── Network (Code-OSS, mas isolado para offline)
└── SecretStorage (para API keys)
```

### 2.3 Dependências do Knowledge Graph

```
Knowledge Graph
├── Storage (SQLite via SQL.js)
├── Project Indexer (usa FileService do Code-OSS)
├── Embeddings (Continue.dev ou VOID)
├── Timeline Service (nova dependência interna)
└── Semantic Search (depende de Embeddings)
```

### 2.4 Dependências do Orchestrator

```
Orchestrator
├── LLM Provider Manager (todas as instâncias)
├── Latency Monitor (coleta métricas em tempo real)
├── Cost Optimizer (configurações + histórico)
├── Fallback Handler (lógica de retry)
└── Model Registry (metadados de modelos)
```

---

## 3. PONTOS DE INTEGRAÇÃO CRÍTICA

### 3.1 Integração 1: EditCodeService no Editor

**Local:** `src/vs/editor/common/services/editCodeServiceImpl.ts`

**Origem:** `void/core/editCodeService.ts`

**Desafios:**
- Adapter entre tipos do VOID e tipos do Code-OSS
- Integração com Undo/Redo stack do editor
- Suporte a diff view nativo do VS Code

**Estratégia:**
1. Criar wrapper `PegasusEditCodeService` que implementa interface do Code-OSS
2. Delegar chamadas de apply para o serviço do VOID
3. Hook no `CodeEditorWidget` para atualizações em tempo real

### 3.2 Integração 2: IPC de LLM no Main Process

**Local:** `src/main.ts` (Electron Main)

**Origem:** `void/electron-main/llmIpc.ts`

**Desafios:**
- Code-OSS já tem seu próprio sistema IPC
- VOID usa IPC customizado para LLM
- Necessário isolar tráfego LLM do tráfego normal

**Estratégia:**
1. Criar canal dedicado `pegasus:llm:*`
2. Registrar handlers no main process mesclando lógica do VOID
3. Usar `WebContents` do Electron para comunicação segura

### 3.3 Integração 3: Chat View no Workbench

**Local:** `src/vs/workbench/contrib/chat/browser/chatViewPane.ts`

**Origem:** Fusão de `void/webview/chat/ChatPanel.tsx` + `opide/src/chat/ChatUI.tsx`

**Desafios:**
- VOID usa React, Code-OSS usa TypeScript puro com templates
- Diferente modelo de renderização (WebView vs DOM nativo)
- Estado compartilhado entre chat e editor

**Estratégia:**
1. Opção A: Portar UI do VOID para componentes nativos do Code-OSS (recomendado)
2. Opção B: Usar WebView do Electron com bridge de estado
3. Criar `PegasusChatContribution` registrando view container

### 3.4 Integração 4: Configurações Unificadas

**Local:** `src/vs/platform/configuration/common/configurationRegistry.ts`

**Origem:** Fusão de Code-OSS config + `void/core/voidSettingsService.ts`

**Desafios:**
- VOID tem schema próprio de configurações
- Code-OSS tem registry global de configurações
- Necessário preservar compatibilidade com settings.json

**Estratégia:**
1. Extender `ConfigurationRegistry` com schema do VOID
2. Mapear `void.settings.*` para `pegasus.ai.*`
3. Criar migration script para usuários migrating do VOID

### 3.5 Integração 5: Sistema de Extensões com IA

**Local:** `src/vs/workbench/api/common/extHost.api.impl.ts`

**Origem:** Code-OSS + adaptações para APIs de IA

**Desafios:**
- Extensions atuais não esperam APIs de LLM nativas
- Necessário expor APIs de IA sem quebrar extensions existentes
- Sandboxing de chamadas LLM de extensions de terceiros

**Estratégia:**
1. Criar namespace `vscode.ai.*` paralelo ao `vscode.*` existente
2. Implementar `PegasusAIExtensionHost` com permissões granulares
3. Rate limiting e quota management por extension

---

## 4. FLUXO DE DADOS PRINCIPAL

### 4.1 Fluxo: Usuário solicita edição via Chat

```
[Usuário digita no Chat]
        ↓
[ChatViewPane (Renderer)]
        ↓
[IPC: pegasus:chat:message]
        ↓
[ChatService (Main)]
        ↓
[Orchestrator → seleciona modelo]
        ↓
[LLM Provider Manager → chama API/local]
        ↓
[Resposta LLM (stream)]
        ↓
[EditCodeService → parse da resposta]
        ↓
[FastApply/SlowApply → gera diffs]
        ↓
[IPC: pegasus:editor:apply]
        ↓
[Editor Core → aplica mudanças]
        ↓
[Diff View → usuário revisa]
        ↓
[Confirm/Reject → commit no undo stack]
```

### 4.2 Fluxo: Indexação de Projeto para RAG

```
[Startup ou mudança em arquivos]
        ↓
[Project Indexer (watcher do FileService)]
        ↓
[Chunking Strategy (por tipo de arquivo)]
        ↓
[Embedding Model (local via Ollama)]
        ↓
[Vector Store (SQLite + pgvector-like)]
        ↓
[Knowledge Graph → atualiza relações]
        ↓
[Timeline Service → registra evento]
        ↓
[Pronto para semantic search]
```

### 4.3 Fluxo: Fallback de Modelo

```
[Orchestrator tenta Modelo Primário]
        ↓
[Timeout ou Erro detectado]
        ↓
[Latency Monitor reporta falha]
        ↓
[Fallback Handler → consulta Model Registry]
        ↓
[Seleciona próximo modelo disponível]
        ↓
[Retry com novo modelo]
        ↓
[Se falhar novamente → Cache ou Erro amigável]
        ↓
[Usuário notificado no Status Bar]
```

---

## 5. ESTRATÉGIA DE FUSÃO DE CÓDIGO

### 5.1 Princípios Gerais

1. **Code-OSS é a base**: Todo código novo deve ser adaptado para o padrão Code-OSS
2. **VOID é a fonte de IA**: Componentes de IA do VOID são优先 adaptados
3. **OPIDE é inspiração UX**: Ideias de UI/UX do OPIDE são portadas, não copiadas
4. **Continue.dev é referência offline**: Estratégias de indexação e embeddings
5. **Zero Telemetry**: Remover todo código de telemetria do Code-OSS

### 5.2 Estratégia por Tipo de Arquivo

#### TypeScript (.ts)
- Manter strict mode do Code-OSS
- Adaptar imports do VOID para estrutura Code-OSS
- Usar namespaces `Pegasus*` para novas classes

#### React/TSX (VOID)
- **Opção Preferida**: Reescrever como componentes nativos do Code-OSS
- **Opção Alternativa**: Isolar em WebView com bridge IPC

#### CSS/SCSS
- Manter sistema de temas do Code-OSS
- Adicionar variáveis `--pegasus-*` para customização
- Importar Tailwind do VOID apenas se necessário (não recomendado)

#### JSON (configs, schemas)
- Unificar schemas no `configurationRegistry`
- Criar `pegasus.configuration.schema.json`

#### Build Scripts (Gulp)
- Estender `gulpfile.js` do Code-OSS
- Adicionar tasks: `compile-void`, `compile-opide`, `compile-pegasus`

---

## 6. RISCOS TÉCNICOS IDENTIFICADOS

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Quebra de compatibilidade com extensions | CRÍTICO | MÉDIA | Test suite extensiva com extensions populares |
| Conflito de tipos TypeScript entre VOID e Code-OSS | ALTO | ALTA | Criar camada de adapters de tipos |
| Performance degradation com IA local | ALTO | MÉDIA | Lazy loading, Web Workers, caching agressivo |
| Vazamento de API keys no main process | CRÍTICO | BAIXA | Usar SecretStorage, nunca plaintext |
| Build system incompatível (Gulp vs outros) | MÉDIO | ALTA | Manter Gulp, adaptar scripts do VOID |
| Tamanho do binary final (>500MB) | MÉDIO | ALTA | Tree-shaking, optional features, compressão |
| Conflito de licenças (MIT vs Apache vs outros) | ALTO | MÉDIA | Auditoria legal, manter MIT compatível |

---

## 7. CHECKLIST DE PRÉ-INTEGRAÇÃO

### 7.1 Code-OSS
- [ ] Clonar branch estável mais recente
- [ ] Rodar build local com sucesso
- [ ] Identificar todos os pontos de telemetria
- [ ] Mapear hooks de extensão para IA

### 7.2 VOID
- [ ] Extrair serviços de LLM isoladamente
- [ ] Testar editCodeService standalone
- [ ] Documentar todos os providers suportados
- [ ] Identificar dependências externas (npm packages)

### 7.3 OPIDE
- [ ] Analisar arquitetura de agents
- [ ] Extrair padrões de UI/UX aplicáveis
- [ ] Documentar fluxos de conversação

### 7.4 Continue.dev
- [ ] Analisar sistema de embeddings
- [ ] Documentar estratégia de indexação
- [ ] Identificar bibliotecas de vector store

### 7.5 Infraestrutura
- [ ] Setup de CI/CD para builds multi-plataforma
- [ ] Configurar signing de binaries (Windows, macOS)
- [ ] Preparar repositório de releases

---

## 8. PRÓXIMOS PASSOS (FASE 3)

Com este mapeamento completo, a Fase 3 (Definição da Arquitetura Consolidada) deverá:

1. Criar diagramas arquiteturais formais (C4 model)
2. Definir estrutura de diretórios final da PegasusAI
3. Especificar interfaces públicas de cada módulo
4. Criar plano de migração de código passo-a-passo
5. Definir critérios de aceite para cada componente

---

**Status da Fase 2:** ✅ CONCLUÍDA

**Arquivo gerado:** `/workspace/FASE2_MAPEAMENTO_ARQUITETURAL.md`

**Próxima fase:** Fase 3 - Definição da Arquitetura Consolidada e Design do Sistema
