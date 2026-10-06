import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { triggerEventOptions, triggerEventProperties } from './events';
import { moduleProperty, workspaceProperty } from './events/properties';
import { webhookMethods } from './webhook/lifecycle';
import { listSearch } from '../shared/GenericFunctions';

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
				displayOptions: { show: { authentication: ['apiKey'] } },
			},
			{
				name: 'inistateOAuth2Api',
				required: true,
				displayOptions: { show: { authentication: ['oAuth2'] } },
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
				displayName: 'Trigger On',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: triggerEventOptions,
				default: 'entryCreated',
			},
			workspaceProperty,
			moduleProperty,
			...triggerEventProperties,
		],
	};

	methods = { listSearch };

	webhookMethods = webhookMethods;

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const returnData: IDataObject = this.getBodyData();

		return {
			workflowData: [this.helpers.returnJsonArray(returnData)],
		};
	}
}
