const assert = require('node:assert/strict');
const test = require('node:test');

const {
	INISTATE_BASE_URL,
	buildAutomationHeaders,
	buildEntryCreatedSubscription,
	getWebhookId,
} = require('../dist/nodes/InistateTrigger/InistateTrigger.contract.js');

test('defines the default Production API URL', () => {
	assert.equal(INISTATE_BASE_URL, 'https://api.inistate.com');
});

test('builds n8n automation headers', () => {
	assert.deepEqual(buildAutomationHeaders('9001'), {
		wsId: '9001',
		medium: 'n8n',
	});
});

test('builds an Entry Created subscription from the legacy Zapier contract', () => {
	assert.deepEqual(buildEntryCreatedSubscription('9101', 'https://n8n.example/webhook/inistate'), {
		moduleId: '9101',
		item: 'create',
		type: 'activity',
		trigger: 'execute',
		channel: 'n8n',
		url: 'https://n8n.example/webhook/inistate',
	});
});

test('accepts string and numeric webhook registration IDs', () => {
	assert.equal(getWebhookId('AwVSpu5SvM'), 'AwVSpu5SvM');
	assert.equal(getWebhookId({ id: 'abc' }), 'abc');
	assert.equal(getWebhookId({ id: 123 }), '123');
});

test('rejects an invalid direct webhook registration ID', () => {
	assert.throws(() => getWebhookId('not an id'), /invalid webhook registration ID/);
});

test('rejects a missing webhook registration ID', () => {
	assert.throws(() => getWebhookId({}), /registration ID/);
});
