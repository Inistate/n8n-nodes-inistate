const assert = require('node:assert/strict');
const test = require('node:test');

const { InistateApi } = require('../dist/credentials/InistateApi.credentials.js');

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
			{ apiKey: 'test-key', username: 'tester@inistate.com', baseUrl: 'http://internal.test.example.com' },
			{ method: 'GET', url: 'http://internal.test.example.com/api/profile' },
		),
		/base URL must start with https:\/\//,
	);
});
