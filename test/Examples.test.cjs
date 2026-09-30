const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { Inistate } = require('../dist/nodes/Inistate/Inistate.node.js');
const { InistateTrigger } = require('../dist/nodes/InistateTrigger/InistateTrigger.node.js');

const examplesDir = path.join(__dirname, '..', 'examples');
const workflows = fs
	.readdirSync(examplesDir)
	.filter((file) => file.endsWith('.workflow.json'))
	.map((file) => ({
		file,
		workflow: JSON.parse(fs.readFileSync(path.join(examplesDir, file), 'utf8')),
	}));

const optionValues = (node, name) =>
	node.description.properties
		.find((property) => property.name === name)
		.options.map((o) => o.value);
const actionOperations = optionValues(new Inistate(), 'operation');
const triggerEvents = optionValues(new InistateTrigger(), 'event');

function expressionsOf(value, found = []) {
	if (typeof value === 'string' && value.startsWith('=')) {
		for (const match of value.matchAll(/\{\{([\s\S]*?)\}\}(?!\})/g)) found.push(match[1]);
	} else if (value && typeof value === 'object') {
		for (const child of Object.values(value)) expressionsOf(child, found);
	}
	return found;
}

function byName(workflow, name) {
	const node = workflow.nodes.find((candidate) => candidate.name === name);
	assert.ok(node, `node "${name}" exists`);
	return node;
}

// Evaluates an n8n expression body with the handful of globals the templates use.
function evaluate(expression, { json, nodes = {} }) {
	const $ = (name) => ({ item: { json: nodes[name] } });
	const DateTime = { fromISO: () => ({ toRelative: () => '4 days ago' }) };
	return new Function('$json', '$', 'DateTime', `return (${expression});`)(json, $, DateTime);
}

test('every example workflow is present', () => {
	assert.deepEqual(workflows.map(({ file }) => file).sort(), [
		'approve-by-email.workflow.json',
		'create-inistate-entry.workflow.json',
		'stale-approvals-digest.workflow.json',
		'wait-for-inistate-approval.workflow.json',
	]);
});

for (const { file, workflow } of workflows) {
	test(`${file}: connections only reference nodes that exist`, () => {
		const names = new Set(workflow.nodes.map((node) => node.name));
		assert.equal(names.size, workflow.nodes.length, 'node names are unique');
		for (const [from, { main }] of Object.entries(workflow.connections)) {
			assert.ok(names.has(from), `source "${from}" exists`);
			for (const target of main.flat())
				assert.ok(names.has(target.node), `target "${target.node}" exists`);
		}
	});

	test(`${file}: ships without credentials, workspace, module, or record data`, () => {
		for (const node of workflow.nodes) {
			assert.equal(node.credentials, undefined, `${node.name} has no credentials`);
			for (const key of ['workspaceId', 'moduleId', 'stateId', 'activityId']) {
				if (node.parameters[key])
					assert.equal(node.parameters[key].value, '', `${node.name}.${key} is blank`);
			}
		}
		assert.equal(workflow.active, false);
	});

	test(`${file}: Inistate nodes use operations and events the package defines`, () => {
		for (const node of workflow.nodes) {
			if (node.type === 'n8n-nodes-inistate.inistate') {
				assert.ok(
					actionOperations.includes(node.parameters.operation),
					`${node.name}: ${node.parameters.operation}`,
				);
			}
			if (node.type === 'n8n-nodes-inistate.inistateTrigger') {
				assert.ok(
					triggerEvents.includes(node.parameters.event),
					`${node.name}: ${node.parameters.event}`,
				);
			}
		}
	});

	test(`${file}: every expression is valid JavaScript`, () => {
		for (const node of workflow.nodes) {
			for (const expression of expressionsOf(node.parameters)) {
				assert.doesNotThrow(
					() => new Function(`return (${expression});`),
					`${node.name}: ${expression}`,
				);
			}
		}
	});
}

const hostile = '<a href="https://evil.example">Click</a> & "quote"';

test('approval email escapes entry values before n8n inserts them into HTML', () => {
	const workflow = workflows.find(({ file }) => file === 'approve-by-email.workflow.json').workflow;
	const [expression] = expressionsOf(
		byName(workflow, 'Build approval email').parameters.assignments.assignments.find(
			(a) => a.name === 'message',
		).value,
	);
	const message = evaluate(expression, {
		json: {
			documentId: 'PR-00042',
			module: 'Purchase Request',
			createdBy: hostile,
			data: { Title: hostile, Supplier: { value: 'Dell <b>MY</b>' }, Amount: 4200, Notes: null },
		},
	});

	assert.ok(!message.includes('<a '), 'no raw markup survives');
	assert.ok(
		message.includes('&lt;a href=&quot;https://evil.example&quot;&gt;Click&lt;/a&gt; &amp;'),
	);
	assert.ok(
		message.includes('Supplier: Dell &lt;b&gt;MY&lt;/b&gt;'),
		'enveloped values are unwrapped',
	);
	assert.ok(message.includes('Amount: 4200'));
	assert.ok(message.includes('Notes: \n') || message.endsWith('Notes: '), 'null renders empty');
});

test('approval decision re-checks the activity that matches the answer', () => {
	const workflow = workflows.find(({ file }) => file === 'approve-by-email.workflow.json').workflow;
	const [expression] = expressionsOf(
		byName(workflow, 'Still actionable?').parameters.conditions.conditions[0].leftValue,
	);
	const nodes = (approved) => ({
		Settings: { approveActivity: 'Approve', rejectActivity: 'Reject' },
		'Ask approver by email': { data: { approved } },
	});

	assert.equal(
		evaluate(expression, {
			json: { availableActivities: { custom: ['Approve'] } },
			nodes: nodes(true),
		}),
		true,
	);
	assert.equal(
		evaluate(expression, {
			json: { availableActivities: { custom: ['Approve'] } },
			nodes: nodes(false),
		}),
		false,
	);
	assert.equal(
		evaluate(expression, { json: { availableActivities: { custom: [] } }, nodes: nodes(true) }),
		false,
	);
	assert.equal(
		evaluate(expression, { json: {}, nodes: nodes(true) }),
		false,
		'missing availability is not actionable',
	);
});

test('stale digest escapes entry values in its HTML table', () => {
	const workflow = workflows.find(
		({ file }) => file === 'stale-approvals-digest.workflow.json',
	).workflow;
	const [expression] = expressionsOf(
		byName(workflow, 'Build digest').parameters.assignments.assignments.find(
			(a) => a.name === 'html',
		).value,
	);
	const html = evaluate(expression, {
		json: {
			entries: [
				{
					documentId: 'PR-00042',
					updatedDate: '2026-09-20T00:00:00Z',
					updatedBy: hostile,
					assignees: ['Tan', '<i>x</i>'],
				},
				{ documentId: 'PR-00043' },
			],
		},
		nodes: { Settings: { pendingState: 'Pending <Approval>', staleDays: 3 } },
	});

	assert.ok(!html.includes('<a '), 'no raw markup from entries');
	assert.ok(html.includes('<b>Pending &lt;Approval&gt;</b>'));
	assert.ok(html.includes('<td>Tan, &lt;i&gt;x&lt;/i&gt;</td>'));
	assert.equal((html.match(/<tr>/g) ?? []).length, 3, 'header plus one row per entry');
});

test('wait-for-approval loops back to Wait until decided or out of checks', () => {
	const workflow = workflows.find(
		({ file }) => file === 'wait-for-inistate-approval.workflow.json',
	).workflow;
	assert.deepEqual(workflow.connections['Keep waiting?'].main, [
		[{ node: 'Wait', type: 'main', index: 0 }],
		[{ node: 'Give up', type: 'main', index: 0 }],
	]);
	const [decided] = expressionsOf(
		byName(workflow, 'Decided?').parameters.conditions.conditions[0].leftValue,
	);
	const nodes = { Settings: { approvedState: 'Approved', rejectedState: 'Rejected' } };
	assert.equal(evaluate(decided, { json: { state: 'Rejected' }, nodes }), true);
	assert.equal(evaluate(decided, { json: { state: 'Pending Approval' }, nodes }), false);
});
