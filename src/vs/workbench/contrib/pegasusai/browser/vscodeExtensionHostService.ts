/*---------------------------------------------------------------------------------------------
 *  PegasusAI - VS Code Extension Host Service
 *  Copyright (c) 2024 PegasusAI. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle';
import { Event, Emitter } from '../../../../base/common/event';
import { ILogService } from '../../../../platform/log/common/log';
import { IStorageService } from '../../../../platform/storage/common/storage';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile';
import { IExtensionManagementService, IExtensionGalleryService, InstallExtensionInfo, InstallOptions } from '../../../../platform/extensionManagement/common/extensionManagement';
import { IExtensionHostStarter, IExtensionHostMainService } from '../../common/extensionHost';
import { URI } from '../../../../base/common/uri';
import { Schemas } from '../../../../base/common/network';
import { IFileService } from '../../../../platform/files/common/files';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment';
import { IProductService } from '../../../../platform/product/common/productService';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration';
import { CancellationToken } from '../../../../base/common/cancellation';
import { ExtensionType, IExtensionDescription, IExtensionManifest } from '../../../../platform/extensions/common/extensions';
import { ExtensionKind } from '../../../common/extensionHostKeys';
import { isWeb } from '../../../../base/common/platform';
import { IRemoteAgentService } from '../../services/remote/common/remoteAgentService';
import { ILanguagePackService } from '../../../../platform/languagePacks/common/languagePacks';
import { TelemetryLevel } from '../../../../platform/telemetry/common/telemetry';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry';

export interface IVSCodeExtensionHostService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Start the extension host for VS Code extensions
	 */
	startExtensionHost(): Promise<void>;
	
	/**
	 * Load a .vsix extension file
	 */
	loadVSIXExtension(vsixPath: string): Promise<IExtensionDescription | null>;
	
	/**
	 * Install extension from OpenVSX registry
	 */
	installFromOpenVSX(extensionId: string, version?: string): Promise<IExtensionDescription | null>;
	
	/**
	 * Get list of installed extensions
	 */
	getInstalledExtensions(): Promise<IExtensionDescription[]>;
	
	/**
	 * Enable/disable extension
	 */
	toggleExtension(extensionId: string, enabled: boolean): Promise<void>;
	
	/**
	 * Uninstall extension
	 */
	uninstallExtension(extensionId: string): Promise<void>;
	
	/**
	 * Check if extension is compatible
	 */
	isExtensionCompatible(extensionId: string): Promise<boolean>;
}

export class VSCodeExtensionHostService extends Disposable implements IVSCodeExtensionHostService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeExtensions = this._register(new Emitter<void>());
	readonly onDidChangeExtensions = this._onDidChangeExtensions.event;

	private extensionHostStarted: boolean = false;
	private loadedExtensions: Map<string, IExtensionDescription> = new Map();

	constructor(
		@ILogService private readonly logService: ILogService,
		@IStorageService private readonly storageService: IStorageService,
		@IUserDataProfilesService private readonly userDataProfilesService: IUserDataProfilesService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IExtensionGalleryService private readonly extensionGalleryService: IExtensionGalleryService,
		@IFileService private readonly fileService: IFileService,
		@INativeEnvironmentService private readonly environmentService: INativeEnvironmentService,
		@IProductService private readonly productService: IProductService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@ILanguagePackService private readonly languagePackService: ILanguagePackService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		super();
		this.logService.info('[PegasusAI] VSCodeExtensionHostService initialized');
	}

	async startExtensionHost(): Promise<void> {
		if (this.extensionHostStarted) {
			this.logService.warn('[PegasusAI] Extension host already started');
			return;
		}

		try {
			this.logService.info('[PegasusAI] Starting VS Code extension host...');
			
			// Initialize extension host starter
			const extensionHostStarter = await this.getExtensionHostStarter();
			
			// Load all installed extensions
			const installedExtensions = await this.getInstalledExtensions();
			
			// Filter compatible extensions
			const compatibleExtensions = installedExtensions.filter(ext => 
				this.isExtensionKindCompatible(ext)
			);

			this.logService.info(`[PegasusAI] Loaded ${compatibleExtensions.length} compatible extensions`);
			
			// Start extension host with filtered extensions
			await extensionHostStarter.start({
				extensions: compatibleExtensions.map(ext => ({
					extensionLocation: ext.extensionLocation,
					identifier: ext.identifier,
					validatedManifest: ext.manifest
				}))
			});

			this.extensionHostStarted = true;
			this._onDidChangeExtensions.fire();
			
			this.logService.info('[PegasusAI] VS Code extension host started successfully');
		} catch (error) {
			this.logService.error('[PegasusAI] Failed to start extension host', error);
			throw error;
		}
	}

	async loadVSIXExtension(vsixPath: string): Promise<IExtensionDescription | null> {
		try {
			this.logService.info(`[PegasusAI] Loading VSIX extension: ${vsixPath}`);

			const vsixUri = URI.file(vsixPath);
			
			// Verify file exists
			if (!await this.fileService.exists(vsixUri)) {
				throw new Error(`VSIX file not found: ${vsixPath}`);
			}

			// Install the extension
			const installOptions: InstallOptions = {
				isMachineScoped: false,
				donotIncludePackAndDependencies: false,
				installGivenVersion: false,
				installPreReleaseVersion: false,
				context: { skipWalkthrough: true }
			};

			const installResult = await this.extensionManagementService.install(
				vsixUri,
				installOptions,
				CancellationToken.None
			);

			const extensionDesc = installResult.local;
			
			if (extensionDesc) {
				this.loadedExtensions.set(extensionDesc.identifier.id, extensionDesc);
				this._onDidChangeExtensions.fire();
				
				this.logService.info(`[PegasusAI] Successfully loaded extension: ${extensionDesc.manifest.displayName}`);
				return extensionDesc;
			}

			return null;
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to load VSIX: ${vsixPath}`, error);
			throw error;
		}
	}

	async installFromOpenVSX(extensionId: string, version?: string): Promise<IExtensionDescription | null> {
		try {
			this.logService.info(`[PegasusAI] Installing from OpenVSX: ${extensionId}${version ? '@' + version : ''}`);

			// Query OpenVSX gallery
			const queryResult = await this.extensionGalleryService.query({
				text: extensionId,
				pageSize: 1,
				sortBy: ['Relevance']
			}, CancellationToken.None);

			if (queryResult.total === 0) {
				throw new Error(`Extension not found in OpenVSX: ${extensionId}`);
			}

			const extension = queryResult.firstPage[0];
			
			// Install the extension
			const installInfo: InstallExtensionInfo = {
				extension: extension,
				version: version || extension.version
			};

			const installResult = await this.extensionManagementService.installFromGallery(
				extension,
				{
					isMachineScoped: false,
					donotIncludePackAndDependencies: false,
					installGivenVersion: !!version,
					installPreReleaseVersion: false,
					context: { skipWalkthrough: true }
				},
				CancellationToken.None
			);

			this.loadedExtensions.set(installResult.identifier.id, installResult);
			this._onDidChangeExtensions.fire();

			this.logService.info(`[PegasusAI] Successfully installed: ${installResult.manifest.displayName}`);
			return installResult;
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to install from OpenVSX: ${extensionId}`, error);
			throw error;
		}
	}

	async getInstalledExtensions(): Promise<IExtensionDescription[]> {
		try {
			const installed = await this.extensionManagementService.getInstalled(ExtensionType.User);
			const systemExtensions = await this.extensionManagementService.getInstalled(ExtensionType.System);
			
			const allExtensions = [...installed, ...systemExtensions];
			
			// Cache loaded extensions
			allExtensions.forEach(ext => {
				if (ext.manifest) {
					this.loadedExtensions.set(ext.identifier.id, ext);
				}
			});

			return allExtensions.filter(ext => ext.manifest !== undefined) as IExtensionDescription[];
		} catch (error) {
			this.logService.error('[PegasusAI] Failed to get installed extensions', error);
			return [];
		}
	}

	async toggleExtension(extensionId: string, enabled: boolean): Promise<void> {
		try {
			this.logService.info(`[PegasusAI] ${enabled ? 'Enabling' : 'Disabling'} extension: ${extensionId}`);

			const currentConfig = this.configurationService.getValue<{ [key: string]: boolean }>('extensions.disabledExtensions') || {};
			
			if (enabled) {
				// Remove from disabled list
				delete currentConfig[extensionId];
			} else {
				// Add to disabled list
				currentConfig[extensionId] = true;
			}

			await this.configurationService.updateValue('extensions.disabledExtensions', currentConfig);
			
			this._onDidChangeExtensions.fire();
			this.logService.info(`[PegasusAI] Extension ${extensionId} ${enabled ? 'enabled' : 'disabled'}`);
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to toggle extension: ${extensionId}`, error);
			throw error;
		}
	}

	async uninstallExtension(extensionId: string): Promise<void> {
		try {
			this.logService.info(`[PegasusAI] Uninstalling extension: ${extensionId}`);

			const installed = await this.getInstalledExtensions();
			const extension = installed.find(ext => ext.identifier.id === extensionId);

			if (!extension) {
				throw new Error(`Extension not found: ${extensionId}`);
			}

			await this.extensionManagementService.uninstall(extension, { donotIncludePack: false });
			
			this.loadedExtensions.delete(extensionId);
			this._onDidChangeExtensions.fire();
			
			this.logService.info(`[PegasusAI] Successfully uninstalled: ${extensionId}`);
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to uninstall extension: ${extensionId}`, error);
			throw error;
		}
	}

	async isExtensionCompatible(extensionId: string): Promise<boolean> {
		try {
			const extension = this.loadedExtensions.get(extensionId);
			
			if (!extension) {
				return false;
			}

			// Check engine compatibility
			const engineVersion = extension.manifest.engines?.vscode;
			if (engineVersion) {
				const currentVersion = this.productService.version;
				if (!this.isVersionCompatible(currentVersion, engineVersion)) {
					return false;
				}
			}

			// Check platform compatibility
			if (!this.isExtensionKindCompatible(extension)) {
				return false;
			}

			// Check dependencies
			if (extension.manifest.extensionDependencies) {
				for (const depId of extension.manifest.extensionDependencies) {
					const isDepCompatible = await this.isExtensionCompatible(depId.toLowerCase());
					if (!isDepCompatible) {
						return false;
					}
				}
			}

			return true;
		} catch (error) {
			this.logService.error(`[PegasusAI] Failed to check compatibility: ${extensionId}`, error);
			return false;
		}
	}

	private async getExtensionHostStarter(): Promise<IExtensionHostStarter> {
		// Implementation would integrate with actual extension host starter
		// This is a placeholder for the actual implementation
		throw new Error('getExtensionHostStarter not fully implemented');
	}

	private isVersionCompatible(currentVersion: string, requiredVersion: string): boolean {
		// Simple semver comparison
		const current = currentVersion.split('.').map(Number);
		const required = requiredVersion.replace('^', '').split('.').map(Number);
		
		for (let i = 0; i < Math.max(current.length, required.length); i++) {
			const curr = current[i] || 0;
			const req = required[i] || 0;
			
			if (curr > req) return true;
			if (curr < req) return false;
		}
		
		return true;
	}

	private isExtensionKindCompatible(extension: IExtensionDescription): boolean {
		const extensionKind = extension.manifest.extensionKind || ['workspace'];
		
		// For native PegasusAI, we support workspace extensions
		if (Array.isArray(extensionKind)) {
			return extensionKind.includes('workspace') || extensionKind.includes('ui');
		}
		
		return extensionKind === 'workspace' || extensionKind === 'ui';
	}
}
