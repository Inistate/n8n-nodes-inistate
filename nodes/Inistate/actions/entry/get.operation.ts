import { inistateApiRequest } from '../../../shared/GenericFunctions';
import { buildApiHeaders } from '../../../shared/Inistate.contract';
import { asDataObject, buildEntryBody, MCP_ENTRY_URL } from '../../../shared/InistateRead.contract';
import { entryIdProperty } from './properties';
import type { EntryReadActionDefinition } from './types';

export const getEntryAction: EntryReadActionDefinition = {
	operation: 'get',
	option: {
		name: 'Get',
		value: 'get',
		action: 'Get an entry',
		description:
			'Retrieve one entry with its field values, current state, and the activities that are legal from that state. Call this before Perform Activity to see what the entry allows.',
	},
	properties: [entryIdProperty('get')],
	async execute({ itemIndex, moduleId, workspaceId }) {
		const response = await inistateApiRequest(this, {
			method: 'POST',
			url: MCP_ENTRY_URL,
			headers: buildApiHeaders(workspaceId, false),
			body: buildEntryBody(moduleId, this.getNodeParameter('entryId', itemIndex)),
		});

		return [asDataObject(response)];
	},
};
