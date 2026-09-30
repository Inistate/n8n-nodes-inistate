import type {
	IDataObject,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
	JsonObject,
	ResourceMapperFields,
	ResourceMapperValue,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	buildApiHeaders,
	extractCollection,
	extractFormElements,
	getFormDefaultValues,
	getMappedFieldValues,
	mapFormFields,
	toReferenceFieldOptions,
	toFieldSearchItems,
	toSearchItems,
} from './Inistate.contract';
import {
	createInistateRequestAdapter,
	findEntryByIdentifier,
	isRecord,
	nestedCollection,
	type InistateRequestConfig,
	type InistateRequestFunctions,
	usesOAuth,
	workspaceModules,
	workspaceModuleStates,
} from './api';

export async function inistateApiRequest(
	context: InistateRequestFunctions,
	options: IHttpRequestOptions,
	requestConfig: InistateRequestConfig = {},
): Promise<unknown> {
	const adapter = await createInistateRequestAdapter(context);

	try {
		return await adapter.request(options, requestConfig);
	} catch (error) {
		throw new NodeApiError(context.getNode(), error as JsonObject, {
			description:
				'Check the Inistate credential, workspace and module access, and request values, then try again.',
		});
	}
}

function getSelectedValue(context: ILoadOptionsFunctions, parameterName: string): string {
	const value = context.getNodeParameter(parameterName, undefined, {
		extractValue: true,
	});
	return value === undefined || value === null ? '' : String(value);
}

async function getWorkspaceDetails(
	context: InistateRequestFunctions,
	workspaceId: string,
): Promise<unknown> {
	if (!workspaceId) {
		return {};
	}

	return await inistateApiRequest(context, {
		method: 'GET',
		url: `/api/Workspace/${encodeURIComponent(workspaceId)}`,
	});
}

async function getModuleStates(
	context: InistateRequestFunctions,
	workspaceId: string,
	moduleId: string,
): Promise<unknown[]> {
	if (usesOAuth(context)) {
		const response = await inistateApiRequest(context, {
			method: 'POST',
			url: '/api/Workspace/Module',
			headers: buildApiHeaders(workspaceId, false),
			body: { moduleId },
		});
		return nestedCollection(response, 'states');
	}

	const response = await getWorkspaceDetails(context, workspaceId);
	return extractCollection(response, 'states').filter((state) => {
		if (typeof state !== 'object' || state === null || Array.isArray(state)) {
			return false;
		}

		return String((state as Record<string, unknown>).module) === moduleId;
	});
}

/**
 * Listings are resolved by name by POST /api/mcp/list, so the selector offers names as
 * values. "Everything" is the server default and is sent as an empty listing.
 */
async function getModuleListings(
	context: InistateRequestFunctions,
	workspaceId: string,
	moduleId: string,
): Promise<unknown[]> {
	const response = await getWorkspaceDetails(context, workspaceId);
	const targetModule = extractCollection(response, 'vectors').find(
		(value) =>
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value) &&
			String((value as Record<string, unknown>).id) === moduleId,
	) as Record<string, unknown> | undefined;

	return Array.isArray(targetModule?.menus) ? targetModule.menus : [];
}

/**
 * The standard activities POST /api/mcp/form accepts by id. searchFormActivities appends
 * the module's custom activities to these.
 */
const standardFormActivities: INodeListSearchItems[] = [
	{ name: 'Change State', value: 'changeState' },
	{ name: 'Comment', value: 'comment' },
	{ name: 'Create', value: 'create' },
	{ name: 'Delete', value: 'delete' },
	{ name: 'Duplicate', value: 'duplicate' },
	{ name: 'Edit', value: 'edit' },
	{ name: 'View', value: 'view' },
];

function getReferenceFieldType(element: Record<string, unknown>): 7 | 20 | undefined {
	const numericType = Number(element.type);
	if (numericType === 7 || numericType === 20) {
		return numericType;
	}

	if (typeof element.type !== 'string') {
		return undefined;
	}

	const normalizedType = element.type.toLocaleLowerCase();
	if (normalizedType === 'module' || normalizedType === 'modules') {
		return 7;
	}
	if (normalizedType === 'user' || normalizedType === 'users') {
		return 20;
	}

	return undefined;
}

function getFormFieldName(element: Record<string, unknown>): string {
	const value = element.fieldName ?? element.name;
	return typeof value === 'string' ? value : '';
}

async function getModuleForm(
	context: InistateRequestFunctions,
	workspaceId: string,
	moduleId: string,
	activityId?: string,
	entryId?: string | number,
): Promise<unknown> {
	if (!workspaceId || !moduleId) {
		return {};
	}

	return await inistateApiRequest(context, {
		method: 'POST',
		url: '/api/Activity/Form',
		headers: buildApiHeaders(workspaceId, false),
		body: {
			vectorId: moduleId,
			...(activityId ? { activityId } : {}),
			...(entryId !== undefined ? { entryId } : {}),
		},
	});
}

export async function resolveMappedFieldValues(
	context: InistateRequestFunctions,
	workspaceId: string,
	moduleId: string,
	activityId: string,
	fields: ResourceMapperValue | IDataObject | null | undefined,
): Promise<IDataObject> {
	const mappedValues = getMappedFieldValues(fields);
	if (
		!fields ||
		typeof fields !== 'object' ||
		!('value' in fields) ||
		!Array.isArray(fields.schema)
	) {
		return mappedValues;
	}

	const rawValues =
		fields.value && typeof fields.value === 'object' ? (fields.value as IDataObject) : {};
	const optionFieldNames = new Set(
		fields.schema
			.filter(
				(field) =>
					field.type === 'options' && Object.prototype.hasOwnProperty.call(rawValues, field.id),
			)
			.map((field) => field.id),
	);
	if (optionFieldNames.size === 0) {
		return mappedValues;
	}

	const form = await getModuleForm(context, workspaceId, moduleId, activityId);
	const referenceElements = extractFormElements(form).filter(
		(element) => {
			const fieldName = getFormFieldName(element);
			return (
				getReferenceFieldType(element) !== undefined &&
				fieldName.length > 0 &&
				optionFieldNames.has(fieldName) &&
				(usesOAuth(context)
					? typeof element.module === 'string'
					: typeof element.id === 'string' || typeof element.id === 'number')
			);
		},
	);
	for (const element of referenceElements) {
		const fieldName = getFormFieldName(element);
		const fieldType = getReferenceFieldType(element);
		if (fieldType === undefined) {
			continue;
		}
		const rawValue = rawValues[fieldName];
		const suppliedId = mappedValues[`${fieldName}Id`];
		if (
			usesOAuth(context) &&
			typeof rawValue === 'string' &&
			rawValue.startsWith('__inistate_reference__:') &&
			suppliedId !== undefined &&
			typeof mappedValues[fieldName] === 'string'
		) {
			continue;
		}
		const searchText = getReferenceSearchText(rawValue, mappedValues[fieldName]);
		const filteredResponse = await getReferenceSelection(
			context,
			workspaceId,
			moduleId,
			activityId,
			element.id as string | number | undefined,
			typeof element.module === 'string' ? element.module : undefined,
			searchText,
			0,
		);
		let reference = findCurrentReference(
			fieldName,
			fieldType,
			filteredResponse,
			rawValue,
			suppliedId,
		);

		if (!reference && suppliedId !== undefined) {
			for (let currentPage = 0; currentPage < 10 && !reference; currentPage++) {
				const pageResponse = await getReferenceSelection(
					context,
					workspaceId,
					moduleId,
					activityId,
					element.id as string | number | undefined,
					typeof element.module === 'string' ? element.module : undefined,
					'',
					currentPage,
				);
				const pageOptions = toReferenceFieldOptions(fieldType, pageResponse);
				if (pageOptions.length === 0) {
					break;
				}
				reference = findCurrentReference(fieldName, fieldType, pageResponse, rawValue, suppliedId);
			}
		}

		if (reference) {
			mappedValues[fieldName] = reference.name;
			mappedValues[`${fieldName}Id`] = reference.id;
			if (reference.username !== undefined) {
				mappedValues[`${fieldName}Username`] = reference.username;
			}
		}
	}

	return mappedValues;
}

async function getReferenceSelection(
	context: InistateRequestFunctions,
	workspaceId: string,
	moduleId: string,
	activityId: string,
	fieldId: string | number | undefined,
	referenceModule: string | undefined,
	text: string,
	currentPage: number,
): Promise<unknown> {
	if (usesOAuth(context)) {
		if (!referenceModule) {
			return [];
		}

		const response = await inistateApiRequest(context, {
			method: 'POST',
			url: '/api/mcp/list',
			headers: buildApiHeaders(workspaceId, false),
			body: {
				module: referenceModule,
				currentPage,
				pageSize: 500,
				...(text ? { search: text } : {}),
			},
		});

		return nestedCollection(response, 'list').flatMap((candidate) => {
			if (!isRecord(candidate)) {
				return [];
			}

			const data = isRecord(candidate.data) ? candidate.data : {};
			const id = candidate.entryId ?? candidate.id;
			const documentId = candidate.documentId;
			const dataValues = Object.values(data).filter(
				(value): value is string | number => typeof value === 'string' || typeof value === 'number',
			);
			const username =
				candidate.username ?? data.Username ?? data.username ?? data.Email ?? data.email;
			const value =
				candidate.value ??
				candidate.name ??
				candidate.displayName ??
				data.Name ??
				data.name ??
				data['Display Name'] ??
				data.Title ??
				data.title ??
				username ??
				documentId ??
				dataValues[0];

			if (
				(typeof id !== 'string' && typeof id !== 'number') ||
				(typeof value !== 'string' && typeof value !== 'number')
			) {
				return [];
			}

			return [
				{
					id,
					value: String(value),
					...(typeof username === 'string' ? { username } : {}),
				},
			];
		});
	}

	if (fieldId === undefined) {
		return [];
	}

	return await inistateApiRequest(context, {
		method: 'POST',
		url: '/api/activity/formselection',
		headers: buildApiHeaders(workspaceId, false),
		body: {
			activityId,
			text,
			currentPage,
			vectorId: /^\d+$/.test(moduleId) ? Number(moduleId) : moduleId,
			fieldId,
			reference: null,
			documentId: '',
		},
	});
}

function findCurrentReference(
	fieldName: string,
	fieldType: number,
	response: unknown,
	rawValue: unknown,
	suppliedId: unknown,
): { id: string | number; name: string; username?: string } | undefined {
	const comparableValues = getReferenceComparableValues(rawValue);
	const references = toReferenceFieldOptions(fieldType, response).flatMap((option) => {
		const decoded = getMappedFieldValues({ [fieldName]: option.value });
		const id = decoded[`${fieldName}Id`];
		const name = decoded[fieldName];
		const username = decoded[`${fieldName}Username`];
		return (typeof id === 'string' || typeof id === 'number') && typeof name === 'string'
			? [
					{
						id,
						name,
						...(typeof username === 'string' ? { username } : {}),
					},
				]
			: [];
	});
	const matches = references.filter((reference) =>
		suppliedId !== undefined
			? String(reference.id) === String(suppliedId)
			: comparableValues.has(reference.name) ||
				(reference.username !== undefined && comparableValues.has(reference.username)),
	);

	return matches.length === 1 ? matches[0] : undefined;
}

function getReferenceSearchText(rawValue: unknown, mappedValue: unknown): string {
	if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
		const value = rawValue as Record<string, unknown>;
		for (const key of ['name', 'Text', 'username', 'Username']) {
			if (typeof value[key] === 'string') {
				return value[key];
			}
		}
	}

	if (typeof rawValue === 'string' && !rawValue.startsWith('__inistate_reference__:')) {
		return rawValue;
	}
	return typeof mappedValue === 'string' ? mappedValue : String(rawValue ?? '');
}

function getReferenceComparableValues(rawValue: unknown): Set<string> {
	if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
		const value = rawValue as Record<string, unknown>;
		return new Set(
			['name', 'Text', 'username', 'Username']
				.map((key) => value[key])
				.filter((candidate): candidate is string => typeof candidate === 'string'),
		);
	}

	return new Set(
		typeof rawValue === 'string' || typeof rawValue === 'number' ? [String(rawValue)] : [],
	);
}

export async function getCurrentEntryFields(
	context: InistateRequestFunctions,
	workspaceId: string,
	moduleId: string,
	documentId: string,
): Promise<IDataObject> {
	if (usesOAuth(context)) {
		const listResponse = await inistateApiRequest(context, {
			method: 'POST',
			url: '/api/workspace/list',
			headers: buildApiHeaders(workspaceId, false),
			body: {
				moduleId,
				currentPage: 0,
				pageSize: 10,
				search: documentId,
			},
		});
		const entry = findEntryByIdentifier(listResponse, documentId);
		if (!entry) {
			throw new Error(`No accessible entry was found with document ID "${documentId}"`);
		}
		if (!isRecord(entry.data)) {
			throw new Error('Inistate did not return the current editable field values');
		}

		return { ...entry.data } as IDataObject;
	}

	const workspace = await getWorkspaceDetails(context, workspaceId);
	const targetModule = extractCollection(workspace, 'vectors').find(
		(value) =>
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value) &&
			String((value as Record<string, unknown>).id) === moduleId,
	) as Record<string, unknown> | undefined;
	const listings = Array.isArray(targetModule?.menus) ? targetModule.menus : [];
	if (listings.length === 0) {
		throw new Error('No accessible listing is available to resolve the entry document ID');
	}

	let entryId: string | number | undefined;
	for (const listing of listings) {
		if (typeof listing !== 'object' || listing === null || Array.isArray(listing)) {
			continue;
		}
		const listingId = (listing as Record<string, unknown>).id;
		if (typeof listingId !== 'string' && typeof listingId !== 'number') {
			continue;
		}
		const listResponse = await inistateApiRequest(context, {
			method: 'POST',
			url: '/api/workspace/list',
			headers: buildApiHeaders(workspaceId, false),
			body: {
				moduleId,
				listingId,
				withHeader: false,
				currentPage: 0,
				pageSize: 10,
				filters: null,
				sorts: null,
				search: documentId,
			},
		});
		const listData =
			typeof listResponse === 'object' && listResponse !== null && !Array.isArray(listResponse)
				? (listResponse as Record<string, unknown>).data
				: undefined;
		const entry = extractCollection(listData, 'list').find(
			(value) =>
				typeof value === 'object' &&
				value !== null &&
				!Array.isArray(value) &&
				String((value as Record<string, unknown>).documentId) === documentId,
		) as Record<string, unknown> | undefined;
		if (entry && (typeof entry.id === 'string' || typeof entry.id === 'number')) {
			entryId = entry.id;
			break;
		}
	}

	if (entryId === undefined) {
		throw new Error(`No accessible entry was found with document ID "${documentId}"`);
	}
	const form = await getModuleForm(context, workspaceId, moduleId, 'edit', entryId);
	const currentValues = getFormDefaultValues(form);
	if (Object.keys(currentValues).length === 0) {
		throw new Error('Inistate did not return the current editable field values');
	}
	return currentValues;
}

export const listSearch = {
	async searchWorkspaces(
		this: ILoadOptionsFunctions,
		filter?: string,
		paginationToken?: string,
	): Promise<INodeListSearchResult> {
		const page = paginationToken ? Number.parseInt(paginationToken, 10) : 0;
		const response = await inistateApiRequest(this, {
			method: 'GET',
			url: '/api/Workspace',
			qs: {
				page: Number.isNaN(page) ? 0 : page,
				search: filter ?? '',
			},
		});
		const results = toSearchItems(extractCollection(response), ['id'], ['name'], filter);

		return {
			results,
			...(results.length > 0
				? { paginationToken: String((Number.isNaN(page) ? 0 : page) + 1) }
				: {}),
		};
	},

	async searchModules(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const response = await getWorkspaceDetails(this, workspaceId);
		return {
			results: toSearchItems(workspaceModules(response), ['id'], ['name'], filter),
		};
	},

	async searchActivities(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		if (!workspaceId || !moduleId) {
			return { results: [] };
		}

		const response = await inistateApiRequest(this, {
			method: 'POST',
			url: '/api/Workspace/Module',
			headers: buildApiHeaders(workspaceId, false),
			body: { moduleId },
		});
		const activities = nestedCollection(response, 'activities').filter((activity) => {
			const name = typeof activity === 'string'
				? activity
				: isRecord(activity) && typeof activity.name === 'string'
					? activity.name
					: '';
			return !['create', 'edit'].includes(name.trim().toLocaleLowerCase());
		});
		return {
			results: usesOAuth(this)
				? toSearchItems(activities, ['name'], ['name'], filter)
				: toSearchItems(activities, ['id'], ['name'], filter),
		};
	},

	async searchTriggerActivities(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		if (!workspaceId || !moduleId) {
			return { results: [] };
		}

		if (usesOAuth(this)) {
			const workspace = await getWorkspaceDetails(this, workspaceId);
			const module = workspaceModules(workspace).find(
				(candidate) => isRecord(candidate) && String(candidate.id) === moduleId,
			);
			const moduleName = isRecord(module) && typeof module.name === 'string'
				? module.name.trim()
				: '';
			if (!moduleName) {
				return { results: [] };
			}

			const response = await inistateApiRequest(this, {
				method: 'GET',
				url: `/api/configure/${encodeURIComponent(moduleName)}`,
				headers: buildApiHeaders(workspaceId, false),
			});
			return {
				results: toSearchItems(nestedCollection(response, 'activities'), ['id'], ['name'], filter),
			};
		}

		const response = await inistateApiRequest(
			this,
			{
				method: 'POST',
				url: '/api/Workspace/Module',
				headers: buildApiHeaders(workspaceId, false),
				body: { moduleId },
			},
			{ preserveLegacyPath: true },
		);
		return {
			results: toSearchItems(nestedCollection(response, 'activities'), ['id'], ['name'], filter),
		};
	},

	async searchFormActivities(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const normalizedFilter = (filter ?? '').trim().toLocaleLowerCase();
		const standards = standardFormActivities.filter(
			({ name, value }) =>
				!normalizedFilter ||
				name.toLocaleLowerCase().includes(normalizedFilter) ||
				String(value).toLocaleLowerCase().includes(normalizedFilter),
		);
		const custom = await listSearch.searchActivities.call(this, filter);

		return { results: [...standards, ...custom.results] };
	},

	async searchFields(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		const response = await getModuleForm(this, workspaceId, moduleId);
		return { results: toFieldSearchItems(response, filter) };
	},

	async searchStates(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		const states = await getModuleStates(this, workspaceId, moduleId);
		return { results: toSearchItems(states, ['name'], ['name'], filter) };
	},

	async searchStateIds(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		const states = await getModuleStates(this, workspaceId, moduleId);
		return { results: toSearchItems(states, ['id'], ['name'], filter) };
	},

	async searchTriggerStateIds(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		if (!workspaceId || !moduleId) {
			return { results: [] };
		}

		const response = await getWorkspaceDetails(this, workspaceId);
		const states = workspaceModuleStates(response, moduleId);
		return { results: toSearchItems(states, ['id'], ['name'], filter) };
	},

	async searchUsers(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const response = usesOAuth(this)
			? await inistateApiRequest(this, {
					method: 'GET',
					url: `/v1/workspaces/${encodeURIComponent(workspaceId)}/users`,
				})
			: await getWorkspaceDetails(this, workspaceId);
		return {
			results: toSearchItems(
				extractCollection(response, 'users'),
				['username'],
				['displayName', 'username'],
				filter,
			),
		};
	},
};

export const loadOptions = {
	async getListings(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		const listings = await getModuleListings(this, workspaceId, moduleId);

		return [
			{ name: 'Everything', value: '' },
			...toSearchItems(listings, ['name'], ['name']).map(({ name, value }) => ({
				name,
				value: String(value),
			})),
			{ name: 'Archive', value: 'archive' },
		];
	},

	async getStates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		const states = await getModuleStates(this, workspaceId, moduleId);

		return toSearchItems(states, ['name'], ['name']).map(({ name, value }) => ({
			name,
			value: String(value),
		}));
	},
};

export const resourceMapping = {
	async getFormFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
		const operation = String(this.getNodeParameter('operation'));
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		const activityId =
			operation === 'performActivity'
				? getSelectedValue(this, 'activityId')
				: operation === 'update'
					? 'edit'
					: 'create';
		const response = await getModuleForm(this, workspaceId, moduleId, activityId);
		const formElements = extractFormElements(response);
		const referenceElements = formElements.filter((element) =>
			getReferenceFieldType(element) !== undefined,
		);
		const referenceOptions = Object.fromEntries(
			await Promise.all(
				referenceElements
					.map(async (element) => {
						const fieldName = getFormFieldName(element);
						const fieldId = element.id;
						const fieldType = getReferenceFieldType(element);
						const referenceModule =
							typeof element.module === 'string' ? element.module : undefined;
						if (
							!fieldName ||
							fieldType === undefined ||
							(usesOAuth(this)
								? !referenceModule
								: typeof fieldId !== 'string' && typeof fieldId !== 'number')
						) {
							return [fieldName, []] as const;
						}

						const options: INodePropertyOptions[] = [];
						const seen = new Set<string>();
						for (let currentPage = 0; currentPage < 10; currentPage++) {
							const selectionResponse = await getReferenceSelection(
								this,
								workspaceId,
								moduleId,
								activityId,
								fieldId as string | number | undefined,
								referenceModule,
								'',
								currentPage,
							);
							const pageOptions = toReferenceFieldOptions(fieldType, selectionResponse);
							let added = 0;
							for (const option of pageOptions) {
								const value = String(option.value);
								if (!seen.has(value)) {
									seen.add(value);
									options.push(option);
									added++;
								}
							}
							if (pageOptions.length === 0 || added === 0) {
								break;
							}
						}

						return [fieldName, options] as const;
					}),
			),
		);
		const fields = mapFormFields(response, referenceOptions);

		return {
			fields,
			...(fields.length === 0
				? {
						emptyFieldsNotice: 'This Inistate activity has no configurable form fields.',
					}
				: {}),
		};
	},
};
