import type { TriggerEventDefinition } from './types';

export const entryCreatedEvent: TriggerEventDefinition = {
	event: 'entryCreated',
	option: {
		name: 'Entry Created',
		value: 'entryCreated',
		description: 'Runs when an entry is created',
	},
	properties: [],
	getItem() {
		return 'create';
	},
};
