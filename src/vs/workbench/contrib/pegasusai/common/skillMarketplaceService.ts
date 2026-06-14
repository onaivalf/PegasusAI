/*---------------------------------------------------------------------------------------------
 *  PegasusAI - Skill Marketplace Service
 *  Manages installation, updates, and discovery of skills
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { ILogger } from 'vs/platform/log/common/log';
import { ISkillDefinition } from './fractalSkillEngine';

export interface ISkillPackage {
	id: string;
	name: string;
	version: string;
	description: string;
	author: string;
	downloadUrl: string;
	checksum: string;
	dependencies: string[];
	skills: ISkillDefinition[];
}

export class SkillMarketplaceService extends Disposable {
	private readonly _onSkillInstalled = this._register(new Emitter<string>());
	public readonly onSkillInstalled = this._onSkillInstalled.event;

	private readonly installedSkills: Map<string, ISkillPackage> = new Map();
	private readonly logger: ILogger;

	constructor(logger: ILogger) {
		super();
		this.logger = logger;
		this.logger.info('[PegasusAI] Skill Marketplace initialized');
	}

	/**
	 * Discovers available skills from the marketplace
	 */
	async discoverSkills(query?: string): Promise<ISkillPackage[]> {
		this.logger.info(`[PegasusAI] Discovering skills${query ? `: ${query}` : ''}`);
		
		// Mock marketplace response - in production this would call an API
		const mockPackages: ISkillPackage[] = [
			{
				id: 'com.pegasusai.python-tools',
				name: 'Python Development Tools',
				version: '1.2.0',
				description: 'Complete Python development skillset',
				author: 'PegasusAI Team',
				downloadUrl: 'https://marketplace.pegasusai.dev/skills/python-tools',
				checksum: 'abc123',
				dependencies: [],
				skills: []
			},
			{
				id: 'com.pegasusai.react-expert',
				name: 'React Expert Skills',
				version: '2.0.1',
				description: 'Advanced React patterns and optimizations',
				author: 'Community',
				downloadUrl: 'https://marketplace.pegasusai.dev/skills/react-expert',
				checksum: 'def456',
				dependencies: ['com.pegasusai.javascript-basics'],
				skills: []
			},
			{
				id: 'com.pegasusai.docker-helper',
				name: 'Docker Helper',
				version: '1.0.5',
				description: 'Containerization and Docker workflows',
				author: 'DevOps Community',
				downloadUrl: 'https://marketplace.pegasusai.dev/skills/docker-helper',
				checksum: 'ghi789',
				dependencies: [],
				skills: []
			}
		];

		if (query) {
			return mockPackages.filter(pkg => 
				pkg.name.toLowerCase().includes(query.toLowerCase()) ||
				pkg.description.toLowerCase().includes(query.toLowerCase())
			);
		}

		return mockPackages;
	}

	/**
	 * Installs a skill package from the marketplace
	 */
	async installSkill(packageId: string): Promise<boolean> {
		this.logger.info(`[PegasusAI] Installing skill package: ${packageId}`);

		if (this.installedSkills.has(packageId)) {
			this.logger.warn(`[PegasusAI] Skill ${packageId} already installed`);
			return false;
		}

		// Simulate download and installation
		try {
			// In production: download from URL, verify checksum, extract
			const mockPackage: ISkillPackage = {
				id: packageId,
				name: 'Installed Skill',
				version: '1.0.0',
				description: 'Successfully installed',
				author: 'Unknown',
				downloadUrl: '',
				checksum: '',
				dependencies: [],
				skills: []
			};

			this.installedSkills.set(packageId, mockPackage);
			this._onSkillInstalled.fire(packageId);
			
			this.logger.info(`[PegasusAI] Successfully installed ${packageId}`);
			return true;
		} catch (error: any) {
			this.logger.error(`[PegasusAI] Failed to install ${packageId}: ${error.message}`);
			return false;
		}
	}

	/**
	 * Uninstalls a skill package
	 */
	async uninstallSkill(packageId: string): Promise<boolean> {
		this.logger.info(`[PegasusAI] Uninstalling skill package: ${packageId}`);

		if (!this.installedSkills.has(packageId)) {
			this.logger.warn(`[PegasusAI] Skill ${packageId} not found`);
			return false;
		}

		// Check for dependents
		for (const [id, pkg] of this.installedSkills.entries()) {
			if (pkg.dependencies.includes(packageId)) {
				this.logger.error(`[PegasusAI] Cannot uninstall ${packageId}: ${id} depends on it`);
				return false;
			}
		}

		this.installedSkills.delete(packageId);
		this.logger.info(`[PegasusAI] Successfully uninstalled ${packageId}`);
		return true;
	}

	/**
	 * Lists all installed skills
	 */
	getInstalledSkills(): ISkillPackage[] {
		return Array.from(this.installedSkills.values());
	}

	/**
	 * Checks for updates for installed skills
	 */
	async checkForUpdates(): Promise<{ packageId: string; currentVersion: string; latestVersion: string }[]> {
		this.logger.info('[PegasusAI] Checking for skill updates...');
		
		const updates: { packageId: string; currentVersion: string; latestVersion: string }[] = [];
		
		// In production, compare with marketplace versions
		for (const [id, pkg] of this.installedSkills.entries()) {
			// Mock update check
			const latestVersion = '9.9.9'; // Always show update available for demo
			if (latestVersion !== pkg.version) {
				updates.push({
					packageId: id,
					currentVersion: pkg.version,
					latestVersion
				});
			}
		}

		this.logger.info(`[PegasusAI] Found ${updates.length} updates available`);
		return updates;
	}
}
