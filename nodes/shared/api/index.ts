import { resolveInistateBaseUrl } from '../Inistate.contract';
import { InistateApiKeyAdapter } from './InistateApiKeyAdapter';
import { InistateOAuthAdapter } from './InistateOAuthAdapter';
import {
	type InistateRequestAdapter,
	type InistateRequestFunctions,
	usesOAuth,
} from './types';

export {
	type InistateRequestConfig,
	type InistateRequestFunctions,
	usesOAuth,
} from './types';
export {
	findEntryByIdentifier,
	isRecord,
	nestedCollection,
	workspaceModules,
	workspaceModuleStates,
} from './response';

export async function createInistateRequestAdapter(
	context: InistateRequestFunctions,
): Promise<InistateRequestAdapter> {
	const oauth = usesOAuth(context);
	const credentials = await context.getCredentials(oauth ? 'inistateOAuth2Api' : 'inistateApi');
	const baseUrl = resolveInistateBaseUrl(credentials.baseUrl);

	return oauth
		? new InistateOAuthAdapter(context, baseUrl)
		: new InistateApiKeyAdapter(context, baseUrl);
}
