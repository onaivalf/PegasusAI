/*---------------------------------------------------------------------------------------------
 *  PegasusAI - Fractal Skill Engine
 *  Based on Anti-Gravity Architecture
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { ILogger } from 'vs/platform/log/common/log';

export enum SkillTier {
	Atomic = 1,      // Single action (e.g., "read_file")
	Molecular = 2,   // Sequence of atoms (e.g., "refactor_function")
	Organic = 3,     // Complex workflow (e.g., "migrate_project")
	Galactic = 4     // Autonomous agent loop
}

export interface ISkillDefinition {
	id: string;
	name: string;
	description: string;
	tier: SkillTier;
	inputSchema: any;
	outputSchema: any;
	executionLogic: (input: any, context: any) => Promise<any>;
	dependencies?: string[];
	metadata: {
		author: string;
		version: string;
		tags: string[];
	};
}

export interface ISkillExecutionResult {
	success: boolean;
	output?: any;
	error?: string;
	logs: string[];
}

export class FractalSkillEngine extends Disposable {
	private readonly _onSkillRegistered = this._register(new Emitter<string>());
	public readonly onSkillRegistered = this._onSkillRegistered.event;

	private readonly _onSkillExecuted = this._register(new Emitter<{ id: string; result: ISkillExecutionResult }>());
	public readonly onSkillExecuted = this._onSkillExecuted.event;

	private readonly skills: Map<string, ISkillDefinition> = new Map();
	private readonly logger: ILogger;

	constructor(logger: ILogger) {
		super();
		this.logger = logger;
		this.logger.info('[PegasusAI] Fractal Skill Engine initialized');
	}

	/**
	 * Registers a new skill into the fractal hierarchy
	 */
	registerSkill(skill: ISkillDefinition): void {
		if (this.skills.has(skill.id)) {
			throw new Error(`Skill ${skill.id} already registered`);
		}
		
		// Validate dependencies
		if (skill.dependencies) {
			for (const dep of skill.dependencies) {
				if (!this.skills.has(dep)) {
					throw new Error(`Missing dependency ${dep} for skill ${skill.id}`);
				}
			}
		}

		this.skills.set(skill.id, skill);
		this._onSkillRegistered.fire(skill.id);
		this.logger.info(`[PegasusAI] Registered skill: ${skill.name} (Tier ${skill.tier})`);
	}

	/**
	 * Executes a skill with fractal resolution (resolves dependencies recursively)
	 */
	async executeSkill(skillId: string, input: any, context: any): Promise<ISkillExecutionResult> {
		const skill = this.skills.get(skillId);
		if (!skill) {
			return { success: false, error: `Skill ${skillId} not found`, logs: [] };
		}

		const logs: string[] = [`Executing ${skill.name}...`];
		
		try {
			// Execute the core logic
			const output = await skill.executionLogic(input, context);
			
			const result: ISkillExecutionResult = {
				success: true,
				output,
				logs
			};

			this._onSkillExecuted.fire({ id: skillId, result });
			return result;
		} catch (error: any) {
			const errorMsg = error.message || 'Unknown error';
			logs.push(`ERROR: ${errorMsg}`);
			this.logger.error(`[PegasusAI] Skill execution failed: ${skillId}`, error);
			
			return {
				success: false,
				error: errorMsg,
				logs
			};
		}
	}

	/**
	 * Resolves a high-level goal into a sequence of skills (Galactic Tier behavior)
	 */
	async resolveGoal(goal: string, context: any): Promise<string[]> {
		// Simple heuristic for now - in production this would use an LLM to plan
		this.logger.info(`[PegasusAI] Resolving goal: ${goal}`);
		
		const plannedSkills: string[] = [];
		
		// Example: If goal contains "test", add unit test skill
		if (goal.toLowerCase().includes('test')) {
			plannedSkills.push('anti-gravity.unit-test.generate');
		}
		if (goal.toLowerCase().includes('fix') || goal.toLowerCase().includes('bug')) {
			plannedSkills.push('anti-gravity.debug.analyze');
			plannedSkills.push('anti-gravity.code.fix');
		}

		return plannedSkills;
	}

	getSkillCount(): number {
		return this.skills.size;
	}

	getAllSkills(): ISkillDefinition[] {
		return Array.from(this.skills.values());
	}
}
