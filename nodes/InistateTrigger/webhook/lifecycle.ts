import type { IHookFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { inistateApiRequest } from '../../shared/GenericFunctions';
import {
	buildApiHeaders,
	buildSubscription,
	getWebhookId,
	type InistateTriggerEvent,
} from '../../shared/Inistate.contract';
import { getTriggerSubscriptionForEvent } from '../events';

export const webhookMethods = {
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
			const moduleId = String(this.getNodeParameter('moduleId', undefined, { extractValue: true }));
			const event = this.getNodeParameter('event') as InistateTriggerEvent;
			const subscription = getTriggerSubscriptionForEvent(this, event);
			const requestOptions: IHttpRequestOptions = {
				method: 'POST',
				url: '/api/automationHook',
				headers: buildApiHeaders(workspaceId),
				body: buildSubscription(
					moduleId,
					subscription.item,
					webhookUrl,
					subscription.type,
					subscription.trigger,
				),
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
				url: `/api/automationHook/delete/${encodeURIComponent(webhookId)}`,
				headers: buildApiHeaders(workspaceId, false),
				json: true,
			};

			await inistateApiRequest(this, requestOptions);

			delete webhookData.webhookId;
			return true;
		},
	},
};
