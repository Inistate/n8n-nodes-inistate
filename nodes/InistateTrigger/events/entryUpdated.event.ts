import type { TriggerEventDefinition } from './types';

export const entryUpdatedEvent: TriggerEventDefinition = {
	event: 'entryUpdated',
	option: {
		name: 'Entry Updated',
		value: 'entryUpdated',
		description: 'Runs when an entry is edited',
	},
	properties: [],
	getItem() {
		return 'edit';
	},
};
