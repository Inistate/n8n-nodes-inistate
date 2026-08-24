import { documentIdProperty } from './properties';
import type { EntryActionDefinition } from './types';

export const duplicateEntryAction: EntryActionDefinition = {
	operation: 'duplicate',
	option: {
		name: 'Duplicate',
		value: 'duplicate',
		action: 'Duplicate an entry',
		description: 'Create a copy of an existing entry',
	},
	properties: [documentIdProperty('duplicate')],
	async prepareInput({ itemIndex, moduleId }) {
		return {
			operation: 'duplicate',
			moduleId,
			documentId: String(this.getNodeParameter('documentId', itemIndex)),
		};
	},
};
