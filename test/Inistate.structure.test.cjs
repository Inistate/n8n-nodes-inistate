const assert = require('node:assert/strict');
const test = require('node:test');

const { Inistate } = require('../dist/nodes/Inistate/Inistate.node.js');
const { assignEntryAction } = require('../dist/nodes/Inistate/actions/entry/assign.operation.js');
const {
	changeStateAction,
} = require('../dist/nodes/Inistate/actions/entry/changeState.operation.js');
const { createEntryAction } = require('../dist/nodes/Inistate/actions/entry/create.operation.js');
const { deleteEntryAction } = require('../dist/nodes/Inistate/actions/entry/delete.operation.js');
const {
	duplicateEntryAction,
} = require('../dist/nodes/Inistate/actions/entry/duplicate.operation.js');
const {
	performActivityAction,
} = require('../dist/nodes/Inistate/actions/entry/performActivity.operation.js');
const { updateEntryAction } = require('../dist/nodes/Inistate/actions/entry/update.operation.js');
const { InistateTrigger } = require('../dist/nodes/InistateTrigger/InistateTrigger.node.js');
const {
	activityPerformedEvent,
} = require('../dist/nodes/InistateTrigger/events/activityPerformed.event.js');
const { entryCreatedEvent } = require('../dist/nodes/InistateTrigger/events/entryCreated.event.js');
const { entryUpdatedEvent } = require('../dist/nodes/InistateTrigger/events/entryUpdated.event.js');
const { stateChangedEvent } = require('../dist/nodes/InistateTrigger/events/stateChanged.event.js');

test('advertises exactly the seven action modules registered by the action node', () => {
	const definitions = [
		assignEntryAction,
		changeStateAction,
		createEntryAction,
		deleteEntryAction,
		duplicateEntryAction,
		performActivityAction,
		updateEntryAction,
	];
	const operationProperty = new Inistate().description.properties.find(
		(property) => property.name === 'operation',
	);

	assert.deepEqual(
		definitions.map(({ operation }) => operation),
		['assign', 'changeState', 'create', 'delete', 'duplicate', 'performActivity', 'update'],
	);
	assert.deepEqual(
		operationProperty.options.map(({ value }) => value),
		definitions.map(({ operation }) => operation),
	);
	for (const definition of definitions) {
		assert.equal(definition.option.value, definition.operation);
		assert.ok(definition.properties.length > 0);
	}

	const expectedScopedProperties = {
		assign: ['documentId', 'username', 'dueDate'],
		changeState: ['documentId', 'stateName'],
		create: ['fields'],
		delete: ['deleteWarning', 'documentId'],
		duplicate: ['documentId'],
		performActivity: ['documentId', 'activityId', 'fields'],
		update: ['documentId', 'fields'],
	};
	for (const [operation, expectedNames] of Object.entries(expectedScopedProperties)) {
		const visibleNames = new Inistate().description.properties
			.filter((property) => property.displayOptions?.show?.operation?.includes(operation))
			.map(({ name }) => name);
		assert.deepEqual(visibleNames, expectedNames);
		assert.equal(new Set(visibleNames).size, visibleNames.length);
	}
});

test('advertises exactly the four event modules registered by the trigger node', () => {
	const definitions = [
		activityPerformedEvent,
		entryCreatedEvent,
		entryUpdatedEvent,
		stateChangedEvent,
	];
	const eventProperty = new InistateTrigger().description.properties.find(
		(property) => property.name === 'event',
	);

	assert.deepEqual(
		definitions.map(({ event }) => event),
		['activityPerformed', 'entryCreated', 'entryUpdated', 'stateChanged'],
	);
	assert.deepEqual(
		eventProperty.options.map(({ value }) => value),
		definitions.map(({ event }) => event),
	);
	for (const definition of definitions) {
		assert.equal(definition.option.value, definition.event);
	}
	assert.equal(eventProperty.displayName, 'Trigger On');
	assert.deepEqual(
		new InistateTrigger().description.properties
			.filter((property) => property.displayOptions?.show?.event?.includes('stateChanged'))
			.map(({ name }) => name),
		['stateChangeDirection', 'stateId'],
	);
});
