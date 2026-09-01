import type {
	IAuthenticate,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const DEFAULT_BASE_URL = 'https://api.inistate.com';
const TRIM_TRAILING_SLASH = '.replace(/\\/+$/, "")';
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
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: DEFAULT_BASE_URL,
			placeholder: 'e.g. https://api.inistate.com',
			displayOptions: {
				show: {
					username: [
						{ _cnd: { endsWith: INISTATE_EMAIL_SUFFIX } },
						{ _cnd: { endsWith: GNEYSOFTWARE_EMAIL_SUFFIX } },
					],
				},
			},
			description:
				'Inistate API base URL. Leave the default unless you have been given another host.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key used to authenticate with the Inistate API',
		},
	];

	authenticate: IAuthenticate = async (credentials, requestOptions) => {
		const baseUrl = String(credentials.baseUrl ?? '')
			.trim()
			.replace(/\/+$/, '');
		const username = String(credentials.username ?? '')
			.trim()
			.toLowerCase();

		if (baseUrl !== '' && !baseUrl.startsWith('https://')) {
			throw new Error('The base URL must start with https://.');
		}

		if (
			baseUrl !== '' &&
			baseUrl !== DEFAULT_BASE_URL &&
			!username.endsWith(INISTATE_EMAIL_SUFFIX) &&
			!username.endsWith(GNEYSOFTWARE_EMAIL_SUFFIX)
		) {
			throw new Error(
				'A custom base URL can only be used with an @inistate.com or @gneysoftware.com username.',
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
			baseURL: `={{ ($credentials.baseUrl || "${DEFAULT_BASE_URL}").trim()${TRIM_TRAILING_SLASH} }}`,
			url: '/api/profile',
			method: 'GET',
		},
	};
}
