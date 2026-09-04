import type {
	IDataObject,
	IExecuteFunctions,
	JsonObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	entryOperationOptions,
	entryOperationProperties,
	executeEntryAction,
} from './actions/entry';
import { moduleProperty, workspaceProperty } from './actions/entry/properties';
import { listSearch, resourceMapping } from '../shared/GenericFunctions';
import type { InistateOperation } from '../shared/Inistate.contract';

export class Inistate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Inistate',
		name: 'inistate',
		icon: { light: 'file:inistate.svg', dark: 'file:inistate.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Create and manage entries in Inistate',
		defaults: { name: 'Inistate' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'inistateApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Entry', value: 'entry' }],
				default: 'entry',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: entryOperationOptions,
				default: 'create',
			},
			workspaceProperty,
			moduleProperty,
			...entryOperationProperties,
		],
	};

	methods = { listSearch, resourceMapping };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as InistateOperation;
				const workspaceId = String(
					this.getNodeParameter('workspaceId', itemIndex, '', {
						extractValue: true,
					}),
				);
				const moduleId = String(
					this.getNodeParameter('moduleId', itemIndex, '', {
						extractValue: true,
					}),
				);
				const response = await executeEntryAction(
					this,
					operation,
					itemIndex,
					workspaceId,
					moduleId,
				);
				returnData.push({
					json: normalizeResponse(operation, response),
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown Inistate error',
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject);
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
						description: error.description ?? undefined,
					});
				}
				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error : new Error('Unknown Inistate error'),
					{
						itemIndex,
						description:
							'Check the selected operation, required fields, and Inistate identifiers, then try again.',
					},
				);
			}
		}

		return [returnData];
	}
}

function normalizeResponse(operation: InistateOperation, response: unknown): IDataObject {
	if (operation === 'delete') {
		return { deleted: true };
	}

	if (typeof response === 'object' && response !== null && !Array.isArray(response)) {
		return response as IDataObject;
	}

	return { data: response as IDataObject[keyof IDataObject] };
}
