import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestOptions,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { inistateApiRequest, listSearch } from '../shared/GenericFunctions';
import {
	APP02_BASE_URL,
	buildApiHeaders,
	buildSubscription,
	getTriggerItem,
	getWebhookId,
	type P0TriggerEvent,
} from '../shared/Inistate.contract';

const listMode = (searchListMethod: string) => ({
	displayName: 'From List',
	name: 'list',
	type: 'list' as const,
	typeOptions: { searchListMethod, searchable: true },
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
	description: 'The Inistate workspace to monitor',
	modes: [listMode('searchWorkspaces'), idMode('workspace', '2307')],
};

const moduleProperty: INodeProperties = {
	displayName: 'Module',
	name: 'moduleId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The module to monitor',
	modes: [listMode('searchModules'), idMode('module', '19296')],
};

export class InistateTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Inistate Trigger',
		name: 'inistateTrigger',
		icon: { light: 'file:inistate.svg', dark: 'file:inistate.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a supported Inistate entry event occurs',
		defaults: {
			name: 'Inistate Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'inistateApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'This P0 node connects only to the App02 API environment.',
				name: 'app02Notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Activity Performed',
						value: 'activityPerformed',
						description: 'Runs when the selected activity is performed',
					},
					{
						name: 'Entry Created',
						value: 'entryCreated',
						description: 'Runs when an entry is created',
					},
					{
						name: 'Entry Updated',
						value: 'entryUpdated',
						description: 'Runs when an entry is edited',
					},
				],
				default: 'entryCreated',
			},
			workspaceProperty,
			moduleProperty,
			{
				displayName: 'Activity',
				name: 'activityId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'Only callbacks for this activity will be registered',
				displayOptions: { show: { event: ['activityPerformed'] } },
				modes: [listMode('searchActivities'), idMode('activity', 'bd438...')],
			},
		],
	};

	methods = { listSearch };

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				return webhookData.webhookId !== undefined;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) {
					throw new NodeOperationError(this.getNode(), 'n8n did not provide a webhook URL');
				}

				const workspaceId = String(
					this.getNodeParameter('workspaceId', undefined, { extractValue: true }),
				);
				const moduleId = String(
					this.getNodeParameter('moduleId', undefined, { extractValue: true }),
				);
				const event = this.getNodeParameter('event') as P0TriggerEvent;
				const activityId =
					event === 'activityPerformed'
						? String(this.getNodeParameter('activityId', undefined, { extractValue: true }))
						: undefined;
				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: `${APP02_BASE_URL}/api/automationHook`,
					headers: buildApiHeaders(workspaceId),
					body: buildSubscription(moduleId, getTriggerItem(event, activityId), webhookUrl),
					json: true,
				};

				const response = await inistateApiRequest(this, requestOptions);

				try {
					this.getWorkflowStaticData('node').webhookId = getWebhookId(response);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), (error as Error).message);
				}

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) {
					return true;
				}

				const workspaceId = String(
					this.getNodeParameter('workspaceId', undefined, { extractValue: true }),
				);
				const webhookId = String(webhookData.webhookId);
				const requestOptions: IHttpRequestOptions = {
					method: 'GET',
					url: `${APP02_BASE_URL}/api/automationHook/delete/${encodeURIComponent(webhookId)}`,
					headers: buildApiHeaders(workspaceId, false),
					json: true,
				};

				await inistateApiRequest(this, requestOptions);

				delete webhookData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const returnData: IDataObject = this.getBodyData();

		return {
			workflowData: [this.helpers.returnJsonArray(returnData)],
		};
	}
}
