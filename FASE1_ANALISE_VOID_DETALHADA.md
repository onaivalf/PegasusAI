# FASE 1 — ANÁLISE COMPLETA DOS REPOSITÓRIOS (Atualizada)

## Relatório do Comitê de Engenharia PegasusAI

### 2. VOID (onaivalf/basevoid) — Análise Detalhada

**Status do Projeto:** Descontinuado (deprecated), mas ainda é uma excelente referência para fork do VS Code.

**Repositório:** `https://github.com/onaivalf/basevoid`  
**Licença:** Apache License 2.0 (para código VOID) + MIT (base Code-OSS)  
**Versão Base:** Code-OSS 1.99.3

---

## ARQUITETURA DO VOID

### Estrutura Principal

O código do Void está organizado em três camadas principais dentro de `src/vs/workbench/contrib/void/`:

```
src/vs/workbench/contrib/void/
├── browser/          # Código que roda no processo renderer (UI)
├── common/           # Código compartilhado entre processos
└── electron-main/    # Código que roda no processo main (Node.js)
```

### Contagem de Arquivos
- **Total de arquivos TypeScript:** 64 arquivos
- **Browser:** ~30 arquivos principais
- **Common:** ~20 arquivos de tipos e serviços
- **Electron-main:** ~6 arquivos de implementação

---

## COMPONENTES CHAVE IDENTIFICADOS

### 1. Sistema de Serviços VOID

#### Serviços Principais (browser/)

| Serviço | Arquivo | Descrição |
|---------|---------|-----------|
| `editCodeService` | `editCodeService.ts` (89KB) | Gerencia aplicação de diffs, Fast/Slow Apply |
| `chatThreadService` | `chatThreadService.ts` (67KB) | Histórico de conversas, threads de chat |
| `autocompleteService` | `autocompleteService.ts` (33KB) | Autocomplete baseado em IA (FIM) |
| `voidCommandBarService` | `voidCommandBarService.ts` (28KB) | Barra de comandos contextual |
| `convertToLLMMessageService` | `convertToLLMMessageService.ts` (26KB) | Conversão de contexto para mensagens LLM |
| `toolsService` | `toolsService.ts` (24KB) | Sistema de ferramentas para agentes |
| `contextGatheringService` | `contextGatheringService.ts` (13KB) | Coleta de contexto do código |
| `extensionTransferService` | `extensionTransferService.ts` (14KB) | Transferência de configurações de extensões |
| `terminalToolService` | `terminalToolService.ts` (14KB) | Integração com terminal |
| `voidSCMService` | `voidSCMService.ts` (9KB) | Controle de versão integrado |
| `sidebarPane` | `sidebarPane.ts` (7KB) | Painel lateral do chat |
| `voidSettingsPane` | `voidSettingsPane.ts` (7KB) | Interface de configurações |

#### Serviços Comuns (common/)

| Serviço | Arquivo | Descrição |
|---------|---------|-----------|
| `modelCapabilities` | `modelCapabilities.ts` (57KB) | Catálogo de modelos e provedores |
| `voidSettingsService` | `voidSettingsService.ts` (22KB) | Gerenciamento de configurações |
| `voidSettingsTypes` | `voidSettingsTypes.ts` (18KB) | Tipos de configurações |
| `directoryStrService` | `directoryStrService.ts` (15KB) | Representação de estrutura de diretórios |
| `mcpService` | `mcpService.ts` (12KB) | Protocolo Model Context |
| `sendLLMMessageService` | `sendLLMMessageService.ts` (9KB) | Comunicação IPC com processo main |
| `refreshModelService` | `refreshModelService.ts` (8KB) | Atualização de lista de modelos |
| `mcpServiceTypes` | `mcpServiceTypes.ts` (7KB) | Tipos MCP |

#### Implementação Main Process (electron-main/)

| Módulo | Arquivo | Descrição |
|--------|---------|-----------|
| `sendLLMMessageChannel` | `sendLLMMessageChannel.ts` | Canal IPC para envio de mensagens LLM |
| `mcpChannel` | `mcpChannel.ts` | Canal IPC para MCP |
| `llmMessage/sendLLMMessage.impl.ts` | (33KB) | Implementações por provedor |
| `llmMessage/extractGrammar.ts` | (12KB) | Extração de gramáticas para parsing |
| `metricsMainService` | `metricsMainService.ts` | Métricas e telemetria (local) |

---

## PIPELINE DE MENSAGENS LLM

### Fluxo de Dados

```
[UI React] → [Service (browser)] → [IPC Channel] → [Main Process] → [Provider API]
     ↓              ↓                    ↓               ↓                  ↓
  sidebarPane   voidSettings      sendLLMMessage    LLMMessageChannel   OpenAI/Ollama/etc
```

### Padrão Arquitetural Identificado

1. **Separação Main/Browser:** O Void usa IPC para isolar chamadas de API no processo main
2. **Hooks de Evento:** Sistema de emitters/listeners para streaming de tokens
3. **Abort Control:** Referências abortáveis para cancelamento de requisições
4. **Provider Agnostic:** Interface unificada para múltiplos provedores

---

## PROVEDORES SUPORTADOS

Do arquivo `modelCapabilities.ts`:

### Provedores Cloud
- **OpenAI:** gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o3, o4-mini
- **Anthropic:** claude-opus-4-0, claude-sonnet-4-0, claude-3-7-sonnet, etc.
- **xAI:** grok-2, grok-3, grok-3-mini
- **Google Gemini:** via API key
- **Groq:** modelos acelerados
- **Mistral:** modelos Mistral AI
- **DeepSeek:** modelos chineses
- **OpenRouter:** gateway multi-modelo

### Provedores Locais (Offline)
- **Ollama:** endpoint local (127.0.0.1:11434)
- **vLLM:** servidor local (localhost:8000)
- **LM Studio:** endpoint local (localhost:1234)
- **OpenAI Compatible:** endpoints customizados
- **LiteLLM:** proxy unificado

### Provedores Enterprise
- **Google Vertex AI:** integração GCP
- **Microsoft Azure Foundry:** Azure OpenAI
- **AWS Bedrock:** modelos Amazon

---

## SISTEMA DE APLICAÇÃO DE CÓDIGO (APPLY)

### Fast Apply vs Slow Apply

**Fast Apply:**
- Usa padrão Search/Replace com marcadores:
```
<<<<<<< ORIGINAL
// código original
=======
// código substituto
>>>>>>> UPDATED
```
- Permite aplicação incremental mesmo em arquivos grandes
- Similar ao Ctrl+F + replace

**Slow Apply:**
- Reescreve arquivo completo
- Usado quando Fast Apply falha

### Componentes Relacionados
- `editCodeService.ts`: Implementação principal
- `DiffZone`: Região de linhas com diffs visuais
- `DiffArea`: Generalização de áreas modificadas
- Streaming token-a-token com cancelamento

---

## SISTEMA DE CONFIGURAÇÕES

### Estrutura de Settings (`voidSettingsService.ts`)

```typescript
interface VoidSettingsState {
  settingsOfProvider: {
    openAI: { apiKey: string }
    ollama: { endpoint: string }
    // ... outros provedores
  }
  modelSelection: { providerName, modelName }
  featureSettings: {
    autocomplete: {...}
    chat: {...}
    ctrlK: {...}
    apply: {...}
  }
}
```

### Feature Names
- `Autocomplete` - Completamento de código
- `Chat` - Chat na sidebar
- `CtrlK` - Quick edit
- `Apply` - Aplicação de mudanças

---

## INTEGRAÇÃO REACT + TAILWIND

### Diferencial do Void

O Void monta React + Tailwind nativamente, algo não possível no VS Code puro:

1. **Build Pipeline Customizado:** Scripts `buildreact` e `watchreact` no package.json
2. **Tailwind Scoped:** Versão modificada para não conflitar com estilos do VS Code
3. **Localização:** `src/vs/workbench/contrib/void/browser/react/`

---

## ACTION IDs REGISTRADAS

Do arquivo `actionIDs.ts`:

| Action ID | Descrição |
|-----------|-----------|
| `void.ctrlLAction` | Abrir chat (Ctrl+L) |
| `void.ctrlKAction` | Quick edit (Ctrl+K) |
| `void.acceptDiff` | Aceitar diff atual |
| `void.rejectDiff` | Rejeitar diff atual |
| `void.goToNextDiff` | Próximo diff |
| `void.goToPrevDiff` | Diff anterior |
| `void.acceptFile` | Aceitar todas mudanças no arquivo |
| `void.rejectFile` | Rejeitar arquivo |
| `void.acceptAllDiffs` | Aceitar todos diffs |
| `void.rejectAllDiffs` | Rejeitar todos diffs |

---

## PADRÕES DE CONTRIBUIÇÃO

### Exemplo de Registro de Serviço (`_dummyContrib.ts`)

```typescript
// 1. Criar interface do serviço
export interface IDummyService {
  readonly _serviceBrand: undefined;
}
export const IDummyService = createDecorator<IDummyService>('DummyService');

// 2. Registrar Action (opcional)
registerAction2(class extends Action2 {
  constructor() {
    super({
      f1: true,
      id: 'void.dummy',
      title: localize2('dummy', 'dummy: Init'),
      keybinding: { primary: KeyMod.CtrlCmd | KeyCode.Digit0 }
    });
  }
  async run(accessor: ServicesAccessor) { ... }
})

// 3. Implementar Service
class DummyService extends Disposable implements IWorkbenchContribution, IDummyService {
  static readonly ID = 'workbench.contrib.void.dummy';
  _serviceBrand: undefined;
  constructor(@ICodeEditorService codeEditorService: ICodeEditorService) { ... }
}

// 4. Registrar Singleton
registerSingleton(IDummyService, DummyService, InstantiationType.Eager);
registerWorkbenchContribution2(DummyService.ID, DummyService, WorkbenchPhase.BlockRestore);
```

---

## ENTRY POINT DO VOID

Arquivo: `void.contribution.ts`

Este arquivo importa todos os módulos do Void, registrando:
- Edit Code Service (diffs inline)
- Sidebar pane e ações (Ctrl+L)
- Quick Edit (Ctrl+K)
- Autocomplete
- Context gathering
- Settings pane
- CSS customizado
- Update actions
- Tools e Terminal tools
- Thread history
- Metrics polling
- Selection helper widget
- Tooltip service
- Onboarding
- SCM integration
- Common services (LLM, settings, model refresh, metrics, updates)

---

## BUILD SYSTEM

### Scripts NPM Principais

```json
{
  "buildreact": "cd ./src/vs/workbench/contrib/void/browser/react/ && node build.js",
  "watchreact": "... --watch",
  "compile": "gulp compile",
  "watch": "npm-run-all -lp watch-client watch-extensions",
  "watch-client": "gulp watch-client",
  "package": "gulp vscode:<platform>"
}
```

### Dependências Chave Adicionadas pelo Void

- `@anthropic-ai/sdk` - SDK Anthropic
- `@google/genai` - SDK Google AI
- `@mistralai/mistralai` - SDK Mistral
- `@modelcontextprotocol/sdk` - MCP
- `@floating-ui/react` - UI components React
- `@c4312/eventsource-umd` - Server-sent events

---

## LIÇÕES APRENDIDAS DO VOID

### ✅ Pontos Fortes

1. **Arquitetura Limpa:** Separação clara browser/main/common
2. **Provider Agnostic:** Fácil adicionar novos provedores
3. **Offline-First:** Suporte nativo a Ollama, vLLM, LM Studio
4. **Streaming Eficiente:** IPC com emitters para tokens
5. **Apply Inteligente:** Fast/Slow apply com fallback
6. **Context Awareness:** Sistema de gathering de contexto
7. **Extensibilidade:** Padrão de serviços bem definido

### ⚠️ Pontos de Atenção

1. **Projeto Descontinuado:** Não recebe mais updates oficiais
2. **React Build Separado:** Requer pipeline de build adicional
3. **Código Específico:** Alguns hardcodes de providers
4. **Sem Sync Upstream:** Fork parado no VS Code 1.99.3

---

## MATRIZ DE REUTILIZAÇÃO PARA PEGASUSAI

| Componente VOID | Reutilizar? | Adaptação Necessária | Prioridade |
|-----------------|-------------|---------------------|------------|
| `editCodeService` | ✅ Sim | Rebranding + melhorias | Alta |
| `chatThreadService` | ✅ Sim | Memória persistente | Alta |
| `autocompleteService` | ✅ Sim | Modelos locais | Alta |
| `sendLLMMessage*` | ✅ Sim | Multi-modelo orchestrator | Alta |
| `modelCapabilities` | ✅ Sim | Expandir catálogo | Média |
| `voidSettingsService` | ✅ Sim | Unificar com Code-OSS | Alta |
| `toolsService` | ✅ Sim | Agent system | Alta |
| `mcpService` | ✅ Sim | Manter compatibilidade | Média |
| `contextGatheringService` | ✅ Sim | Grafo de conhecimento | Alta |
| `terminalToolService` | ✅ Sim | Manter | Média |
| `voidSCMService` | ⚠️ Parcial | Integrar com Git nativo | Baixa |
| React Build | ✅ Sim | Manter pipeline | Alta |
| Fast/Slow Apply | ✅ Sim | Melhorar parser | Alta |

---

## PRÓXIMOS PASSOS RECOMENDADOS

1. **Clonar Code-OSS Oficial:** Obter base atualizada do microsoft/vscode
2. **Extrair Módulos VOID:** Copiar serviços essenciais para estrutura PegasusAI
3. **Criar Camada de Abstração:** Interface unificada para IA
4. **Implementar Offline-First:** Priorizar provedores locais
5. **Design do Orchestrator:** Pipeline multi-modelo inteligente

---

**Comitê de Engenharia PegasusAI**  
*Análise VOID concluída - Fase 1 completa*
