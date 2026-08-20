import type { IDataObject } from 'n8n-workflow';

export const APP02_BASE_URL = 'https://app02.apps.inistate.com';

export function buildAutomationHeaders(workspaceId: string): IDataObject {
	return {
		wsId: workspaceId,
		medium: 'n8n',
	};
}

export function buildEntryCreatedSubscription(
	moduleId: string,
	webhookUrl: string,
): IDataObject {
	return {
		moduleId,
		item: 'create',
		type: 'activity',
		trigger: 'execute',
		channel: 'n8n',
		url: webhookUrl,
	};
}

export function getWebhookId(response: unknown): string {
	if (typeof response !== 'object' || response === null || !('id' in response)) {
		throw new Error('Inistate did not return a webhook registration ID');
	}

	const id = (response as { id: unknown }).id;
	if ((typeof id !== 'string' && typeof id !== 'number') || String(id).length === 0) {
		throw new Error('Inistate returned an invalid webhook registration ID');
	}

	return String(id);
}
