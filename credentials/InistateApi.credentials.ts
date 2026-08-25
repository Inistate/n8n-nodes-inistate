import type {
	IAuthenticate,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const APP02_ENVIRONMENT = 'app02';
const INISTATE_EMAIL_SUFFIX = '@inistate.com';
const GNEYSOFTWARE_EMAIL_SUFFIX = '@gneysoftware.com';

export class InistateApi implements ICredentialType {
	name = 'inistateApi';

	displayName = 'Inistate API';

	icon = {
		light: 'file:inistate.svg',
		dark: 'file:inistate.dark.svg',
	} as const;

	documentationUrl = 'https://github.com/Inistate/n8n-nodes-inistate#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Inistate Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. name@example.com',
			description: 'Username returned by the Inistate profile, normally your email address',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Inistate',
					value: 'production',
					description: 'Connect to Inistate',
				},
				{
					name: 'App02',
					value: APP02_ENVIRONMENT,
					description: 'Connect to the internal App02',
				},
			],
			default: 'production',
			displayOptions: {
				show: {
					username: [
						{ _cnd: { endsWith: INISTATE_EMAIL_SUFFIX } },
						{ _cnd: { endsWith: GNEYSOFTWARE_EMAIL_SUFFIX } },
					],
				},
			},
			description:
				'API environment. App02 is available only when the username ends with @inistate.com or @gneysoftware.com.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key used to authenticate with the selected Inistate environment',
		},
	];

	authenticate: IAuthenticate = async (credentials, requestOptions) => {
		const environment = String(credentials.environment ?? 'production');
		const username = String(credentials.username ?? '')
			.trim()
			.toLowerCase();

		if (
			environment === APP02_ENVIRONMENT &&
			!username.endsWith(INISTATE_EMAIL_SUFFIX) &&
			!username.endsWith(GNEYSOFTWARE_EMAIL_SUFFIX)
		) {
			throw new Error(
				'App02 can only be selected for an @inistate.com or @gneysoftware.com username.',
			);
		}

		return {
			...requestOptions,
			headers: {
				...(requestOptions.headers ?? {}),
				Authorization: `fsk ${String(credentials.apiKey ?? '')}`,
			},
		};
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.environment === "app02" ? "https://app02.apps.inistate.com" : "https://api.inistate.com"}}',
			url: '/api/profile',
			method: 'GET',
		},
	};
}
