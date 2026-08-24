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
