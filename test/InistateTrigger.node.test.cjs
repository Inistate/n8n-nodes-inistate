const assert = require('node:assert/strict');
const test = require('node:test');

const { InistateTrigger } = require('../dist/nodes/InistateTrigger/InistateTrigger.node.js');
const { PRODUCTION_SANDBOX } = require('./fixtures/production-sandbox.cjs');

const { workspace, modules } = PRODUCTION_SANDBOX;

function createHookContext(
	requests,
	staticData,
	event = 'activityPerformed',
	stateChangeDirection = 'changeTo',
	module = modules[0],
) {
	const parameters = {
		workspaceId: { value: workspace.id },
		moduleId: { value: module.id },
		event,
		...(event === 'activityPerformed' ? { activityId: { value: 'activity-1' } } : {}),
		...(event === 'stateChanged' ? { stateChangeDirection, stateId: { value: 'state-1' } } : {}),
	};

	return {
		getCredentials: async () => ({
			baseUrl: '',
			username: 'tester@inistate.com',
		}),
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => 'https://n8n.example/webhook/inistate',
		getNodeParameter(name, fallback, options) {
			if (!Object.prototype.hasOwnProperty.call(parameters, name)) {
				throw new Error('Could not find property');
			}
			const value = parameters[name] ?? fallback;
			return options?.extractValue && value && typeof value === 'object' ? value.value : value;
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				return options.method === 'POST' ? 'AwVSpu5SvM' : { deleted: true };
			},
		},
		getNode: () => ({
			id: 'trigger-id',
			name: 'Inistate Trigger',
			type: 'n8n-nodes-inistate.inistateTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	};
}

test('registers, recognizes, and removes Activity Performed webhooks for every sandbox module', async () => {
	const node = new InistateTrigger();
	for (const module of modules) {
		const requests = [];
		const staticData = {};
		const context = createHookContext(
			requests,
			staticData,
			'activityPerformed',
			'changeTo',
			module,
		);

		assert.equal(await node.webhookMethods.default.checkExists.call(context), false);
		assert.equal(await node.webhookMethods.default.create.call(context), true);
		assert.equal(staticData.webhookId, 'AwVSpu5SvM');
		assert.equal(await node.webhookMethods.default.checkExists.call(context), true);
		assert.deepEqual(requests[0], {
			credentialName: 'inistateApi',
			options: {
				method: 'POST',
				url: 'https://api.inistate.com/api/automationHook',
				headers: { wsId: workspace.id, medium: 'n8n' },
				body: {
					moduleId: module.id,
					item: 'activity-1',
					type: 'activity',
					trigger: 'execute',
					channel: 'n8n',
					url: 'https://n8n.example/webhook/inistate',
				},
				json: true,
			},
		});

		assert.equal(await node.webhookMethods.default.delete.call(context), true);
		assert.equal(staticData.webhookId, undefined);
		assert.deepEqual(requests[1], {
			credentialName: 'inistateApi',
			options: {
				method: 'GET',
				url: 'https://api.inistate.com/api/automationHook/delete/AwVSpu5SvM',
				headers: { wsId: workspace.id },
				json: true,
			},
		});
	}
});

test('registers entry events without reading the hidden Activity property', async () => {
	const node = new InistateTrigger();
	for (const [event, item] of [
		['entryCreated', 'create'],
		['entryUpdated', 'edit'],
	]) {
		for (const module of modules) {
			const requests = [];
			const context = createHookContext(requests, {}, event, 'changeTo', module);

			assert.equal(await node.webhookMethods.default.create.call(context), true);
			assert.equal(requests.length, 1);
			assert.equal(requests[0].options.body.item, item);
			assert.equal(requests[0].options.body.moduleId, module.id);
		}
	}
});

test('registers State Changed webhooks for both supported directions', async () => {
	const node = new InistateTrigger();
	for (const module of modules) {
		for (const direction of ['changeFrom', 'changeTo']) {
			const requests = [];
			const context = createHookContext(requests, {}, 'stateChanged', direction, module);

			assert.equal(await node.webhookMethods.default.create.call(context), true);
			assert.deepEqual(requests[0].options.body, {
				moduleId: module.id,
				item: 'state-1',
				type: 'state',
				trigger: direction,
				channel: 'n8n',
				url: 'https://n8n.example/webhook/inistate',
			});
		}
	}
});

test('passes the delivered webhook JSON directly to the workflow', async () => {
	const node = new InistateTrigger();
	const body = {
		header: { documentId: 'N8N-TEST00001' },
		data: { priority: 'High' },
	};
	const context = {
		getBodyData: () => body,
		helpers: {
			returnJsonArray: (value) => [{ json: value }],
		},
	};

	assert.deepEqual(await node.webhook.call(context), {
		workflowData: [[{ json: body }]],
	});
});
