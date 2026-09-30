import type { IHttpRequestOptions } from 'n8n-workflow';

import {
	authenticatedRequest,
	type InistateRequestAdapter,
	type InistateRequestFunctions,
} from './types';

export class InistateApiKeyAdapter implements InistateRequestAdapter {
	constructor(
		private readonly context: InistateRequestFunctions,
		private readonly baseUrl: string,
	) {}

	async request(options: IHttpRequestOptions): Promise<unknown> {
		return await authenticatedRequest(this.context, 'inistateApi', this.baseUrl, options);
	}
}
