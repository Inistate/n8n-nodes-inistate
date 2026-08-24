import type { IHookFunctions } from 'n8n-workflow';

import type { P0TriggerEvent } from '../../shared/Inistate.contract';
import { activityPerformedEvent } from './activityPerformed.event';
import { entryCreatedEvent } from './entryCreated.event';
import { entryUpdatedEvent } from './entryUpdated.event';

export const triggerEvents = [activityPerformedEvent, entryCreatedEvent, entryUpdatedEvent];

export const triggerEventOptions = triggerEvents.map(({ option }) => option);
export const triggerEventProperties = triggerEvents.flatMap(({ properties }) => properties);

const eventsByName = new Map(triggerEvents.map((event) => [event.event, event]));

export function getTriggerItemForEvent(context: IHookFunctions, event: P0TriggerEvent): string {
	const definition = eventsByName.get(event);
	if (!definition) {
		throw new Error(`Unsupported Inistate trigger event: ${String(event)}`);
	}

	return definition.getItem.call(context);
}
