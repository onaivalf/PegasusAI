/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { IMarkdownString } from '../../../../../base/common/htmlContent.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ContextKeyExpression } from '../../../../../platform/contextkey/common/contextkey.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';

export const enum ChatViewsWelcomeExtensions {
	ChatViewsWelcomeRegistry = 'workbench.registry.chat.viewsWelcome',
}

export interface IChatViewsWelcomeDescriptor {
	icon?: ThemeIcon;
	title: string;
	content: IMarkdownString | ((disposables: DisposableStore) => HTMLElement);
	when: ContextKeyExpression;
}

export interface IChatViewsWelcomeContributionRegistry {
	onDidChange: Event<pegasusai>;
	get(): ReadonlyArray<IChatViewsWelcomeDescriptor>;
	register(descriptor: IChatViewsWelcomeDescriptor): pegasusai;
}

class ChatViewsWelcomeContributionRegistry implements IChatViewsWelcomeContributionRegistry {
	private readonly descriptors: IChatViewsWelcomeDescriptor[] = [];
	private readonly _onDidChange = new Emitter<pegasusai>();
	public readonly onDidChange: Event<pegasusai> = this._onDidChange.event;

	public register(descriptor: IChatViewsWelcomeDescriptor): pegasusai {
		this.descriptors.push(descriptor);
		this._onDidChange.fire();
	}

	public get(): ReadonlyArray<IChatViewsWelcomeDescriptor> {
		return this.descriptors;
	}
}

export const chatViewsWelcomeRegistry = new ChatViewsWelcomeContributionRegistry();
Registry.add(ChatViewsWelcomeExtensions.ChatViewsWelcomeRegistry, chatViewsWelcomeRegistry);
