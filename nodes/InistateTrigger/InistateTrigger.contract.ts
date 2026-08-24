import type { IDataObject } from 'n8n-workflow';

export { APP02_BASE_URL, INISTATE_BASE_URL, getWebhookId } from '../shared/Inistate.contract';

import { buildApiHeaders, buildSubscription } from '../shared/Inistate.contract';

/** @deprecated Use buildApiHeaders from the shared P0 contract. */
export function buildAutomationHeaders(workspaceId: string): IDataObject {
	return buildApiHeaders(workspaceId);
}

/** @deprecated Use buildSubscription from the shared P0 contract. */
export function buildEntryCreatedSubscription(moduleId: string, webhookUrl: string): IDataObject {
	return buildSubscription(moduleId, 'create', webhookUrl);
}
