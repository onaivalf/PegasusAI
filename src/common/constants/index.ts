/**
 * PEGASUSAI - Constantes de Marca e Configuração
 * Centraliza todas as referências de branding para rebranding seguro
 */

export const APP_CONSTANTS = {
  name: 'PegasusAI',
  version: '0.1.0',
  codename: 'Bellerophon',
  description: 'IDE PegasusAI - Offline-first AI-powered IDE',
  vendor: 'PegasusAI Team',
  website: 'https://pegasusai.dev',
  supportUrl: 'https://github.com/pegasusai/support',
  updateUrl: 'https://pegasusai.dev/updates',
  license: 'MIT'
} as const;

export const WINDOW_CONSTANTS = {
  title: 'PegasusAI',
  icon: 'resources/icons/pegasus-512.png',
  minWidth: 800,
  minHeight: 600,
  defaultWidth: 1200,
  defaultHeight: 800
} as const;

export const PROTOCOL_CONSTANTS = {
  scheme: 'pegasusai',
  extensions: ['.pegasus', '.pai']
} as const;

export const STORAGE_CONSTANTS = {
  appName: 'PegasusAI',
  userDataDir: 'PegasusAI',
  cacheDir: 'pegasusai-cache',
  dbFileName: 'pegasus.db'
} as const;

export const AI_CONSTANTS = {
  defaultProvider: 'local-ollama',
  maxContextLength: 8192,
  defaultModel: 'llama3.1:8b',
  fallbackModels: ['mistral:7b', 'codellama:7b'],
  offlineMode: true
} as const;

export type AppConstantKeys = keyof typeof APP_CONSTANTS;
export type WindowConstantKeys = keyof typeof WINDOW_CONSTANTS;
export type ProtocolConstantKeys = keyof typeof PROTOCOL_CONSTANTS;
export type StorageConstantKeys = keyof typeof STORAGE_CONSTANTS;
export type AIConstantKeys = keyof typeof AI_CONSTANTS;
