# 🚀 PEGASUSAI - PLANO DE IMPLEMENTAÇÃO REAL (OPÇÃO A)

## ⚠️ Contexto da Revisão
As fases anteriores criaram arquivos de serviço isolados (`services/`), mas **não integraram** essas funcionalidades ao núcleo do editor (Electron Main Process, UI React, Build System). 
Este plano foca em **implementação real**, modificando arquivos existentes do código base, injetando dependências e garantindo que cada feature funcione na prática.

---

## 📋 METODOLOGIA DE TRABALHO
Para cada fase abaixo, seguirei estritamente este ciclo:
1.  **Análise**: Identificar os arquivos exatos do código base (Void original) que precisam ser alterados.
2.  **Implementação**: Editar o código fonte real (`.ts`, `.tsx`, `.json`), não apenas criar novos arquivos.
3.  **Integração**: Conectar novos serviços aos componentes de UI e ao processo principal.
4.  **Build Check**: Verificar se as configurações de build (Webpack/Vite/Electron) reconhecem as mudanças.
5.  **Auto-Revisão Obrigatória**: Ao final de cada fase, gerarei um relatório de "Checklist de Realidade" confirmando linha por linha o que foi alterado.

---

## 🗓️ CRONOGRAMA DETALHADO (FASE POR FASE)

### FASE 1: CONSOLIDAÇÃO DA RENOMEAÇÃO (VOID → PEGASUSAI)
**Objetivo**: Garantir que *nenhuma* referência a "void" reste no código executável e que a UI reflita "PegasusAI".
*   **Ações Reais**:
    *   [ ] Varredura profunda (`grep -r`) em todo o repositório para encontrar ocorrências restantes de "void", "Void", "VOID".
    *   [ ] Atualização do `package.json`: nome, versão, scripts, author.
    *   [ ] Modificação do `product.json` (núcleo do VS Code) para alterar nomes de janelas, menus e about box.
    *   [ ] Substituição de ícones e assets visuais (troca de arquivos `.png`, `.svg`, `.ico`).
    *   [ ] Atualização de imports internos que usavam caminhos `.../void/...`.
*   **Critério de Sucesso**: Compilar o projeto sem erros de importação e a janela do app mostrar "PegasusAI".

### FASE 2: MOTOR LLM LOCAL FUNCIONAL (INTEGRAÇÃO REAL)
**Objetivo**: Fazer o dropdown de modelos listar servidores locais (Ollama) e enviar/receber dados reais.
*   **Ações Reais**:
    *   [ ] Editar `src/vs/workbench/contrib/pegasusai/services/modelService.ts` (ou equivalente): Adicionar lógica real de fetch HTTP para `http://localhost:11434`.
    *   [ ] Modificar a UI de Settings (`src/vs/workbench/contrib/pegasusai/components/Settings.tsx`): Adicionar campos reais para "Base URL" e "Model Name".
    *   [ ] Implementar o stream de resposta no componente de Chat (`ChatView.tsx`), processando tokens em tempo real.
    *   [ ] Criar handler no Electron Main Process para permitir requisições HTTP locais (CORS bypass se necessário).
*   **Critério de Sucesso**: Selecionar "Ollama" nas settings, digitar um prompt e ver a resposta do modelo local na tela.

### FASE 3: SISTEMA DE ARQUIVOS E TERMINAL (PERMISSÕES REAIS)
**Objetivo**: Permitir que o agente leia/escreva em `D:\projetos` e execute comandos no terminal do sistema.
*   **Ações Reais**:
    *   [ ] Modificar `electron-main.ts` (ou `main.js`): Implementar IPC handlers (`ipcMain.handle`) para `readFile`, `writeFile`, `listDir` com caminho absoluto.
    *   [ ] Atualizar `preload.ts`: Expor essas funções novas para o renderer process de forma segura (`contextBridge`).
    *   [ ] Integrar o `terminalService` ao componente de Terminal existente, permitindo injeção de comandos via API do agente.
    *   [ ] Implementar modal de "Permissão de Arquivo" na UI que pausa a execução até o usuário clicar em "Allow".
*   **Critério de Sucesso**: O agente conseguir ler um arquivo em `D:\testes\app.txt` e criar um novo arquivo via comando do chat.

### FASE 4: INTEGRAÇÃO OPIDE (MEMÓRIA E AST NO CORE)
**Objetivo**: O parser AST rodar em background e a memória persistir entre sessões.
*   **Ações Reais**:
    *   [ ] Instalar dependências reais: `npm install tree-sitter tree-sitter-typescript tree-sitter-python ...`
    *   [ ] Modificar o `workspaceService`: Adicionar hook que dispara o parser AST sempre que um arquivo é salvo.
    *   [ ] Implementar banco de dados local (SQLite ou LevelDB) no processo principal para salvar os "Engrams".
    *   [ ] Conectar o serviço de busca vetorial ao input de "Contexto" do chat.
*   **Critério de Sucesso**: Ao abrir um projeto grande, o índice AST é gerado; ao reiniciar o app, a IA lembra do contexto anterior.

### FASE 5: SKILLS ANTIGRAVITY (EXECUTORES REAIS)
**Objetivo**: As skills não serem apenas texto, mas funções executáveis.
*   **Ações Reais**:
    *   [ ] Criar registro de skills no código (`skillsRegistry.ts`) mapeando nomes de skills para funções TypeScript reais.
    *   [ ] Modificar o parser de resposta do LLM: Detectar chamadas de skill (ex: `<skill name="create_file">`) e interceptar antes de renderizar como texto.
    *   [ ] Implementar executor de workflows que chama sequencialmente as funções registradas.
*   **Critério de Sucesso**: Pedir "Crie um projeto React" e o sistema executar a skill correspondente, criando pastas e arquivos reais.

### FASE 6: COMPATIBILIDADE VS CODE (LSP E EXTENSÕES)
**Objetivo**: Rodar linguagem servers e suportar extensões básicas.
*   **Ações Reais**:
    *   [ ] Habilitar o sistema de extensão do VS Code no `product.json` (remover restrições se houver).
    *   [ ] Configurar o `LanguageClient` para apontar para servidores locais ou bundled.
    *   [ ] Testar instalação de uma extensão simples (.vsix) via UI.
*   **Critério de Sucesso**: Instalar a extensão do Python ou ESLint e ter intellisense funcionando.

### FASE 7: BUILD, SEGURANÇA E RELEASE
**Objetivo**: Gerar o instalador executável (.exe, .dmg, .AppImage).
*   **Ações Reais**:
    *   [ ] Configurar `electron-builder.yml` ou `forge.config.js` com ícones e metadados da PegasusAI.
    *   [ ] Rodar script de build (`npm run build` ou `npm run package`).
    *   [ ] Realizar teste de instalação em máquina limpa.
    *   [ ] Auditoria de segurança: Verificar se chaves de API não estão hardcoded.
*   **Critério de Sucesso**: Arquivo instalável gerado na pasta `dist/` e funcionando.

---

## 🏁 INÍCIO DA EXECUÇÃO

Estou pronto para iniciar a **FASE 1: CONSOLIDAÇÃO DA RENOMEAÇÃO** com rigor técnico.
Ao final, apresentarei o **Relatório de Revisão Obrigatória**.

Posso começar a Fase 1 agora?
