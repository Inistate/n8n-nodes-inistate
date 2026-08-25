import type { ResourceMapperValue } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getCurrentEntryFields } from '../../../shared/GenericFunctions';
import { getMappedFieldValues } from '../../../shared/Inistate.contract';
import { documentIdProperty, fieldsProperty } from './properties';
import type { EntryActionDefinition } from './types';

export const updateEntryAction: EntryActionDefinition = {
	operation: 'update',
	option: {
		name: 'Update',
		value: 'update',
		action: 'Update an entry',
		description: 'Update an entry using its module edit form',
	},
	properties: [documentIdProperty('update'), fieldsProperty('update')],
	async prepareInput({ itemIndex, moduleId, workspaceId }) {
		const documentId = String(this.getNodeParameter('documentId', itemIndex));
		const fields = this.getNodeParameter('fields', itemIndex) as ResourceMapperValue;
		const selectedFields = getMappedFieldValues(fields);
		if (Object.keys(selectedFields).length === 0) {
			throw new NodeOperationError(
				this.getNode(),
				new Error('Select at least one field to update'),
				{
					itemIndex,
					description: 'Choose one or more Fields values before running the Update operation.',
				},
			);
		}

		const currentFields = await getCurrentEntryFields(this, workspaceId, moduleId, documentId);

		return {
			operation: 'update',
			moduleId,
			documentId,
			fields: { ...currentFields, ...selectedFields },
		};
	},
};
