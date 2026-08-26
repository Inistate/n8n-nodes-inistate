import type { ResourceMapperValue } from 'n8n-workflow';

import { resolveMappedFieldValues } from '../../../shared/GenericFunctions';
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
	async prepareInput({ itemIndex, moduleId, workspaceId }) {
		const fields = this.getNodeParameter('fields', itemIndex) as ResourceMapperValue;
		return {
			operation: 'create',
			moduleId,
			fields: await resolveMappedFieldValues(
				this,
				workspaceId,
				moduleId,
				'create',
				fields,
			),
		};
	},
};
