import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';

import { inistateApiRequest } from '../../../shared/GenericFunctions';
import {
	buildActionBody,
	buildApiHeaders,
	type P0Operation,
} from '../../../shared/Inistate.contract';
import { assignEntryAction } from './assign.operation';
import { changeStateAction } from './changeState.operation';
import { createEntryAction } from './create.operation';
import { performActivityAction } from './performActivity.operation';
import { updateEntryAction } from './update.operation';

export const entryActions = [
	assignEntryAction,
	changeStateAction,
	createEntryAction,
	performActivityAction,
	updateEntryAction,
];

export const entryOperationOptions = entryActions.map(({ option }) => option);
export const entryOperationProperties = entryActions.flatMap(({ properties }) => properties);

const actionsByOperation = new Map(entryActions.map((action) => [action.operation, action]));

export async function executeEntryAction(
	context: IExecuteFunctions,
	operation: P0Operation,
	itemIndex: number,
	workspaceId: string,
	moduleId: string,
): Promise<unknown> {
	const action = actionsByOperation.get(operation);
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

	return await inistateApiRequest(context, requestOptions);
}
