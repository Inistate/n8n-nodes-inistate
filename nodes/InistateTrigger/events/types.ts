import type { IHookFunctions, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { P0TriggerEvent } from '../../shared/Inistate.contract';

export interface TriggerEventDefinition {
	event: P0TriggerEvent;
	option: INodePropertyOptions;
	properties: INodeProperties[];
	getItem(this: IHookFunctions): string;
}
