const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const SCANNED = ['credentials', 'nodes', 'dist', 'docs', 'examples', 'scripts', 'README.md'];
const FORBIDDEN = ['app', '02'].join('');

function walk(target, files = []) {
	const stats = fs.statSync(target);
	if (stats.isFile()) {
		files.push(target);
		return files;
	}
	for (const entry of fs.readdirSync(target)) walk(path.join(target, entry), files);
	return files;
}

test('no shipped or repo source file names the internal host', () => {
	const offenders = [];
	for (const relative of SCANNED) {
		const target = path.join(ROOT, relative);
		if (!fs.existsSync(target)) continue;
		for (const file of walk(target)) {
			const content = fs.readFileSync(file, 'utf8');
			if (content.toLowerCase().includes(FORBIDDEN)) {
				offenders.push(path.relative(ROOT, file));
			}
		}
	}

	assert.deepEqual(offenders, []);
});
