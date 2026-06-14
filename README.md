## PegasusAI - IDE com LLM Local e Agente de Codificação

PegasusAI é uma IDE moderna baseada em VS Code, com suporte total a LLMs locais (Ollama, vLLM, LM Studio), integração com OPIDE (memória Engram, indexação AST) e skills do AntiGravity da Google.

### Recursos Principais:

- **100% LLM Local**: Execute modelos como Qwen2.5-Coder, Gemma2, DeepSeek-Coder diretamente no seu computador
- **Agente de Codificação**: Edição automática de arquivos, leitura/escrita em qualquer pasta (ex: `D:\projetos`)
- **Terminal Completo**: PowerShell/bash integrados para execução de comandos
- **Compatibilidade VS Code**: Suporte a extensões e LSP (IntelliSense)
- **Memória Engram**: Sistema de memória de 3 níveis inspirado no OPIDE
- **Skills Fractais**: 573 skills padronizadas do AntiGravity

### Download

Para baixar o PegasusAI, veja [Releases](https://github.com/pegasusai/pegasusai/releases).

### Forking VS Code

Se você está fazendo fork do VS Code, pode referenciar a lógica do PegasusAI. Veja nosso [Codebase Guide](https://github.com/pegasusai/pegasusai/blob/main/PEGASUSAI_CODEBASE_GUIDE.md) e [How to Contribute](https://github.com/pegasusai/pegasusai/blob/main/HOW_TO_CONTRIBUTE.md).

- Montamos React + Tailwind. Isso não é possível no VS Code puro, e exigiu estender o pipeline de build para compilar React e [scope](https://github.com/andrewpareles/scope-tailwind) Tailwind ourselves.

- Você pode copiar nossos GitHub Actions para empacotar, assinar e atualizar automaticamente o PegasusAI. O pipeline de build do VS Code é privado, então isso normalmente é muito difícil.

- Nosso código de provedor de IA é construído do zero, permitindo suportar autocomplete (FIM) e outras respostas personalizadas. Exponemos gramáticas para tags comuns `<thinking>`, tool tags, etc. Sinta-se livre para referenciar nossa arquitetura usando IPC e satisfazendo CSP.

- Use nossos serviços personalizados para editar arquivos. EditCodeService permite mostrar diffs enquanto o código flui, até token por token. PegasusAIModelService permite editar arquivos em segundo plano e sincroniza arquivos do sistema operacional com seus buffers de texto.

- Tudo que fizemos é 100% open source. Veja [repos](https://github.com/orgs/pegasusai/repositories) para uma visão completa de todos os repositórios que compõem o PegasusAI.



# Welcome to PegasusAI.

<div align="center">
	<img
		src="./src/vs/workbench/browser/parts/editor/media/slice_of_void.png"
	 	alt="Void Welcome"
		width="300"
	 	height="300"
	/>
</div>

Use AI agents on your codebase, checkpoint and visualize changes, and bring any model or host locally. Void sends messages directly to providers without retaining your data.

This repo contains the full sourcecode for Void's Desktop app. If you're new, welcome!

- 🧭 [Website](https://pegasusai.com)

- 🚙 [Roadmap](https://github.com/orgs/pegasusai/projects/2)

- 🔨 [Contribute](https://github.com/pegasusai/void/blob/main/HOW_TO_CONTRIBUTE.md)




## Reference

Void is a fork of the [vscode](https://github.com/microsoft/vscode) repository. For a guide to our codebase, see [VOID_CODEBASE_GUIDE](https://github.com/pegasusai/void/blob/main/VOID_CODEBASE_GUIDE.md).

For a guide on how to develop your own version of Void, see [HOW_TO_CONTRIBUTE](https://github.com/pegasusai/void/blob/main/HOW_TO_CONTRIBUTE.md) and [void-builder](https://github.com/pegasusai/void-builder).



## Support
You can always reach us in our [Discord server](https://discord.gg/RSNjgaugJs) or contact us via email at hello@pegasusai.com.
