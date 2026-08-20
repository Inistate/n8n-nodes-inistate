import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	ResourceMapperValue,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { inistateApiRequest, listSearch, resourceMapping } from '../shared/GenericFunctions';
import { buildActionBody, buildApiHeaders, type P0Operation } from '../shared/Inistate.contract';

const listMode = (searchListMethod: string) => ({
	displayName: 'From List',
	name: 'list',
	type: 'list' as const,
	typeOptions: {
		searchListMethod,
		searchable: true,
	},
});

const idMode = (displayName: string, placeholder: string) => ({
	displayName: 'By ID',
	name: 'id',
	type: 'string' as const,
	placeholder,
	hint: `Enter the ${displayName} ID when it is not available in the list`,
});

const workspaceProperty: INodeProperties = {
	displayName: 'Workspace',
	name: 'workspaceId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Inistate workspace to use',
	modes: [listMode('searchWorkspaces'), idMode('workspace', '2307')],
};

const moduleProperty: INodeProperties = {
	displayName: 'Module',
	name: 'moduleId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The module containing the entry',
	modes: [listMode('searchModules'), idMode('module', '19296')],
};

const activityProperty: INodeProperties = {
	displayName: 'Activity',
	name: 'activityId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The activity to perform',
	displayOptions: { show: { operation: ['performActivity'] } },
	modes: [listMode('searchActivities'), idMode('activity', 'bd438...')],
};

const stateProperty: INodeProperties = {
	displayName: 'State',
	name: 'stateName',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The destination state name expected by the Inistate activity API',
	displayOptions: { show: { operation: ['changeState'] } },
	modes: [
		listMode('searchStates'),
		{
			displayName: 'By Name',
			name: 'name',
			type: 'string',
			placeholder: 'Completed',
			hint: 'Enter the exact Inistate state name',
		},
	],
};

const userProperty: INodeProperties = {
	displayName: 'User',
	name: 'username',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Inistate user to assign, represented by username',
	displayOptions: { show: { operation: ['assign'] } },
	modes: [
		listMode('searchUsers'),
		{
			displayName: 'By Username',
			name: 'username',
			type: 'string',
			placeholder: 'user@example.com',
			hint: 'Enter the exact Inistate username',
		},
	],
};

const fieldsProperty: INodeProperties = {
	displayName: 'Fields',
	name: 'fields',
	type: 'resourceMapper',
	default: {
		mappingMode: 'defineBelow',
		value: null,
		matchingColumns: [],
		schema: [],
		attemptToConvertTypes: false,
		convertFieldsToString: false,
	},
	required: true,
	noDataExpression: true,
	displayOptions: { show: { operation: ['create', 'update', 'performActivity'] } },
	typeOptions: {
		loadOptionsDependsOn: ['operation', 'moduleId.value', 'activityId.value'],
		resourceMapper: {
			resourceMapperMethod: 'getFormFields',
			mode: 'add',
			fieldWords: { singular: 'field', plural: 'fields' },
			addAllFields: true,
			supportAutoMap: true,
			multiKeyMatch: false,
			allowEmptyValues: true,
		},
	},
};

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
				displayName: 'This P0 node connects only to the App02 API environment.',
				name: 'app02Notice',
				type: 'notice',
				default: '',
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
				options: [
					{
						name: 'Assign',
						value: 'assign',
						action: 'Assign an entry',
						description: 'Assign an Inistate user and optionally set a due date',
					},
					{
						name: 'Change State',
						value: 'changeState',
						action: 'Change an entry state',
						description: 'Move an entry to a selected state',
					},
					{
						name: 'Create',
						value: 'create',
						action: 'Create an entry',
						description: 'Create an entry using its module form',
					},
					{
						name: 'Perform Activity',
						value: 'performActivity',
						action: 'Perform an activity',
						description: 'Perform an activity with or without form fields',
					},
					{
						name: 'Update',
						value: 'update',
						action: 'Update an entry',
						description: 'Update an entry using its module edit form',
					},
				],
				default: 'create',
			},
			workspaceProperty,
			moduleProperty,
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'N8N-TEST00001',
				description: 'The stable document ID of the entry',
				displayOptions: {
					show: { operation: ['update', 'performActivity', 'changeState', 'assign'] },
				},
			},
			activityProperty,
			stateProperty,
			userProperty,
			{
				displayName: 'Due Date',
				name: 'dueDate',
				type: 'dateTime',
				default: '',
				description: 'Optional assignment due date',
				displayOptions: { show: { operation: ['assign'] } },
			},
			fieldsProperty,
		],
	};

	methods = { listSearch, resourceMapping };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as P0Operation;
				const workspaceId = String(
					this.getNodeParameter('workspaceId', itemIndex, '', { extractValue: true }),
				);
				const moduleId = String(
					this.getNodeParameter('moduleId', itemIndex, '', { extractValue: true }),
				);
				const supportsFields = ['create', 'update', 'performActivity'].includes(operation);
				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: '/api/activity/',
					headers: buildApiHeaders(workspaceId),
					body: buildActionBody({
						operation,
						moduleId,
						documentId: String(this.getNodeParameter('documentId', itemIndex, '')),
						activityId: String(
							this.getNodeParameter('activityId', itemIndex, '', { extractValue: true }),
						),
						stateName: String(
							this.getNodeParameter('stateName', itemIndex, '', { extractValue: true }),
						),
						username: String(
							this.getNodeParameter('username', itemIndex, '', { extractValue: true }),
						),
						dueDate: String(this.getNodeParameter('dueDate', itemIndex, '')),
						fields: supportsFields
							? (this.getNodeParameter('fields', itemIndex, {}) as ResourceMapperValue)
							: undefined,
					}),
				};
				const response = await inistateApiRequest(this, requestOptions);
				returnData.push({
					json: normalizeResponse(response),
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : 'Unknown Inistate error' },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error : new Error('Unknown Inistate error'),
					{ itemIndex },
				);
			}
		}

		return [returnData];
	}
}

function normalizeResponse(response: unknown): IDataObject {
	if (typeof response === 'object' && response !== null && !Array.isArray(response)) {
		return response as IDataObject;
	}

	return { data: response as IDataObject[keyof IDataObject] };
}
