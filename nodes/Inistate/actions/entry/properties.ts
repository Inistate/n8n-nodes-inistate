import type { INodeProperties } from 'n8n-workflow';

import type { InistateOperation, P0Operation } from '../../../shared/Inistate.contract';

export const listMode = (searchListMethod: string) => ({
	displayName: 'From List',
	name: 'list',
	type: 'list' as const,
	typeOptions: {
		searchListMethod,
		searchable: true,
	},
});

export const idMode = (displayName: string, placeholder: string) => ({
	displayName: 'By ID',
	name: 'id',
	type: 'string' as const,
	placeholder: `e.g. ${placeholder}`,
	hint: `Enter the ${displayName} ID when it is not available in the list`,
});

export const workspaceProperty: INodeProperties = {
	displayName: 'Workspace',
	name: 'workspaceId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Inistate workspace to use',
	modes: [listMode('searchWorkspaces'), idMode('workspace', '2307')],
};

export const moduleProperty: INodeProperties = {
	displayName: 'Module',
	name: 'moduleId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The module containing the entry',
	modes: [listMode('searchModules'), idMode('module', '19296')],
};

export function documentIdProperty(
	operation: Exclude<InistateOperation, 'create'>,
): INodeProperties {
	return {
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. N8N-TEST00001',
		description: 'The stable document ID of the entry',
		displayOptions: { show: { operation: [operation] } },
	};
}

export function fieldsProperty(
	operation: Extract<P0Operation, 'create' | 'update' | 'performActivity'>,
): INodeProperties {
	return {
		displayName: 'Fields',
		name: 'fields',
		type: 'resourceMapper',
		default: {
			mappingMode: 'defineBelow',
			value: null,
			matchingColumns: [],
			schema: [],
			attemptToConvertTypes: false,
			convertFieldsToString: false,
		},
		required: true,
		noDataExpression: true,
		displayOptions: { show: { operation: [operation] } },
		typeOptions: {
			loadOptionsDependsOn: [
				'operation',
				'workspaceId.value',
				'moduleId.value',
				'activityId.value',
			],
			resourceMapper: {
				resourceMapperMethod: 'getFormFields',
				mode: 'add',
				fieldWords: { singular: 'field', plural: 'fields' },
				addAllFields: true,
				supportAutoMap: true,
				multiKeyMatch: false,
				allowEmptyValues: true,
			},
		},
	};
}
