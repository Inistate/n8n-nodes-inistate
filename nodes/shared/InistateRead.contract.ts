import type { IDataObject } from 'n8n-workflow';

import { extractCollection, type InistateOperation } from './Inistate.contract';

/**
 * Read requests go to the MCP layer of the Inistate API rather than `/api/activity/`.
 * These endpoints answer with display-name keyed data plus the governance signals the
 * node exists to surface: the entry's current state and the activities that are legal
 * from it (`availableActivities`).
 */
export const MCP_ENTRY_URL = '/api/mcp/entry';
export const MCP_FORM_URL = '/api/mcp/form';
export const MCP_HISTORY_URL = '/api/mcp/history';
export const MCP_LIST_URL = '/api/mcp/list';

/** Largest page `POST /api/mcp/list` serves; it clamps anything larger server-side. */
export const MAX_LIST_PAGE_SIZE = 500;

/** `POST /api/mcp/history` pages at a fixed server-side size and reports `hasMore`. */
export const HISTORY_PAGE_SIZE = 50;

export type InistateReadOperation = 'get' | 'getAll' | 'getForm' | 'getHistory';

export type InistateNodeOperation = InistateOperation | InistateReadOperation;

export interface ListRequestOptions {
	assignee?: string;
	createdAfter?: string;
	createdBefore?: string;
	createdBy?: string;
	documentId?: string;
	fields?: string | string[];
	filters?: string | IDataObject;
	listing?: string;
	search?: string;
	sortBy?: string;
	sortDirection?: string;
	state?: string;
	updatedAfter?: string;
	updatedBefore?: string;
}

const LIST_STRING_OPTIONS = [
	'assignee',
	'createdAfter',
	'createdBefore',
	'createdBy',
	'documentId',
	'listing',
	'search',
	'sortBy',
	'sortDirection',
	'state',
	'updatedAfter',
	'updatedBefore',
] as const;

/**
 * The MCP endpoints accept either the document ID ("N8N-TEST00001") or the numeric entry
 * ID, so unlike the write operations both are passed straight through.
 */
export function requireEntryId(value: unknown): string {
	const entryId = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
	if (!entryId) {
		throw new Error(
			'Entry ID is required. Use the document ID (for example "N8N-TEST00001") or the numeric entry ID.',
		);
	}

	return entryId;
}

export function buildEntryBody(moduleId: string, entryId: unknown): IDataObject {
	return { module: moduleId, entryId: requireEntryId(entryId) };
}

export function buildHistoryBody(moduleId: string, entryId: unknown, page: number): IDataObject {
	return {
		module: moduleId,
		entryId: requireEntryId(entryId),
		page: Math.max(0, Math.trunc(page)),
	};
}

export function buildFormBody(moduleId: string, activity: unknown, entryId?: unknown): IDataObject {
	const resolvedActivity = String(activity ?? '').trim();
	if (!resolvedActivity) {
		throw new Error('Activity is required for the Get Form operation');
	}

	const resolvedEntryId = String(entryId ?? '').trim();

	return {
		module: moduleId,
		activity: resolvedActivity,
		...(resolvedEntryId ? { entryId: resolvedEntryId } : {}),
	};
}

export function buildListBody(
	moduleId: string,
	page: number,
	pageSize: number,
	options: ListRequestOptions = {},
): IDataObject {
	const body: IDataObject = {
		module: moduleId,
		currentPage: Math.max(0, Math.trunc(page)),
		pageSize: Math.min(Math.max(1, Math.trunc(pageSize)), MAX_LIST_PAGE_SIZE),
	};

	for (const key of LIST_STRING_OPTIONS) {
		const value = options[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			body[key] = value.trim();
		}
	}

	const fields = parseFieldList(options.fields);
	if (fields.length > 0) {
		body.fields = fields;
	}

	const filters = parseFilters(options.filters);
	if (filters) {
		body.filters = filters;
	}

	return body;
}

export function parseFieldList(value: unknown): string[] {
	const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

	return entries.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
}

export function parseFilters(value: unknown): IDataObject | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return undefined;
		}

		const parsed = tryParseJson(trimmed);
		if (parsed === undefined) {
			throw new Error('Filters must be valid JSON, for example {"Status": "Active"}');
		}

		return asFilterObject(parsed);
	}

	return asFilterObject(value);
}

function asFilterObject(value: unknown): IDataObject | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('Filters must be a JSON object, for example {"Status": "Active"}');
	}

	return Object.keys(value as IDataObject).length > 0 ? (value as IDataObject) : undefined;
}

function tryParseJson(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}

export interface ReadPage {
	items: IDataObject[];
	hasMore: boolean;
}

/**
 * `list` and `histories` are both collections wrapped in a `hasMore` envelope. n8n
 * expects one output item per record, so the envelope is unwrapped while every record
 * keeps the exact field names the Inistate API returned.
 */
export function getResponsePage(response: unknown, property: 'list' | 'histories'): ReadPage {
	const items = extractCollection(response, property).filter(
		(item): item is IDataObject =>
			typeof item === 'object' && item !== null && !Array.isArray(item),
	);

	return { items, hasMore: asDataObject(response).hasMore === true };
}

export function asDataObject(response: unknown): IDataObject {
	if (typeof response === 'object' && response !== null && !Array.isArray(response)) {
		return response as IDataObject;
	}

	return { data: response as IDataObject[keyof IDataObject] };
}
