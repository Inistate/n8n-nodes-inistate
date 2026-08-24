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
		getCredentials: async () => ({ environment: 'app02', username: 'tester@inistate.com' }),
		getInputData: () => [{ json: { source: 1 } }, { json: { source: 2 } }],
		getNodeParameter(name, itemIndex, fallback, options) {
			const value = parameters[itemIndex][name] ?? fallback;
			return extractParameter(value, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/api/Workspace/2307')) {
					return { vectors: [{ id: 19296, menus: [{ id: 'defaultListing' }] }] };
				}
				if (options.url.endsWith('/api/workspace/list')) {
					return { data: { list: [{ id: 806548, documentId: 'N8N-TEST00001' }] } };
				}
				if (options.url.endsWith('/api/Activity/Form')) {
					return {
						classificationForm: {
							default: { 'title-id': 'Existing title', 'priority-id': 'Medium' },
							design: {
								rows: [
									{
										items: [
											{ id: 'title-id', fieldName: 'title', type: 0 },
											{ id: 'priority-id', fieldName: 'priority', type: 27 },
										],
									},
								],
							},
						},
					};
				}
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
		requests
			.filter(({ options }) => options.url.endsWith('/api/activity/'))
			.map(({ credentialName, options }) => ({ credentialName, ...options })),
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
					payload: { title: 'Existing title', priority: 'High' },
				},
				json: true,
			},
		],
	);
	assert.deepEqual(output, [
		[
			{ json: { requestNumber: 1 }, pairedItem: { item: 0 } },
			{ json: { requestNumber: 5 }, pairedItem: { item: 1 } },
		],
	]);
	assert.deepEqual(requests[2].options.body, {
		moduleId: '19296',
		listingId: 'defaultListing',
		withHeader: false,
		currentPage: 0,
		pageSize: 10,
		filters: null,
		sorts: null,
		search: 'N8N-TEST00001',
	});
	assert.deepEqual(requests[3].options.body, {
		vectorId: '19296',
		activityId: 'edit',
		entryId: 806548,
	});
});

test('does not read operation-specific properties hidden from Create', async () => {
	const node = new Inistate();
	const requests = [];
	const parameters = {
		operation: 'create',
		workspaceId: { mode: 'id', value: '2307' },
		moduleId: { mode: 'id', value: '19296' },
		fields: {
			mappingMode: 'defineBelow',
			value: { title: 'N8N-TEST strict create' },
			matchingColumns: [],
			schema: [],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		},
	};
	const context = {
		getCredentials: async () => ({ environment: 'app02', username: 'tester@inistate.com' }),
		getInputData: () => [{ json: {} }],
		getNodeParameter(name, _itemIndex, _fallback, options) {
			if (!Object.prototype.hasOwnProperty.call(parameters, name)) {
				throw new Error('Could not find property');
			}
			return extractParameter(parameters[name], options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				return { header: { documentId: 'P0 00006' } };
			},
		},
		continueOnFail: () => false,
		getNode: () => ({ name: 'Create entry' }),
	};

	const output = await node.execute.call(context);
	assert.equal(requests.length, 1);
	assert.equal(requests[0].options.body.activityId, 'create');
	assert.deepEqual(output, [
		[{ json: { header: { documentId: 'P0 00006' } }, pairedItem: { item: 0 } }],
	]);
});

test('executes Delete and Duplicate with the Zapier-compatible activity contracts', async () => {
	const node = new Inistate();
	const requests = [];
	const parameters = [
		{
			operation: 'delete',
			workspaceId: { value: '2307' },
			moduleId: { value: '19296' },
			documentId: 'N8N-TEST00001',
		},
		{
			operation: 'duplicate',
			workspaceId: { value: '2307' },
			moduleId: { value: '19296' },
			documentId: 'N8N-TEST00002',
		},
	];
	const context = {
		getCredentials: async () => ({ environment: 'app02', username: 'tester@inistate.com' }),
		getInputData: () => [{ json: {} }, { json: {} }],
		getNodeParameter(name, itemIndex, fallback, options) {
			return extractParameter(parameters[itemIndex][name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				return options.body.activityId === 'delete' ? { deleted: true } : { duplicated: true };
			},
		},
		continueOnFail: () => false,
		getNode: () => ({ name: 'P1 entry action' }),
	};

	const output = await node.execute.call(context);
	assert.deepEqual(
		requests.map(({ options }) => options.body),
		[
			{ activityId: 'delete', moduleId: '19296', entry: 'N8N-TEST00001' },
			{ activityId: 'duplicate', moduleId: '19296', entry: 'N8N-TEST00002' },
		],
	);
	assert.deepEqual(output, [
		[
			{ json: { deleted: true }, pairedItem: { item: 0 } },
			{ json: { duplicated: true }, pairedItem: { item: 1 } },
		],
	]);
});

test('returns a per-item error when Continue On Fail is enabled', async () => {
	const node = new Inistate();
	const context = {
		getCredentials: async () => ({ environment: 'app02', username: 'tester@inistate.com' }),
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
		getCredentials: async () => ({ environment: 'app02', username: 'tester@inistate.com' }),
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

test('implements Workspace, Module, Activity, Field, State Name, State ID, and User selectors', async () => {
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
	assert.deepEqual(await listSearch.searchStateIds.call(context), {
		results: [{ name: 'Backlog', value: 'state-1' }],
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
	assert.deepEqual(formRequest.headers, { wsId: '2307' });
	assert.deepEqual(formRequest.body, { vectorId: '19296', activityId: 'activity-1' });
});

test('loads Module and User form fields as dropdown options', async () => {
	const requests = [];
	const context = createLoadContext(
		{
			workspaceId: { value: '2307' },
			moduleId: { value: '19305' },
			operation: 'create',
			documentId: '',
		},
		(options) => {
			if (options.url.endsWith('/api/Activity/Form')) {
				return {
					classificationForm: {
						design: {
							rows: [
								{
									items: [
										{
											id: 'project-id',
											fieldName: 'relatedProject',
											displayName: 'Related Project',
											type: 7,
										},
										{
											id: 'assignee-id',
											fieldName: 'assignee',
											displayName: 'Assignee',
											type: 20,
										},
									],
								},
							],
						},
					},
				};
			}
			if (options.url.endsWith('/api/activity/formselection')) {
				if (options.body.currentPage > 0) return [];
				if (options.body.fieldId === 'project-id') {
					return [{ id: 806568, value: 'N8N Sandbox Project' }];
				}
				if (options.body.fieldId === 'assignee-id') {
					return [{ id: 806569, value: 'N8N Test User One', username: 'n8n.test.user1' }];
				}
			}

			throw new Error(`Unexpected test URL: ${options.url}`);
		},
		requests,
	);

	const result = await resourceMapping.getFormFields.call(context);
	assert.deepEqual(
		result.fields.map(({ id, type, options }) => ({
			id,
			type,
			optionNames: options?.map(({ name }) => name),
		})),
		[
			{
				id: 'relatedProject',
				type: 'options',
				optionNames: ['N8N Sandbox Project'],
			},
			{
				id: 'assignee',
				type: 'options',
				optionNames: ['N8N Test User One'],
			},
		],
	);
	const selectionRequests = requests.filter(({ options }) =>
		options.url.endsWith('/api/activity/formselection'),
	);
	assert.equal(selectionRequests.length, 4);
	assert.deepEqual(selectionRequests[0].options.headers, { wsId: '2307' });
	assert.deepEqual(selectionRequests[0].options.body, {
		activityId: 'create',
		text: '',
		currentPage: 0,
		vectorId: 19305,
		fieldId: 'project-id',
		reference: null,
		documentId: '',
	});
});

test('does not pass an entry document ID when loading custom-activity reference options', async () => {
	const requests = [];
	const context = createLoadContext(
		{
			workspaceId: { value: '2307' },
			moduleId: { value: '19305' },
			operation: 'performActivity',
			activityId: { value: 'activity-1' },
			documentId: 'N8N00005',
		},
		(options) => {
			if (options.url.endsWith('/api/Activity/Form')) {
				return {
					classificationForm: {
						design: {
							rows: [
								{
									items: [
										{
											id: 'project-id',
											fieldName: 'relatedProject',
											displayName: 'Related Project',
											type: 7,
										},
									],
								},
							],
						},
					},
				};
			}
			if (options.url.endsWith('/api/activity/formselection')) {
				if (options.body.currentPage > 0) return [];
				return options.body.documentId === '' ? [{ id: 806568, value: 'N8N Sandbox Project' }] : [];
			}

			throw new Error(`Unexpected test URL: ${options.url}`);
		},
		requests,
	);

	const result = await resourceMapping.getFormFields.call(context);
	assert.deepEqual(
		result.fields[0].options?.map(({ name }) => name),
		['N8N Sandbox Project'],
	);
	const selectionRequest = requests.find(({ options }) =>
		options.url.endsWith('/api/activity/formselection'),
	);
	assert.equal(selectionRequest.options.body.activityId, 'activity-1');
	assert.equal(selectionRequest.options.body.documentId, '');
});
