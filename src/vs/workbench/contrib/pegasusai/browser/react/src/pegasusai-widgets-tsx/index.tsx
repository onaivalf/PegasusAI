/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { PegasusAICommandBarMain } from './PegasusAICommandBar.js'
import { PegasusAISelectionHelperMain } from './PegasusAISelectionHelper.js'

export const mountPegasusAICommandBar = mountFnGenerator(PegasusAICommandBarMain)

export const mountPegasusAISelectionHelper = mountFnGenerator(PegasusAISelectionHelperMain)

