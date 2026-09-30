const assert = require('node:assert/strict');
const test = require('node:test');

const {
	buildActionBody,
	buildApiHeaders,
	buildSubscription,
	extractCollection,
	extractFormElements,
	resolveInistateBaseUrl,
	getFormDefaultValues,
	getMappedFieldValues,
	getTriggerItem,
	mapFormFields,
	toFieldSearchItems,
	toReferenceFieldOptions,
	toSearchItems,
} = require('../dist/nodes/shared/Inistate.contract.js');

test('falls back to the production host and normalises a custom base URL', () => {
	assert.equal(resolveInistateBaseUrl(undefined), 'https://api.inistate.com');
	assert.equal(resolveInistateBaseUrl(''), 'https://api.inistate.com');
	assert.equal(resolveInistateBaseUrl('   '), 'https://api.inistate.com');
	assert.equal(
		resolveInistateBaseUrl('https://internal.test.example.com'),
		'https://internal.test.example.com',
	);
	assert.equal(
		resolveInistateBaseUrl('https://internal.test.example.com//'),
		'https://internal.test.example.com',
	);
	assert.equal(resolveInistateBaseUrl('http://insecure.test.example.com'), 'https://api.inistate.com');
});

test('builds activity headers with the n8n medium and metadata headers without it', () => {
	assert.deepEqual(buildApiHeaders('9001'), { wsId: '9001', medium: 'n8n' });
	assert.deepEqual(buildApiHeaders('9001', false), { wsId: '9001' });
});

test('extracts only resource-mapper field values', () => {
	assert.deepEqual(
		getMappedFieldValues({
			mappingMode: 'defineBelow',
			value: { title: 'N8N-TEST task', priority: 'High' },
			matchingColumns: [],
			schema: [],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		}),
		{ title: 'N8N-TEST task', priority: 'High' },
	);
});

test('maps reference selections to flat Inistate activity payload fields', () => {
	const moduleOptions = toReferenceFieldOptions(7, [{ id: 806568, value: 'N8N Sandbox Project' }]);
	const userOptions = toReferenceFieldOptions(20, [
		{ id: 806569, value: 'N8N Test User One', username: 'n8n.test.user1' },
	]);

	assert.deepEqual(
		moduleOptions.map(({ name }) => name),
		['N8N Sandbox Project'],
	);
	assert.deepEqual(
		userOptions.map(({ name }) => name),
		['N8N Test User One'],
	);
	assert.deepEqual(
		getMappedFieldValues({
			'Related Project': moduleOptions[0].value,
			Assignee: userOptions[0].value,
		}),
		{
			'Related Project': 'N8N Sandbox Project',
			'Related ProjectId': 806568,
			Assignee: 'N8N Test User One',
			AssigneeId: 806569,
			AssigneeUsername: 'n8n.test.user1',
		},
	);
});

test('maps expression reference objects for reference fields', () => {
	const moduleOptions = toReferenceFieldOptions(7, [{ id: 9867845, value: 'PJ001' }]);
	const userOptions = toReferenceFieldOptions(20, [
		{ id: 9867820, value: 'Project Owner', username: 'owner@example.com' },
	]);

	assert.deepEqual(
		getMappedFieldValues({
			mappingMode: 'defineBelow',
			value: {
				Project: { id: 9867845, name: 'PJ001' },
				Owner: { id: 9867820, name: 'Project Owner', username: 'owner@example.com' },
			},
			matchingColumns: [],
			schema: [
				{ id: 'Project', type: 'options', options: moduleOptions },
				{ id: 'Owner', type: 'options', options: userOptions },
			],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		}),
		{
			Project: 'PJ001',
			ProjectId: 9867845,
			Owner: 'Project Owner',
			OwnerId: 9867820,
			OwnerUsername: 'owner@example.com',
		},
	);
});

test('maps natural trigger values to matching reference options', () => {
	const moduleOptions = toReferenceFieldOptions(7, [{ id: 9867845, value: 'PJ001' }]);
	const userOptions = toReferenceFieldOptions(20, [
		{ id: 9867820, value: 'Project Owner', username: 'owner@example.com' },
	]);

	assert.deepEqual(
		getMappedFieldValues({
			mappingMode: 'defineBelow',
			value: {
				ProjectFromCode: 'PJ001',
				ProjectFromId: 9867845,
				Owner: { Text: 'owner@example.com', Id: 9867820 },
			},
			matchingColumns: [],
			schema: [
				{ id: 'ProjectFromCode', type: 'options', options: moduleOptions },
				{ id: 'ProjectFromId', type: 'options', options: moduleOptions },
				{ id: 'Owner', type: 'options', options: userOptions },
			],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		}),
		{
			ProjectFromCode: 'PJ001',
			ProjectFromCodeId: 9867845,
			ProjectFromId: 'PJ001',
			ProjectFromIdId: 9867845,
			Owner: 'Project Owner',
			OwnerId: 9867820,
			OwnerUsername: 'owner@example.com',
		},
	);
});

test('does not guess when a trigger value matches multiple reference options', () => {
	const duplicateOptions = toReferenceFieldOptions(7, [
		{ id: 9867845, value: 'PJ001' },
		{ id: 9867999, value: 'PJ001' },
	]);

	assert.deepEqual(
		getMappedFieldValues({
			mappingMode: 'defineBelow',
			value: { Project: 'PJ001' },
			matchingColumns: [],
			schema: [{ id: 'Project', type: 'options', options: duplicateOptions }],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		}),
		{ Project: 'PJ001' },
	);
});

test('does not reinterpret expression objects for non-reference fields', () => {
	const metadata = { id: 9867845, name: 'PJ001' };

	assert.deepEqual(
		getMappedFieldValues({
			mappingMode: 'defineBelow',
			value: { Metadata: metadata },
			matchingColumns: [],
			schema: [{ id: 'Metadata', type: 'object' }],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		}),
		{ Metadata: metadata },
	);
});

test('builds all five protected P0 action request bodies', () => {
	assert.deepEqual(
		buildActionBody({
			operation: 'create',
			moduleId: '9101',
			fields: { title: 'Task' },
		}),
		{ activityId: 'create', moduleId: '9101', payload: { title: 'Task' } },
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'update',
			moduleId: '9101',
			documentId: 'N8N-TEST00001',
			fields: { priority: 'High' },
		}),
		{
			activityId: 'edit',
			moduleId: '9101',
			entry: 'N8N-TEST00001',
			payload: { priority: 'High' },
		},
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'performActivity',
			moduleId: '9101',
			documentId: 'N8N-TEST00001',
			activityId: 'activity-1',
			fields: null,
		}),
		{
			activityId: 'activity-1',
			moduleId: '9101',
			entry: 'N8N-TEST00001',
			payload: {},
		},
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'changeState',
			moduleId: '9101',
			documentId: 'N8N-TEST00001',
			stateName: 'Completed',
		}),
		{
			activityId: 'changeStatus',
			moduleId: '9101',
			entry: 'N8N-TEST00001',
			state: 'Completed',
		},
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'assign',
			moduleId: '9101',
			documentId: 'N8N-TEST00001',
			username: 'tester@example.com',
			dueDate: '2026-08-21T17:30:00+08:00',
		}),
		{
			activityId: 'assign',
			assignees: ['tester@example.com'],
			due: '2026-08-21T17:30:00+08:00',
			entry: 'N8N-TEST00001',
			moduleId: '9101',
		},
	);
});

test('builds the two P1 action request bodies', () => {
	assert.deepEqual(
		buildActionBody({
			operation: 'delete',
			moduleId: '9101',
			documentId: 'N8N-TEST00001',
		}),
		{
			activityId: 'delete',
			moduleId: '9101',
			entry: 'N8N-TEST00001',
		},
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'duplicate',
			moduleId: '9101',
			documentId: 'N8N-TEST00001',
		}),
		{
			activityId: 'duplicate',
			moduleId: '9101',
			entry: 'N8N-TEST00001',
		},
	);
});

test('omits an empty optional assignment due date and validates operation identifiers', () => {
	assert.deepEqual(
		buildActionBody({
			operation: 'assign',
			moduleId: '9101',
			documentId: 'N8N-TEST00001',
			username: 'tester@example.com',
		}),
		{
			activityId: 'assign',
			assignees: ['tester@example.com'],
			entry: 'N8N-TEST00001',
			moduleId: '9101',
		},
	);
	assert.throws(
		() =>
			buildActionBody({
				operation: 'update',
				moduleId: '9101',
				fields: {},
			}),
		/Document ID is required/,
	);
	assert.throws(
		() =>
			buildActionBody({
				operation: 'update',
				moduleId: '9101',
				documentId: '806548',
				fields: { priority: 'Medium' },
			}),
		/Use the document ID.*P0 00006.*not the internal numeric entry ID/,
	);
});

test('builds all protected trigger subscriptions', () => {
	assert.equal(getTriggerItem('entryCreated'), 'create');
	assert.equal(getTriggerItem('entryUpdated'), 'edit');
	assert.equal(getTriggerItem('activityPerformed', 'activity-1'), 'activity-1');
	assert.throws(() => getTriggerItem('activityPerformed'), /Activity ID is required/);
	assert.deepEqual(buildSubscription('9101', 'edit', 'https://n8n.example/webhook/id'), {
		moduleId: '9101',
		item: 'edit',
		type: 'activity',
		trigger: 'execute',
		channel: 'n8n',
		url: 'https://n8n.example/webhook/id',
	});
	assert.deepEqual(
		buildSubscription('9101', 'state-1', 'https://n8n.example/webhook/id', 'state', 'changeTo'),
		{
			moduleId: '9101',
			item: 'state-1',
			type: 'state',
			trigger: 'changeTo',
			channel: 'n8n',
			url: 'https://n8n.example/webhook/id',
		},
	);
});

test('normalizes selector response shapes, filters, and de-duplicates values', () => {
	assert.deepEqual(extractCollection({ vectors: [{ id: 1 }] }, 'vectors'), [{ id: 1 }]);
	assert.deepEqual(extractCollection({ data: [{ id: 2 }] }), [{ id: 2 }]);
	assert.deepEqual(
		toSearchItems(
			[
				{ id: 9001, name: 'N8N Production Sandbox' },
				{ id: 9001, name: 'Duplicate' },
				{ id: 2, name: 'Other' },
			],
			['id'],
			['name'],
			'production',
		),
		[{ name: 'N8N Production Sandbox', value: '9001' }],
	);
});

const nestedFormResponse = {
	classificationForm: {
		default: {
			'title-id': 'Existing title',
			'blocked-id': false,
			'priority-id': 'Low',
			'readonly-id': 42,
			'unsupported-id': 'Preserve this value',
		},
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
						{
							input: 'section',
							design: {
								rows: [
									{
										items: [
											{
												id: 'blocked-id',
												fieldName: 'blocked',
												displayName: 'Is Blocked',
												type: 1,
											},
										],
									},
								],
							},
						},
						{
							input: 'section',
							type: 'tab',
							tabs: [
								{
									design: {
										rows: [
											{
												items: [
													{
														id: 'priority-id',
														fieldName: 'priority',
														displayName: 'Priority',
														type: 27,
														optionList: [{ name: 'Low' }, { name: 'High' }],
													},
													{
														id: 'readonly-id',
														fieldName: 'computed',
														displayName: 'Computed',
														type: 3,
														readOnly: true,
													},
													{
														id: 'unsupported-id',
														fieldName: 'unsupported',
														displayName: 'Unsupported',
														type: 999,
													},
												],
											},
										],
									},
								},
							],
						},
					],
				},
			],
		},
	},
};

test('recursively maps nested sections and tabs while handling read-only and unsupported fields', () => {
	assert.equal(extractFormElements(nestedFormResponse).length, 5);
	const fields = mapFormFields(nestedFormResponse);
	assert.deepEqual(
		fields.map(({ id, type, required, display, readOnly, options }) => ({
			id,
			type,
			required,
			display,
			readOnly,
			options,
		})),
		[
			{
				id: 'title',
				type: 'string',
				required: true,
				display: true,
				readOnly: false,
				options: undefined,
			},
			{
				id: 'blocked',
				type: 'boolean',
				required: false,
				display: true,
				readOnly: false,
				options: undefined,
			},
			{
				id: 'priority',
				type: 'options',
				required: false,
				display: true,
				readOnly: false,
				options: [
					{ name: 'Low', value: 'Low' },
					{ name: 'High', value: 'High' },
				],
			},
			{
				id: 'computed',
				type: 'number',
				required: false,
				display: false,
				readOnly: true,
				options: undefined,
			},
		],
	);
});

test('provides the supporting Field selector from recursively nested form elements', () => {
	assert.deepEqual(toFieldSearchItems(nestedFormResponse, 'priority'), [
		{ name: 'Priority', value: 'priority-id' },
	]);
});

test('maps edit-form defaults to field names while excluding read-only values', () => {
	assert.deepEqual(getFormDefaultValues(nestedFormResponse), {
		title: 'Existing title',
		blocked: false,
		priority: 'Low',
		unsupported: 'Preserve this value',
	});
});
