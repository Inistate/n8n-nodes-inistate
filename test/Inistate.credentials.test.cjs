const assert = require('node:assert/strict');
const test = require('node:test');

const { InistateApi } = require('../dist/credentials/InistateApi.credentials.js');

test('collects an API key and username while authenticating only with the API key', () => {
	const credential = new InistateApi();
	const properties = Object.fromEntries(
		credential.properties.map((property) => [property.name, property]),
	);

	assert.equal(properties.apiKey.required, true);
	assert.equal(properties.apiKey.typeOptions.password, true);
	assert.equal(properties.username.required, true);
	assert.equal(properties.username.type, 'string');
	assert.deepEqual(credential.authenticate.properties.headers, {
		Authorization: '=fsk {{$credentials.apiKey}}',
	});
	assert.equal(credential.test.request.url, '/api/profile');
});
