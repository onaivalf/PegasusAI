/*--------------------------------------------------------------------------------------
 *  Copyright 2025 PegasusAI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// register quick edit (Ctrl+K)
import './quickEditActions.js'


// register Autocomplete
import './autocompleteService.js'

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './pegasusaiSettingsPane.js'

// register css
import './media/pegasusai.css'

// update (frontend part, also see platform/)
import './pegasusaiUpdateActions.js'

import './convertToLLMMessageWorkbenchContrib.js'

// tools
import './toolsService.js'
import './terminalToolService.js'

// register Thread History
import './chatThreadService.js'

// ping
import './metricsPollService.js'

// helper services
import './helperServices/consistentItemService.js'

// register selection helper
import './pegasusaiSelectionHelperWidget.js'

// ============================================
// FASE 5: ANTI-GRAVITY SKILLS INTEGRATION
// ============================================
import { FractalSkillEngine } from '../common/fractalSkillEngine';
import { AntiGravitySkillsRepo } from '../common/antiGravitySkillsRepo';
import { SkillMarketplaceService } from '../common/skillMarketplaceService';

// Initialize Anti-Gravity Skills System
const logger = { 
  info: (msg: string) => console.log('[PegasusAI]', msg),
  warn: (msg: string) => console.warn('[PegasusAI]', msg),
  error: (msg: string, err?: any) => console.error('[PegasusAI]', msg, err)
};

const skillEngine = new FractalSkillEngine(logger as any);
const skillsRepo = new AntiGravitySkillsRepo(logger as any);
const marketplaceService = new SkillMarketplaceService(logger as any);

// Load all 573 Anti-Gravity skills
const allSkills = skillsRepo.getAllSkills();
for (const skill of allSkills) {
  skillEngine.registerSkill(skill);
}

console.log(`[PegasusAI] Phase 5 Complete: ${skillEngine.getSkillCount()} skills loaded and ready`);

// register tooltip service
import './tooltipService.js'

// register onboarding service
import './pegasusaiOnboardingService.js'

// register misc service
import './miscWokrbenchContrib.js'

// register file service (for explorer context menu)
import './fileService.js'

// register source control management
import './pegasusaiSCMService.js'

// ============================================
// FASE 6: VS CODE COMPATIBILITY - FINAL REGISTRATION
// ============================================
import { VscodeExtensionHostService } from './vscodeExtensionHostService';
import { LspBridgeService } from './lspBridgeService';
import { SettingsImporter } from './settingsImporter';
import { JsonRpcHandler } from '../common/jsonRpcHandler';

// Initialize Extension Host Service
const extensionHostService = new VscodeExtensionHostService();
extensionHostService.initialize();

// Initialize LSP Bridge with robust JSON-RPC handler
const lspBridge = new LspBridgeService();
const jsonRpcHandler = new JsonRpcHandler();
lspBridge.setJsonRpcHandler(jsonRpcHandler);
lspBridge.initialize();

// Initialize Settings Importer
const settingsImporter = new SettingsImporter();

console.log('[PegasusAI] Phase 6 Complete: VS Code Compatibility Layer Active');
console.log('[PegasusAI] - Extension Host: Ready');
console.log('[PegasusAI] - LSP Bridge: Ready with JSON-RPC 2.0');
console.log('[PegasusAI] - Settings Importer: Ready');

// ---------- common (unclear if these actually need to be imported, because they're already imported wherever they're used) ----------

// llmMessage
import '../common/sendLLMMessageService.js'

// pegasusaiSettings
import '../common/pegasusaiSettingsService.js'

// refreshModel
import '../common/refreshModelService.js'

// metrics
import '../common/metricsService.js'

// updates
import '../common/pegasusaiUpdateService.js'

// model service
import '../common/pegasusaiModelService.js'

// Local LLM Provider
import '../common/localProviderConfig.js'

// Edit Engine
import './localEditEngine.js'

// Permission Service
import '../common/permissionService.js'

// Terminal Integration
import './terminalIntegration.js'

// File System Service
import '../common/fileSystem/fileSystemService.js'

// Terminal Service
import '../common/terminal/terminalService.js'

// Context Awareness Service
import '../common/contextAwareness/contextAwarenessService.js'

// ============================================
// FASE 6: VS CODE COMPATIBILITY INTEGRATION
// ============================================
// VS Code Extension Host - Load and manage .vsix extensions
import './vscodeExtensionHostService.js'

// LSP Bridge - Native Language Server Protocol support
import './lspBridgeService.js'

// Settings Importer - Migrate VS Code settings and themes
import './settingsImporter.js'

console.log('[PegasusAI] Phase 6 Complete: VS Code compatibility layer loaded');
