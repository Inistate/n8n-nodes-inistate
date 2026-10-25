const assert = require('node:assert/strict');
const test = require('node:test');

const { Inistate } = require('../dist/nodes/Inistate/Inistate.node.js');
const { resourceMapping } = require('../dist/nodes/shared/GenericFunctions.js');
const {
	getTableColumns,
	isTableFieldType,
	isTableMapperField,
	mapFormFields,
	normalizeTableValues,
} = require('../dist/nodes/shared/Inistate.contract.js');

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

// An API-key form (POST /api/Activity/Form) designs the table as one item that carries its columns.
const apiKeyInvoiceForm = {
	classificationForm: {
		design: {
			rows: [
				{ items: [{ id: 'iv-debtor', fieldName: 'debtorCode', displayName: 'Customer Code', type: 0 }] },
				{
					items: [
						{
							id: 'iv-lines',
							fieldName: 'lines',
							displayName: 'Lines',
							type: 14,
							input: 'table',
							fields: [
								{ id: 'l-item', fieldName: 'itemCode', displayName: 'Item Code', type: 0 },
								{ id: 'l-qty', fieldName: 'qty', displayName: 'Qty', type: 3 },
								{ id: 'l-price', fieldName: 'unitPrice', displayName: 'Unit Price', type: 4 },
								{ id: 'l-owner', fieldName: 'owner', displayName: 'Owner', type: 20 },
								{
									id: 'l-subtotal',
									fieldName: 'subTotal',
									displayName: 'Subtotal',
									type: 4,
									readOnly: true,
								},
							],
						},
					],
				},
			],
		},
	},
};

// The OAuth form (POST /v1/form) names fields and columns by display name.
const oauthInvoiceForm = {
	form: [
		{ 'Customer Code': { type: 'Text', required: true } },
		{
			Lines: {
				type: 'Table',
				fields: [
					{ 'Item Code': { type: 'Text' } },
					{ Qty: { type: 'Number' } },
					{ 'Unit Price': { type: 'Currency' } },
					{ Owner: { type: 'User', module: 'User Profile' } },
				],
			},
		},
	],
};

test('recognises Table and List fields by number and by name', () => {
	assert.equal(isTableFieldType(14), true);
	assert.equal(isTableFieldType('15'), true);
	assert.equal(isTableFieldType('Table'), true);
	assert.equal(isTableFieldType('list'), true);
	assert.equal(isTableFieldType(0), false);
	assert.equal(isTableFieldType('Text'), false);
	assert.equal(isTableFieldType(undefined), false);
});

test('reads table columns from both form shapes', () => {
	const apiKeyColumns = getTableColumns(
		apiKeyInvoiceForm.classificationForm.design.rows[1].items[0],
	);
	assert.deepEqual(
		apiKeyColumns.map(({ key, label, readOnly, usesFieldNames }) => ({
			key,
			label,
			readOnly,
			usesFieldNames,
		})),
		[
			{ key: 'itemCode', label: 'Item Code', readOnly: false, usesFieldNames: true },
			{ key: 'qty', label: 'Qty', readOnly: false, usesFieldNames: true },
			{ key: 'unitPrice', label: 'Unit Price', readOnly: false, usesFieldNames: true },
			{ key: 'owner', label: 'Owner', readOnly: false, usesFieldNames: true },
			{ key: 'subTotal', label: 'Subtotal', readOnly: true, usesFieldNames: true },
		],
	);
	assert.deepEqual(apiKeyColumns[0].names, ['itemcode', 'item code']);

	const oauthColumns = getTableColumns({ ...oauthInvoiceForm.form[1].Lines, name: 'Lines' });
	assert.deepEqual(
		oauthColumns.map(({ key, names, usesFieldNames }) => ({ key, names, usesFieldNames })),
		[
			{ key: 'Item Code', names: ['item code'], usesFieldNames: false },
			{ key: 'Qty', names: ['qty'], usesFieldNames: false },
			{ key: 'Unit Price', names: ['unit price'], usesFieldNames: false },
			{ key: 'Owner', names: ['owner'], usesFieldNames: false },
		],
	);
});

test('maps a table to an untyped JSON rows field that names its writable columns', () => {
	const [, apiKeyLines] = mapFormFields(apiKeyInvoiceForm);
	assert.deepEqual(apiKeyLines, {
		id: 'lines',
		displayName: 'Lines (JSON rows: Item Code, Qty, Unit Price, Owner)',
		defaultMatch: false,
		canBeUsedToMatch: false,
		required: false,
		display: true,
		readOnly: false,
		defaultValue: '[{"Item Code":"","Qty":"","Unit Price":"","Owner":""}]',
	});
	assert.equal(isTableMapperField(apiKeyLines), true);

	const [customerCode, oauthLines] = mapFormFields(oauthInvoiceForm);
	assert.equal(customerCode.type, 'string');
	assert.equal(isTableMapperField(customerCode), false);
	assert.equal(oauthLines.id, 'Lines');
	assert.equal(oauthLines.type, undefined);
	assert.equal(oauthLines.displayName, 'Lines (JSON rows: Item Code, Qty, Unit Price, Owner)');
});

test('API-key rows are sent by column field name, typed, with empty cells dropped', () => {
	const result = normalizeTableValues(
		{
			debtorCode: '300-A001',
			lines: [
				{ 'ITEM CODE': 'CAT6-305', qty: '2', 'Unit Price': '', id: 'row-from-elsewhere' },
				{ itemCode: { value: 'POC-TEST-02' }, Qty: 1.5 },
			],
		},
		apiKeyInvoiceForm,
		{ keepRowIds: false },
	);

	assert.deepEqual(result, {
		debtorCode: '300-A001',
		lines: [
			{ itemCode: 'CAT6-305', qty: 2 },
			{ itemCode: 'POC-TEST-02', qty: 1.5 },
		],
	});
});

test('API-key rows split a Module or User cell into its text, id and username keys', () => {
	const result = normalizeTableValues(
		{
			lines: [
				{
					'Item Code': 'CAT6-305',
					Owner: { id: 9867820, value: 'Project Owner', username: 'owner@example.com' },
				},
			],
		},
		apiKeyInvoiceForm,
		{ keepRowIds: false },
	);

	assert.deepEqual(result.lines, [
		{
			itemCode: 'CAT6-305',
			owner: 'Project Owner',
			ownerId: 9867820,
			ownerUsername: 'owner@example.com',
		},
	]);
});

test('OAuth rows keep display names and the {value, id} envelope the v1 route reads', () => {
	const result = normalizeTableValues(
		{
			'Customer Code': '300-A001',
			Lines: JSON.stringify([
				{
					'item code': 'CAT6-305',
					Qty: '3',
					Owner: { id: 10191799, value: 'bingqian', username: 'bingqian.lee@inistate.com' },
				},
			]),
		},
		oauthInvoiceForm,
		{ keepRowIds: false },
	);

	assert.deepEqual(result, {
		'Customer Code': '300-A001',
		Lines: [
			{
				'Item Code': 'CAT6-305',
				Qty: 3,
				Owner: { value: 'bingqian', id: 10191799, username: 'bingqian.lee@inistate.com' },
			},
		],
	});
});

test('keeps a row id only where the rows belong to the entry being changed', () => {
	const rows = [{ id: '01c5d1ec-4be3-48ed-811d-32c39f6a593c', 'Item Code': 'CAT6-305', Qty: 1 }];

	assert.deepEqual(
		normalizeTableValues({ Lines: rows }, oauthInvoiceForm, { keepRowIds: true }).Lines,
		[{ id: '01c5d1ec-4be3-48ed-811d-32c39f6a593c', 'Item Code': 'CAT6-305', Qty: 1 }],
	);
	assert.deepEqual(
		normalizeTableValues({ Lines: rows }, oauthInvoiceForm, { keepRowIds: false }).Lines,
		[{ 'Item Code': 'CAT6-305', Qty: 1 }],
	);
});

test('accepts one row object, and leaves out an untouched row template', () => {
	assert.deepEqual(
		normalizeTableValues(
			{ Lines: { 'Item Code': 'CAT6-305', Qty: 1 } },
			oauthInvoiceForm,
			{ keepRowIds: false },
		).Lines,
		[{ 'Item Code': 'CAT6-305', Qty: 1 }],
	);

	const template = mapFormFields(oauthInvoiceForm)[1].defaultValue;
	assert.deepEqual(
		normalizeTableValues({ 'Customer Code': '300-A001', Lines: template }, oauthInvoiceForm, {
			keepRowIds: false,
		}),
		{ 'Customer Code': '300-A001' },
	);
	assert.deepEqual(
		normalizeTableValues({ Lines: '   ' }, oauthInvoiceForm, { keepRowIds: false }),
		{},
	);
});

test('sends an explicit empty array as no rows', () => {
	assert.deepEqual(
		normalizeTableValues({ Lines: '[]' }, oauthInvoiceForm, { keepRowIds: true }),
		{ Lines: [] },
	);
});

test('refuses rows it cannot send, naming the table and the column', () => {
	assert.throws(
		() =>
			normalizeTableValues(
				{ Lines: [{ 'Item Code': 'CAT6-305', Colour: 'red' }] },
				oauthInvoiceForm,
				{ keepRowIds: false },
			),
		{
			message: '"Lines" has no column "Colour". Its columns are: Item Code, Qty, Unit Price, Owner',
		},
	);
	assert.throws(
		() => normalizeTableValues({ Lines: '[{"Qty": 1' }, oauthInvoiceForm, { keepRowIds: false }),
		{ message: '"Lines" must be a JSON array of rows, for example [{"Qty": 1}]' },
	);
	assert.throws(
		() => normalizeTableValues({ Lines: 42 }, oauthInvoiceForm, { keepRowIds: false }),
		{ message: '"Lines" must be a JSON array of rows, for example [{"Qty": 1}]' },
	);
	assert.throws(
		() => normalizeTableValues({ Lines: ['CAT6-305'] }, oauthInvoiceForm, { keepRowIds: false }),
		{ message: 'Row 1 of "Lines" must be an object of column values' },
	);
});

test('leaves fields outside tables untouched', () => {
	const values = { debtorCode: '300-A001', remarks: '[not rows]' };
	assert.deepEqual(normalizeTableValues(values, apiKeyInvoiceForm, { keepRowIds: false }), values);
});

test('API-key Create sends table rows by field name in the activity payload', async () => {
	const node = new Inistate();
	const requests = [];
	const parameters = {
		operation: 'create',
		workspaceId: { mode: 'id', value: '9001' },
		moduleId: { mode: 'id', value: '9101' },
		fields: {
			mappingMode: 'defineBelow',
			value: {
				debtorCode: '300-A001',
				lines: [
					{ 'Item Code': 'CAT6-305', Qty: '2' },
					{ 'Item Code': 'POC-TEST-02', Qty: 1, 'Unit Price': '12.50' },
				],
			},
			matchingColumns: [],
			schema: [
				{ id: 'debtorCode', type: 'string' },
				{ id: 'lines', displayName: 'Lines (JSON rows: Item Code, Qty, Unit Price, Owner)' },
			],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		},
	};
	const context = {
		getCredentials: async () => ({ baseUrl: '' }),
		getInputData: () => [{ json: {} }],
		getNodeParameter(name, _itemIndex, fallback, options) {
			return extractParameter(parameters[name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/api/Activity/Form')) {
					return apiKeyInvoiceForm;
				}
				return { header: { documentId: 'I-000013' } };
			},
		},
		continueOnFail: () => false,
		getNode: () => ({ name: 'Create entry' }),
	};

	await node.execute.call(context);

	assert.deepEqual(
		requests.map(({ options }) => options.url),
		['https://api.inistate.com/api/Activity/Form', 'https://api.inistate.com/api/activity/'],
	);
	assert.deepEqual(requests[0].options.body, { vectorId: '9101', activityId: 'create' });
	assert.deepEqual(requests[1].options.body, {
		activityId: 'create',
		moduleId: '9101',
		payload: {
			debtorCode: '300-A001',
			lines: [
				{ itemCode: 'CAT6-305', qty: 2 },
				{ itemCode: 'POC-TEST-02', qty: 1, unitPrice: 12.5 },
			],
		},
	});
});

test('OAuth Create sends table rows typed in as JSON text to v1 activity', async () => {
	const node = new Inistate();
	const requests = [];
	const parameters = {
		authentication: 'oAuth2',
		operation: 'create',
		workspaceId: { mode: 'id', value: '9001' },
		moduleId: { mode: 'id', value: '9102' },
		fields: {
			mappingMode: 'defineBelow',
			value: {
				'Customer Code': '300-A001',
				Lines: '[{"Item Code": "CAT6-305", "Qty": "2"}]',
			},
			matchingColumns: [],
			schema: [{ id: 'Customer Code', type: 'string' }, { id: 'Lines' }],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		},
	};
	const context = {
		getCredentials: async () => ({ baseUrl: '' }),
		getInputData: () => [{ json: {} }],
		getNode: () => ({ name: 'Create entry', parameters }),
		getNodeParameter(name, _itemIndex, fallback, options) {
			return extractParameter(parameters[name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/v1/workspaces/9001')) {
					return { modules: [{ id: 9102, name: 'Invoices' }] };
				}
				if (options.url.endsWith('/v1/form')) {
					return oauthInvoiceForm;
				}
				if (options.url.endsWith('/v1/activity')) {
					return { header: { documentId: 'I-000013' } };
				}

				throw new Error(`Unexpected OAuth execution URL: ${options.url}`);
			},
		},
		continueOnFail: () => false,
	};

	await node.execute.call(context);

	const activityRequest = requests.find(({ options }) => options.url.endsWith('/v1/activity'));
	assert.deepEqual(activityRequest.options.body, {
		module: 'Invoices',
		activity: 'create',
		input: {
			'Customer Code': '300-A001',
			Lines: [{ 'Item Code': 'CAT6-305', Qty: 2 }],
		},
	});
});

test('a bad row stops the item before anything is sent to the activity route', async () => {
	const node = new Inistate();
	const requests = [];
	const parameters = {
		authentication: 'oAuth2',
		operation: 'create',
		workspaceId: { mode: 'id', value: '9001' },
		moduleId: { mode: 'id', value: '9102' },
		fields: {
			mappingMode: 'defineBelow',
			value: { Lines: [{ Colour: 'red' }] },
			matchingColumns: [],
			schema: [{ id: 'Lines' }],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		},
	};
	const context = {
		getCredentials: async () => ({ baseUrl: '' }),
		getInputData: () => [{ json: {} }],
		getNode: () => ({ name: 'Create entry', parameters }),
		getNodeParameter(name, _itemIndex, fallback, options) {
			return extractParameter(parameters[name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/v1/workspaces/9001')) {
					return { modules: [{ id: 9102, name: 'Invoices' }] };
				}
				if (options.url.endsWith('/v1/form')) {
					return oauthInvoiceForm;
				}

				throw new Error(`Unexpected OAuth execution URL: ${options.url}`);
			},
		},
		continueOnFail: () => true,
	};

	const [[result]] = await node.execute.call(context);

	assert.match(result.json.error, /"Lines" has no column "Colour"/);
	assert.ok(requests.every(({ options }) => !options.url.endsWith('/v1/activity')));
});

test('OAuth Perform Activity keeps the row ids of the entry it changes', async () => {
	const node = new Inistate();
	const requests = [];
	const parameters = {
		authentication: 'oAuth2',
		operation: 'performActivity',
		workspaceId: { mode: 'id', value: '9001' },
		moduleId: { mode: 'id', value: '9102' },
		documentId: 'VND00006',
		activityId: { mode: 'id', value: 'Adjust' },
		fields: {
			mappingMode: 'defineBelow',
			value: {
				Lines: [{ id: '01c5d1ec-4be3-48ed-811d-32c39f6a593c', 'Item Code': 'CAT6-305', Qty: 4 }],
			},
			matchingColumns: [],
			schema: [{ id: 'Lines' }],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		},
	};
	const context = {
		getCredentials: async () => ({ baseUrl: '' }),
		getInputData: () => [{ json: {} }],
		getNode: () => ({ name: 'Adjust entry', parameters }),
		getNodeParameter(name, _itemIndex, fallback, options) {
			return extractParameter(parameters[name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/v1/workspaces/9001')) {
					return { modules: [{ id: 9102, name: 'Vendor Bills' }] };
				}
				if (options.url.endsWith('/v1/form')) {
					return oauthInvoiceForm;
				}
				if (options.url.endsWith('/v1/list')) {
					return { list: [{ entryId: 83698, documentId: 'VND00006' }] };
				}
				if (options.url.endsWith('/v1/activity')) {
					return { header: { documentId: 'VND00006' } };
				}

				throw new Error(`Unexpected OAuth execution URL: ${options.url}`);
			},
		},
		continueOnFail: () => false,
	};

	await node.execute.call(context);

	const activityRequest = requests.find(({ options }) => options.url.endsWith('/v1/activity'));
	assert.deepEqual(activityRequest.options.body, {
		module: 'Vendor Bills',
		activity: 'Adjust',
		entryId: 83698,
		input: {
			Lines: [{ id: '01c5d1ec-4be3-48ed-811d-32c39f6a593c', 'Item Code': 'CAT6-305', Qty: 4 }],
		},
	});
});

test('the field mapping UI offers an OAuth table as a JSON rows field', async () => {
	const requests = [];
	const context = {
		getCredentials: async () => ({ baseUrl: '' }),
		getNode: () => ({ parameters: { authentication: 'oAuth2' } }),
		getNodeParameter(name, fallback, options) {
			const parameters = {
				workspaceId: { value: '9001' },
				moduleId: { value: '9102' },
				operation: 'create',
			};
			return extractParameter(parameters[name] ?? fallback, options);
		},
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				if (options.url.endsWith('/v1/workspaces/9001')) {
					return { modules: [{ id: 9102, name: 'Invoices' }] };
				}
				if (options.url.endsWith('/v1/form')) {
					return { form: oauthInvoiceForm.form.slice(0, 2) };
				}
				if (options.url.endsWith('/v1/list')) {
					return { list: [] };
				}

				throw new Error(`Unexpected OAuth test URL: ${options.url}`);
			},
		},
	};

	const result = await resourceMapping.getFormFields.call(context);
	const lines = result.fields.find(({ id }) => id === 'Lines');
	assert.equal(lines.type, undefined);
	assert.equal(lines.displayName, 'Lines (JSON rows: Item Code, Qty, Unit Price, Owner)');
	assert.equal(
		lines.defaultValue,
		'[{"Item Code":"","Qty":"","Unit Price":"","Owner":""}]',
	);
});
