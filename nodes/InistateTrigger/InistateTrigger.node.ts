import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	APP02_BASE_URL,
	buildAutomationHeaders,
	buildEntryCreatedSubscription,
	getWebhookId,
} from './InistateTrigger.contract';

export class InistateTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Inistate Trigger',
		name: 'inistateTrigger',
		icon: { light: 'file:inistate.svg', dark: 'file:inistate.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'Entry Created',
		description: 'Starts the workflow when an entry is created in Inistate',
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
				displayName: 'Workspace ID',
				name: 'workspaceId',
				type: 'string',
				default: '',
				required: true,
				placeholder: '2306',
				description: 'Numeric ID of the Inistate workspace',
			},
			{
				displayName: 'Module ID',
				name: 'moduleId',
				type: 'string',
				default: '',
				required: true,
				placeholder: '19295',
				description: 'Numeric ID of the module to monitor',
			},
		],
	};

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

				const workspaceId = this.getNodeParameter('workspaceId') as string;
				const moduleId = this.getNodeParameter('moduleId') as string;
				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: `${APP02_BASE_URL}/api/automationHook`,
					headers: buildAutomationHeaders(workspaceId),
					body: buildEntryCreatedSubscription(moduleId, webhookUrl),
					json: true,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'inistateApi',
					requestOptions,
				);

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

				const workspaceId = this.getNodeParameter('workspaceId') as string;
				const webhookId = String(webhookData.webhookId);
				const requestOptions: IHttpRequestOptions = {
					method: 'GET',
					url: `${APP02_BASE_URL}/api/automationHook/delete/${encodeURIComponent(webhookId)}`,
					headers: { wsId: workspaceId },
					json: true,
				};

				await this.helpers.httpRequestWithAuthentication.call(
					this,
					'inistateApi',
					requestOptions,
				);

				delete webhookData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const returnData: IDataObject = {
			body: this.getBodyData(),
			headers: this.getHeaderData(),
			query: this.getQueryData(),
		};

		return {
			workflowData: [this.helpers.returnJsonArray(returnData)],
		};
	}
}
