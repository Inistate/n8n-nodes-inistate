const assert = require('node:assert/strict');
const test = require('node:test');

const { Inistate } = require('../dist/nodes/Inistate/Inistate.node.js');
const { listSearch, loadOptions } = require('../dist/nodes/shared/GenericFunctions.js');

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

/**
 * `respond` receives every outgoing request and returns the mocked API response, so each
 * test can assert the exact MCP request bodies the node produced.
 */
function createContext(parameters, respond) {
	const requests = [];

	return {
		requests,
		getCredentials: async () => ({
			environment: 'production',
			username: 'tester@inistate.com',
		}),
		getInputData: () => parameters.map((_, index) => ({ json: { source: index } })),
		getNodeParameter(name, itemIndex, fallback, options) {
			const item = parameters[itemIndex];
			const value = Object.prototype.hasOwnProperty.call(item, name) ? item[name] : fallback;
			return extractParameter(value, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, ...options });
				return respond(options, requests.length - 1);
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
}

const workspaceAndModule = {
	workspaceId: { mode: 'id', value: '9001' },
	moduleId: { mode: 'id', value: '9101' },
};

test('Get returns the entry with its state and legal activities intact', async () => {
	const entry = {
		module: 'Task Tracker',
		entryId: 806548,
		documentId: 'N8N-TEST00001',
		data: { Title: 'Refund request', Amount: 420 },
		state: 'Pending Approval',
		availableActivities: {
			standard: ['edit', 'changeState'],
			custom: ['approve', 'reject'],
			stateFlow: {
				currentState: 'Pending Approval',
				transitions: { approve: ['Approved'], reject: ['Rejected'] },
			},
		},
	};
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'get', entryId: 'N8N-TEST00001' }],
		() => entry,
	);

	const output = await new Inistate().execute.call(context);

	assert.deepEqual(context.requests, [
		{
			credentialName: 'inistateApi',
			method: 'POST',
			url: 'https://api.inistate.com/api/mcp/entry',
			headers: { wsId: '9001' },
			body: { module: '9101', entryId: 'N8N-TEST00001' },
			json: true,
		},
	]);
	assert.deepEqual(output, [[{ json: entry, pairedItem: { item: 0 } }]]);
});

test('Get Many stops at the limit and asks for no more than it needs', async () => {
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'getAll', returnAll: false, limit: 2 }],
		() => ({
			module: 'Task Tracker',
			totalItems: 9,
			hasMore: true,
			list: [
				{ entryId: 1, documentId: 'N8N-TEST00001' },
				{ entryId: 2, documentId: 'N8N-TEST00002' },
			],
		}),
	);

	const output = await new Inistate().execute.call(context);

	assert.equal(context.requests.length, 1);
	assert.deepEqual(context.requests[0].body, {
		module: '9101',
		currentPage: 0,
		pageSize: 2,
	});
	assert.deepEqual(
		output[0].map(({ json }) => json.documentId),
		['N8N-TEST00001', 'N8N-TEST00002'],
	);
	assert.deepEqual(
		output[0].map(({ pairedItem }) => pairedItem),
		[{ item: 0 }, { item: 0 }],
	);
});

test('Get Many follows hasMore until the last page when returning all', async () => {
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'getAll', returnAll: true }],
		(options) =>
			options.body.currentPage === 0
				? { hasMore: true, list: [{ entryId: 1 }, { entryId: 2 }] }
				: { hasMore: false, list: [{ entryId: 3 }] },
	);

	const output = await new Inistate().execute.call(context);

	assert.deepEqual(
		context.requests.map(({ body }) => [body.currentPage, body.pageSize]),
		[
			[0, 500],
			[1, 500],
		],
	);
	assert.deepEqual(
		output[0].map(({ json }) => json.entryId),
		[1, 2, 3],
	);
});

test('Get Many stops when a page comes back empty even if hasMore stays true', async () => {
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'getAll', returnAll: true }],
		() => ({ hasMore: true, list: [] }),
	);

	const output = await new Inistate().execute.call(context);

	assert.equal(context.requests.length, 1);
	assert.deepEqual(output, [[]]);
});

test('Get Many forwards the listing and every supplied option', async () => {
	const context = createContext(
		[
			{
				...workspaceAndModule,
				operation: 'getAll',
				returnAll: false,
				limit: 10,
				listing: 'Outstanding Work',
				options: {
					state: 'Pending Approval',
					assignee: 'alex',
					search: 'refund',
					sortBy: 'Updated Date',
					sortDirection: 'desc',
					fields: 'Title,Amount',
					filters: '{"Amount": {"min": 500}}',
					createdAfter: '2026-08-01T00:00:00.000Z',
				},
			},
		],
		() => ({ hasMore: false, list: [] }),
	);

	await new Inistate().execute.call(context);

	assert.deepEqual(context.requests[0].body, {
		module: '9101',
		currentPage: 0,
		pageSize: 10,
		listing: 'Outstanding Work',
		state: 'Pending Approval',
		assignee: 'alex',
		search: 'refund',
		sortBy: 'Updated Date',
		sortDirection: 'desc',
		createdAfter: '2026-08-01T00:00:00.000Z',
		fields: ['Title', 'Amount'],
		filters: { Amount: { min: 500 } },
	});
});

test('Get History pages the audit trail and emits one item per record', async () => {
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'getHistory', entryId: '806548', returnAll: true }],
		(options) =>
			options.body.page === 0
				? {
						module: 'Task Tracker',
						entryId: '806548',
						hasMore: true,
						histories: [{ id: '1', activity: 'create', by: 'alex', on: '2026-08-01T00:00:00Z' }],
					}
				: {
						hasMore: false,
						histories: [{ id: '2', activity: 'approve', actor: 'ai', on: '2026-08-02T00:00:00Z' }],
					},
	);

	const output = await new Inistate().execute.call(context);

	assert.deepEqual(
		context.requests.map(({ url, body }) => ({ url, body })),
		[
			{
				url: 'https://api.inistate.com/api/mcp/history',
				body: { module: '9101', entryId: '806548', page: 0 },
			},
			{
				url: 'https://api.inistate.com/api/mcp/history',
				body: { module: '9101', entryId: '806548', page: 1 },
			},
		],
	);
	assert.deepEqual(
		output[0].map(({ json }) => json.id),
		['1', '2'],
	);
});

test('Get History honours the limit without fetching another page', async () => {
	const context = createContext(
		[
			{
				...workspaceAndModule,
				operation: 'getHistory',
				entryId: 'N8N-TEST00001',
				returnAll: false,
				limit: 1,
			},
		],
		() => ({ hasMore: true, histories: [{ id: '1' }, { id: '2' }] }),
	);

	const output = await new Inistate().execute.call(context);

	assert.equal(context.requests.length, 1);
	assert.deepEqual(
		output[0].map(({ json }) => json.id),
		['1'],
	);
});

test('Get Form describes an activity and only sends an entry when one is given', async () => {
	const form = {
		module: 'Task Tracker',
		activity: 'approve',
		form: [{ name: 'Decision', type: 'options', required: true }],
		defaults: {},
		confidence_threshold: 0.8,
		availableActivities: { standard: ['edit'], custom: ['approve'] },
	};
	const context = createContext(
		[
			{
				...workspaceAndModule,
				operation: 'getForm',
				formActivity: { mode: 'list', value: 'approve' },
				formEntryId: 'N8N-TEST00001',
			},
			{
				...workspaceAndModule,
				operation: 'getForm',
				formActivity: { mode: 'id', value: 'create' },
				formEntryId: '',
			},
		],
		() => form,
	);

	const output = await new Inistate().execute.call(context);

	assert.deepEqual(
		context.requests.map(({ url, body }) => ({ url, body })),
		[
			{
				url: 'https://api.inistate.com/api/mcp/form',
				body: { module: '9101', activity: 'approve', entryId: 'N8N-TEST00001' },
			},
			{
				url: 'https://api.inistate.com/api/mcp/form',
				body: { module: '9101', activity: 'create' },
			},
		],
	);
	assert.deepEqual(
		output[0].map(({ json }) => json.confidence_threshold),
		[0.8, 0.8],
	);
});

test('read requests do not claim an n8n write medium', async () => {
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'get', entryId: 'N8N-TEST00001' }],
		() => ({}),
	);

	await new Inistate().execute.call(context);

	assert.deepEqual(context.requests[0].headers, { wsId: '9001' });
});

test('rejects filters that are not a JSON object before any request is sent', async () => {
	const context = createContext(
		[
			{
				...workspaceAndModule,
				operation: 'getAll',
				returnAll: true,
				options: { filters: '{not json' },
			},
		],
		() => ({ hasMore: false, list: [] }),
	);

	await assert.rejects(
		async () => await new Inistate().execute.call(context),
		/must be valid JSON/,
	);
	assert.equal(context.requests.length, 0);
});

test('rejects a missing entry ID before any request is sent', async () => {
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'get', entryId: '  ' }],
		() => ({}),
	);

	await assert.rejects(
		async () => await new Inistate().execute.call(context),
		/Entry ID is required/,
	);
	assert.equal(context.requests.length, 0);
});

test('a failed read reports the item error when continueOnFail is on', async () => {
	const context = createContext(
		[{ ...workspaceAndModule, operation: 'get', entryId: '' }],
		() => ({}),
	);
	context.continueOnFail = () => true;

	const output = await new Inistate().execute.call(context);

	assert.equal(output[0].length, 1);
	assert.match(output[0][0].json.error, /Entry ID is required/);
});

test('offers the standard activity forms alongside the module activities', async () => {
	const context = {
		getCredentials: async () => ({ environment: 'production' }),
		getNodeParameter: (name) =>
			name === 'workspaceId' ? '9001' : name === 'moduleId' ? '9101' : '',
		helpers: {
			async httpRequestWithAuthentication() {
				return { activities: [{ id: 'bd438', name: 'Approve' }] };
			},
		},
		getNode: () => ({ name: 'Inistate' }),
	};

	assert.deepEqual(await listSearch.searchFormActivities.call(context), {
		results: [
			{ name: 'Change State', value: 'changeState' },
			{ name: 'Comment', value: 'comment' },
			{ name: 'Create', value: 'create' },
			{ name: 'Delete', value: 'delete' },
			{ name: 'Duplicate', value: 'duplicate' },
			{ name: 'Edit', value: 'edit' },
			{ name: 'View', value: 'view' },
			{ name: 'Approve', value: 'bd438' },
		],
	});
	assert.deepEqual(await listSearch.searchFormActivities.call(context, 'crea'), {
		results: [{ name: 'Create', value: 'create' }],
	});
});

test('offers the module listings and states as list filter choices', async () => {
	const context = {
		getCredentials: async () => ({ environment: 'production' }),
		getNodeParameter: (name) => (name === 'workspaceId' ? '9001' : '9101'),
		helpers: {
			async httpRequestWithAuthentication() {
				return {
					vectors: [{ id: 9101, menus: [{ id: 'outstanding', name: 'Outstanding Work' }] }],
					states: [
						{ module: '9101', id: 's1', name: 'Pending Approval' },
						{ module: '9999', id: 's2', name: 'Other Module State' },
					],
				};
			},
		},
		getNode: () => ({ name: 'Inistate' }),
	};

	assert.deepEqual(await loadOptions.getListings.call(context), [
		{ name: 'Everything', value: '' },
		{ name: 'Outstanding Work', value: 'Outstanding Work' },
		{ name: 'Archive', value: 'archive' },
	]);
	assert.deepEqual(await loadOptions.getStates.call(context), [
		{ name: 'Pending Approval', value: 'Pending Approval' },
	]);
});
