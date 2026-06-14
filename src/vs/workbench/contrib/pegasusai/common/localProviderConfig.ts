/*--------------------------------------------------------------------------------------
 *  Copyright 2025 PegasusAI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Configuração otimizada para provedores LLM locais

import { ProviderName, SettingsOfProvider } from './pegasusaiSettingsTypes.js';

export interface LocalProviderConfig {
	endpoint: string;
	defaultModels: string[];
	recommendedModels: string[];
	capabilities: {
		supportsFIM: boolean;
		supportsTools: boolean;
		supportsVision: boolean;
		maxContextWindow: number;
	};
}

export const localProviderConfigs: Record<'ollama' | 'vLLM' | 'lmStudio', LocalProviderConfig> = {
	ollama: {
		endpoint: 'http://127.0.0.1:11434',
		defaultModels: [],
		recommendedModels: [
			'qwen2.5-coder:32b',      // Melhor para código geral
			'deepseek-coder:33b',     // Excelente em Python/JS
			'codellama:34b',          // Bom para múltiplas linguagens
			'starcoder2:15b',         // Rápido e eficiente
			'gemma2:27b',             // Modelo aberto da Google
			'mistral-large:123b',     // Alta qualidade
		],
		capabilities: {
			supportsFIM: true,
			supportsTools: true,
			supportsVision: false,
			maxContextWindow: 128000,
		}
	},
	vLLM: {
		endpoint: 'http://127.0.0.1:8000/v1',
		defaultModels: [],
		recommendedModels: [
			'Qwen/Qwen2.5-Coder-32B-Instruct',
			'deepseek-ai/DeepSeek-Coder-V2-Instruct',
			'meta-llama/Llama-3.1-70B-Instruct',
			'google/gemma-2-27b-it',
		],
		capabilities: {
			supportsFIM: true,
			supportsTools: true,
			supportsVision: false,
			maxContextWindow: 256000,
		}
	},
	lmStudio: {
		endpoint: 'http://127.0.0.1:1234/v1',
		defaultModels: [],
		recommendedModels: [
			'Qualquer modelo GGUF carregado',
		],
		capabilities: {
			supportsFIM: false, // Depende do modelo
			supportsTools: false,
			supportsVision: false,
			maxContextWindow: 32000, // Depende do modelo
		}
	}
};

export const getModelRecommendations = (providerName: ProviderName): string[] => {
	if (providerName === 'ollama') {
		return localProviderConfigs.ollama.recommendedModels;
	} else if (providerName === 'vLLM') {
		return localProviderConfigs.vLLM.recommendedModels;
	} else if (providerName === 'lmStudio') {
		return localProviderConfigs.lmStudio.recommendedModels;
	}
	return [];
};

export const getDefaultEndpoint = (providerName: ProviderName): string => {
	if (providerName === 'ollama') {
		return localProviderConfigs.ollama.endpoint;
	} else if (providerName === 'vLLM') {
		return localProviderConfigs.vLLM.endpoint;
	} else if (providerName === 'lmStudio') {
		return localProviderConfigs.lmStudio.endpoint;
	}
	throw new Error(`Provider ${providerName} is not a local provider`);
};

export const isLocalProvider = (providerName: ProviderName): boolean => {
	return ['ollama', 'vLLM', 'lmStudio'].includes(providerName);
};
