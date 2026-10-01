import type { INodeProperties, ResourceMapperValue } from 'n8n-workflow';

import {
	getApiKeyPerformActivityReadOnlyValues,
	resolveMappedFieldValues,
} from '../../../shared/GenericFunctions';
import { usesOAuth } from '../../../shared/api';
import { documentIdProperty, fieldsProperty, idMode, listMode } from './properties';
import type { EntryActionDefinition } from './types';

const activityProperty: INodeProperties = {
	displayName: 'Activity',
	name: 'activityId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The activity to perform',
	displayOptions: { show: { operation: ['performActivity'] } },
	modes: [listMode('searchActivities'), idMode('activity', 'bd438...')],
};

export const performActivityAction: EntryActionDefinition = {
	operation: 'performActivity',
	option: {
		name: 'Perform Activity',
		value: 'performActivity',
		action: 'Perform an activity',
		description: 'Perform an activity with or without form fields',
	},
	properties: [
		documentIdProperty('performActivity'),
		activityProperty,
		fieldsProperty('performActivity'),
	],
	async prepareInput({ itemIndex, moduleId, workspaceId }) {
		const activityId = String(
			this.getNodeParameter('activityId', itemIndex, '', { extractValue: true }),
		);
		const documentId = String(this.getNodeParameter('documentId', itemIndex));
		const fields = this.getNodeParameter('fields', itemIndex) as ResourceMapperValue;
		const selectedFields = await resolveMappedFieldValues(
			this,
			workspaceId,
			moduleId,
			activityId,
			fields,
		);
		const readOnlyValues = usesOAuth(this)
			? {}
			: await getApiKeyPerformActivityReadOnlyValues(
					this,
					workspaceId,
					moduleId,
					activityId,
					documentId,
				);
		return {
			operation: 'performActivity',
			moduleId,
			documentId,
			activityId,
			fields: { ...selectedFields, ...readOnlyValues },
		};
	},
};
