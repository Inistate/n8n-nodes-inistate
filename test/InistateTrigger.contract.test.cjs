const assert = require('node:assert/strict');
const test = require('node:test');

const {
	APP02_BASE_URL,
	buildAutomationHeaders,
	buildEntryCreatedSubscription,
	getWebhookId,
} = require('../dist/nodes/InistateTrigger/InistateTrigger.contract.js');

test('uses the fixed App02 P0 API URL', () => {
	assert.equal(APP02_BASE_URL, 'https://app02.apps.inistate.com');
});

test('builds n8n automation headers', () => {
	assert.deepEqual(buildAutomationHeaders('2306'), {
		wsId: '2306',
		medium: 'n8n',
	});
});

test('builds an Entry Created subscription from the legacy Zapier contract', () => {
	assert.deepEqual(
		buildEntryCreatedSubscription('19295', 'https://n8n.example/webhook/inistate'),
		{
			moduleId: '19295',
			item: 'create',
			type: 'activity',
			trigger: 'execute',
			channel: 'n8n',
			url: 'https://n8n.example/webhook/inistate',
		},
	);
});

test('accepts string and numeric webhook registration IDs', () => {
	assert.equal(getWebhookId({ id: 'abc' }), 'abc');
	assert.equal(getWebhookId({ id: 123 }), '123');
});

test('rejects a missing webhook registration ID', () => {
	assert.throws(() => getWebhookId({}), /registration ID/);
});
