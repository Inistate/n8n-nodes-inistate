import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';

import type { ActionRequestInput, InistateOperation } from '../../../shared/Inistate.contract';
import type { InistateReadOperation } from '../../../shared/InistateRead.contract';

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

/**
 * Read operations own their whole request: they target the MCP endpoints rather than the
 * single `/api/activity/` write route, and a collection read returns one output item per
 * record instead of one per input item.
 */
export interface EntryReadActionDefinition {
	operation: InistateReadOperation;
	option: INodePropertyOptions;
	properties: INodeProperties[];
	execute(this: IExecuteFunctions, context: EntryActionContext): Promise<IDataObject[]>;
}
