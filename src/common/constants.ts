/**
 * PegasusAI - Constantes Globais e Configuração de Marca
 * 
 * Este arquivo centraliza todas as constantes de identificação da marca
 * para garantir consistência em todo o projeto e facilitar o rebranding.
 */

export const APP_IDENTITY = {
  /** ID único da aplicação (usado em IPC, storage, etc.) */
  appId: 'ai.pegasus.ide',
  
  /** Nome completo da aplicação */
  name: 'PegasusAI',
  
  /** Nome curto para exibição em espaços limitados */
  shortName: 'Pegasus',
  
  /** Versão atual (semver) */
  version: '0.1.0',
  
  /** Codinome da versão */
  codename: 'Bellerophon',
  
  /** Descrição da aplicação */
  description: 'IDE Inteligente Offline-First com Integração Multi-Modelo',
  
  /** URL do site oficial */
  homepage: 'https://pegasusai.dev',
  
  /** ID do vendor/empresa */
  vendorId: 'ai.pegasus',
  
  /** Nome do vendor */
  vendorName: 'PegasusAI Foundation',
} as const;

export const PRODUCT_INFO = {
  /** Nome do produto para exibição na UI */
  displayName: 'PegasusAI',
  
  /** Nome interno usado em logs e debugging */
  internalName: 'PEGASUS_AI',
  
  /** Prefixo para chaves de storage e configurações */
  storagePrefix: 'pegasus',
  
  /** Schema de configuração */
  configSchema: 'pegasus-config-v1',
  
  /** Chave de registro no Windows (se aplicável) */
  windowsRegistryKey: 'SOFTWARE\\PegasusAI\\PegasusAI',
  
  /** Nome do executável */
  executableName: 'pegasusai',
  
  /** Bundle ID para macOS */
  darwinBundleIdentifier: 'ai.pegasus.ide',
  
  /** Categoria da aplicação */
  category: 'Development',
} as const;

export const BRANDING_COLORS = {
  /** Cor primária da marca (azul celeste inspirado em Pegasus) */
  primary: '#4A90E2',
  
  /** Cor secundária (roxo profundo) */
  secondary: '#6B5CE7',
  
  /** Cor de destaque (dourado) */
  accent: '#F5A623',
  
  /** Cor de fundo principal */
  background: '#1E1E2E',
  
  /** Cor de texto principal */
  textPrimary: '#FFFFFF',
  
  /** Cor de texto secundário */
  textSecondary: '#A0A0B0',
} as const;

export const PATHS = {
  /** Diretório de dados da aplicação */
  dataDir: 'pegasus-data',
  
  /** Diretório de configurações */
  configDir: 'pegasus-config',
  
  /** Diretório de cache */
  cacheDir: 'pegasus-cache',
  
  /** Diretório de logs */
  logsDir: 'pegasus-logs',
  
  /** Diretório de extensões */
  extensionsDir: 'pegasus-extensions',
  
  /** Diretório de memória e conhecimento */
  memoryDir: 'pegasus-memory',
} as const;

export const COMPATIBILITY = {
  /** ID do produto VS Code base */
  vscodeProductId: 'vscode',
  
  /** Versão mínima do VS Code compatível */
  minVSCodeVersion: '1.85.0',
  
  /** API version suportada */
  apiVersion: '1.85.0',
  
  /** Extensões incompatíveis (lista negra) */
  incompatibleExtensions: [] as string[],
  
  /** Extensões recomendadas */
  recommendedExtensions: [
    'pegasusai.theme-default',
    'pegasusai.snippets-core',
  ] as string[],
} as const;

export const FEATURES = {
  /** Habilitar modo offline por padrão */
  offlineFirst: true,
  
  /** Habilitar integração com provedores locais */
  localProviders: true,
  
  /** Habilitar sistema de memória */
  memorySystem: true,
  
  /** Habilitar grafo de conhecimento */
  knowledgeGraph: true,
  
  /** Habilitar orchestrator multi-modelo */
  multiModelOrchestrator: true,
  
  /** Habilitar marketplace de extensões */
  extensionMarketplace: false, // Desabilitado por padrão para offline-first
  
  /** Habilitar telemetria (desabilitado para privacidade) */
  telemetry: false,
} as const;

export type AppIdentity = typeof APP_IDENTITY;
export type ProductInfo = typeof PRODUCT_INFO;
export type BrandingColors = typeof BRANDING_COLORS;
export type Paths = typeof PATHS;
export type Compatibility = typeof COMPATIBILITY;
export type Features = typeof FEATURES;

// Exportações individuais para conveniência
export const {
  appId,
  name,
  shortName,
  version,
  codename,
  description,
  homepage,
  vendorId,
  vendorName,
} = APP_IDENTITY;

export const {
  displayName,
  internalName,
  storagePrefix,
  configSchema,
  executableName,
  darwinBundleIdentifier,
} = PRODUCT_INFO;

export const {
  primary,
  secondary,
  accent,
  background,
  textPrimary,
  textSecondary,
} = BRANDING_COLORS;
