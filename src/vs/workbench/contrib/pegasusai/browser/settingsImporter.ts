/*---------------------------------------------------------------------------------------------
 *  PegasusAI - VS Code Settings Importer
 *  Copyright (c) 2024 PegasusAI. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle';
import { ILogService } from '../../../../platform/log/common/log';
import { IFileService } from '../../../../platform/files/common/files';
import { URI } from '../../../../base/common/uri';
import { IStorageService } from '../../../../platform/storage/common/storage';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement';
import { CancellationToken } from '../../../../base/common/cancellation';
import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

export interface IVSCodeSettingsImporter {
	readonly _serviceBrand: undefined;
	
	/**
	 * Import settings from VS Code installation
	 */
	importFromVSCode(): Promise<ImportResult>;
	
	/**
	 * Import settings from a backup file
	 */
	importFromBackup(backupPath: string): Promise<ImportResult>;
	
	/**
	 * Export current settings to backup
	 */
	exportToBackup(backupPath?: string): Promise<string>;
	
	/**
	 * Get available VS Code settings locations
	 */
	findVSCodeInstallations(): Promise<VSCodeInstallation[]>;
}

export interface ImportResult {
	settingsImported: number;
	extensionsImported: number;
	snippetsImported: number;
	keybindingsImported: number;
	errors: string[];
}

export interface VSCodeInstallation {
	path: string;
	version?: string;
	type: 'stable' | 'insiders' | 'exploration';
	hasSettings: boolean;
	hasExtensions: boolean;
}

export class VSCodeSettingsImporter extends Disposable implements IVSCodeSettingsImporter {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService
	) {
		super();
		this.logService.info('[PegasusAI] VSCodeSettingsImporter initialized');
	}

	async importFromVSCode(): Promise<ImportResult> {
		try {
			this.logService.info('[PegasusAI] Starting import from VS Code...');

			const installations = await this.findVSCodeInstallations();
			
			if (installations.length === 0) {
				throw new Error('No VS Code installation found');
			}

			// Use the first stable installation or any available
			const targetInstall = installations.find(i => i.type === 'stable') || installations[0];
			
			this.logService.info(`[PegasusAI] Importing from: ${targetInstall.path}`);

			const result: ImportResult = {
				settingsImported: 0,
				extensionsImported: 0,
				snippetsImported: 0,
				keybindingsImported: 0,
				errors: []
			};

			// Import settings.json
			try {
				const settingsPath = join(targetInstall.path, 'User', 'settings.json');
				if (existsSync(settingsPath)) {
					const settingsContent = readFileSync(settingsPath, 'utf-8');
					const settings = JSON.parse(settingsContent);
					
					// Filter out VS Code specific settings that won't work in PegasusAI
					const filteredSettings = this.filterSettings(settings);
					
					// Merge with current settings
					for (const [key, value] of Object.entries(filteredSettings)) {
						await this.configurationService.updateValue(key, value);
						result.settingsImported++;
					}
					
					this.logService.info(`[PegasusAI] Imported ${result.settingsImported} settings`);
				}
			} catch (error) {
				result.errors.push(`Failed to import settings: ${error.message}`);
			}

			// Import keybindings.json
			try {
				const keybindingsPath = join(targetInstall.path, 'User', 'keybindings.json');
				if (existsSync(keybindingsPath)) {
					const keybindingsContent = readFileSync(keybindingsPath, 'utf-8');
					const keybindings = JSON.parse(keybindingsContent);
					
					// Store keybindings for later processing
					this.storageService.store('pegasusai.importedKeybindings', JSON.stringify(keybindings), 0, 0);
					result.keybindingsImported = Array.isArray(keybindings) ? keybindings.length : 0;
					
					this.logService.info(`[PegasusAI] Imported ${result.keybindingsImported} keybindings`);
				}
			} catch (error) {
				result.errors.push(`Failed to import keybindings: ${error.message}`);
			}

			// Import extensions list
			try {
				const extensionsPath = join(targetInstall.path, 'User', 'globalStorage', 'extensions.json');
				if (existsSync(extensionsPath)) {
					const extensionsContent = readFileSync(extensionsPath, 'utf-8');
					const extensions = JSON.parse(extensionsContent);
					
					// Store extension IDs for later installation
					const extensionIds = extensions.map((ext: any) => ext.id || ext);
					this.storageService.store('pegasusai.importedExtensions', JSON.stringify(extensionIds), 0, 0);
					result.extensionsImported = extensionIds.length;
					
					this.logService.info(`[PegasusAI] Found ${result.extensionsImported} extensions to install`);
				}
			} catch (error) {
				result.errors.push(`Failed to import extensions list: ${error.message}`);
			}

			// Import snippets
			try {
				const snippetsDir = join(targetInstall.path, 'User', 'snippets');
				if (existsSync(snippetsDir)) {
					// Read all snippet files
					const fs = require('fs');
					const path = require('path');
					const snippetFiles = fs.readdirSync(snippetsDir).filter(f => f.endsWith('.json'));
					
					for (const file of snippetFiles) {
						const snippetContent = readFileSync(path.join(snippetsDir, file), 'utf-8');
						const snippetName = file.replace('.json', '');
						
						this.storageService.store(`pegasusai.snippet.${snippetName}`, snippetContent, 0, 0);
						result.snippetsImported++;
					}
					
					this.logService.info(`[PegasusAI] Imported ${result.snippetsImported} snippet files`);
				}
			} catch (error) {
				result.errors.push(`Failed to import snippets: ${error.message}`);
			}

			this.logService.info('[PegasusAI] Import completed', result);
			return result;
		} catch (error) {
			this.logService.error('[PegasusAI] Failed to import from VS Code', error);
			throw error;
		}
	}

	async importFromBackup(backupPath: string): Promise<ImportResult> {
		try {
			this.logService.info(`[PegasusAI] Importing from backup: ${backupPath}`);

			const backupUri = URI.file(backupPath);
			
			if (!await this.fileService.exists(backupUri)) {
				throw new Error(`Backup file not found: ${backupPath}`);
			}

			const result: ImportResult = {
				settingsImported: 0,
				extensionsImported: 0,
				snippetsImported: 0,
				keybindingsImported: 0,
				errors: []
			};

			// Read and parse backup file
			const backupContent = await this.fileService.readFile(backupUri);
			const backup = JSON.parse(backupContent.value.toString());

			// Import settings
			if (backup.settings) {
				for (const [key, value] of Object.entries(backup.settings)) {
					await this.configurationService.updateValue(key, value);
					result.settingsImported++;
				}
			}

			// Import extensions
			if (backup.extensions) {
				this.storageService.store('pegasusai.importedExtensions', JSON.stringify(backup.extensions), 0, 0);
				result.extensionsImported = backup.extensions.length;
			}

			// Import keybindings
			if (backup.keybindings) {
				this.storageService.store('pegasusai.importedKeybindings', JSON.stringify(backup.keybindings), 0, 0);
				result.keybindingsImported = backup.keybindings.length;
			}

			// Import snippets
			if (backup.snippets) {
				for (const [name, content] of Object.entries(backup.snippets)) {
					this.storageService.store(`pegasusai.snippet.${name}`, content as string, 0, 0);
					result.snippetsImported++;
				}
			}

			this.logService.info('[PegasusAI] Backup import completed', result);
			return result;
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to import from backup: ${backupPath}`, error);
			throw error;
		}
	}

	async exportToBackup(backupPath?: string): Promise<string> {
		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const defaultPath = join(homedir(), `pegasusai-backup-${timestamp}.json`);
			const outputPath = backupPath || defaultPath;

			this.logService.info(`[PegasusAI] Exporting backup to: ${outputPath}`);

			// Gather current settings
			const allSettings = this.configurationService.getValue();
			const pegasusSettings = this.filterPegasusSettings(allSettings);

			// Get stored extensions
			const extensionsJson = this.storageService.get('pegasusai.installedExtensions', 0, '[]');
			const extensions = JSON.parse(extensionsJson);

			// Get stored keybindings
			const keybindingsJson = this.storageService.get('pegasusai.keybindings', 0, '[]');
			const keybindings = JSON.parse(keybindingsJson);

			// Gather snippets
			const snippets: Record<string, string> = {};
			// This would need to iterate through storage keys to find all snippets

			const backup = {
				version: '1.0',
				exportedAt: new Date().toISOString(),
				settings: pegasusSettings,
				extensions: extensions,
				keybindings: keybindings,
				snippets: snippets
			};

			// Write to file
			const outputUri = URI.file(outputPath);
			await this.fileService.writeFile(outputUri, Buffer.from(JSON.stringify(backup, null, 2)));

			this.logService.info(`[PegasusAI] Backup exported successfully: ${outputPath}`);
			return outputPath;
		} catch (error) {
			this.logService.error('[PegasusAI] Failed to export backup', error);
			throw error;
		}
	}

	async findVSCodeInstallations(): Promise<VSCodeInstallation[]> {
		const installations: VSCodeInstallation[] = [];
		const home = homedir();

		// Check common VS Code paths
		const pathsToCheck = [
			{
				path: join(home, '.config', 'Code'),
				type: 'stable' as const,
				name: 'VS Code Stable'
			},
			{
				path: join(home, '.config', 'Code - Insiders'),
				type: 'insiders' as const,
				name: 'VS Code Insiders'
			},
			{
				path: join(home, '.config', 'Code - Exploration'),
				type: 'exploration' as const,
				name: 'VS Code Exploration'
			},
			// Windows paths
			{
				path: join(home, 'AppData', 'Roaming', 'Code'),
				type: 'stable' as const,
				name: 'VS Code Stable (Windows)'
			},
			{
				path: join(home, 'AppData', 'Roaming', 'Code - Insiders'),
				type: 'insiders' as const,
				name: 'VS Code Insiders (Windows)'
			},
			// macOS paths
			{
				path: join(home, 'Library', 'Application Support', 'Code'),
				type: 'stable' as const,
				name: 'VS Code Stable (macOS)'
			},
			{
				path: join(home, 'Library', 'Application Support', 'Code - Insiders'),
				type: 'insiders' as const,
				name: 'VS Code Insiders (macOS)'
			}
		];

		for (const check of pathsToCheck) {
			if (existsSync(check.path)) {
				const hasSettings = existsSync(join(check.path, 'User', 'settings.json'));
				const hasExtensions = existsSync(join(check.path, 'extensions')) || 
									existsSync(join(check.path, 'User', 'globalStorage', 'extensions.json'));

				installations.push({
					path: check.path,
					type: check.type,
					hasSettings,
					hasExtensions
				});

				this.logService.info(`[PegasusAI] Found VS Code installation: ${check.name}`);
			}
		}

		return installations;
	}

	private filterSettings(settings: any): any {
		const filtered: any = {};
		
		// Settings to exclude (VS Code specific)
		const excludePatterns = [
			'team.',
			'github.',
			'ms-',
			'vscode.',
			'workbench.experimental.',
			'update.'
		];

		for (const [key, value] of Object.entries(settings)) {
			const shouldExclude = excludePatterns.some(pattern => key.startsWith(pattern));
			
			if (!shouldExclude) {
				filtered[key] = value;
			}
		}

		return filtered;
	}

	private filterPegasusSettings(settings: any): any {
		const pegasusSettings: any = {};
		
		// Only include pegasusai settings and common editor settings
		for (const [key, value] of Object.entries(settings)) {
			if (key.startsWith('pegasusai.') || 
				key.startsWith('editor.') || 
				key.startsWith('files.') ||
				key.startsWith('terminal.') ||
				key.startsWith('workbench.colorTheme')) {
				pegasusSettings[key] = value;
			}
		}

		return pegasusSettings;
	}
}
