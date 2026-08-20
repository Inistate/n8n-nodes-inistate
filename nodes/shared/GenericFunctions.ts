import type {
	IAllExecuteFunctions,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	ResourceMapperFields,
} from 'n8n-workflow';

import {
	APP02_BASE_URL,
	buildApiHeaders,
	extractCollection,
	mapFormFields,
	toFieldSearchItems,
	toSearchItems,
} from './Inistate.contract';

type InistateRequestFunctions = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

export async function inistateApiRequest(
	context: InistateRequestFunctions,
	options: IHttpRequestOptions,
): Promise<unknown> {
	return await context.helpers.httpRequestWithAuthentication.call(
		context as IAllExecuteFunctions,
		'inistateApi',
		{
			...options,
			url: options.url.startsWith('http') ? options.url : `${APP02_BASE_URL}${options.url}`,
			json: true,
		},
	);
}

function getSelectedValue(context: ILoadOptionsFunctions, parameterName: string): string {
	const value = context.getNodeParameter(parameterName, undefined, { extractValue: true });
	return value === undefined || value === null ? '' : String(value);
}

async function getWorkspaceDetails(
	context: ILoadOptionsFunctions,
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

async function getModuleForm(
	context: ILoadOptionsFunctions,
	moduleId: string,
	activityId?: string,
): Promise<unknown> {
	if (!moduleId) {
		return {};
	}

	return await inistateApiRequest(context, {
		method: 'POST',
		url: '/api/Activity/Form',
		body: {
			vectorId: moduleId,
			...(activityId ? { activityId } : {}),
		},
	});
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
			results: toSearchItems(extractCollection(response, 'vectors'), ['id'], ['name'], filter),
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
		return {
			results: toSearchItems(extractCollection(response, 'activities'), ['id'], ['name'], filter),
		};
	},

	async searchFields(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const moduleId = getSelectedValue(this, 'moduleId');
		const response = await getModuleForm(this, moduleId);
		return { results: toFieldSearchItems(response, filter) };
	},

	async searchStates(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const moduleId = getSelectedValue(this, 'moduleId');
		const response = await getWorkspaceDetails(this, workspaceId);
		const states = extractCollection(response, 'states').filter((state) => {
			if (typeof state !== 'object' || state === null || Array.isArray(state)) {
				return false;
			}

			return String((state as Record<string, unknown>).module) === moduleId;
		});

		return { results: toSearchItems(states, ['name'], ['name'], filter) };
	},

	async searchUsers(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const workspaceId = getSelectedValue(this, 'workspaceId');
		const response = await getWorkspaceDetails(this, workspaceId);
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

export const resourceMapping = {
	async getFormFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
		const operation = String(this.getNodeParameter('operation'));
		const moduleId = getSelectedValue(this, 'moduleId');
		const activityId =
			operation === 'performActivity'
				? getSelectedValue(this, 'activityId')
				: operation === 'update'
					? 'edit'
					: 'create';
		const response = await getModuleForm(this, moduleId, activityId);
		const fields = mapFormFields(response);

		return {
			fields,
			...(fields.length === 0
				? { emptyFieldsNotice: 'This Inistate activity has no configurable form fields.' }
				: {}),
		};
	},
};
