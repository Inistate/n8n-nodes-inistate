import type { INodeProperties } from 'n8n-workflow';

import { documentIdProperty } from './properties';
import type { EntryActionDefinition } from './types';

const deleteWarningProperty: INodeProperties = {
	displayName: 'This permanently deletes the selected entry and cannot be undone',
	name: 'deleteWarning',
	type: 'notice',
	default: '',
	displayOptions: { show: { operation: ['delete'] } },
};

export const deleteEntryAction: EntryActionDefinition = {
	operation: 'delete',
	option: {
		name: 'Delete',
		value: 'delete',
		action: 'Delete an entry',
		description: 'Permanently delete an entry; this cannot be undone',
	},
	properties: [deleteWarningProperty, documentIdProperty('delete')],
	async prepareInput({ itemIndex, moduleId }) {
		return {
			operation: 'delete',
			moduleId,
			documentId: String(this.getNodeParameter('documentId', itemIndex)),
		};
	},
};
