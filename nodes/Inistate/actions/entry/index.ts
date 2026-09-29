import type { IDataObject, IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';

import { inistateApiRequest } from '../../../shared/GenericFunctions';
import {
	buildActionBody,
	buildApiHeaders,
	type InistateOperation,
} from '../../../shared/Inistate.contract';
import {
	asDataObject,
	type InistateNodeOperation,
	type InistateReadOperation,
} from '../../../shared/InistateRead.contract';
import { assignEntryAction } from './assign.operation';
import { changeStateAction } from './changeState.operation';
import { createEntryAction } from './create.operation';
import { deleteEntryAction } from './delete.operation';
import { duplicateEntryAction } from './duplicate.operation';
import { getEntryAction } from './get.operation';
import { getAllEntriesAction } from './getAll.operation';
import { getFormAction } from './getForm.operation';
import { getHistoryAction } from './getHistory.operation';
import { performActivityAction } from './performActivity.operation';
import { updateEntryAction } from './update.operation';

export const entryActions = [
	assignEntryAction,
	changeStateAction,
	createEntryAction,
	deleteEntryAction,
	duplicateEntryAction,
	performActivityAction,
	updateEntryAction,
];

export const entryReadActions = [
	getEntryAction,
	getAllEntriesAction,
	getFormAction,
	getHistoryAction,
];

// n8n renders operation options in declaration order, and the lint rules expect them
// alphabetised, so the merged list is sorted rather than concatenated.
export const entryOperationOptions = [...entryActions, ...entryReadActions]
	.map(({ option }) => option)
	.sort((first, second) => String(first.name).localeCompare(String(second.name), 'en'));

export const entryOperationProperties = [...entryActions, ...entryReadActions].flatMap(
	({ properties }) => properties,
);

const actionsByOperation = new Map(entryActions.map((action) => [action.operation, action]));
const readActionsByOperation = new Map(
	entryReadActions.map((action) => [action.operation, action]),
);

export async function executeEntryAction(
	context: IExecuteFunctions,
	operation: InistateNodeOperation,
	itemIndex: number,
	workspaceId: string,
	moduleId: string,
): Promise<IDataObject[]> {
	const readAction = readActionsByOperation.get(operation as InistateReadOperation);
	if (readAction) {
		return await readAction.execute.call(context, { itemIndex, moduleId, workspaceId });
	}

	const action = actionsByOperation.get(operation as InistateOperation);
	if (!action) {
		throw new Error(`Unsupported Inistate operation: ${String(operation)}`);
	}

	const input = await action.prepareInput.call(context, { itemIndex, moduleId, workspaceId });
	const requestOptions: IHttpRequestOptions = {
		method: 'POST',
		url: '/api/activity/',
		headers: buildApiHeaders(workspaceId),
		body: buildActionBody(input),
	};

	return [
		normalizeActionResponse(action.operation, await inistateApiRequest(context, requestOptions)),
	];
}

export function normalizeActionResponse(
	operation: InistateOperation,
	response: unknown,
): IDataObject {
	return operation === 'delete' ? { deleted: true } : asDataObject(response);
}
