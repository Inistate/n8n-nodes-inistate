import type { INodeProperties } from 'n8n-workflow';

import { inistateApiRequest } from '../../../shared/GenericFunctions';
import { buildApiHeaders } from '../../../shared/Inistate.contract';
import { asDataObject, buildFormBody, MCP_FORM_URL } from '../../../shared/InistateRead.contract';
import { entryIdentifierTypeProperty, idMode, listMode } from './properties';
import type { EntryReadActionDefinition } from './types';

const formActivityProperty: INodeProperties = {
	displayName: 'Activity',
	name: 'formActivity',
	type: 'resourceLocator',
	default: { mode: 'list', value: 'create' },
	required: true,
	description: 'The activity whose form should be described',
	displayOptions: { show: { operation: ['getForm'] } },
	modes: [listMode('searchFormActivities'), idMode('activity', 'create')],
};

const formEntryIdProperty: INodeProperties = {
	displayName: 'Entry Identifier',
	name: 'formEntryId',
	type: 'string',
	default: '',
	placeholder: 'e.g. N8N-TEST00001 or 806548',
	description:
		'Optional entry to describe the form against, matching the selected identifier type, so the response carries its current values as defaults',
	displayOptions: { show: { operation: ['getForm'] } },
};

export const getFormAction: EntryReadActionDefinition = {
	operation: 'getForm',
	option: {
		name: 'Get Form',
		value: 'getForm',
		action: 'Get an activity form',
		description:
			'Describe the fields, types, options, and defaults an activity expects, so a workflow or agent can fill it in without guessing field names',
	},
	properties: [
		formActivityProperty,
		entryIdentifierTypeProperty('getForm'),
		formEntryIdProperty,
	],
	async execute({ itemIndex, moduleId, workspaceId }) {
		const entryIdentifierType = this.getNodeParameter(
			'entryIdentifierType',
			itemIndex,
			'documentId',
		) as 'documentId' | 'entryId';
		const response = await inistateApiRequest(
			this,
			{
				method: 'POST',
				url: MCP_FORM_URL,
				headers: buildApiHeaders(workspaceId, false),
				body: buildFormBody(
					moduleId,
					this.getNodeParameter('formActivity', itemIndex, '', { extractValue: true }),
					this.getNodeParameter('formEntryId', itemIndex, ''),
				),
			},
			{ entryIdentifierType },
		);

		return [asDataObject(response)];
	},
};
