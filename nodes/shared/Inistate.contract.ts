import type {
	IDataObject,
	INodeListSearchItems,
	INodePropertyOptions,
	ResourceMapperField,
	ResourceMapperValue,
} from 'n8n-workflow';

export const APP02_BASE_URL = 'https://app02.apps.inistate.com';
export const INISTATE_BASE_URL = 'https://api.inistate.com';

export function getInistateBaseUrl(environment: unknown): string {
	return environment === 'app02' ? APP02_BASE_URL : INISTATE_BASE_URL;
}

export type P0Operation = 'create' | 'update' | 'performActivity' | 'changeState' | 'assign';

export type P1Operation = 'delete' | 'duplicate';

export type InistateOperation = P0Operation | P1Operation;

export type P0TriggerEvent = 'entryCreated' | 'entryUpdated' | 'activityPerformed';

export type P1TriggerEvent = 'stateChanged';

export type InistateTriggerEvent = P0TriggerEvent | P1TriggerEvent;

type UnknownRecord = Record<string, unknown>;

const REFERENCE_VALUE_PREFIX = '__inistate_reference__:';

export interface ActionRequestInput {
	operation: InistateOperation;
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

	let values: IDataObject;
	if ('mappingMode' in fields || 'matchingColumns' in fields || 'schema' in fields) {
		const value = (fields as ResourceMapperValue).value;
		values = value && typeof value === 'object' ? { ...value } : {};
	} else {
		values = { ...fields };
	}

	return Object.fromEntries(
		Object.entries(values).flatMap(([key, value]) => expandMappedField(key, value)),
	) as IDataObject;
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

	if (operation === 'delete' || operation === 'duplicate') {
		return {
			activityId: operation,
			moduleId,
			entry: documentId,
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

export function buildSubscription(
	moduleId: string,
	item: string,
	webhookUrl: string,
	type = 'activity',
	trigger = 'execute',
): IDataObject {
	return {
		moduleId,
		item,
		type,
		trigger,
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

export function mapFormFields(
	response: unknown,
	referenceOptions: Record<string, INodePropertyOptions[]> = {},
): ResourceMapperField[] {
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
			field.options = [7, 20].includes(numericType)
				? (referenceOptions[id] ?? [])
				: extractCollection(element.optionList).flatMap((option) => {
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

export function toReferenceFieldOptions(
	fieldType: number,
	response: unknown,
): INodePropertyOptions[] {
	if (![7, 20].includes(fieldType)) {
		return [];
	}

	const options: INodePropertyOptions[] = [];
	const seen = new Set<string>();
	for (const candidate of extractCollection(response)) {
		if (!isRecord(candidate)) {
			continue;
		}

		const id = firstPrimitive(candidate, ['id', 'entryId', 'entityId']);
		const name = firstPrimitive(candidate, [
			'value',
			'optionName',
			'name',
			'displayName',
			'documentId',
			'username',
		]);
		const username = firstPrimitive(candidate, ['username']);
		if (id === undefined || name === undefined || (fieldType === 20 && username === undefined)) {
			continue;
		}

		const reference = {
			id,
			name: String(name),
			...(fieldType === 20 ? { username: String(username) } : {}),
		};
		const value = `${REFERENCE_VALUE_PREFIX}${JSON.stringify(reference)}`;
		if (seen.has(value)) {
			continue;
		}

		seen.add(value);
		options.push({ name: String(name), value });
	}

	return options;
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
			(key) => key !== undefined && Object.prototype.hasOwnProperty.call(defaults, String(key)),
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

function expandMappedField(key: string, value: unknown): Array<[string, unknown]> {
	if (typeof value !== 'string' || !value.startsWith(REFERENCE_VALUE_PREFIX)) {
		return [[key, value]];
	}

	try {
		const decoded = JSON.parse(value.slice(REFERENCE_VALUE_PREFIX.length)) as unknown;
		if (
			!isRecord(decoded) ||
			(typeof decoded.id !== 'string' && typeof decoded.id !== 'number') ||
			typeof decoded.name !== 'string'
		) {
			return [[key, value]];
		}

		return [
			[key, decoded.name],
			[`${key}Id`, decoded.id],
			...(typeof decoded.username === 'string'
				? ([[`${key}Username`, decoded.username]] as Array<[string, unknown]>)
				: []),
		];
	} catch {
		return [[key, value]];
	}
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
	if ([0, 16, 22, 25, 26, 33].includes(type)) {
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

	if ([7, 20, 27].includes(type)) {
		return 'options';
	}

	return undefined;
}
