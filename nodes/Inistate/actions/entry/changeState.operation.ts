import type { INodeProperties } from 'n8n-workflow';

import { documentIdProperty, listMode } from './properties';
import type { EntryActionDefinition } from './types';

const stateProperty: INodeProperties = {
	displayName: 'State',
	name: 'stateName',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The destination state name expected by the Inistate activity API',
	displayOptions: { show: { operation: ['changeState'] } },
	modes: [
		listMode('searchStates'),
		{
			displayName: 'By Name',
			name: 'name',
			type: 'string',
			placeholder: 'Completed',
			hint: 'Enter the exact Inistate state name',
		},
	],
};

export const changeStateAction: EntryActionDefinition = {
	operation: 'changeState',
	option: {
		name: 'Change State',
		value: 'changeState',
		action: 'Change an entry state',
		description: 'Move an entry to a selected state',
	},
	properties: [documentIdProperty('changeState'), stateProperty],
	async prepareInput({ itemIndex, moduleId }) {
		return {
			operation: 'changeState',
			moduleId,
			documentId: String(this.getNodeParameter('documentId', itemIndex)),
			stateName: String(this.getNodeParameter('stateName', itemIndex, '', { extractValue: true })),
		};
	},
};
