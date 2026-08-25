const assert = require('node:assert/strict');
const test = require('node:test');

const { InistateApi } = require('../dist/credentials/InistateApi.credentials.js');

test('defaults to Production and reveals App02 only for internal usernames', () => {
	const credential = new InistateApi();
	const properties = Object.fromEntries(
		credential.properties.map((property) => [property.name, property]),
	);

	assert.equal(properties.apiKey.required, true);
	assert.equal(properties.apiKey.typeOptions.password, true);
	assert.equal(properties.username.required, true);
	assert.equal(properties.username.type, 'string');
	assert.equal(properties.username.placeholder, 'e.g. name@example.com');
	assert.equal(properties.environment.default, 'production');
	assert.deepEqual(
		properties.environment.options.map(({ value }) => value),
		['production', 'app02'],
	);
	assert.deepEqual(properties.environment.displayOptions, {
		show: {
			username: [
				{ _cnd: { endsWith: '@inistate.com' } },
				{ _cnd: { endsWith: '@gneysoftware.com' } },
			],
		},
	});
	assert.equal(credential.test.request.url, '/api/profile');
	assert.match(credential.test.request.baseURL, /api\.inistate\.com/);
	assert.match(credential.test.request.baseURL, /app02\.apps\.inistate\.com/);
});

test('authenticates both internal domains and rejects App02 for an external username', async () => {
	const credential = new InistateApi();
	for (const username of ['tester@inistate.com', 'tester@gneysoftware.com']) {
		const request = await credential.authenticate(
			{
				apiKey: 'test-key',
				username,
				environment: 'app02',
			},
			{ method: 'GET', url: 'https://app02.apps.inistate.com/api/profile' },
		);

		assert.deepEqual(request.headers, { Authorization: 'fsk test-key' });
	}

	await assert.rejects(
		credential.authenticate(
			{
				apiKey: 'test-key',
				username: 'external@example.com',
				environment: 'app02',
			},
			{ method: 'GET', url: 'https://app02.apps.inistate.com/api/profile' },
		),
		/App02 can only be selected for an @inistate\.com or @gneysoftware\.com username/,
	);
});
