const assert = require('node:assert/strict');
const test = require('node:test');

const {
	buildEntryBody,
	buildFormBody,
	buildHistoryBody,
	buildListBody,
	getResponsePage,
	MAX_LIST_PAGE_SIZE,
	parseFieldList,
	parseFilters,
	requireEntryId,
} = require('../dist/nodes/shared/InistateRead.contract.js');

test('accepts either the document ID or the numeric entry ID', () => {
	assert.equal(requireEntryId(' N8N-TEST00001 '), 'N8N-TEST00001');
	assert.equal(requireEntryId(806548), '806548');
	assert.throws(() => requireEntryId('   '), /Entry ID is required/);
	assert.throws(() => requireEntryId(undefined), /Entry ID is required/);
});

test('builds the single entry and history request bodies', () => {
	assert.deepEqual(buildEntryBody('9101', 'N8N-TEST00001'), {
		module: '9101',
		entryId: 'N8N-TEST00001',
	});
	assert.deepEqual(buildHistoryBody('9101', 806548, 2), {
		module: '9101',
		entryId: '806548',
		page: 2,
	});
	assert.deepEqual(buildHistoryBody('9101', 'N8N-TEST00001', -3).page, 0);
});

test('builds the form request body and omits a blank entry', () => {
	assert.deepEqual(buildFormBody('9101', 'create'), { module: '9101', activity: 'create' });
	assert.deepEqual(buildFormBody('9101', ' approve ', ' N8N-TEST00001 '), {
		module: '9101',
		activity: 'approve',
		entryId: 'N8N-TEST00001',
	});
	assert.deepEqual(buildFormBody('9101', 'create', '   '), {
		module: '9101',
		activity: 'create',
	});
	assert.throws(() => buildFormBody('9101', ''), /Activity is required/);
});

test('sends only the list options that carry a value', () => {
	assert.deepEqual(buildListBody('9101', 0, 50), {
		module: '9101',
		currentPage: 0,
		pageSize: 50,
	});
	assert.deepEqual(
		buildListBody('9101', 1, 25, {
			assignee: ' alex ',
			createdBy: '',
			listing: 'Outstanding',
			search: 'invoice',
			sortBy: 'Updated Date',
			sortDirection: 'desc',
			state: 'Pending Approval',
			fields: 'Title, Status ,,Amount',
			filters: '{"Status": "Active"}',
		}),
		{
			module: '9101',
			currentPage: 1,
			pageSize: 25,
			assignee: 'alex',
			listing: 'Outstanding',
			search: 'invoice',
			sortBy: 'Updated Date',
			sortDirection: 'desc',
			state: 'Pending Approval',
			fields: ['Title', 'Status', 'Amount'],
			filters: { Status: 'Active' },
		},
	);
});

test('clamps the page size to what the list endpoint will serve', () => {
	assert.equal(buildListBody('9101', 0, 5000).pageSize, MAX_LIST_PAGE_SIZE);
	assert.equal(buildListBody('9101', 0, 0).pageSize, 1);
	assert.equal(buildListBody('9101', -4, 10).currentPage, 0);
});

test('parses comma separated field projections', () => {
	assert.deepEqual(parseFieldList('Title, Status'), ['Title', 'Status']);
	assert.deepEqual(parseFieldList(['Title', ' Status ', '']), ['Title', 'Status']);
	assert.deepEqual(parseFieldList(''), []);
	assert.deepEqual(parseFieldList(undefined), []);
});

test('accepts filters as JSON text or an object and rejects anything else', () => {
	assert.deepEqual(parseFilters('{"or": [{"Status": "Active"}]}'), {
		or: [{ Status: 'Active' }],
	});
	assert.deepEqual(parseFilters({ Status: 'Active' }), { Status: 'Active' });
	assert.equal(parseFilters('  '), undefined);
	assert.equal(parseFilters({}), undefined);
	assert.equal(parseFilters(undefined), undefined);
	assert.throws(() => parseFilters('{not json'), /must be valid JSON/);
	assert.throws(() => parseFilters('[1,2]'), /must be a JSON object/);
	assert.throws(() => parseFilters('"text"'), /must be a JSON object/);
});

test('unwraps a paged collection without renaming any record field', () => {
	assert.deepEqual(
		getResponsePage(
			{
				module: 'Task Tracker',
				listing: 'Everything',
				page: 0,
				pageSize: 50,
				totalItems: 2,
				hasMore: true,
				list: [
					{ entryId: 1, documentId: 'N8N-TEST00001', state: 'Open', data: { Title: 'One' } },
					'not-an-object',
				],
			},
			'list',
		),
		{
			items: [{ entryId: 1, documentId: 'N8N-TEST00001', state: 'Open', data: { Title: 'One' } }],
			hasMore: true,
		},
	);
	assert.deepEqual(getResponsePage({ histories: [], hasMore: false }, 'histories'), {
		items: [],
		hasMore: false,
	});
	assert.deepEqual(getResponsePage(null, 'list'), { items: [], hasMore: false });
});
