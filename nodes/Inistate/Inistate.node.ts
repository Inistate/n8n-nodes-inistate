import type {
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
import { listSearch, loadOptions, resourceMapping } from '../shared/GenericFunctions';
import type { InistateNodeOperation } from '../shared/InistateRead.contract';

export class Inistate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Inistate',
		name: 'inistate',
		icon: { light: 'file:inistate.svg', dark: 'file:inistate.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Read and manage entries in Inistate',
		defaults: { name: 'Inistate' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'inistateApi',
				required: true,
				displayOptions: { show: { authentication: ['apiKey'] } },
			},
			{
				name: 'inistateOAuth2Api',
				required: true,
				displayOptions: { show: { authentication: ['oAuth2'] } },
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{ name: 'API Key', value: 'apiKey' },
					{ name: 'OAuth2', value: 'oAuth2' },
				],
				default: 'oAuth2',
			},
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

	methods = { listSearch, loadOptions, resourceMapping };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as InistateNodeOperation;
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
				// A read operation can answer with any number of records, so one input item
				// may fan out to many output items or to none at all.
				const results = await executeEntryAction(this, operation, itemIndex, workspaceId, moduleId);
				for (const json of results) {
					returnData.push({ json, pairedItem: { item: itemIndex } });
				}
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
