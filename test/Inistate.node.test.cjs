const assert = require('node:assert/strict');
const test = require('node:test');

const { Inistate } = require('../dist/nodes/Inistate/Inistate.node.js');
const { listSearch, resourceMapping } = require('../dist/nodes/shared/GenericFunctions.js');

function extractParameter(value, options) {
	if (
		options?.extractValue &&
		value &&
		typeof value === 'object' &&
		Object.prototype.hasOwnProperty.call(value, 'value')
	) {
		return value.value;
	}

	return value;
}

test('executes two input items independently with explicit payloads and paired output', async () => {
	const node = new Inistate();
	const requests = [];
	const parameters = [
		{
			operation: 'create',
			workspaceId: { mode: 'id', value: '2307' },
			moduleId: { mode: 'id', value: '19296' },
			fields: {
				mappingMode: 'defineBelow',
				value: { title: 'N8N-TEST one' },
				matchingColumns: [],
				schema: [],
				attemptToConvertTypes: false,
				convertFieldsToString: false,
			},
		},
		{
			operation: 'update',
			workspaceId: { mode: 'id', value: '2307' },
			moduleId: { mode: 'id', value: '19296' },
			documentId: 'N8N-TEST00001',
			fields: {
				mappingMode: 'defineBelow',
				value: { priority: 'High' },
				matchingColumns: [],
				schema: [],
				attemptToConvertTypes: false,
				convertFieldsToString: false,
			},
		},
	];
	const context = {
		getInputData: () => [{ json: { source: 1 } }, { json: { source: 2 } }],
		getNodeParameter(name, itemIndex, fallback, options) {
			const value = parameters[itemIndex][name] ?? fallback;
			return extractParameter(value, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				return { requestNumber: requests.length };
			},
		},
		continueOnFail: () => false,
		getNode: () => ({
			id: 'node-id',
			name: 'Inistate',
			type: 'n8n-nodes-inistate.inistate',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	};

	const output = await node.execute.call(context);
	assert.deepEqual(
		requests.map(({ credentialName, options }) => ({ credentialName, ...options })),
		[
			{
				credentialName: 'inistateApi',
				method: 'POST',
				url: 'https://app02.apps.inistate.com/api/activity/',
				headers: { wsId: '2307', medium: 'n8n' },
				body: {
					activityId: 'create',
					moduleId: '19296',
					payload: { title: 'N8N-TEST one' },
				},
				json: true,
			},
			{
				credentialName: 'inistateApi',
				method: 'POST',
				url: 'https://app02.apps.inistate.com/api/activity/',
				headers: { wsId: '2307', medium: 'n8n' },
				body: {
					activityId: 'edit',
					moduleId: '19296',
					entry: 'N8N-TEST00001',
					payload: { priority: 'High' },
				},
				json: true,
			},
		],
	);
	assert.deepEqual(output, [
		[
			{ json: { requestNumber: 1 }, pairedItem: { item: 0 } },
			{ json: { requestNumber: 2 }, pairedItem: { item: 1 } },
		],
	]);
});

test('returns a per-item error when Continue On Fail is enabled', async () => {
	const node = new Inistate();
	const context = {
		getInputData: () => [{ json: {} }],
		getNodeParameter(name, _itemIndex, fallback, options) {
			const values = {
				operation: 'create',
				workspaceId: { value: '2307' },
				moduleId: { value: '19296' },
				fields: { value: { title: 'N8N-TEST' }, mappingMode: 'defineBelow' },
			};
			return extractParameter(values[name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication() {
				throw new Error('Sandbox rejected the action');
			},
		},
		continueOnFail: () => true,
		getNode: () => ({ name: 'Inistate' }),
	};

	assert.deepEqual(await node.execute.call(context), [
		[
			{
				json: { error: 'Sandbox rejected the action' },
				pairedItem: { item: 0 },
			},
		],
	]);
});

function createLoadContext(parameters, responder, requests) {
	return {
		getNodeParameter(name, fallback, options) {
			return extractParameter(parameters[name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				return responder(options);
			},
		},
	};
}

test('implements Workspace, Module, Activity, Field, State, and User selectors', async () => {
	const requests = [];
	const context = createLoadContext(
		{
			workspaceId: { value: '2307' },
			moduleId: { value: '19296' },
			operation: 'performActivity',
			activityId: { value: 'activity-1' },
		},
		(options) => {
			if (options.url.endsWith('/api/Workspace')) {
				return [{ id: 2307, name: 'N8N Node Testing' }];
			}
			if (options.url.endsWith('/api/Workspace/2307')) {
				return {
					vectors: [{ id: 19296, name: 'P0 Task Tracker' }],
					states: [
						{ id: 'state-1', name: 'Backlog', module: 19296 },
						{ id: 'other-state', name: 'Ignore', module: 999 },
					],
					users: [{ username: 'tester@example.com', displayName: 'Tester' }],
				};
			}
			if (options.url.endsWith('/api/Workspace/Module')) {
				return { activities: [{ id: 'activity-1', name: 'Complete Task' }] };
			}
			if (options.url.endsWith('/api/Activity/Form')) {
				return {
					classificationForm: {
						design: {
							rows: [
								{
									items: [
										{
											id: 'title-id',
											fieldName: 'title',
											displayName: 'Task Title',
											type: 0,
											required: true,
										},
									],
								},
							],
						},
					},
				};
			}

			throw new Error(`Unexpected test URL: ${options.url}`);
		},
		requests,
	);

	assert.deepEqual(await listSearch.searchWorkspaces.call(context, 'node'), {
		results: [{ name: 'N8N Node Testing', value: '2307' }],
		paginationToken: '1',
	});
	assert.deepEqual(await listSearch.searchModules.call(context), {
		results: [{ name: 'P0 Task Tracker', value: '19296' }],
	});
	assert.deepEqual(await listSearch.searchActivities.call(context), {
		results: [{ name: 'Complete Task', value: 'activity-1' }],
	});
	assert.deepEqual(await listSearch.searchFields.call(context), {
		results: [{ name: 'Task Title', value: 'title-id' }],
	});
	assert.deepEqual(await listSearch.searchStates.call(context), {
		results: [{ name: 'Backlog', value: 'Backlog' }],
	});
	assert.deepEqual(await listSearch.searchUsers.call(context), {
		results: [{ name: 'Tester', value: 'tester@example.com' }],
	});
	assert.deepEqual(await resourceMapping.getFormFields.call(context), {
		fields: [
			{
				id: 'title',
				displayName: 'Task Title',
				defaultMatch: false,
				canBeUsedToMatch: false,
				required: true,
				display: true,
				readOnly: false,
				type: 'string',
			},
		],
	});

	const activityRequest = requests.find(({ options }) =>
		options.url.endsWith('/api/Workspace/Module'),
	);
	assert.deepEqual(activityRequest.options.headers, { wsId: '2307' });
	assert.deepEqual(activityRequest.options.body, { moduleId: '19296' });
	const formRequest = requests.at(-1).options;
	assert.deepEqual(formRequest.body, { vectorId: '19296', activityId: 'activity-1' });
});
