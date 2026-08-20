const assert = require('node:assert/strict');

const {
	APP02_BASE_URL,
	buildActionBody,
	buildApiHeaders,
	buildSubscription,
	extractCollection,
	getWebhookId,
	mapFormFields,
} = require('../dist/nodes/shared/Inistate.contract.js');

const apiKey = process.env.INISTATE_API_KEY;
const workspaceId = process.env.INISTATE_WORKSPACE_ID ?? '2307';
const moduleId = process.env.INISTATE_MODULE_ID ?? '19296';
const runId = `N8N-TEST-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

if (!apiKey) {
	throw new Error('INISTATE_API_KEY is required; supply it through the environment, never source control');
}

const createdDocuments = new Set();
let temporaryHookId;

function headers(includeWorkspace = true, includeMedium = false) {
	return {
		Accept: 'application/json',
		Authorization: `fsk ${apiKey}`,
		'Content-Type': 'application/json',
		...(includeWorkspace ? buildApiHeaders(workspaceId, includeMedium) : {}),
	};
}

async function request(path, options = {}) {
	const response = await fetch(`${APP02_BASE_URL}${path}`, {
		method: options.method ?? 'GET',
		headers: options.headers ?? headers(),
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
		signal: AbortSignal.timeout(45_000),
	});
	const text = await response.text();
	let data = text;
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			// Some App02 endpoints intentionally return a direct string identifier.
		}
	}

	if (!response.ok) {
		throw new Error(`App02 ${options.method ?? 'GET'} ${path} failed with HTTP ${response.status}`);
	}

	return data;
}

async function getForm(activityId) {
	return await request('/api/Activity/Form', {
		method: 'POST',
		headers: headers(false),
		body: { vectorId: moduleId, activityId },
	});
}

function makePayload(form, valuesByLabel) {
	const fields = mapFormFields(form);
	const payload = {};

	for (const field of fields) {
		if (field.readOnly || field.display === false) {
			continue;
		}

		if (Object.hasOwn(valuesByLabel, field.displayName)) {
			payload[field.id] = valuesByLabel[field.displayName];
			continue;
		}

		if (!field.required) {
			continue;
		}

		if (field.type === 'boolean') payload[field.id] = false;
		else if (field.type === 'number') payload[field.id] = 1;
		else if (field.type === 'dateTime') payload[field.id] = '2026-08-21T09:30:00+08:00';
		else if (field.type === 'options' && field.options?.[0]) payload[field.id] = field.options[0].value;
		else payload[field.id] = `${runId} required value`;
	}

	return payload;
}

function findNamed(values, name) {
	return values.find(
		(value) =>
			typeof value === 'object' &&
			value !== null &&
			String(value.name).toLocaleLowerCase() === name.toLocaleLowerCase(),
	);
}

function extractDocumentId(response) {
	const candidates = [
		response?.header?.documentId,
		response?.documentId,
		response?.document,
		response?.data?.header?.documentId,
		response?.data?.documentId,
	];
	const documentId = candidates.find(
		(value) => typeof value === 'string' && value.trim().length > 0,
	);
	if (!documentId) {
		throw new Error('App02 create response did not contain a document ID');
	}
	return documentId;
}

async function activity(body) {
	return await request('/api/activity/', {
		method: 'POST',
		headers: headers(true, true),
		body,
	});
}

async function createEntry(form, titleSuffix) {
	const response = await activity(
		buildActionBody({
			operation: 'create',
			moduleId,
			fields: makePayload(form, {
				'Task Title': `${runId} ${titleSuffix}`,
				Description: `Created by the n8n P0 live smoke test (${runId})`,
				Priority: 'High',
				'Estimated Hours': 3.5,
				'Due Date': '2026-08-30T00:00:00+08:00',
				'Reminder At': '2026-08-29T09:30:00+08:00',
				'Is Blocked': false,
				'Test Run ID': runId,
			}),
		}),
	);
	const documentId = extractDocumentId(response);
	createdDocuments.add(documentId);
	return documentId;
}

async function removeEntry(documentId) {
	await activity({ activityId: 'delete', moduleId, entry: documentId });
	createdDocuments.delete(documentId);
}

async function run() {
	console.log(`LIVE_SMOKE_RUN=${runId}`);

	await request('/api/profile', { headers: headers(false) });
	console.log('PROFILE=pass');

	const [workspace, moduleMetadata, createForm, editForm] = await Promise.all([
		request(`/api/Workspace/${encodeURIComponent(workspaceId)}`, { headers: headers(false) }),
		request('/api/Workspace/Module', {
			method: 'POST',
			headers: headers(),
			body: { moduleId },
		}),
		getForm('create'),
		getForm('edit'),
	]);

	const activities = extractCollection(moduleMetadata, 'activities');
	const startWork = findNamed(activities, 'Start Work');
	const completeTask = findNamed(activities, 'Complete Task');
	assert.ok(startWork?.id, 'Start Work activity is unavailable');
	assert.ok(completeTask?.id, 'Complete Task activity is unavailable');

	const states = extractCollection(workspace, 'states').filter(
		(state) =>
			typeof state === 'object' && state !== null && String(state.module) === String(moduleId),
	);
	const inProgress = findNamed(states, 'In Progress');
	assert.ok(inProgress?.name, 'In Progress state is unavailable');

	const users = extractCollection(workspace, 'users');
	const assignee = users.find(
		(user) => typeof user === 'object' && user !== null && typeof user.username === 'string',
	);
	assert.ok(assignee?.username, 'No assignable workspace user is available');

	const primaryDocument = await createEntry(createForm, 'Action Lifecycle');
	console.log(`CREATE=pass DOCUMENT=${primaryDocument}`);

	await activity(
		buildActionBody({
			operation: 'update',
			moduleId,
			documentId: primaryDocument,
			fields: makePayload(editForm, {
				Description: `Updated by the n8n P0 live smoke test (${runId})`,
				Priority: 'Medium',
				'Estimated Hours': 4.25,
				'Reminder At': '2026-08-29T10:45:00+08:00',
				'Is Blocked': true,
				'Test Run ID': runId,
			}),
		}),
	);
	console.log('UPDATE=pass');

	await activity(
		buildActionBody({
			operation: 'assign',
			moduleId,
			documentId: primaryDocument,
			username: assignee.username,
			dueDate: '2026-08-30T17:00:00+08:00',
		}),
	);
	console.log('ASSIGN=pass');

	const startForm = await getForm(String(startWork.id));
	await activity(
		buildActionBody({
			operation: 'performActivity',
			moduleId,
			documentId: primaryDocument,
			activityId: String(startWork.id),
			fields: makePayload(startForm, {}),
		}),
	);
	console.log('PERFORM_ACTIVITY_NO_FORM=pass');

	const completeForm = await getForm(String(completeTask.id));
	await activity(
		buildActionBody({
			operation: 'performActivity',
			moduleId,
			documentId: primaryDocument,
			activityId: String(completeTask.id),
			fields: makePayload(completeForm, {
				'Completion Note': `Completed by ${runId}`,
				'Actual Hours': 3.75,
			}),
		}),
	);
	console.log('PERFORM_ACTIVITY_WITH_FORM=pass');

	const stateDocument = await createEntry(createForm, 'State Change');
	console.log(`CREATE_FOR_STATE=pass DOCUMENT=${stateDocument}`);
	await activity(
		buildActionBody({
			operation: 'changeState',
			moduleId,
			documentId: stateDocument,
			stateName: String(inProgress.name),
		}),
	);
	console.log('CHANGE_STATE=pass');

	const hookResponse = await request('/api/automationHook', {
		method: 'POST',
		headers: headers(true, true),
		body: buildSubscription(
			moduleId,
			'create',
			`https://example.invalid/n8n-p0-smoke/${encodeURIComponent(runId)}`,
		),
	});
	temporaryHookId = getWebhookId(hookResponse);
	console.log(`HOOK_REGISTER=pass ID=${temporaryHookId}`);
	await request(`/api/automationHook/delete/${encodeURIComponent(temporaryHookId)}`, {
		headers: headers(),
	});
	temporaryHookId = undefined;
	console.log('HOOK_REMOVE=pass');

	await removeEntry(primaryDocument);
	await removeEntry(stateDocument);
	console.log('ENTRY_CLEANUP=pass');
	console.log('LIVE_SMOKE=pass');
}

async function cleanup() {
	const failures = [];
	if (temporaryHookId) {
		try {
			await request(`/api/automationHook/delete/${encodeURIComponent(temporaryHookId)}`, {
				headers: headers(),
			});
		} catch (error) {
			failures.push(`hook ${temporaryHookId}: ${error.message}`);
		}
	}

	for (const documentId of [...createdDocuments]) {
		try {
			await removeEntry(documentId);
		} catch (error) {
			failures.push(`entry ${documentId}: ${error.message}`);
		}
	}

	if (failures.length > 0) {
		throw new Error(`Sandbox cleanup failed: ${failures.join('; ')}`);
	}
}

run()
	.catch((error) => {
		console.error(`LIVE_SMOKE=fail ERROR=${error.message}`);
		process.exitCode = 1;
	})
	.finally(async () => {
		try {
			await cleanup();
		} catch (error) {
			console.error(`LIVE_SMOKE_CLEANUP=fail ERROR=${error.message}`);
			process.exitCode = 1;
		}
	});
