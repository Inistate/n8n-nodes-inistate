import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const INISTATE_API_URL = 'https://api.inistate.com';
const INISTATE_MCP_URL = 'https://mcp.inistate.com/mcp';

export class InistateOAuth2Api implements ICredentialType {
	name = 'inistateOAuth2Api';

	extends = ['mcpOAuth2Api'];

	displayName = 'Inistate OAuth2 API';

	icon = {
		light: 'file:inistate.svg',
		dark: 'file:inistate.dark.svg',
	} as const;

	documentationUrl = 'https://github.com/Inistate/n8n-nodes-inistate#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Register New OAuth Client',
			name: 'useDynamicClientRegistration',
			type: 'boolean',
			default: true,
			description:
				'Turn off after n8n has registered this credential once to reuse the saved client and avoid registration rate limits',
		},
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'hidden',
			default: INISTATE_MCP_URL,
		},
		{
			displayName: 'Resource URL',
			name: 'resourceUrl',
			type: 'hidden',
			default: INISTATE_MCP_URL,
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'hidden',
			default: INISTATE_API_URL,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'hidden',
			typeOptions: {
				password: true,
			},
			default: '',
			required: false,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.oauthTokenData.access_token}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: INISTATE_API_URL,
			url: '/v1/whoami',
			method: 'GET',
		},
	};
}
