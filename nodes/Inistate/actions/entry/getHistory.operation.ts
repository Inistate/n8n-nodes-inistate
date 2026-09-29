import type { IDataObject } from 'n8n-workflow';

import { inistateApiRequest } from '../../../shared/GenericFunctions';
import { buildApiHeaders } from '../../../shared/Inistate.contract';
import {
	buildHistoryBody,
	getResponsePage,
	MCP_HISTORY_URL,
} from '../../../shared/InistateRead.contract';
import { entryIdProperty, limitProperty, returnAllProperty } from './properties';
import type { EntryReadActionDefinition } from './types';

export const getHistoryAction: EntryReadActionDefinition = {
	operation: 'getHistory',
	option: {
		name: 'Get History',
		value: 'getHistory',
		action: 'Get entry history',
		description:
			'Retrieve the audit trail of an entry: every activity performed, every state change, and every comment, by humans and AI alike',
	},
	properties: [
		entryIdProperty('getHistory'),
		returnAllProperty('getHistory'),
		limitProperty('getHistory'),
	],
	async execute({ itemIndex, moduleId, workspaceId }) {
		const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
		const limit = returnAll
			? Number.POSITIVE_INFINITY
			: (this.getNodeParameter('limit', itemIndex, 50) as number);
		const entryId = this.getNodeParameter('entryId', itemIndex);
		const headers = buildApiHeaders(workspaceId, false);
		const histories: IDataObject[] = [];

		// The endpoint pages at a fixed server-side size, so a limit is applied after the
		// fact rather than pushed down into the request.
		for (let page = 0; ; page++) {
			const response = await inistateApiRequest(this, {
				method: 'POST',
				url: MCP_HISTORY_URL,
				headers,
				body: buildHistoryBody(moduleId, entryId, page),
			});
			const { items, hasMore } = getResponsePage(response, 'histories');
			histories.push(...items);

			if (!hasMore || items.length === 0 || histories.length >= limit) {
				break;
			}
		}

		return returnAll ? histories : histories.slice(0, limit);
	},
};
