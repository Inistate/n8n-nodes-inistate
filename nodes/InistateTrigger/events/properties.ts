import type { INodeProperties } from 'n8n-workflow';

export const listMode = (searchListMethod: string) => ({
	displayName: 'From List',
	name: 'list',
	type: 'list' as const,
	typeOptions: { searchListMethod, searchable: true },
});

export const idMode = (displayName: string, placeholder: string) => ({
	displayName: 'By ID',
	name: 'id',
	type: 'string' as const,
	placeholder,
	hint: `Enter the ${displayName} ID when it is not available in the list`,
});

export const workspaceProperty: INodeProperties = {
	displayName: 'Workspace',
	name: 'workspaceId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Inistate workspace to monitor',
	modes: [listMode('searchWorkspaces'), idMode('workspace', '2307')],
};

export const moduleProperty: INodeProperties = {
	displayName: 'Module',
	name: 'moduleId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The module to monitor',
	modes: [listMode('searchModules'), idMode('module', '19296')],
};
