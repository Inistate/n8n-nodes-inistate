const assert = require('node:assert/strict');
const test = require('node:test');

const { InistateTrigger } = require('../dist/nodes/InistateTrigger/InistateTrigger.node.js');

function createHookContext(requests, staticData) {
	const parameters = {
		workspaceId: { value: '2307' },
		moduleId: { value: '19296' },
		event: 'activityPerformed',
		activityId: { value: 'activity-1' },
	};

	return {
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => 'https://n8n.example/webhook/inistate',
		getNodeParameter(name, fallback, options) {
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

test('registers, recognizes, and removes an Activity Performed webhook', async () => {
	const node = new InistateTrigger();
	const requests = [];
	const staticData = {};
	const context = createHookContext(requests, staticData);

	assert.equal(await node.webhookMethods.default.checkExists.call(context), false);
	assert.equal(await node.webhookMethods.default.create.call(context), true);
	assert.equal(staticData.webhookId, 'AwVSpu5SvM');
	assert.equal(await node.webhookMethods.default.checkExists.call(context), true);
	assert.deepEqual(requests[0], {
		credentialName: 'inistateApi',
		options: {
			method: 'POST',
			url: 'https://app02.apps.inistate.com/api/automationHook',
			headers: { wsId: '2307', medium: 'n8n' },
			body: {
				moduleId: '19296',
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
			url: 'https://app02.apps.inistate.com/api/automationHook/delete/AwVSpu5SvM',
			headers: { wsId: '2307' },
			json: true,
		},
	});
});

test('passes the delivered webhook JSON directly to the workflow', async () => {
	const node = new InistateTrigger();
	const body = { header: { documentId: 'N8N-TEST00001' }, data: { priority: 'High' } };
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
