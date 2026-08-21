const assert = require('node:assert/strict');
const test = require('node:test');

const {
	buildActionBody,
	buildApiHeaders,
	buildSubscription,
	extractCollection,
	extractFormElements,
	getFormDefaultValues,
	getMappedFieldValues,
	getTriggerItem,
	mapFormFields,
	toFieldSearchItems,
	toSearchItems,
} = require('../dist/nodes/shared/Inistate.contract.js');

test('builds activity headers with the n8n medium and metadata headers without it', () => {
	assert.deepEqual(buildApiHeaders('2307'), { wsId: '2307', medium: 'n8n' });
	assert.deepEqual(buildApiHeaders('2307', false), { wsId: '2307' });
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

test('builds all five protected P0 action request bodies', () => {
	assert.deepEqual(
		buildActionBody({ operation: 'create', moduleId: '19296', fields: { title: 'Task' } }),
		{ activityId: 'create', moduleId: '19296', payload: { title: 'Task' } },
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'update',
			moduleId: '19296',
			documentId: 'N8N-TEST00001',
			fields: { priority: 'High' },
		}),
		{
			activityId: 'edit',
			moduleId: '19296',
			entry: 'N8N-TEST00001',
			payload: { priority: 'High' },
		},
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'performActivity',
			moduleId: '19296',
			documentId: 'N8N-TEST00001',
			activityId: 'activity-1',
			fields: null,
		}),
		{
			activityId: 'activity-1',
			moduleId: '19296',
			entry: 'N8N-TEST00001',
			payload: {},
		},
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'changeState',
			moduleId: '19296',
			documentId: 'N8N-TEST00001',
			stateName: 'Completed',
		}),
		{
			activityId: 'changeStatus',
			moduleId: '19296',
			entry: 'N8N-TEST00001',
			state: 'Completed',
		},
	);

	assert.deepEqual(
		buildActionBody({
			operation: 'assign',
			moduleId: '19296',
			documentId: 'N8N-TEST00001',
			username: 'tester@example.com',
			dueDate: '2026-08-21T17:30:00+08:00',
		}),
		{
			activityId: 'assign',
			assignees: ['tester@example.com'],
			due: '2026-08-21T17:30:00+08:00',
			entry: 'N8N-TEST00001',
			moduleId: '19296',
		},
	);
});

test('omits an empty optional assignment due date and validates operation identifiers', () => {
	assert.deepEqual(
		buildActionBody({
			operation: 'assign',
			moduleId: '19296',
			documentId: 'N8N-TEST00001',
			username: 'tester@example.com',
		}),
		{
			activityId: 'assign',
			assignees: ['tester@example.com'],
			entry: 'N8N-TEST00001',
			moduleId: '19296',
		},
	);
	assert.throws(
		() =>
			buildActionBody({
				operation: 'update',
				moduleId: '19296',
				fields: {},
			}),
		/Document ID is required/,
	);
	assert.throws(
		() =>
			buildActionBody({
				operation: 'update',
				moduleId: '19296',
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
	assert.deepEqual(buildSubscription('19296', 'edit', 'https://n8n.example/webhook/id'), {
		moduleId: '19296',
		item: 'edit',
		type: 'activity',
		trigger: 'execute',
		channel: 'n8n',
		url: 'https://n8n.example/webhook/id',
	});
});

test('normalizes selector response shapes, filters, and de-duplicates values', () => {
	assert.deepEqual(extractCollection({ vectors: [{ id: 1 }] }, 'vectors'), [{ id: 1 }]);
	assert.deepEqual(extractCollection({ data: [{ id: 2 }] }), [{ id: 2 }]);
	assert.deepEqual(
		toSearchItems(
			[
				{ id: 2307, name: 'N8N Node Testing' },
				{ id: 2307, name: 'Duplicate' },
				{ id: 2, name: 'Other' },
			],
			['id'],
			['name'],
			'node',
		),
		[{ name: 'N8N Node Testing', value: '2307' }],
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
