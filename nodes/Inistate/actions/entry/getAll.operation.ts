import type { IDataObject, INodeProperties } from 'n8n-workflow';

import { inistateApiRequest } from '../../../shared/GenericFunctions';
import { buildApiHeaders } from '../../../shared/Inistate.contract';
import {
	buildListBody,
	getResponsePage,
	MAX_LIST_PAGE_SIZE,
	MCP_LIST_URL,
	type ListRequestOptions,
} from '../../../shared/InistateRead.contract';
import { limitProperty, returnAllProperty } from './properties';
import type { EntryReadActionDefinition } from './types';

const listingProperty: INodeProperties = {
	displayName: 'Listing Name or ID',
	name: 'listing',
	type: 'options',
	default: '',
	description:
		'The module listing to query. Leave empty for Everything. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	typeOptions: {
		loadOptionsDependsOn: ['workspaceId.value', 'moduleId.value'],
		loadOptionsMethod: 'getListings',
	},
	displayOptions: { show: { operation: ['getAll'] } },
};

const optionsProperty: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	default: {},
	placeholder: 'Add option',
	displayOptions: { show: { operation: ['getAll'] } },
	options: [
		{
			displayName: 'Assignee',
			name: 'assignee',
			type: 'string',
			default: '',
			description: 'Only return entries assigned to a user whose name contains this value',
		},
		{
			displayName: 'Created After',
			name: 'createdAfter',
			type: 'dateTime',
			default: '',
			description: 'Only return entries created on or after this moment',
		},
		{
			displayName: 'Created Before',
			name: 'createdBefore',
			type: 'dateTime',
			default: '',
			description: 'Only return entries created on or before this moment',
		},
		{
			displayName: 'Created By',
			name: 'createdBy',
			type: 'string',
			default: '',
			description: 'Only return entries whose creator contains this value',
		},
		{
			displayName: 'Document ID',
			name: 'documentId',
			type: 'string',
			default: '',
			description: 'Only return entries whose document ID contains this value',
		},
		{
			displayName: 'Fields',
			name: 'fields',
			type: 'string',
			default: '',
			placeholder: 'e.g. Title,Status,Amount',
			description:
				'Comma-separated field display names to return. Entry ID and document ID are always included. Narrowing the projection is the biggest payload saving.',
		},
		{
			displayName: 'Filters',
			name: 'filters',
			type: 'json',
			default: '',
			placeholder: 'e.g. {"Status": "Active"}',
			description:
				'Module-specific field filters as JSON. Supports operators and nested and/or, for example {"or": [{"Status": "Active"}, {"Priority": "High"}]}.',
		},
		{
			displayName: 'Search',
			name: 'search',
			type: 'string',
			default: '',
			description: 'Wildcard search across the text-like fields of the module',
		},
		{
			displayName: 'Sort By',
			name: 'sortBy',
			type: 'string',
			default: '',
			placeholder: 'e.g. Updated Date',
			description: 'Field display name to sort by',
		},
		{
			displayName: 'Sort Direction',
			name: 'sortDirection',
			type: 'options',
			default: 'asc',
			description: 'Direction to sort in',
			options: [
				{ name: 'Ascending', value: 'asc' },
				{ name: 'Descending', value: 'desc' },
			],
		},
		{
			displayName: 'State Name or ID',
			name: 'state',
			type: 'options',
			default: '',
			description:
				'Only return entries in this state. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			typeOptions: {
				loadOptionsDependsOn: ['workspaceId.value', 'moduleId.value'],
				loadOptionsMethod: 'getStates',
			},
		},
		{
			displayName: 'Updated After',
			name: 'updatedAfter',
			type: 'dateTime',
			default: '',
			description: 'Only return entries last changed on or after this moment',
		},
		{
			displayName: 'Updated Before',
			name: 'updatedBefore',
			type: 'dateTime',
			default: '',
			description: 'Only return entries last changed on or before this moment',
		},
	],
};

export const getAllEntriesAction: EntryReadActionDefinition = {
	operation: 'getAll',
	option: {
		name: 'Get Many',
		value: 'getAll',
		action: 'Get many entries',
		description:
			'Query entries in a module, optionally scoped to a listing and filtered by state, assignee, dates, or field values',
	},
	properties: [
		listingProperty,
		returnAllProperty('getAll'),
		limitProperty('getAll'),
		optionsProperty,
	],
	async execute({ itemIndex, moduleId, workspaceId }) {
		const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
		const limit = returnAll
			? Number.POSITIVE_INFINITY
			: (this.getNodeParameter('limit', itemIndex, 50) as number);
		const options: ListRequestOptions = {
			...(this.getNodeParameter('options', itemIndex, {}) as IDataObject),
			listing: String(this.getNodeParameter('listing', itemIndex, '')),
		};
		const headers = buildApiHeaders(workspaceId, false);
		const entries: IDataObject[] = [];

		for (let page = 0; ; page++) {
			const pageSize = returnAll
				? MAX_LIST_PAGE_SIZE
				: Math.min(limit - entries.length, MAX_LIST_PAGE_SIZE);
			const response = await inistateApiRequest(this, {
				method: 'POST',
				url: MCP_LIST_URL,
				headers,
				body: buildListBody(moduleId, page, pageSize, options),
			});
			const { items, hasMore } = getResponsePage(response, 'list');
			entries.push(...items);

			if (!hasMore || items.length === 0 || entries.length >= limit) {
				break;
			}
		}

		return returnAll ? entries : entries.slice(0, limit);
	},
};
