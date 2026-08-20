import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class InistateApi implements ICredentialType {
	name = 'inistateApi';

	displayName = 'Inistate API';

	icon = { light: 'file:inistate.svg', dark: 'file:inistate.dark.svg' } as const;

	documentationUrl = 'https://github.com/Inistate/n8n-nodes-inistate#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key used to authenticate with the App02 Inistate API',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=fsk {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://app02.apps.inistate.com',
			url: '/api/profile',
			method: 'GET',
		},
	};
}
