import type { IExecuteFunctions, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { ActionRequestInput, InistateOperation } from '../../../shared/Inistate.contract';

export interface EntryActionContext {
	itemIndex: number;
	moduleId: string;
	workspaceId: string;
}

export interface EntryActionDefinition {
	operation: InistateOperation;
	option: INodePropertyOptions;
	properties: INodeProperties[];
	prepareInput(this: IExecuteFunctions, context: EntryActionContext): Promise<ActionRequestInput>;
}
