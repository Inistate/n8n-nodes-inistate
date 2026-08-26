const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');

const {
	INISTATE_BASE_URL,
	buildActionBody,
	buildApiHeaders,
	buildSubscription,
	extractCollection,
	extractFormElements,
	getWebhookId,
	mapFormFields,
	toReferenceFieldOptions,
} = require('../dist/nodes/shared/Inistate.contract.js');

const credentialsFile = path.resolve(__dirname, '..', '.env.live.local');
if (existsSync(credentialsFile)) loadEnvFile(credentialsFile);

const apiKey = process.env.INISTATE_API_KEY;
const workspaceName = 'N8N Production Sandbox';
const moduleNames = ['Task Tracker', 'Projects', 'Members'];
const runId = `N8N-TEST-${new Date()
	.toISOString()
	.replace(/[-:.TZ]/g, '')
	.slice(0, 14)}`;
const webhookUrl =
	process.env.INISTATE_WEBHOOK_URL?.trim() ||
	`https://example.invalid/n8n-production-smoke/${encodeURIComponent(runId)}`;

if (!apiKey) {
	throw new Error('INISTATE_API_KEY is required; add it to the ignored .env.live.local file');
}

const createdEntries = new Map();
const temporaryHooks = new Map();
let workspace;
let modules = [];

function apiHeaders(workspaceId, includeMedium = false) {
	return {
		Accept: 'application/json',
		Authorization: `fsk ${apiKey}`,
		'Content-Type': 'application/json',
		...(workspaceId ? buildApiHeaders(workspaceId, includeMedium) : {}),
	};
}

async function request(path, options = {}) {
	const response = await fetch(`${INISTATE_BASE_URL}${path}`, {
		method: options.method ?? 'GET',
		headers: options.headers ?? apiHeaders(options.workspaceId, options.includeMedium),
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
		signal: AbortSignal.timeout(45_000),
	});
	const text = await response.text();
	let data = text;
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			// Some Inistate endpoints intentionally return a direct string identifier.
		}
	}

	if (!response.ok) {
		throw new Error(
			`Production ${options.method ?? 'GET'} ${path} failed with HTTP ${response.status}`,
		);
	}

	return data;
}

function exactNamed(values, expectedName, resourceType) {
	const matches = values.filter(
		(value) =>
			typeof value === 'object' &&
			value !== null &&
			String(value.name).toLocaleLowerCase() === expectedName.toLocaleLowerCase(),
	);
	assert.equal(
		matches.length,
		1,
		`Expected exactly one ${resourceType} named ${expectedName}; found ${matches.length}`,
	);
	return matches[0];
}

async function discoverWorkspace() {
	for (let page = 0; page < 10; page++) {
		const response = await request(
			`/api/Workspace?page=${page}&search=${encodeURIComponent(workspaceName)}`,
		);
		const values = extractCollection(response);
		const matches = values.filter(
			(value) =>
				typeof value === 'object' &&
				value !== null &&
				String(value.name).toLocaleLowerCase() === workspaceName.toLocaleLowerCase(),
		);
		if (matches.length > 0) return exactNamed(matches, workspaceName, 'workspace');
		if (values.length === 0) break;
	}
	throw new Error(`Production workspace ${workspaceName} was not found`);
}

function extractDocumentId(response) {
	if (typeof response === 'string' && response.trim().length > 0) return response.trim();
	const candidates = [
		response?.header?.documentId,
		response?.documentId,
		response?.document,
		response?.data?.header?.documentId,
		response?.data?.documentId,
	];
	const value = candidates.find(
		(candidate) =>
			(typeof candidate === 'string' || typeof candidate === 'number') &&
			String(candidate).trim().length > 0,
	);
	if (value !== undefined) return String(value).trim();

	const visited = new Set();
	const queue = [response];
	while (queue.length > 0) {
		const candidate = queue.shift();
		if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) continue;
		visited.add(candidate);
		for (const [key, nestedValue] of Object.entries(candidate)) {
			if (
				['documentid', 'document', 'documentno', 'documentnumber'].includes(
					key.toLocaleLowerCase(),
				) &&
				(typeof nestedValue === 'string' || typeof nestedValue === 'number') &&
				String(nestedValue).trim().length > 0
			) {
				return String(nestedValue).trim();
			}
			if (nestedValue && typeof nestedValue === 'object') queue.push(nestedValue);
		}
	}

	return undefined;
}

function entryKey(moduleId, documentId) {
	return `${moduleId}:${documentId}`;
}

async function activity(module, body) {
	return await request('/api/activity/', {
		method: 'POST',
		workspaceId: String(workspace.id),
		includeMedium: true,
		body,
	});
}

async function getReferenceOptions(module, activityId, form) {
	const optionsByField = {};
	for (const element of extractFormElements(form)) {
		const fieldType = Number(element.type);
		const fieldName = String(element.fieldName ?? '');
		const fieldId = element.id;
		if (!fieldName || ![7, 20].includes(fieldType) || fieldId === undefined) continue;

		const options = [];
		for (let currentPage = 0; currentPage < 10; currentPage++) {
			const response = await request('/api/activity/formselection', {
				method: 'POST',
				workspaceId: String(workspace.id),
				body: {
					activityId,
					text: '',
					currentPage,
					vectorId: /^\d+$/.test(String(module.id)) ? Number(module.id) : module.id,
					fieldId,
					reference: null,
					documentId: '',
				},
			});
			const pageOptions = toReferenceFieldOptions(fieldType, response);
			options.push(...pageOptions);
			if (pageOptions.length === 0) break;
		}
		optionsByField[fieldName] = options;
	}
	return optionsByField;
}

async function getPreparedForm(module, activityId) {
	const form = await request('/api/Activity/Form', {
		method: 'POST',
		workspaceId: String(workspace.id),
		body: { vectorId: module.id, activityId },
	});
	const referenceOptions = await getReferenceOptions(module, activityId, form);
	return { form, fields: mapFormFields(form, referenceOptions) };
}

function fieldValue(field, suffix) {
	const label = field.displayName.toLocaleLowerCase();
	if (field.type === 'boolean') return false;
	if (field.type === 'number') return 1;
	if (field.type === 'dateTime') return new Date(Date.now() + 86_400_000).toISOString();
	if (field.type === 'options') return field.options?.[0]?.value;
	if (label.includes('email')) return `n8n.test+${runId.toLocaleLowerCase()}@gneysoftware.com`;
	if (label.includes('url') || label.includes('website')) return 'https://www.inistate.com';
	if (label.includes('phone') || label.includes('mobile')) return '+6591234567';
	return `${runId} ${suffix} ${field.displayName}`;
}

function makePayload(preparedForm, suffix) {
	const payload = {};
	for (const field of preparedForm.fields) {
		if (field.readOnly || field.display === false) continue;
		const value = fieldValue(field, suffix);
		if (value === undefined) {
			if (field.required) {
				throw new Error(`Required field ${field.displayName} has no selectable production value`);
			}
			continue;
		}
		payload[field.id] = value;
	}
	return payload;
}

async function listRunEntries(module) {
	const listingId = Array.isArray(module.menus) ? module.menus[0]?.id : undefined;
	if (listingId === undefined) return [];
	const response = await request('/api/workspace/list', {
		method: 'POST',
		workspaceId: String(workspace.id),
		body: {
			moduleId: module.id,
			listingId,
			withHeader: false,
			currentPage: 0,
			pageSize: 100,
			filters: null,
			sorts: null,
			search: runId,
		},
	});
	const listData =
		response && typeof response === 'object' && !Array.isArray(response)
			? response.data
			: undefined;
	return extractCollection(listData ?? response, 'list')
		.map((entry) => extractDocumentId(entry))
		.filter((documentId) => documentId !== undefined);
}

async function waitForNewRunEntries(module, existingIds) {
	for (let attempt = 1; attempt <= 5; attempt++) {
		const newIds = (await listRunEntries(module)).filter(
			(documentId) => !existingIds.has(documentId),
		);
		if (newIds.length > 0) return newIds;
		if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1_000));
	}
	return [];
}

async function createEntry(module, preparedForm) {
	const response = await activity(
		module,
		buildActionBody({
			operation: 'create',
			moduleId: String(module.id),
			fields: makePayload(preparedForm, 'create'),
		}),
	);
	const documentId = extractDocumentId(response);
	assert.ok(documentId, `${module.name} create response did not contain a document ID`);
	createdEntries.set(entryKey(module.id, documentId), { module, documentId });
	return documentId;
}

async function removeEntry(module, documentId) {
	await activity(module, {
		activityId: 'delete',
		moduleId: String(module.id),
		entry: documentId,
	});
	createdEntries.delete(entryKey(module.id, documentId));
}

async function registerAndRemoveHook(module, item, type = 'activity', trigger = 'execute') {
	const response = await request('/api/automationHook', {
		method: 'POST',
		workspaceId: String(workspace.id),
		includeMedium: true,
		body: buildSubscription(String(module.id), String(item), webhookUrl, type, trigger),
	});
	const hookId = getWebhookId(response);
	temporaryHooks.set(hookId, String(workspace.id));
	await request(`/api/automationHook/delete/${encodeURIComponent(hookId)}`, {
		workspaceId: String(workspace.id),
	});
	temporaryHooks.delete(hookId);
}

async function runModule(module, workspaceDetails) {
	console.log(`MODULE=${module.name} ID=${module.id}`);
	const metadata = await request('/api/Workspace/Module', {
		method: 'POST',
		workspaceId: String(workspace.id),
		body: { moduleId: module.id },
	});
	const createForm = await getPreparedForm(module, 'create');
	const editForm = await getPreparedForm(module, 'edit');
	const activities = extractCollection(metadata, 'activities');
	const states = extractCollection(workspaceDetails, 'states').filter(
		(state) =>
			typeof state === 'object' && state !== null && String(state.module) === String(module.id),
	);
	const users = extractCollection(workspaceDetails, 'users');
	const assignee = users.find(
		(user) => typeof user === 'object' && user !== null && typeof user.username === 'string',
	);

	const documentId = await createEntry(module, createForm);
	console.log(`CREATE=pass MODULE=${module.name} DOCUMENT=${documentId}`);

	await activity(
		module,
		buildActionBody({
			operation: 'update',
			moduleId: String(module.id),
			documentId,
			fields: makePayload(editForm, 'update'),
		}),
	);
	console.log(`UPDATE=pass MODULE=${module.name}`);

	if (assignee?.username) {
		await activity(
			module,
			buildActionBody({
				operation: 'assign',
				moduleId: String(module.id),
				documentId,
				username: assignee.username,
			}),
		);
		console.log(`ASSIGN=pass MODULE=${module.name}`);
	} else {
		console.log(`ASSIGN=skip MODULE=${module.name} REASON=no-assignable-user`);
	}

	const safeActivity = activities.find(
		(candidate) =>
			typeof candidate === 'object' &&
			candidate !== null &&
			candidate.id !== undefined &&
			!/delete|remove|archive/i.test(String(candidate.name)),
	);
	if (safeActivity) {
		const activityForm = await getPreparedForm(module, String(safeActivity.id));
		await activity(
			module,
			buildActionBody({
				operation: 'performActivity',
				moduleId: String(module.id),
				documentId,
				activityId: String(safeActivity.id),
				fields: makePayload(activityForm, 'activity'),
			}),
		);
		console.log(`PERFORM_ACTIVITY=pass MODULE=${module.name} ACTIVITY=${safeActivity.name}`);
	} else {
		console.log(`PERFORM_ACTIVITY=skip MODULE=${module.name} REASON=no-safe-activity`);
	}

	const targetState = states[0];
	if (targetState?.name) {
		await activity(
			module,
			buildActionBody({
				operation: 'changeState',
				moduleId: String(module.id),
				documentId,
				stateName: String(targetState.name),
			}),
		);
		console.log(`CHANGE_STATE=pass MODULE=${module.name} STATE=${targetState.name}`);
	} else {
		console.log(`CHANGE_STATE=skip MODULE=${module.name} REASON=no-state`);
	}

	assert.ok(
		Array.isArray(module.menus) && module.menus[0]?.id !== undefined,
		`${module.name} has no listing, so Duplicate cannot be verified and cleaned safely`,
	);
	const beforeDuplicate = new Set(await listRunEntries(module));
	const duplicateResponse = await activity(
		module,
		buildActionBody({
			operation: 'duplicate',
			moduleId: String(module.id),
			documentId,
		}),
	);
	const responseDocumentId = extractDocumentId(duplicateResponse);
	const duplicateIds = await waitForNewRunEntries(module, beforeDuplicate);
	if (
		responseDocumentId &&
		responseDocumentId !== documentId &&
		!duplicateIds.includes(responseDocumentId)
	) {
		duplicateIds.push(responseDocumentId);
	}
	assert.ok(duplicateIds.length > 0, `${module.name} Duplicate did not expose a new entry`);
	for (const duplicateId of duplicateIds) {
		createdEntries.set(entryKey(module.id, duplicateId), {
			module,
			documentId: duplicateId,
		});
	}
	console.log(`DUPLICATE=pass MODULE=${module.name}`);

	await registerAndRemoveHook(module, 'create');
	await registerAndRemoveHook(module, 'edit');
	if (safeActivity?.id !== undefined) await registerAndRemoveHook(module, safeActivity.id);
	if (targetState?.id !== undefined) {
		await registerAndRemoveHook(module, targetState.id, 'state', 'changeTo');
		await registerAndRemoveHook(module, targetState.id, 'state', 'changeFrom');
	}
	console.log(`HOOK_LIFECYCLE=pass MODULE=${module.name}`);

	await removeEntry(module, documentId);
	console.log(`DELETE=pass MODULE=${module.name}`);
}

async function run() {
	console.log(`LIVE_SMOKE_RUN=${runId}`);
	console.log(`API_HOST=${INISTATE_BASE_URL}`);
	await request('/api/profile');
	console.log('PROFILE=pass');

	workspace = await discoverWorkspace();
	assert.ok(workspace.id, `${workspaceName} does not expose an ID`);
	const workspaceDetails = await request(`/api/Workspace/${encodeURIComponent(workspace.id)}`);
	const availableModules = extractCollection(workspaceDetails, 'vectors');
	modules = moduleNames.map((name) => exactNamed(availableModules, name, 'module'));
	console.log(`WORKSPACE=${workspace.name} ID=${workspace.id}`);

	for (const module of modules) await runModule(module, workspaceDetails);
	console.log('LIVE_SMOKE=pass');
}

async function cleanup() {
	const failures = [];
	for (const [hookId, workspaceId] of [...temporaryHooks]) {
		try {
			await request(`/api/automationHook/delete/${encodeURIComponent(hookId)}`, { workspaceId });
			temporaryHooks.delete(hookId);
		} catch (error) {
			failures.push(`hook ${hookId}: ${error.message}`);
		}
	}

	if (workspace?.id) {
		for (const module of modules) {
			try {
				for (const documentId of await listRunEntries(module)) {
					createdEntries.set(entryKey(module.id, documentId), {
						module,
						documentId,
					});
				}
			} catch (error) {
				failures.push(`${module.name} cleanup discovery: ${error.message}`);
			}
		}
	}

	for (const { module, documentId } of [...createdEntries.values()]) {
		try {
			await removeEntry(module, documentId);
		} catch (error) {
			failures.push(`${module.name} entry ${documentId}: ${error.message}`);
		}
	}

	if (failures.length > 0) throw new Error(`Sandbox cleanup failed: ${failures.join('; ')}`);
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
