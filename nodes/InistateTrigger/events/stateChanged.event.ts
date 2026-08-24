import type { INodeProperties } from 'n8n-workflow';

import { idMode, listMode } from './properties';
import type { TriggerEventDefinition } from './types';

const changeDirectionProperty: INodeProperties = {
	displayName: 'Change',
	name: 'stateChangeDirection',
	type: 'options',
	default: 'changeTo',
	required: true,
	noDataExpression: true,
	description: 'Whether to trigger when an entry enters or leaves the selected state',
	displayOptions: { show: { event: ['stateChanged'] } },
	options: [
		{
			name: 'From State',
			value: 'changeFrom',
			description: 'Trigger when an entry leaves the selected state',
		},
		{
			name: 'To State',
			value: 'changeTo',
			description: 'Trigger when an entry enters the selected state',
		},
	],
};

const stateProperty: INodeProperties = {
	displayName: 'State',
	name: 'stateId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The state used by the selected change direction',
	displayOptions: { show: { event: ['stateChanged'] } },
	modes: [listMode('searchStateIds'), idMode('state', '8968d341-dc65-4b65-a47c-775633d4c538')],
};

export const stateChangedEvent: TriggerEventDefinition = {
	event: 'stateChanged',
	option: {
		name: 'State Changed',
		value: 'stateChanged',
		description: 'Runs when an entry enters or leaves a selected state',
	},
	properties: [changeDirectionProperty, stateProperty],
	getSubscription() {
		const stateId = String(
			this.getNodeParameter('stateId', undefined, { extractValue: true }),
		).trim();
		if (!stateId) {
			throw new Error('State ID is required for the State Changed trigger');
		}

		const trigger = String(this.getNodeParameter('stateChangeDirection')).trim();
		if (!['changeFrom', 'changeTo'].includes(trigger)) {
			throw new Error('Change must be either From State or To State');
		}

		return { item: stateId, trigger, type: 'state' };
	},
};
