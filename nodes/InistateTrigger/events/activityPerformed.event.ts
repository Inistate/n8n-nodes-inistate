import type { INodeProperties } from 'n8n-workflow';

import { getTriggerItem } from '../../shared/Inistate.contract';
import { idMode, listMode } from './properties';
import type { TriggerEventDefinition } from './types';

const activityProperty: INodeProperties = {
	displayName: 'Activity',
	name: 'activityId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'Only callbacks for this activity will be registered',
	displayOptions: { show: { event: ['activityPerformed'] } },
	modes: [listMode('searchActivities'), idMode('activity', 'bd438...')],
};

export const activityPerformedEvent: TriggerEventDefinition = {
	event: 'activityPerformed',
	option: {
		name: 'Activity Performed',
		value: 'activityPerformed',
		description: 'Runs when the selected activity is performed',
	},
	properties: [activityProperty],
	getSubscription() {
		const activityId = String(
			this.getNodeParameter('activityId', undefined, { extractValue: true }),
		);
		return {
			item: getTriggerItem('activityPerformed', activityId),
			trigger: 'execute',
			type: 'activity',
		};
	},
};
