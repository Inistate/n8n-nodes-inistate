import type { ResourceMapperValue } from 'n8n-workflow';

import { fieldsProperty } from './properties';
import type { EntryActionDefinition } from './types';

export const createEntryAction: EntryActionDefinition = {
	operation: 'create',
	option: {
		name: 'Create',
		value: 'create',
		action: 'Create an entry',
		description: 'Create an entry using its module form',
	},
	properties: [fieldsProperty('create')],
	async prepareInput({ itemIndex, moduleId }) {
		return {
			operation: 'create',
			moduleId,
			fields: this.getNodeParameter('fields', itemIndex) as ResourceMapperValue,
		};
	},
};
