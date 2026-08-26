// These stable synthetic IDs are used only by offline tests. The live smoke test resolves the
// current production IDs from the API by the exact workspace and module names below.
const PRODUCTION_SANDBOX = Object.freeze({
	workspace: Object.freeze({
		name: 'N8N Production Sandbox',
		id: '9001',
	}),
	modules: Object.freeze([
		Object.freeze({ name: 'Task Tracker', id: '9101' }),
		Object.freeze({ name: 'Projects', id: '9102' }),
		Object.freeze({ name: 'Members', id: '9103' }),
	]),
});

module.exports = { PRODUCTION_SANDBOX };
