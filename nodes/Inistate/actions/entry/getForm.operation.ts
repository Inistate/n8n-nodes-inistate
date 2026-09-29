import type { INodeProperties } from 'n8n-workflow';

import { inistateApiRequest } from '../../../shared/GenericFunctions';
import { buildApiHeaders } from '../../../shared/Inistate.contract';
import { asDataObject, buildFormBody, MCP_FORM_URL } from '../../../shared/InistateRead.contract';
import { idMode, listMode } from './properties';
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
	displayName: 'Entry ID',
	name: 'formEntryId',
	type: 'string',
	default: '',
	placeholder: 'e.g. N8N-TEST00001',
	description:
		'Optional entry to describe the form against, so the response carries the current values of that entry as defaults. Accepts the document ID or the numeric entry ID.',
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
	properties: [formActivityProperty, formEntryIdProperty],
	async execute({ itemIndex, moduleId, workspaceId }) {
		const response = await inistateApiRequest(this, {
			method: 'POST',
			url: MCP_FORM_URL,
			headers: buildApiHeaders(workspaceId, false),
			body: buildFormBody(
				moduleId,
				this.getNodeParameter('formActivity', itemIndex, '', { extractValue: true }),
				this.getNodeParameter('formEntryId', itemIndex, ''),
			),
		});

		return [asDataObject(response)];
	},
};
