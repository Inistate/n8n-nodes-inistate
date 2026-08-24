import type { TriggerEventDefinition } from './types';

export const entryUpdatedEvent: TriggerEventDefinition = {
	event: 'entryUpdated',
	option: {
		name: 'Entry Updated',
		value: 'entryUpdated',
		description: 'Runs when an entry is edited',
	},
	properties: [
		{
			displayName:
				'Updating an entry in this workflow can trigger another execution. Add an idempotent condition to prevent loops',
			name: 'entryUpdatedLoopNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { event: ['entryUpdated'] } },
		},
	],
	getSubscription() {
		return { item: 'edit', trigger: 'execute', type: 'activity' };
	},
};
