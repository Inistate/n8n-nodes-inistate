import type { IHookFunctions } from 'n8n-workflow';

import type { InistateTriggerEvent } from '../../shared/Inistate.contract';
import { activityPerformedEvent } from './activityPerformed.event';
import { entryCreatedEvent } from './entryCreated.event';
import { entryUpdatedEvent } from './entryUpdated.event';
import { stateChangedEvent } from './stateChanged.event';
import type { TriggerSubscriptionSelection } from './types';

export const triggerEvents = [
	activityPerformedEvent,
	entryCreatedEvent,
	entryUpdatedEvent,
	stateChangedEvent,
];

export const triggerEventOptions = triggerEvents.map(({ option }) => option);
export const triggerEventProperties = triggerEvents.flatMap(({ properties }) => properties);

const eventsByName = new Map(triggerEvents.map((event) => [event.event, event]));

export function getTriggerSubscriptionForEvent(
	context: IHookFunctions,
	event: InistateTriggerEvent,
): TriggerSubscriptionSelection {
	const definition = eventsByName.get(event);
	if (!definition) {
		throw new Error(`Unsupported Inistate trigger event: ${String(event)}`);
	}

	return definition.getSubscription.call(context);
}
