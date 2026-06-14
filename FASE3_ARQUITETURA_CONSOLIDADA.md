# FASE 3 — ARQUITETURA CONSOLIDADA E DESIGN DO SISTEMA

## 1. OBJETIVO

Definir a arquitetura consolidada da PegasusAI, fundindo os melhores componentes dos repositórios analisados (Code-OSS, VOID, OPIDE, Google Antigravity, Open-Antigravity) em um design coerente, escalável e mantível. Esta fase estabelece as bases para a implementação nas fases subsequentes.

---

## 2. VISÃO GERAL DA ARQUITETURA CONSOLIDADA

### 2.1 Princípios de Design

1. **Extensibilidade sobre Modificação**: Nunca modificar código core do Code-OSS; sempre estender via Registry, Contributions e Dependency Injection.
2. **Offline-First**: Todas as funcionalidades devem operar sem dependência de serviços externos.
3. **Compatibilidade Preservada**: Manter 100% de compatibilidade com extensões VS Code (VSIX, LSP, Debug Adapters).
4. **Isolamento de Responsabilidades**: Código PegasusAI isolado em `src/vs/workbench/contrib/pegasusai/`.
5. **Multi-Modelo Agnóstico**: Suporte nativo a múltiplos provedores de IA (locais e cloud) via adapters.

### 2.2 Camadas Arquiteturais

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                    │
│  (React Webviews, View Containers, Side Panel, Editor)      │
├─────────────────────────────────────────────────────────────┤
│                   CAMADA DE ORQUESTRAÇÃO                     │
│  (Pegasus Orchestrator, Skills Engine, Task Manager)        │
├─────────────────────────────────────────────────────────────┤
│                  CAMADA DE INTELIGÊNCIA                      │
│  (LLM Adapters, Context Management, RAG, Memory Graph)      │
├─────────────────────────────────────────────────────────────┤
│                   CAMADA DE INTEGRAÇÃO                       │
│  (IPC Bridge, Extension Host, LSP Client, Debug Adapter)    │
├─────────────────────────────────────────────────────────────┤
│                      CORE CODE-OSS                           │
│  (Editor, File System, Workspace, Extensions, Terminal)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. COMPONENTES CONSOLIDADOS

### 3.1 Core Editor (Origem: Code-OSS)

| Componente | Ação | Justificativa |
|------------|------|---------------|
| Monaco Editor | Manter nativo | Melhor editor web disponível, maduro e performático |
| Extension Host | Manter nativo | Ecossistema de extensões é diferencial competitivo |
| File System Provider | Manter nativo | Suporte multi-plataforma já resolvido |
| Workspace Service | Manter nativo | Gestão de workspaces complexos já implementada |
| Terminal Integration | Manter nativo | Integração com shells já otimizada |
| Debug Protocol | Manter nativo | Padrão DAP amplamente adotado |
| Language Server Protocol | Manter nativo | Padrão da indústria para linguagens |

**Adaptações**: Nenhuma modificação direta. Extensão via contributions.

### 3.2 AI/LLM Layer (Origem: VOID + Open-Antigravity)

| Componente | Origem | Adaptações | Destino PegasusAI |
|------------|--------|------------|-------------------|
| LLM Provider Interface | VOID | Generalizar para multi-modelo | `src/vs/workbench/contrib/pegasusai/common/llmProvider.ts` |
| Ollama Adapter | VOID | Adicionar fallback automático | `src/vs/workbench/contrib/pegasusai/node/adapters/ollamaAdapter.ts` |
| LM Studio Adapter | VOID | Adicionar suporte a modelos customizados | `src/vs/workbench/contrib/pegasusai/node/adapters/lmStudioAdapter.ts` |
| OpenAI Compatible Adapter | VOID | Suporte a endpoints customizados | `src/vs/workbench/contrib/pegasusai/node/adapters/openAICompatibleAdapter.ts` |
| Skills Engine | Open-Antigravity | Adaptar para TypeScript native | `src/vs/workbench/contrib/pegasusai/common/skillsEngine.ts` |
| Skills Registry | Open-Antigravity | Integração com marketplace VSIX | `src/vs/workbench/contrib/pegasusai/common/skillsRegistry.ts` |
| Prompt Templates | VOID | Sistema de templates versionáveis | `src/vs/workbench/contrib/pegasusai/common/promptTemplates.ts` |
| Fast/Slow Apply | VOID | Refinar heurísticas de diff | `src/vs/workbench/contrib/pegasusai/browser/editApplyService.ts` |

**Dependências Removidas**:
- `@void/editor` → Substituído por imports diretos do Code-OSS
- Dependências React específicas do VOID → Isoladas em webviews

**Dependências Adicionadas**:
- `langchain` (opcional, lazy-loaded) para RAG avançado
- `node-fetch` para chamadas HTTP em ambiente Node
- `tiktoken` para contagem precisa de tokens

**Impacto no Build**: Mínimo. Novos arquivos TypeScript compilados junto com o build existente.

### 3.3 Knowledge Graph & Memory (Origem: Google Antigravity + Open-Antigravity)

| Componente | Origem | Adaptações | Destino PegasusAI |
|------------|--------|------------|-------------------|
| Dependency Graph | Google Antigravity | Adaptar para grafo persistente | `src/vs/workbench/contrib/pegasusai/node/graph/dependencyGraph.ts` |
| Workspace Intelligence | Google Antigravity | Adicionar indexação incremental | `src/vs/workbench/contrib/pegasusai/node/graph/workspaceIndexer.ts` |
| Entity Extraction | Google Antigravity | Suporte a múltiplas linguagens | `src/vs/workbench/contrib/pegasusai/node/graph/entityExtractor.ts` |
| Timeline Service | Open-Antigravity | Integração com git history | `src/vs/workbench/contrib/pegasusai/common/timelineService.ts` |
| Memory Store | Open-Antigravity | Persistência em SQLite local | `src/vs/workbench/contrib/pegasusai/node/memory/memoryStore.ts` |
| Conversation Linker | VOID + Open-Antigravity | Fusão de conversas com entidades | `src/vs/workbench/contrib/pegasusai/common/conversationLinker.ts` |

**Entidades do Grafo**:
- `File`, `Class`, `Function`, `Component`, `Module`
- `Conversation`, `Task`, `Commit`, `ADR` (Architecture Decision Record)

**Relacionamentos**:
- `criou`, `alterou`, `corrige`, `depende_de`, `utiliza`, `referencia`

**Persistência**: SQLite embutido em `%APPDATA%/PegasusAI/graph.db`

### 3.4 Pegasus Orchestrator (Origem: Nova Implementação)

| Componente | Descrição | Local |
|------------|-----------|-------|
| Task Planner | Decomposição de tarefas complexas | `src/vs/workbench/contrib/pegasusai/common/orchestrator/taskPlanner.ts` |
| Tool Coordinator | Coordenação de skills e ferramentas | `src/vs/workbench/contrib/pegasusai/common/orchestrator/toolCoordinator.ts` |
| Response Consolidator | Consolidação de respostas multi-modelo | `src/vs/workbench/contrib/pegasusai/common/orchestrator/responseConsolidator.ts` |
| Execution Monitor | Monitoramento de execução de longo prazo | `src/vs/workbench/contrib/pegasusai/common/orchestrator/executionMonitor.ts` |
| Context Manager | Gestão de contexto entre sessões | `src/vs/workbench/contrib/pegasusai/common/orchestrator/contextManager.ts` |

### 3.5 UI/UX Layer (Origem: VOID + Code-OSS)

| Componente | Origem | Adaptações | Destino PegasusAI |
|------------|--------|------------|-------------------|
| Side Panel Framework | VOID | Integrar com ViewContainer API | `src/vs/workbench/contrib/pegasusai/browser/sidePanel/pegasusSidePanel.ts` |
| Chat Webview | VOID | Adicionar suporte a markdown avançado | `src/vs/workbench/contrib/pegasusai/browser/webviews/chatWebview.tsx` |
| Diff Viewer | VOID + Code-OSS | Fusionar com native diff editor | `src/vs/workbench/contrib/pegasusai/browser/webviews/diffViewer.tsx` |
| Graph Visualizer | Google Antigravity | Usar D3.js para visualização | `src/vs/workbench/contrib/pegasusai/browser/webviews/graphVisualizer.tsx` |
| Timeline View | Open-Antigravity | Integração com Source Control | `src/vs/workbench/contrib/pegasusai/browser/views/timelineView.ts` |

**Tecnologias**:
- React 18 (isolado em webviews)
- TailwindCSS (via build pipeline customizado)
- Monaco Editor (nativo do Code-OSS)

### 3.6 Offline & Privacy (Origem: Code-OSS + VOID)

| Componente | Ação | Justificativa |
|------------|------|---------------|
| Telemetria | Desabilitar por padrão | Privacidade do usuário |
| Analytics Externos | Remover completamente | Requisito offline-first |
| Crash Reporting | Redirecionar para arquivo local | Debug sem envio externo |
| Update Checker | Manter opcional | Usuário decide quando atualizar |
| Extension Gallery | Suporte a OpenVSX + local | Alternativa ao Marketplace Microsoft |

**Configurações**:
```json
{
  "pegasusai.telemetry.enabled": false,
  "pegasusai.offlineMode": true,
  "pegasusai.llm.provider": "ollama",
  "pegasusai.llm.endpoint": "http://localhost:11434"
}
```

---

## 4. MATRIZ DE INTEGRAÇÃO

### 4.1 Matriz de Origem-Destino

| Componente | Code-OSS | VOID | OPIDE | Antigravity | Open-Antigravity | Destino Final |
|------------|----------|------|-------|-------------|------------------|---------------|
| Editor Core | ✅ Nativo | - | - | - | - | `src/vs/editor/` |
| Extension Host | ✅ Nativo | - | - | - | - | `src/vs/workbench/api/` |
| LLM Provider | - | ✅ Base | - | - | ⚠️ Adaptação | `src/vs/workbench/contrib/pegasusai/common/` |
| Skills Engine | - | - | - | - | ✅ Base | `src/vs/workbench/contrib/pegasusai/common/` |
| Dependency Graph | - | - | - | ✅ Base | ⚠️ Adaptação | `src/vs/workbench/contrib/pegasusai/node/graph/` |
| Side Panel | ⚠️ API | ✅ Base | - | - | - | `src/vs/workbench/contrib/pegasusai/browser/` |
| Build Pipeline | ✅ Gulp | ⚠️ Parcial | ✅ Base | - | - | `build/gulpfile.pegasusai.js` |
| Branding | ⚠️ Product.json | - | ✅ Base | - | - | `product.json` + `src/vs/base/common/product.ts` |
| Memory Store | - | - | - | - | ✅ Base | `src/vs/workbench/contrib/pegasusai/node/memory/` |
| Orchestrator | - | ⚠️ Parcial | - | - | ⚠️ Inspiração | `src/vs/workbench/contrib/pegasusai/common/orchestrator/` |

**Legenda**:
- ✅ = Utilização direta ou com mínimas adaptações
- ⚠️ = Adaptação significativa necessária
- - = Não aplicável ou não utilizado

### 4.2 Matriz de Dependências Cruzadas

```
┌─────────────────────┬──────────┬────────┬───────────┬────────────┬──────────────┐
│                     │ Core OSS │ VOID   │ Antigrav. │ Open-Anti. │ PegasusAI    │
├─────────────────────┼──────────┼────────┼───────────┼────────────┼──────────────┤
│ Core OSS            │    -     │  Baixa │   Baixa   │   Baixa    │   Média      │
│ VOID                │  Alta    │   -    │   Nula    │   Nula     │   Alta       │
│ Antigravity         │  Média   │  Nula  │    -      │   Alta     │   Média      │
│ Open-Antigravity    │  Média   │  Nula  │   Alta    │     -      │   Alta       │
│ PegasusAI           │  Alta    │  Alta  │   Média   │   Média    │     -        │
└─────────────────────┴──────────┴────────┴───────────┴────────────┴──────────────┘
```

**Análise**:
- PegasusAI depende fortemente do Core OSS (base) e VOID (IA)
- Antigravity e Open-Antigravity têm dependência mútua (grafo + skills)
- VOID é relativamente isolado, facilitando integração

---

## 5. ESTRATÉGIA DE FUSÃO DE CÓDIGO

### 5.1 Por Tipo de Arquivo

| Tipo de Arquivo | Estratégia | Ferramenta |
|-----------------|------------|------------|
| TypeScript (.ts) | Merge manual com revisão | Git merge + revisão humana |
| React (.tsx) | Isolamento em webviews | Copy-paste com adaptação de imports |
| JSON (.json) | Merge automatizado | `jq` + script customizado |
| CSS/SCSS | Concatenação ordenada | PostCSS pipeline |
| HTML | Template merging | EJS templates |
| Markdown | Revisão manual | - |
| YAML | Merge estruturado | `yq` tool |

### 5.2 Regras de Conflito

1. **Conflito de Imports**: Priorizar imports do Code-OSS; adaptar imports de outros repos para estrutura PegasusAI.
2. **Conflito de Namespaces**: Prefixar todos os símbolos PegasusAI com `PegasusAI` ou `pegasusai.`.
3. **Conflito de Configuração**: Unificar em `product.json` com chaves namespaced (`pegasusai.*`).
4. **Conflito de Build**: Estender Gulp tasks existentes, nunca sobrescrever.

---

## 6. FLUXOS DE DADOS PRINCIPAIS

### 6.1 Fluxo: Chat → Edit Code

```
[User Input in Chat] 
    ↓
[Pegasus Side Panel Webview]
    ↓ (postMessage)
[PegasusAI IPC Bridge]
    ↓ (invoke)
[LLM Provider Service]
    ↓ (call)
[Local/Cloud LLM Endpoint]
    ↓ (response)
[Response Parser]
    ↓
[Fast/Slow Apply Service]
    ↓ (compute diff)
[Monaco Editor API]
    ↓ (apply edits)
[Document Text Buffer]
    ↓
[Save to Disk]
```

### 6.2 Fluxo: RAG Indexing

```
[File System Watcher]
    ↓ (file changed)
[Workspace Indexer]
    ↓ (extract entities)
[Entity Extractor]
    ↓ (update graph)
[Dependency Graph DB]
    ↓ (embed chunks)
[Vector Store (SQLite + embeddings)]
    ↓
[Index Ready for Queries]
```

### 6.3 Fluxo: Multi-Model Fallback

```
[Orchestrator Request]
    ↓
[Model Router]
    ├─→ [Primary Model (Ollama)] ──(success)─→ [Response]
    ├─→ (timeout/fail) ──→ [Secondary Model (LM Studio)] ──(success)─→ [Response]
    └─→ (timeout/fail) ──→ [Tertiary Model (Cloud Fallback)] ──→ [Response]
```

---

## 7. PONTOS DE INTEGRAÇÃO CRÍTICA

### 7.1 IPC Bridge (Browser ↔ Main Process)

**Local**: `src/vs/workbench/contrib/pegasusai/electron-sandbox/ipcBridge.ts`

**Responsabilidade**: Isolar chamadas de IA no processo main para evitar bloqueio da UI.

**Canais IPC**:
- `pegasusai:llm:invoke`
- `pegasusai:graph:query`
- `pegasusai:memory:store`
- `pegasusai:skills:execute`

### 7.2 Registry Extensions

**Local**: `src/vs/workbench/contrib/pegasusai/common/registry.ts`

**Responsabilidade**: Registrar contribuições sem modificar código core.

**Exemplo**:
```typescript
Registry.add('pegasusai.commands', {
  id: 'pegasusai.chat.open',
  handler: () => { /* ... */ }
});
```

### 7.3 Dependency Injection Container

**Local**: `src/vs/workbench/contrib/pegasusai/common/services.ts`

**Responsabilidade**: Injeção de dependências para serviços PegasusAI.

**Serviços Registrados**:
- `IPegasusAILLMService`
- `IPegasusAIGraphService`
- `IPegasusAIMemoryService`
- `IPegasusAIOrchestratorService`

### 7.4 Build Pipeline Extension

**Local**: `build/gulpfile.pegasusai.js`

**Responsabilidade**: Estender build do Code-OSS com tasks PegasusAI.

**Tasks**:
- `compile-pegasusai`
- `package-pegasusai`
- `build-pegasusai-win32`
- `build-pegasusai-linux`
- `build-pegasusai-darwin`

### 7.5 Configuration Schema

**Local**: `src/vs/workbench/contrib/pegasusai/common/configuration.ts`

**Responsabilidade**: Definir schema de configurações PegasusAI.

**Schema**:
```json
{
  "pegasusai.llm.provider": { "type": "string", "enum": ["ollama", "lmstudio", "openai"] },
  "pegasusai.llm.endpoint": { "type": "string" },
  "pegasusai.graph.enabled": { "type": "boolean", "default": true },
  "pegasusai.memory.enabled": { "type": "boolean", "default": true },
  "pegasusai.telemetry.enabled": { "type": "boolean", "default": false }
}
```

---

## 8. RISCOS TÉCNICOS E MITIGAÇÃO

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Conflito de versões TypeScript | Alta | Alto | Pin versão exata do Code-OSS; testar compilação incremental |
| Quebra de compatibilidade com extensões | Média | Alto | Test suite extensiva com extensões populares; CI/CD com matrix de testes |
| Performance degradation com grafo grande | Média | Médio | Indexação incremental; lazy loading; paginação de resultados |
| Vazamento de memória em webviews React | Baixa | Médio | Profiling regular; limitação de histórico em memória |
| Build pipeline complexo demais | Alta | Médio | Documentação detalhada; scripts de automação; containerização do build |
| Dependências nativas incompatíveis | Média | Alto | Vendorização de dependências críticas; build reproduzível |
| Rebranding incompleto | Baixa | Baixo | Checklist automatizado; busca por strings "VS Code" em todo código |

---

## 9. CHECKLIST DE PRÉ-INTEGRAÇÃO

### 9.1 Code-OSS
- [ ] Clonar branch estável mais recente
- [ ] Compilar com sucesso (`npm run compile`)
- [ ] Executar testes unitários (`npm test`)
- [ ] Identificar commit base para merge

### 9.2 VOID
- [ ] Extrair serviços LLM independentes
- [ ] Isolar componentes React em módulos reutilizáveis
- [ ] Documentar interfaces IPC
- [ ] Remover dependências hardcoded

### 9.3 OPIDE
- [ ] Extrair scripts de build Gulp
- [ ] Mapear modificações em `product.json`
- [ ] Documentar pipeline de packaging
- [ ] Identificar customizações de branding

### 9.4 Google Antigravity
- [ ] Extrair motor de grafo de dependências
- [ ] Adaptar algoritmos de análise para TypeScript
- [ ] Documentar estruturas de dados do grafo
- [ ] Identificar pontos de integração com workspace

### 9.5 Open-Antigravity
- [ ] Extrair Skills Engine
- [ ] Adaptar JSON-RPC para IPC interno
- [ ] Documentar formato de Skills
- [ ] Mapear integrações com MCP (Model Context Protocol)

---

## 10. DECISÕES ARQUITETURAIS REGISTRADAS (ADRs)

### ADR-001: Isolamento de Código PegasusAI

**Contexto**: Necessidade de manter compatibilidade com futuras atualizações do Code-OSS.

**Problema**: Como integrar funcionalidades PegasusAI sem modificar código core?

**Alternativas**:
1. Find & Replace global (rejeitado: alto risco de regressão)
2. Fork completo do Code-OSS (rejeitado: manutenção insustentável)
3. Extensão via Registry e Contributions (aceito)

**Solução**: Todo código PegasusAI em `src/vs/workbench/contrib/pegasusai/`, registrado via APIs de extensão do próprio Code-OSS.

**Justificativa**: Permite atualizações do Code-OSS com merges limpos; segue padrões estabelecidos pela comunidade VS Code.

**Consequências**: Curva de aprendizado para desenvolvedores; necessidade de disciplina rigorosa.

---

### ADR-002: Offline-First com Fallback Cloud

**Contexto**: Usuários exigem privacidade e operação sem internet.

**Problema**: Como balancear funcionalidade offline com capacidades de modelos cloud?

**Alternativas**:
1. Apenas offline (rejeitado: limita capacidades)
2. Apenas cloud (rejeitado: viola requisito de privacidade)
3. Offline-first com fallback configurável (aceito)

**Solução**: Configuração padrão aponta para Ollama local; usuário pode configurar fallbacks cloud opcionais.

**Justificativa**: Atende requisitos de privacidade sem sacrificar funcionalidade avançada.

**Consequências**: Complexidade adicional no roteamento de requests; necessidade de UI para configuração.

---

### ADR-003: SQLite para Persistência de Grafo e Memória

**Contexto**: Necessidade de persistência eficiente de grafo de conhecimento e memória de conversas.

**Problema**: Qual banco de dados embarcado utilizar?

**Alternativas**:
1. JSON files (rejeitado: performance ruim para queries complexas)
2. IndexedDB (rejeitado: limitado ao renderer process)
3. SQLite (aceito)
4. LevelDB (rejeitado: menos maduro para queries relacionais)

**Solução**: SQLite via `better-sqlite3` no processo main, com wrapper async.

**Justificativa**: Maduro, performático, suporta queries complexas, amplamente testado em Electron apps.

**Consequências**: Dependência nativa; necessidade de build para múltiplas plataformas.

---

### ADR-004: React Isolado em Webviews

**Contexto**: VOID utiliza React extensivamente; Code-OSS usa vanilla TS/HTML.

**Problema**: Como integrar React sem conflitar com build do Code-OSS?

**Alternativas**:
1. Converter tudo para vanilla TS (rejeitado: perda de produtividade)
2. Migrar Code-OSS para React (rejeitado: esforço monumental)
3. Isolar React em webviews (aceito)

**Solução**: Componentes React rodam exclusivamente em webviews; comunicação via postMessage/IPC.

**Justificativa**: Minimiza conflitos; permite uso de ecossistema React moderno.

**Consequências**: Overhead de serialização em comunicações; necessidade de definir contratos de mensagem rigorosos.

---

## 11. ESTRUTURA DE DIRETÓRIOS PROPOSTA

```
pegasusai/
├── src/
│   └── vs/
│       ├── base/ (Code-OSS nativo)
│       ├── editor/ (Code-OSS nativo)
│       ├── platform/ (Code-OSS nativo)
│       └── workbench/
│           ├── api/ (Code-OSS nativo)
│           ├── browser/ (Code-OSS nativo)
│           ├── common/ (Code-OSS nativo)
│           ├── electron-sandbox/ (Code-OSS nativo)
│           ├── electron-main/ (Code-OSS nativo)
│           └── contrib/
│               └── pegasusai/          ← NOVO: Todo código PegasusAI
│                   ├── browser/        ← UI (React webviews, views)
│                   │   ├── sidePanel/
│                   │   ├── webviews/
│                   │   └── views/
│                   ├── common/         ← Lógica compartilhada
│                   │   ├── orchestrator/
│                   │   ├── skills/
│                   │   └── services/
│                   ├── node/           ← Backend (processo main)
│                   │   ├── adapters/
│                   │   ├── graph/
│                   │   ├── memory/
│                   │   └── services/
│                   └── electron-sandbox/ ← IPC bridge
├── build/
│   ├── gulpfile.js (Code-OSS nativo)
│   └── gulpfile.pegasusai.js  ← NOVO: Tasks customizadas
├── product.json (modificado com branding PegasusAI)
├── package.json (modificado com dependências PegasusAI)
└── resources/
    └── pegasusai/  ← Assets (ícones, logos, etc.)
```

---

## 12. PRÓXIMOS PASSOS (FASE 4)

1. Criar estrutura de diretórios PegasusAI no workspace
2. Scaffold inicial dos arquivos TypeScript base
3. Configurar build pipeline estendido (Gulp)
4. Setup de product.json com branding inicial
5. Validação de compilação básica

---

## 13. VALIDAÇÃO DESTA FASE

- [x] Arquitetura documentada em detalhes
- [x] Componentes mapeados com origem e destino
- [x] Matrizes de integração completas
- [x] Fluxos de dados principais definidos
- [x] Riscos identificados com mitigação
- [x] ADRs registrados
- [x] Estrutura de diretórios proposta
- [x] Checklist de pré-integração definido

---

## 14. PLANO DE ROLLBACK

Em caso de falha na validação da arquitetura:

1. Revisar ADRs com o comitê de engenharia
2. Identificar componentes problemáticos
3. Avaliar alternativas de implementação
4. Atualizar documentação arquitetural
5. Re-validar antes de prosseguir para Fase 4

**Critério de Rollback**: Se mais de 3 riscos críticos não tiverem mitigação viável, retornar para Fase 2 para re-mapeamento.

---

*Documento gerado pelo Comitê de Engenharia PegasusAI em conformidade com a especificação mestre.*
