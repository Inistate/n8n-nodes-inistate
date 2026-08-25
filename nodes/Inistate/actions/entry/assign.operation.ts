import type { INodeProperties } from 'n8n-workflow';

import { documentIdProperty, listMode } from './properties';
import type { EntryActionDefinition } from './types';

const userProperty: INodeProperties = {
	displayName: 'User',
	name: 'username',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Inistate user to assign, represented by username',
	displayOptions: { show: { operation: ['assign'] } },
	modes: [
		listMode('searchUsers'),
		{
			displayName: 'By Username',
			name: 'username',
			type: 'string',
			placeholder: 'e.g. user@example.com',
			hint: 'Enter the exact Inistate username',
		},
	],
};

const dueDateProperty: INodeProperties = {
	displayName: 'Due Date',
	name: 'dueDate',
	type: 'dateTime',
	default: '',
	description: 'Optional assignment due date',
	displayOptions: { show: { operation: ['assign'] } },
};

export const assignEntryAction: EntryActionDefinition = {
	operation: 'assign',
	option: {
		name: 'Assign',
		value: 'assign',
		action: 'Assign an entry',
		description: 'Assign an Inistate user and optionally set a due date',
	},
	properties: [documentIdProperty('assign'), userProperty, dueDateProperty],
	async prepareInput({ itemIndex, moduleId }) {
		return {
			operation: 'assign',
			moduleId,
			documentId: String(this.getNodeParameter('documentId', itemIndex)),
			username: String(this.getNodeParameter('username', itemIndex, '', { extractValue: true })),
			dueDate: String(this.getNodeParameter('dueDate', itemIndex, '')),
		};
	},
};
