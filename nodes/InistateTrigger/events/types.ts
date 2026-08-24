import type { IHookFunctions, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { InistateTriggerEvent } from '../../shared/Inistate.contract';

export interface TriggerSubscriptionSelection {
	item: string;
	trigger: string;
	type: string;
}

export interface TriggerEventDefinition {
	event: InistateTriggerEvent;
	option: INodePropertyOptions;
	properties: INodeProperties[];
	getSubscription(this: IHookFunctions): TriggerSubscriptionSelection;
}
