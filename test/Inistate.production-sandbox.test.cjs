const assert = require('node:assert/strict');
const test = require('node:test');

const { buildActionBody, buildSubscription } = require('../dist/nodes/shared/Inistate.contract.js');
const { PRODUCTION_SANDBOX } = require('./fixtures/production-sandbox.cjs');

test('defines the exact production sandbox workspace and module names', () => {
	assert.equal(PRODUCTION_SANDBOX.workspace.name, 'N8N Production Sandbox');
	assert.deepEqual(
		PRODUCTION_SANDBOX.modules.map(({ name }) => name),
		['Task Tracker', 'Projects', 'Members'],
	);
});

test('builds every action contract for each production sandbox module fixture', () => {
	for (const module of PRODUCTION_SANDBOX.modules) {
		const inputs = [
			{ operation: 'create', fields: { title: `N8N-TEST ${module.name}` } },
			{
				operation: 'update',
				documentId: 'N8N-TEST00001',
				fields: { title: 'Updated' },
			},
			{
				operation: 'performActivity',
				documentId: 'N8N-TEST00001',
				activityId: 'activity-1',
				fields: {},
			},
			{
				operation: 'changeState',
				documentId: 'N8N-TEST00001',
				stateName: 'Completed',
			},
			{
				operation: 'assign',
				documentId: 'N8N-TEST00001',
				username: 'tester@example.com',
			},
			{ operation: 'delete', documentId: 'N8N-TEST00001' },
			{ operation: 'duplicate', documentId: 'N8N-TEST00001' },
		];

		for (const input of inputs) {
			assert.equal(buildActionBody({ ...input, moduleId: module.id }).moduleId, module.id);
		}
	}
});

test('builds every trigger contract for each production sandbox module fixture', () => {
	for (const module of PRODUCTION_SANDBOX.modules) {
		for (const subscription of [
			buildSubscription(module.id, 'create', 'https://n8n.example/webhook/inistate'),
			buildSubscription(module.id, 'edit', 'https://n8n.example/webhook/inistate'),
			buildSubscription(module.id, 'activity-1', 'https://n8n.example/webhook/inistate'),
			buildSubscription(
				module.id,
				'state-1',
				'https://n8n.example/webhook/inistate',
				'state',
				'changeTo',
			),
		]) {
			assert.equal(subscription.moduleId, module.id);
		}
	}
});
