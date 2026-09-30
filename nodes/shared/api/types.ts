import type {
	IAllExecuteFunctions,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

export type InistateRequestFunctions =
	| IExecuteFunctions
	| IHookFunctions
	| ILoadOptionsFunctions;

export type InistateCredentialName = 'inistateApi' | 'inistateOAuth2Api';

export type EntryIdentifierType = 'documentId' | 'entryId';

export interface InistateRequestConfig {
	entryIdentifierType?: EntryIdentifierType;
	preserveLegacyPath?: boolean;
}

export interface InistateRequestAdapter {
	request(options: IHttpRequestOptions, config?: InistateRequestConfig): Promise<unknown>;
}

export function usesOAuth(context: InistateRequestFunctions): boolean {
	return (
		typeof context.getNode === 'function' &&
		context.getNode().parameters?.authentication === 'oAuth2'
	);
}

export async function authenticatedRequest(
	context: InistateRequestFunctions,
	credentialName: InistateCredentialName,
	baseUrl: string,
	options: IHttpRequestOptions,
): Promise<unknown> {
	return await context.helpers.httpRequestWithAuthentication.call(
		context as IAllExecuteFunctions,
		credentialName,
		{
			...options,
			url: options.url.startsWith('http') ? options.url : `${baseUrl}${options.url}`,
			json: true,
		},
	);
}
