# FASE 2: ARQUITETURA CONSOLIDADA PEGASUSAI

## 1. VISÃO GERAL

Esta fase define a arquitetura oficial da IDE PegasusAI, consolidando os melhores componentes dos repositórios base (Code-OSS, VOID, OPIDE, Antigravity) em um design unificado, escalável e 100% offline-first.

### Princípios de Design
- **Offline-First:** Nenhuma dependência obrigatória de serviços cloud.
- **Compatibilidade VS Code:** Manutenção da API e ecossistema de extensões.
- **Modularidade:** Componentes desacoplados via IPC e interfaces bem definidas.
- **Segurança:** Isolamento de processos de IA e validação de edições de código.

---

## 2. ARQUITETURA EM 5 CAMADAS

| Camada | Nome | Responsabilidade | Origem Principal |
| :--- | :--- | :--- | :--- |
| **L5** | **Apresentação** | UI, Webviews, Chat, Diff View, Painéis | VOID (React), Code-OSS (Workbench) |
| **L4** | **Orquestração** | Agentes, Pipeline Multi-Modelo, Roteamento | VOID (Orchestrator), Antigravity |
| **L3** | **Inteligência** | LLM Providers, Embeddings, RAG, Memory | VOID (Providers), Open-Antigravity |
| **L2** | **Integração** | IPC Bridge, VS Code API Shim, FS Access | Code-OSS (IPC), OPIDE |
| **L1** | **Core** | Electron Main, Process Management, SQLite | Code-OSS (Electron), VOID (DB) |

---

## 3. COMPONENTES DETALHADOS

### 3.1. Camada L1: Core
- **Electron Main Process:** Gerenciamento de janelas, ciclos de vida e segurança.
- **SQLite Engine:** Armazenamento local para memória, configurações e grafo de conhecimento.
- **File System Watcher:** Monitoramento de mudanças em arquivos para indexação.

### 3.2. Camada L2: Integração
- **Pegasus IPC Bridge:** Canal seguro e tipado entre Main e Renderer.
- **VS Code API Shim:** Camada de compatibilidade para extensões VSIX.
- **Extension Host:** Ambiente isolado para execução de extensões.

### 3.3. Camada L3: Inteligência
- **Provider Registry:** Registro dinâmico de provedores (Ollama, LM Studio, OpenAI, etc.).
- **Smart Apply Engine:** Mecanismo de edição de código com diff e rollback (VOID + Antigravity).
- **Offline Manager:** Gerenciamento de saúde e fallback de modelos locais.
- **Embedding Service:** Geração de vetores para busca semântica local.

### 3.4. Camada L4: Orquestração
- **Pegasus Orchestrator:** Pipeline de tarefas (Planejar → Executar → Revisar).
- **Agent System:**
  - **Planner:** Divide tarefas complexas.
  - **Coder:** Gera código.
  - **Reviewer:** Valida e corrige código.
  - **Architect:** Mantém visão macro do projeto.
  - **Memory Agent:** Gerencia contexto e recuperação.
  - **Tool Agent:** Executa ferramentas externas.

### 3.5. Camada L5: Apresentação
- **Workbench Adaptado:** Interface base do Code-OSS com branding PegasusAI.
- **Chat View:** Interface React para interação com IA.
- **Diff View:** Visualização de alterações propostas.
- **Memory & Graph Panels:** Visualização de timeline e grafo de conhecimento.

---

## 4. FLUXOS DE DADOS CRÍTICOS

### Fluxo 1: Chat-to-Edit (Solicitação → Edição)
1. Usuário digita prompt no Chat View (L5).
2. Mensagem enviada via IPC Bridge (L2) ao Orchestrator (L4).
3. Orchestrador seleciona modelo via Provider Registry (L3).
4. Modelo gera resposta/código.
5. Smart Apply Engine (L3) calcula diff e aplica com segurança.
6. Confirmação enviada de volta à UI.

### Fluxo 2: Indexação de Memória (File Watch → Grafo)
1. File Watcher (L1) detecta mudança em arquivo.
2. Graph Builder (L3) analisa símbolos e dependências.
3. Embedding Service (L3) gera vetores.
4. Dados persistidos no SQLite (L1).
5. Memory Agent (L4) atualiza contexto disponível.

---

## 5. MATRIZ DE ORIGEM-DESTINO

| Componente PegasusAI | Origem | Adaptações Necessárias | Prioridade |
| :--- | :--- | :--- | :--- |
| **Editor Core** | Code-OSS | Rebranding, remoção de telemetry | Crítica |
| **Chat UI** | VOID | Integração com novos agentes | Crítica |
| **LLM Providers** | VOID | Adicionar suporte a mais modelos locais | Crítica |
| **Smart Apply** | VOID + Antigravity | Fusão de lógicas de diff | Crítica |
| **Orchestrator** | Novo (Baseado em VOID) | Implementação de agentes hierárquicos | Alta |
| **Memory Service** | Novo | SQLite + Vetores | Alta |
| **Timeline Tracker** | Novo | Baseado em eventos do VS Code | Média |
| **Knowledge Graph** | Open-Antigravity | Adaptação para TypeScript/Python | Média |

---

## 6. DECISÕES DE ARQUITETURA (ADRs)

### ADR-001: Persistência Exclusiva em SQLite
- **Decisão:** Usar SQLite para todos os dados locais (memória, configs, grafo).
- **Justificativa:** Simplicidade, performance, único arquivo, sem dependência de servidor.

### ADR-002: Isolamento de Processos de IA
- **Decisão:** Executar chamadas LLM em Worker Threads dedicados no Main Process.
- **Justificativa:** Evitar bloqueio da UI, melhor gerenciamento de recursos.

### ADR-003: Estratégia de Rebranding
- **Decisão:** Substituição de strings e assets via script de build (Gulp).
- **Justificativa:** Manter código base limpo, facilitar atualizações futuras do Code-OSS.

### ADR-004: Offline-First
- **Decisão:** Nenhum serviço cloud é obrigatório. Fallback automático para modelos locais.
- **Justificativa:** Privacidade, segurança, funcionamento em ambientes restritos.

---

## 7. ESTRATÉGIA DE FUSÃO DE CÓDIGO

1. **Base Code-OSS:** Clonar e aplicar patches de rebranding.
2. **Inserção VOID:** Copiar módulos `src/main/ai`, `src/renderer/chat` adaptando imports.
3. **Inserção Antigravity:** Integrar lógica de diff preciso no `SmartApplyEngine`.
4. **Novos Módulos:** Criar diretórios `src/main/memory`, `src/main/orchestrator` do zero.

---

## 8. VALIDAÇÃO PEG-VVF (FASE 2)

- [x] Todos os componentes dos diagramas possuem definição de implementação.
- [x] Fluxos especificados têm origem e destino claros.
- [x] Nenhuma funcionalidade "imaginada"; todas derivadas da análise real da Fase 1.
- [x] ADRs documentados justificando decisões críticas.

---

## 9. PRÓXIMOS PASSOS

- **Fase 3:** Criação do Scaffold (estrutura de diretórios, package.json, tsconfig, gulpfile).
- **Fase 4:** Implementação dos núcleos funcionais (IA, Memória, Orchestrator).
- **Fase 5:** Integração final, testes e build.

---

*Documento gerado conforme framework PEG-VVF. Próxima revisão na Fase 3.*
