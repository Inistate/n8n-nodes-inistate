import type { IHttpRequestOptions } from 'n8n-workflow';

import {
	findEntryByIdentifier,
	isRecord,
	workspaceModules,
} from './response';
import {
	authenticatedRequest,
	type InistateRequestAdapter,
	type InistateRequestConfig,
	type InistateRequestFunctions,
} from './types';

function headerValue(options: IHttpRequestOptions, name: string): string {
	const headers = options.headers;
	if (!isRecord(headers)) {
		return '';
	}

	const key = Object.keys(headers).find(
		(candidate) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase(),
	);
	const value = key ? headers[key] : undefined;
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function copyDefined(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
	pairs: Array<[string, string]>,
): void {
	for (const [sourceKey, targetKey] of pairs) {
		if (source[sourceKey] !== undefined) {
			target[targetKey] = source[sourceKey];
		}
	}
}

function numericEntryId(value: unknown): number {
	const normalized = String(value ?? '').trim();
	const entryId = Number(normalized);
	if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(entryId) || entryId < 1) {
		throw new Error('Entry ID must be a positive integer');
	}

	return entryId;
}

function toV1ActivityInput(value: unknown): unknown {
	if (!isRecord(value)) {
		return value;
	}

	const input = { ...value };
	for (const [key, id] of Object.entries(value)) {
		if (!key.endsWith('Id') || key.length === 2) {
			continue;
		}

		const fieldName = key.slice(0, -2);
		const fieldValue = value[fieldName];
		if (
			fieldValue === undefined ||
			(typeof id !== 'string' && typeof id !== 'number')
		) {
			continue;
		}

		const usernameKey = `${fieldName}Username`;
		const username = value[usernameKey];
		input[fieldName] = {
			value: fieldValue,
			id,
			...(typeof username === 'string' ? { username } : {}),
		};
		delete input[key];
		delete input[usernameKey];
	}

	return input;
}

export class InistateOAuthAdapter implements InistateRequestAdapter {
	constructor(
		private readonly context: InistateRequestFunctions,
		private readonly baseUrl: string,
	) {}

	async request(
		options: IHttpRequestOptions,
		requestConfig: InistateRequestConfig = {},
	): Promise<unknown> {
		const requestOptions = requestConfig.preserveLegacyPath
			? options
			: await this.adaptRequest(options, requestConfig);
		return await this.send(requestOptions);
	}

	private async send(options: IHttpRequestOptions): Promise<unknown> {
		return await authenticatedRequest(
			this.context,
			'inistateOAuth2Api',
			this.baseUrl,
			options,
		);
	}

	private async resolveModuleName(
		options: IHttpRequestOptions,
		moduleIdentifier: unknown,
	): Promise<string> {
		const requested = String(moduleIdentifier ?? '').trim();
		const workspaceId = headerValue(options, 'wsId');
		if (!requested || !workspaceId) {
			return requested;
		}

		const workspace = await this.send({
			method: 'GET',
			url: `/v1/workspaces/${encodeURIComponent(workspaceId)}`,
			headers: options.headers,
		});
		const match = workspaceModules(workspace).find((candidate) => {
			if (!isRecord(candidate)) {
				return false;
			}
			return [candidate.id, candidate.moduleId, candidate.name].some(
				(value) => value !== undefined && String(value) === requested,
			);
		});

		return isRecord(match) && typeof match.name === 'string' ? match.name : requested;
	}

	private async resolveEntryId(
		options: IHttpRequestOptions,
		module: string,
		entryIdentifier: unknown,
	): Promise<string | number> {
		const requested = String(entryIdentifier ?? '').trim();
		const response = await this.send({
			method: 'POST',
			url: '/v1/list',
			headers: options.headers,
			body: {
				module,
				search: requested,
				currentPage: 0,
				pageSize: 10,
			},
		});
		const entry = findEntryByIdentifier(response, requested);
		const entryId = isRecord(entry) ? (entry.entryId ?? entry.id) : undefined;
		if (typeof entryId !== 'string' && typeof entryId !== 'number') {
			throw new Error(`No accessible entry was found with document ID "${requested}"`);
		}

		return entryId;
	}

	private async adaptEntryIdentifier(
		options: IHttpRequestOptions,
		module: string,
		entryIdentifier: unknown,
		entryIdentifierType: InistateRequestConfig['entryIdentifierType'],
	): Promise<string | number> {
		return entryIdentifierType === 'entryId'
			? numericEntryId(entryIdentifier)
			: await this.resolveEntryId(options, module, entryIdentifier);
	}

	private async adaptRequest(
		options: IHttpRequestOptions,
		requestConfig: InistateRequestConfig,
	): Promise<IHttpRequestOptions> {
		if (options.url === '/api/Workspace') {
			return { ...options, url: '/v1/workspaces' };
		}

		const workspaceMatch = options.url.match(/^\/api\/Workspace\/([^/]+)$/i);
		if (
			workspaceMatch &&
			!['module', 'list'].includes(workspaceMatch[1].toLocaleLowerCase())
		) {
			return { ...options, url: `/v1/workspaces/${workspaceMatch[1]}` };
		}

		const body = isRecord(options.body) ? options.body : {};
		if (/^\/api\/mcp\/entry$/i.test(options.url)) {
			const module = await this.resolveModuleName(options, body.module);
			const entryId = await this.adaptEntryIdentifier(
				options,
				module,
				body.entryId,
				requestConfig.entryIdentifierType,
			);
			return { ...options, url: '/v1/entry', body: { ...body, module, entryId } };
		}

		if (/^\/api\/mcp\/list$/i.test(options.url)) {
			return await this.adaptNamedModuleRequest(options, body, '/v1/list');
		}

		if (/^\/api\/mcp\/history$/i.test(options.url)) {
			const module = await this.resolveModuleName(options, body.module);
			const entryId = await this.adaptEntryIdentifier(
				options,
				module,
				body.entryId,
				requestConfig.entryIdentifierType,
			);
			return {
				...options,
				url: '/v1/history',
				body: { ...body, module, entryId },
			};
		}

		if (/^\/api\/mcp\/form$/i.test(options.url)) {
			const module = await this.resolveModuleName(options, body.module);
			if (body.entryId === undefined) {
				return { ...options, url: '/v1/form', body: { ...body, module } };
			}
			const entryId = await this.adaptEntryIdentifier(
				options,
				module,
				body.entryId,
				requestConfig.entryIdentifierType,
			);
			return { ...options, url: '/v1/form', body: { ...body, module, entryId } };
		}

		if (/^\/api\/activity\/?$/i.test(options.url)) {
			const module = await this.resolveModuleName(options, body.moduleId);
			const v1Body: Record<string, unknown> = {
				module,
				activity: body.activityId,
			};
			if (body.entry !== undefined) {
				v1Body.entryId = await this.resolveEntryId(options, module, body.entry);
			}
			copyDefined(v1Body, body, [
				['payload', 'input'],
				['state', 'state'],
				['assignees', 'assignees'],
				['due', 'due'],
				['comment', 'comment'],
			]);
			v1Body.input = toV1ActivityInput(v1Body.input);
			return { ...options, url: '/v1/activity', body: v1Body };
		}

		if (/^\/api\/Activity\/Form$/i.test(options.url)) {
			const module = await this.resolveModuleName(options, body.vectorId);
			const v1Body: Record<string, unknown> = {
				module,
				activity: body.activityId ?? 'create',
			};
			copyDefined(v1Body, body, [['entryId', 'entryId']]);
			return { ...options, url: '/v1/form', body: v1Body };
		}

		if (/^\/api\/Workspace\/Module$/i.test(options.url)) {
			const module = await this.resolveModuleName(options, body.moduleId);
			return {
				...options,
				method: 'GET',
				url: `/v1/modules/${encodeURIComponent(module)}`,
				body: undefined,
				qs: { tier: 'extended' },
			};
		}

		if (/^\/api\/workspace\/list$/i.test(options.url)) {
			const module = await this.resolveModuleName(options, body.moduleId);
			const v1Body: Record<string, unknown> = { module };
			copyDefined(v1Body, body, [
				['listingId', 'listing'],
				['search', 'search'],
				['filters', 'filters'],
				['currentPage', 'currentPage'],
				['pageSize', 'pageSize'],
			]);
			return { ...options, url: '/v1/list', body: v1Body };
		}

		return options;
	}

	private async adaptNamedModuleRequest(
		options: IHttpRequestOptions,
		body: Record<string, unknown>,
		url: string,
	): Promise<IHttpRequestOptions> {
		const module = await this.resolveModuleName(options, body.module);
		return { ...options, url, body: { ...body, module } };
	}
}
