const assert = require('node:assert/strict');
const test = require('node:test');

const { InistateApi } = require('../dist/credentials/InistateApi.credentials.js');
const { InistateOAuth2Api } = require('../dist/credentials/InistateOAuth2Api.credentials.js');
const {
	getCurrentEntryFields,
	inistateApiRequest,
	listSearch,
} = require('../dist/nodes/shared/GenericFunctions.js');

const INTERNAL_HOST = 'https://internal.test.example.com';

test('defaults to the production host and reveals the base URL only for internal usernames', () => {
	const credential = new InistateApi();
	const properties = Object.fromEntries(
		credential.properties.map((property) => [property.name, property]),
	);

	assert.equal(properties.apiKey.required, true);
	assert.equal(properties.apiKey.typeOptions.password, true);
	assert.equal(properties.username.required, true);
	assert.equal(properties.username.type, 'string');
	assert.equal(properties.username.placeholder, 'e.g. name@example.com');
	assert.equal(properties.environment, undefined);
	assert.equal(properties.baseUrl.type, 'string');
	assert.equal(properties.baseUrl.default, 'https://api.inistate.com');
	assert.deepEqual(properties.baseUrl.displayOptions, {
		show: {
			username: [
				{ _cnd: { endsWith: '@inistate.com' } },
				{ _cnd: { endsWith: '@gneysoftware.com' } },
			],
		},
	});
	assert.equal(credential.test.request.url, '/api/profile');
	assert.match(credential.test.request.baseURL, /api\.inistate\.com/);
});

test('authenticates both internal domains and rejects a custom host for an external username', async () => {
	const credential = new InistateApi();
	for (const username of ['tester@inistate.com', 'tester@gneysoftware.com']) {
		const request = await credential.authenticate(
			{
				apiKey: 'test-key',
				username,
				baseUrl: INTERNAL_HOST,
			},
			{ method: 'GET', url: `${INTERNAL_HOST}/api/profile` },
		);

		assert.deepEqual(request.headers, { Authorization: 'fsk test-key' });
	}

	await assert.rejects(
		credential.authenticate(
			{
				apiKey: 'test-key',
				username: 'external@example.com',
				baseUrl: INTERNAL_HOST,
			},
			{ method: 'GET', url: `${INTERNAL_HOST}/api/profile` },
		),
		/custom base URL can only be used with an @inistate\.com or @gneysoftware\.com username/,
	);
});

test('accepts the production host for any username and rejects a non-https custom host', async () => {
	const credential = new InistateApi();

	const request = await credential.authenticate(
		{ apiKey: 'test-key', username: 'external@example.com', baseUrl: '' },
		{ method: 'GET', url: 'https://api.inistate.com/api/profile' },
	);
	assert.deepEqual(request.headers, { Authorization: 'fsk test-key' });

	await assert.rejects(
		credential.authenticate(
			{
				apiKey: 'test-key',
				username: 'tester@inistate.com',
				baseUrl: 'http://internal.test.example.com',
			},
			{ method: 'GET', url: 'http://internal.test.example.com/api/profile' },
		),
		/base URL must start with https:\/\//,
	);
});

test('configures retry-safe MCP dynamic client registration for OAuth2', () => {
	const credential = new InistateOAuth2Api();
	const properties = Object.fromEntries(
		credential.properties.map((property) => [property.name, property]),
	);

	assert.deepEqual(credential.extends, ['mcpOAuth2Api']);
	assert.equal(properties.useDynamicClientRegistration.default, true);
	assert.equal(properties.useDynamicClientRegistration.type, 'boolean');
	assert.match(properties.useDynamicClientRegistration.description, /reuse/i);
	assert.equal(properties.clientSecret.type, 'hidden');
	assert.equal(properties.clientSecret.typeOptions.password, true);
	assert.equal(properties.clientSecret.required, false);
	assert.equal(properties.serverUrl.default, 'https://mcp.inistate.com/mcp');
	assert.equal(properties.resourceUrl.default, 'https://mcp.inistate.com/mcp');
	assert.equal(properties.baseUrl.default, 'https://api.inistate.com');
	assert.equal(credential.test.request.url, '/v1/whoami');
});

test('routes OAuth2 workspace discovery through the scoped v1 API', async () => {
	const requests = [];
	const context = {
		getNode: () => ({ parameters: { authentication: 'oAuth2' } }),
		getCredentials: async (credentialName) => {
			assert.equal(credentialName, 'inistateOAuth2Api');
			return { baseUrl: 'https://api.inistate.com' };
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				return { ok: true };
			},
		},
	};

	await inistateApiRequest(context, { method: 'GET', url: '/api/Workspace' });

	assert.equal(requests[0].credentialName, 'inistateOAuth2Api');
	assert.equal(requests[0].options.url, 'https://api.inistate.com/v1/workspaces');
});

test('keeps legacy API routes unchanged for API-key credentials', async () => {
	const requests = [];
	const context = {
		getNode: () => ({ parameters: { authentication: 'apiKey' } }),
		getCredentials: async (credentialName) => {
			assert.equal(credentialName, 'inistateApi');
			return { baseUrl: 'https://api.inistate.com' };
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				return { ok: true };
			},
		},
	};

	await inistateApiRequest(context, { method: 'GET', url: '/api/Workspace' });

	assert.equal(requests[0].credentialName, 'inistateApi');
	assert.equal(requests[0].options.url, 'https://api.inistate.com/api/Workspace');
});

test('translates OAuth2 activity requests to the v1 contract', async () => {
	const requests = [];
	const context = {
		getNode: () => ({ parameters: { authentication: 'oAuth2' } }),
		getCredentials: async () => ({ baseUrl: 'https://api.inistate.com' }),
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/v1/workspaces/2307')) {
					return {
						modules: [
							{
								id: 42,
								name: 'Requests',
								states: [{ id: 'state-open', name: 'Open' }],
							},
						],
					};
				}
				if (options.url.endsWith('/v1/list')) {
					return { list: [{ entryId: 1001, documentId: 'REQ 00001' }] };
				}
				return { ok: true };
			},
		},
	};

	await inistateApiRequest(context, {
		method: 'POST',
		url: '/api/activity/',
		headers: { wsId: '2307', medium: 'n8n' },
		body: {
			activityId: 'edit',
			moduleId: '42',
			entry: 'REQ 00001',
			payload: { Title: 'Updated' },
		},
	});

	assert.equal(requests.length, 3);
	assert.equal(requests[1].options.url, 'https://api.inistate.com/v1/list');
	assert.deepEqual(requests[1].options.body, {
		module: 'Requests',
		search: 'REQ 00001',
		currentPage: 0,
		pageSize: 10,
	});
	assert.equal(requests[2].options.url, 'https://api.inistate.com/v1/activity');
	assert.deepEqual(requests[2].options.body, {
		module: 'Requests',
		activity: 'edit',
		entryId: 1001,
		input: { Title: 'Updated' },
	});
});

test('loads current OAuth2 entry values from the v1 list response', async () => {
	const requests = [];
	const context = {
		getNode: () => ({ parameters: { authentication: 'oAuth2' } }),
		getCredentials: async () => ({ baseUrl: 'https://api.inistate.com' }),
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/v1/workspaces/2307')) {
					return { modules: [{ id: 42, name: 'Requests' }] };
				}
				if (options.url.endsWith('/v1/list')) {
					return {
						list: [
							{
								entryId: 1001,
								documentId: 'REQ 00001',
								data: { Title: 'Existing', Priority: 'High' },
							},
						],
					};
				}
				throw new Error(`Unexpected URL: ${options.url}`);
			},
		},
	};

	assert.deepEqual(await getCurrentEntryFields(context, '2307', '42', 'REQ 00001'), {
		Title: 'Existing',
		Priority: 'High',
	});
	assert.equal(requests.at(-1).options.url, 'https://api.inistate.com/v1/list');
});

test('loads OAuth2 workspace and module selectors from v1 response shapes', async () => {
	const requests = [];
	const parameters = {
		workspaceId: { value: '2307' },
		moduleId: { value: '42' },
	};
	const context = {
		getNode: () => ({ parameters: { authentication: 'oAuth2' } }),
		getNodeParameter(name, fallback, options) {
			const value = parameters[name] ?? fallback;
			return options?.extractValue && value && typeof value === 'object' ? value.value : value;
		},
		getCredentials: async () => ({ baseUrl: 'https://api.inistate.com' }),
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/v1/workspaces')) {
					return [{ id: 2307, name: 'Operations' }];
				}
				if (options.url.endsWith('/v1/workspaces/2307')) {
					return {
						modules: [
							{
								id: 42,
								name: 'Requests',
								states: [{ id: 'state-open', name: 'Open' }],
							},
						],
					};
				}
				if (options.url.includes('/v1/modules/Requests')) {
					return {
						module: {
							activities: ['create', 'edit', 'Approve'],
							states: ['Open'],
						},
					};
				}
				if (options.url.endsWith('/api/configure/Requests')) {
					return {
						activities: [{ id: 'activity-approve', name: 'Approve' }],
					};
				}
				if (options.url.endsWith('/v1/workspaces/2307/users')) {
					return [{ username: 'lee@example.com', displayName: 'Lee' }];
				}
				throw new Error(`Unexpected URL: ${options.url}`);
			},
		},
	};

	assert.deepEqual(await listSearch.searchWorkspaces.call(context), {
		results: [{ name: 'Operations', value: '2307' }],
		paginationToken: '1',
	});
	assert.deepEqual(await listSearch.searchModules.call(context), {
		results: [{ name: 'Requests', value: '42' }],
	});
	assert.deepEqual(await listSearch.searchActivities.call(context), {
		results: [{ name: 'Approve', value: 'Approve' }],
	});
	assert.deepEqual(await listSearch.searchStates.call(context), {
		results: [{ name: 'Open', value: 'Open' }],
	});
	assert.deepEqual(await listSearch.searchTriggerActivities.call(context), {
		results: [{ name: 'Approve', value: 'activity-approve' }],
	});
	assert.deepEqual(await listSearch.searchTriggerStateIds.call(context), {
		results: [{ name: 'Open', value: 'state-open' }],
	});
	assert.deepEqual(await listSearch.searchUsers.call(context), {
		results: [{ name: 'Lee', value: 'lee@example.com' }],
	});
	assert.equal(requests.every(({ credentialName }) => credentialName === 'inistateOAuth2Api'), true);
	assert.equal(
		requests.some(({ options }) => options.url === 'https://api.inistate.com/api/configure/Requests'),
		true,
	);
	assert.equal(
		requests.some(({ options }) => options.url === 'https://api.inistate.com/api/Workspace/Module'),
		false,
	);
	assert.equal(
		requests.some(({ options }) => options.url === 'https://api.inistate.com/api/Workspace/2307'),
		false,
	);
});
