# PegasusAI

**IDE PegasusAI** - Offline-First AI-Powered Development Environment

## 🦅 Visão Geral

PegasusAI é uma IDE baseada em Code-OSS que integra o melhor das arquiteturas:
- **Code-OSS** - Core do VS Code
- **VOID** - Sistema de IA e LLM providers
- **OPIDE** - Interface e UX
- **Antigravity** - Recursos avançados de código

### Princípios

- ✅ **100% Offline por padrão** - Funciona sem internet
- ✅ **Compatibilidade VS Code** - Suporte total a extensões .vsix
- ✅ **Multi-Modelo** - Suporte a provedores locais e cloud
- ✅ **Memória & Conhecimento** - Grafo de conhecimento e timeline
- ✅ **Orquestração Inteligente** - Fallback automático entre modelos

## 🚀 Quick Start

### Pré-requisitos

- Node.js >= 20.0.0
- Yarn >= 1.22.0
- Python 3.x (para builds nativos)
- C++ Build Tools

### Instalação

```bash
# Clone o repositório
git clone https://github.com/pegasusai/pegasusai.git
cd pegasusai

# Instale dependências
yarn install

# Build de desenvolvimento
yarn watch

# Iniciar
yarn electron
```

### Build de Produção

```bash
# Build completo
yarn build-prod

# Ou separadamente
yarn build
yarn package
```

## 📁 Estrutura do Projeto

```
pegasusai/
├── src/
│   ├── main/           # Processo principal Electron
│   │   ├── ai/         # Serviços de IA
│   │   ├── ipc/        # Comunicação IPC
│   │   ├── memory/     # Sistema de memória
│   │   ├── orchestrator/ # Orquestrador multi-modelo
│   │   └── providers/  # Provedores LLM
│   ├── renderer/       # Processo de renderização
│   │   ├── components/ # Componentes React
│   │   ├── hooks/      # Hooks customizados
│   │   ├── services/   # Serviços frontend
│   │   └── views/      # Views principais
│   └── common/         # Código compartilhado
├── integration/        # Integrações externas
│   ├── void/           # VOID components
│   ├── opide/          # OPIDE components
│   ├── antigravity/    # Antigravity components
│   └── code-oss/       # Code-OSS core
├── resources/          # Recursos estáticos
│   ├── icons/          # Ícones PegasusAI
│   ├── themes/         # Temas
│   └── locales/        # Internacionalização
├── scripts/            # Scripts de build e utilitários
├── test/               # Testes
├── build/              # Configurações de build
└── docs/               # Documentação
```

## 🤖 Provedores de IA Suportados

### Locais (Offline)
- **Ollama** - Modelos locais via Ollama
- **LM Studio** - Servidor local LM Studio
- **vLLM** - Inferência otimizada
- **Transformers.js** - Modelos no navegador

### Cloud (Opcional)
- **OpenAI** - GPT-4, GPT-3.5
- **Anthropic** - Claude
- **Google** - Gemini
- **Azure** - Azure OpenAI

## 🔧 Features

### Sistema de Memória
- Grafo de conhecimento persistente
- Timeline de interações
- RAG (Retrieval-Augmented Generation)

### Apply de Código
- **Fast Apply** - Aplicações rápidas e seguras
- **Slow Apply** - Refatorações complexas com validação

### Orquestrador
- Fallback automático entre modelos
- Balanceamento de custo/performance
- Cache inteligente de respostas

## 📦 Compatibilidade

- ✅ Extensões VS Code (.vsix)
- ✅ Themes personalizados
- ✅ Snippets
- ✅ Tasks e Debuggers
- ✅ Language Server Protocol (LSP)

## 🛠️ Desenvolvimento

### Scripts Disponíveis

```bash
yarn compile          # Compila TypeScript
yarn watch            # Watch mode
yarn lint             # ESLint
yarn test             # Roda testes
yarn build            # Build completo
yarn package          # Gera instaladores
yarn rebrand          # Aplica rebranding
```

### Arquitetura

Verifique a documentação completa em `docs/`:
- `FASE1_ANALISE_REPOSITORIOS.md` - Análise dos repos base
- `FASE2_MAPEAMENTO_ARQUITETURAL.md` - Mapeamento de componentes
- `FASE3_ARQUITETURA_CONSOLIDADA.md` - Arquitetura final

## 📄 Licença

MIT License - Ver [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

Este projeto incorpora trabalho das seguintes comunidades:
- Microsoft Code-OSS
- VOID Team
- OPIDE Contributors
- Antigravity Project

---

**PegasusAI** - Voando alto no desenvolvimento com IA 🦅
