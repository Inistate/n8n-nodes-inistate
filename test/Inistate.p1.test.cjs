const assert = require('node:assert/strict');
const test = require('node:test');

const { Inistate } = require('../dist/nodes/Inistate/Inistate.node.js');
const { InistateTrigger } = require('../dist/nodes/InistateTrigger/InistateTrigger.node.js');

function extractParameter(value, options) {
	return options?.extractValue && value && typeof value === 'object' ? value.value : value;
}

function nodeDetails(name) {
	return {
		id: `${name}-id`,
		name,
		type: `n8n-nodes-inistate.${name}`,
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	};
}

function createActionContext(operation, responder) {
	const parameters = {
		operation,
		workspaceId: { value: '2307' },
		moduleId: { value: '19296' },
		documentId: 'N8N-TEST00001',
	};
	const requests = [];
	return {
		requests,
		context: {
			getCredentials: async () => ({ environment: 'app02' }),
			getInputData: () => [{ json: {} }],
			getNodeParameter(name, _itemIndex, fallback, options) {
				return extractParameter(parameters[name] ?? fallback, options);
			},
			helpers: {
				async httpRequestWithAuthentication(credentialName, options) {
					requests.push({ credentialName, options });
					return await responder(options);
				},
			},
			continueOnFail: () => false,
			getNode: () => nodeDetails('inistate'),
		},
	};
}

function createStateHookContext({ direction = 'changeTo', stateId = 'state-1', responder } = {}) {
	const staticData = {};
	const requests = [];
	const parameters = {
		workspaceId: { value: '2307' },
		moduleId: { value: '19296' },
		event: 'stateChanged',
		stateChangeDirection: direction,
		stateId: { value: stateId },
	};
	return {
		requests,
		staticData,
		context: {
			getCredentials: async () => ({ environment: 'app02' }),
			getWorkflowStaticData: () => staticData,
			getNodeWebhookUrl: () => 'https://n8n.example/webhook/inistate',
			getNodeParameter(name, fallback, options) {
				return extractParameter(parameters[name] ?? fallback, options);
			},
			helpers: {
				async httpRequestWithAuthentication(credentialName, options) {
					requests.push({ credentialName, options });
					if (responder) return await responder(options);
					return options.method === 'POST' ? 'AwVSpu5SvM' : { deleted: true };
				},
			},
			getNode: () => nodeDetails('inistateTrigger'),
		},
	};
}

test('normalizes Delete output and preserves the Duplicate API response', async () => {
	const deleteSetup = createActionContext('delete', async () => ({
		internalStatus: 'removed',
	}));
	const duplicateResponse = {
		header: { documentId: 'N8N-TEST00002' },
		copied: true,
	};
	const duplicateSetup = createActionContext('duplicate', async () => duplicateResponse);

	assert.deepEqual(await new Inistate().execute.call(deleteSetup.context), [
		[{ json: { deleted: true }, pairedItem: { item: 0 } }],
	]);
	assert.deepEqual(await new Inistate().execute.call(duplicateSetup.context), [
		[{ json: duplicateResponse, pairedItem: { item: 0 } }],
	]);
	assert.equal(deleteSetup.requests[0].options.body.activityId, 'delete');
	assert.equal(duplicateSetup.requests[0].options.body.activityId, 'duplicate');
});

test('reports P1 API failures as NodeApiError with recovery guidance', async () => {
	const apiFailure = Object.assign(new Error('Entry not found'), {
		statusCode: 404,
	});
	const { context } = createActionContext('delete', async () => {
		throw apiFailure;
	});

	await assert.rejects(new Inistate().execute.call(context), (error) => {
		assert.equal(error.constructor.name, 'NodeApiError');
		assert.equal(error.httpCode, '404');
		assert.match(error.description, /credential.*environment.*workspace.*module.*try again/i);
		return true;
	});
});

test('runs the complete State Changed registration and removal lifecycle for both directions', async () => {
	const node = new InistateTrigger();
	for (const direction of ['changeFrom', 'changeTo']) {
		const { context, requests, staticData } = createStateHookContext({
			direction,
		});

		assert.equal(await node.webhookMethods.default.checkExists.call(context), false);
		assert.equal(await node.webhookMethods.default.create.call(context), true);
		assert.equal(await node.webhookMethods.default.checkExists.call(context), true);
		assert.equal(staticData.webhookId, 'AwVSpu5SvM');
		assert.deepEqual(requests[0].options.body, {
			moduleId: '19296',
			item: 'state-1',
			type: 'state',
			trigger: direction,
			channel: 'n8n',
			url: 'https://n8n.example/webhook/inistate',
		});

		assert.equal(await node.webhookMethods.default.delete.call(context), true);
		assert.equal(await node.webhookMethods.default.checkExists.call(context), false);
		assert.equal(staticData.webhookId, undefined);
		assert.equal(
			requests[1].options.url,
			'https://app02.apps.inistate.com/api/automationHook/delete/AwVSpu5SvM',
		);
	}
});

test('rejects invalid State Changed selections with recovery guidance', async () => {
	const node = new InistateTrigger();
	for (const selection of [
		{ stateId: '', expected: /State ID is required/ },
		{ direction: 'sideways', expected: /From State or To State/ },
	]) {
		const { context } = createStateHookContext(selection);
		await assert.rejects(node.webhookMethods.default.create.call(context), (error) => {
			assert.equal(error.constructor.name, 'NodeOperationError');
			assert.match(error.message, selection.expected);
			assert.match(error.description, /selected trigger event.*required Activity or State/i);
			return true;
		});
	}
});

test('keeps the State Changed webhook ID when removal fails', async () => {
	const apiFailure = Object.assign(new Error('Inistate unavailable'), {
		statusCode: 503,
	});
	const setup = createStateHookContext({
		responder: async (options) => {
			if (options.method === 'POST') return 'AwVSpu5SvM';
			throw apiFailure;
		},
	});
	const node = new InistateTrigger();

	await node.webhookMethods.default.create.call(setup.context);
	await assert.rejects(node.webhookMethods.default.delete.call(setup.context), (error) => {
		assert.equal(error.constructor.name, 'NodeApiError');
		assert.equal(error.httpCode, '503');
		return true;
	});
	assert.equal(setup.staticData.webhookId, 'AwVSpu5SvM');
});
