import type {
	IDataObject,
	INodeListSearchItems,
	ResourceMapperField,
	ResourceMapperValue,
} from 'n8n-workflow';

export const APP02_BASE_URL = 'https://app02.apps.inistate.com';

export type P0Operation = 'create' | 'update' | 'performActivity' | 'changeState' | 'assign';

export type P0TriggerEvent = 'entryCreated' | 'entryUpdated' | 'activityPerformed';

type UnknownRecord = Record<string, unknown>;

export interface ActionRequestInput {
	operation: P0Operation;
	moduleId: string;
	documentId?: string;
	activityId?: string;
	stateName?: string;
	username?: string;
	dueDate?: string;
	fields?: ResourceMapperValue | IDataObject | null;
}

export function buildApiHeaders(workspaceId: string, includeMedium = true): IDataObject {
	const headers: IDataObject = { wsId: workspaceId };

	if (includeMedium) {
		headers.medium = 'n8n';
	}

	return headers;
}

export function getMappedFieldValues(
	fields: ResourceMapperValue | IDataObject | null | undefined,
): IDataObject {
	if (!fields || typeof fields !== 'object') {
		return {};
	}

	if ('mappingMode' in fields || 'matchingColumns' in fields || 'schema' in fields) {
		const value = (fields as ResourceMapperValue).value;
		return value && typeof value === 'object' ? { ...value } : {};
	}

	return { ...fields };
}

export function buildActionBody(input: ActionRequestInput): IDataObject {
	const { operation, moduleId } = input;

	if (operation === 'create') {
		return {
			activityId: 'create',
			moduleId,
			payload: getMappedFieldValues(input.fields),
		};
	}

	const documentId = input.documentId?.trim() ?? '';
	if (!documentId) {
		throw new Error(`Document ID is required for the ${operation} operation`);
	}
	if (/^\d+$/.test(documentId)) {
		throw new Error(
			'Use the document ID (for example "P0 00006"), not the internal numeric entry ID.',
		);
	}

	if (operation === 'update') {
		return {
			activityId: 'edit',
			moduleId,
			entry: documentId,
			payload: getMappedFieldValues(input.fields),
		};
	}

	if (operation === 'performActivity') {
		if (!input.activityId) {
			throw new Error('Activity ID is required for the Perform Activity operation');
		}

		return {
			activityId: input.activityId,
			moduleId,
			entry: documentId,
			payload: getMappedFieldValues(input.fields),
		};
	}

	if (operation === 'changeState') {
		if (!input.stateName) {
			throw new Error('State is required for the Change State operation');
		}

		return {
			activityId: 'changeStatus',
			moduleId,
			entry: documentId,
			state: input.stateName,
		};
	}

	if (operation !== 'assign') {
		throw new Error(`Unsupported Inistate operation: ${String(operation)}`);
	}

	if (!input.username) {
		throw new Error('User is required for the Assign operation');
	}

	const body: IDataObject = {
		activityId: 'assign',
		assignees: [input.username],
		entry: documentId,
		moduleId,
	};

	if (input.dueDate) {
		body.due = input.dueDate;
	}

	return body;
}

export function getTriggerItem(event: P0TriggerEvent, activityId?: string): string {
	if (event === 'entryCreated') {
		return 'create';
	}

	if (event === 'entryUpdated') {
		return 'edit';
	}

	if (!activityId) {
		throw new Error('Activity ID is required for the Activity Performed trigger');
	}

	return activityId;
}

export function buildSubscription(moduleId: string, item: string, webhookUrl: string): IDataObject {
	return {
		moduleId,
		item,
		type: 'activity',
		trigger: 'execute',
		channel: 'n8n',
		url: webhookUrl,
	};
}

export function getWebhookId(response: unknown): string {
	if (typeof response === 'string') {
		const id = response.trim();
		if (/^[A-Za-z0-9_-]+$/.test(id)) {
			return id;
		}

		throw new Error('Inistate returned an invalid webhook registration ID');
	}

	if (!isRecord(response) || !('id' in response)) {
		throw new Error('Inistate did not return a webhook registration ID');
	}

	const id = response.id;
	if ((typeof id !== 'string' && typeof id !== 'number') || String(id).length === 0) {
		throw new Error('Inistate returned an invalid webhook registration ID');
	}

	return String(id);
}

export function extractCollection(response: unknown, property?: string): unknown[] {
	if (Array.isArray(response)) {
		return response;
	}

	if (!isRecord(response)) {
		return [];
	}

	if (property && Array.isArray(response[property])) {
		return response[property];
	}

	for (const fallback of ['data', 'items', 'results']) {
		if (Array.isArray(response[fallback])) {
			return response[fallback];
		}
	}

	return [];
}

export function toSearchItems(
	values: unknown[],
	valueKeys: string[],
	nameKeys: string[],
	filter = '',
): INodeListSearchItems[] {
	const normalizedFilter = filter.trim().toLocaleLowerCase();
	const seen = new Set<string>();
	const results: INodeListSearchItems[] = [];

	for (const value of values) {
		if (!isRecord(value)) {
			continue;
		}

		const itemValue = firstPrimitive(value, valueKeys);
		const itemName = firstPrimitive(value, nameKeys) ?? itemValue;
		if (itemValue === undefined || itemName === undefined) {
			continue;
		}

		const comparableValue = String(itemValue);
		const comparableName = String(itemName);
		if (
			normalizedFilter &&
			!comparableName.toLocaleLowerCase().includes(normalizedFilter) &&
			!comparableValue.toLocaleLowerCase().includes(normalizedFilter)
		) {
			continue;
		}

		if (seen.has(comparableValue)) {
			continue;
		}

		seen.add(comparableValue);
		results.push({ name: comparableName, value: comparableValue });
	}

	return results;
}

export function extractFormElements(response: unknown): UnknownRecord[] {
	if (!isRecord(response) || !isRecord(response.classificationForm)) {
		return [];
	}

	const elements: UnknownRecord[] = [];
	collectDesignElements(response.classificationForm.design, elements);
	return elements;
}

export function mapFormFields(response: unknown): ResourceMapperField[] {
	const fields: ResourceMapperField[] = [];
	const seen = new Set<string>();

	for (const element of extractFormElements(response)) {
		const idValue = firstPrimitive(element, ['fieldName']);
		const displayNameValue = firstPrimitive(element, ['displayName', 'fieldName']);
		const numericType = typeof element.type === 'number' ? element.type : Number(element.type);
		const mappedType = mapFieldType(numericType);

		if (idValue === undefined || displayNameValue === undefined || !mappedType) {
			continue;
		}

		const id = String(idValue);
		if (seen.has(id)) {
			continue;
		}

		seen.add(id);
		const readOnly = element.readOnly === true;
		const field: ResourceMapperField = {
			id,
			displayName: String(displayNameValue),
			defaultMatch: false,
			canBeUsedToMatch: false,
			required: element.required === true,
			display: !readOnly,
			readOnly,
			type: mappedType,
		};

		if (mappedType === 'options') {
			field.options = extractCollection(element.optionList).flatMap((option) => {
				if (!isRecord(option)) {
					return [];
				}

				const optionValue = firstPrimitive(option, ['name', 'value', 'id']);
				const optionName = firstPrimitive(option, ['name', 'displayName', 'value', 'id']);
				return optionValue === undefined || optionName === undefined
					? []
					: [{ name: String(optionName), value: String(optionValue) }];
			});
		}

		fields.push(field);
	}

	return fields;
}

export function getFormDefaultValues(response: unknown): IDataObject {
	if (
		!isRecord(response) ||
		!isRecord(response.classificationForm) ||
		!isRecord(response.classificationForm.default)
	) {
		return {};
	}

	const defaults = response.classificationForm.default;
	const values: IDataObject = {};
	for (const element of extractFormElements(response)) {
		if (element.readOnly === true) {
			continue;
		}
		const fieldName = firstPrimitive(element, ['fieldName']);
		const elementId = firstPrimitive(element, ['id']);
		if (fieldName === undefined) {
			continue;
		}
		const defaultKey = [elementId, fieldName].find(
			(key) =>
				key !== undefined && Object.prototype.hasOwnProperty.call(defaults, String(key)),
		);
		if (defaultKey !== undefined) {
			values[String(fieldName)] = defaults[String(defaultKey)] as IDataObject[string];
		}
	}
	return values;
}

export function toFieldSearchItems(response: unknown, filter = ''): INodeListSearchItems[] {
	return toSearchItems(
		extractFormElements(response),
		['id', 'fieldName'],
		['displayName', 'fieldName'],
		filter,
	);
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstPrimitive(
	value: UnknownRecord,
	keys: string[],
): string | number | boolean | undefined {
	for (const key of keys) {
		const candidate = value[key];
		if (
			typeof candidate === 'string' ||
			typeof candidate === 'number' ||
			typeof candidate === 'boolean'
		) {
			return candidate;
		}
	}

	return undefined;
}

function collectDesignElements(value: unknown, elements: UnknownRecord[]): void {
	if (!isRecord(value) || !Array.isArray(value.rows)) {
		return;
	}

	for (const row of value.rows) {
		if (!isRecord(row) || !Array.isArray(row.items)) {
			continue;
		}

		for (const item of row.items) {
			if (!isRecord(item)) {
				continue;
			}

			if (item.input !== 'section') {
				if (typeof item.fieldName === 'string' && item.fieldName.length > 0) {
					elements.push(item);
				}
				continue;
			}

			if (item.type === 'tab' && Array.isArray(item.tabs)) {
				for (const tab of item.tabs) {
					if (isRecord(tab)) {
						collectDesignElements(tab.design, elements);
					}
				}
			} else {
				collectDesignElements(item.design, elements);
			}
		}
	}
}

function mapFieldType(type: number): ResourceMapperField['type'] | undefined {
	if ([0, 7, 16, 20, 22, 25, 26, 33].includes(type)) {
		return 'string';
	}

	if (type === 1) {
		return 'boolean';
	}

	if ([2, 3, 4].includes(type)) {
		return 'number';
	}

	if ([5, 6].includes(type)) {
		return 'dateTime';
	}

	if (type === 27) {
		return 'options';
	}

	return undefined;
}
