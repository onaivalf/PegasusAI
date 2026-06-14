/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { PegasusAICheckUpdateRespose } from './pegasusaiUpdateServiceTypes.js';



export interface IPegasusAIUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<PegasusAICheckUpdateRespose>;
}


export const IPegasusAIUpdateService = createDecorator<IPegasusAIUpdateService>('PegasusAIUpdateService');


// implemented by calling channel
export class PegasusAIUpdateService implements IPegasusAIUpdateService {

	readonly _serviceBrand: undefined;
	private readonly pegasusaiUpdateService: IPegasusAIUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.pegasusaiUpdateService = ProxyChannel.toService<IPegasusAIUpdateService>(mainProcessService.getChannel('pegasusai-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IPegasusAIUpdateService['check'] = async (explicit) => {
		const res = await this.pegasusaiUpdateService.check(explicit)
		return res
	}
}

registerSingleton(IPegasusAIUpdateService, PegasusAIUpdateService, InstantiationType.Eager);


