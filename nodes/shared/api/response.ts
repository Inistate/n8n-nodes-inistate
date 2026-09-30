import { extractCollection } from '../Inistate.contract';

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nestedCollection(response: unknown, property: string): unknown[] {
	if (!isRecord(response)) {
		return [];
	}

	if (Array.isArray(response[property])) {
		return response[property];
	}

	for (const containerName of ['data', 'workspace', 'module', 'schema', 'result']) {
		const container = response[containerName];
		if (isRecord(container) && Array.isArray(container[property])) {
			return container[property];
		}
	}

	return [];
}

export function findEntryByIdentifier(
	response: unknown,
	entryIdentifier: string,
): Record<string, unknown> | undefined {
	return nestedCollection(response, 'list').find((candidate) => {
		if (!isRecord(candidate)) {
			return false;
		}

		return [candidate.documentId, candidate.entryId, candidate.id].some(
			(value) => value !== undefined && String(value) === entryIdentifier,
		);
	}) as Record<string, unknown> | undefined;
}

export function workspaceModules(response: unknown): unknown[] {
	const modules = nestedCollection(response, 'modules');
	return modules.length > 0 ? modules : nestedCollection(response, 'vectors');
}

export function workspaceModuleStates(response: unknown, moduleId: string): unknown[] {
	const module = workspaceModules(response).find(
		(candidate) => isRecord(candidate) && String(candidate.id) === moduleId,
	);
	if (isRecord(module) && Array.isArray(module.states)) {
		return module.states;
	}

	return extractCollection(response, 'states').filter(
		(state) => isRecord(state) && String(state.module) === moduleId,
	);
}
