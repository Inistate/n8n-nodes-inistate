import type { IHttpRequestOptions } from 'n8n-workflow';

import { findEntryByIdentifier, isRecord } from './response';
import {
	authenticatedRequest,
	type InistateRequestAdapter,
	type InistateRequestConfig,
	type InistateRequestFunctions,
} from './types';

export class InistateApiKeyAdapter implements InistateRequestAdapter {
	constructor(
		private readonly context: InistateRequestFunctions,
		private readonly baseUrl: string,
	) {}

	async request(
		options: IHttpRequestOptions,
		requestConfig: InistateRequestConfig = {},
	): Promise<unknown> {
		const requestOptions = await this.resolveReadDocumentId(options, requestConfig);
		return await this.send(requestOptions);
	}

	private async send(options: IHttpRequestOptions): Promise<unknown> {
		return await authenticatedRequest(this.context, 'inistateApi', this.baseUrl, options);
	}

	private async resolveReadDocumentId(
		options: IHttpRequestOptions,
		requestConfig: InistateRequestConfig,
	): Promise<IHttpRequestOptions> {
		if (
			requestConfig.entryIdentifierType !== 'documentId' ||
			!/^\/api\/mcp\/(?:entry|history|form)$/i.test(options.url)
		) {
			return options;
		}

		const body = isRecord(options.body) ? options.body : {};
		if (body.entryId === undefined) {
			return options;
		}

		const moduleId = String(body.module ?? '').trim();
		const documentId = String(body.entryId).trim();
		if (!moduleId || !documentId) {
			throw new Error('Module and document ID are required to resolve the entry');
		}

		const response = await this.send({
			method: 'POST',
			url: '/api/mcp/list',
			headers: options.headers,
			body: {
				module: moduleId,
				search: documentId,
				currentPage: 0,
				pageSize: 10,
			},
		});
		const entry = findEntryByIdentifier(response, documentId);
		const entryId = isRecord(entry) ? (entry.entryId ?? entry.id) : undefined;
		if (typeof entryId === 'string' || typeof entryId === 'number') {
			return { ...options, body: { ...body, entryId } };
		}

		throw new Error(`No accessible entry was found with document ID "${documentId}"`);
	}
}
