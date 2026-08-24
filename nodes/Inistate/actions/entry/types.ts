import type { IExecuteFunctions, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { ActionRequestInput, P0Operation } from '../../../shared/Inistate.contract';

export interface EntryActionContext {
	itemIndex: number;
	moduleId: string;
	workspaceId: string;
}

export interface EntryActionDefinition {
	operation: P0Operation;
	option: INodePropertyOptions;
	properties: INodeProperties[];
	prepareInput(this: IExecuteFunctions, context: EntryActionContext): Promise<ActionRequestInput>;
}
