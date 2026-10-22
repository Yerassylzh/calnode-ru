// Extracts every t('key') / $t('key') reference from src and verifies each
// exists in the flattened catalogs. Run: node scripts/check-keys.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catDir = join(root, 'src', 'lib', 'i18n', 'catalogs');

function extractKeys(source, name) {
	const m = source.match(new RegExp('export const ' + name + '[^=]*=\\s*\\{([\\s\\S]*?)\\};'));
	if (!m) return [];
	const keys = [];
	const re = /['"]([a-zA-Z][\w.]*)['"]\s*:/g;
	let match;
	while ((match = re.exec(m[1])) !== null) keys.push(match[1]);
	return keys;
}

const catalog = new Set();
for (const file of readdirSync(catDir).filter((f) => f.endsWith('.ts'))) {
	const src = readFileSync(join(catDir, file), 'utf8');
	for (const k of extractKeys(src, 'en')) catalog.add(k);
	for (const k of extractKeys(src, 'ru')) catalog.add(k);
}

function walk(dir, out = []) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (/\.(svelte|ts|js)$/.test(e.name) && !p.includes('i18n' + '\\')) out.push(p);
	}
	return out;
}

const files = walk(join(root, 'src')).filter((p) => !p.includes('catalogs'));
let failed = false;
for (const file of files) {
	const src = readFileSync(file, 'utf8');
	const re = /(?<![\w$.])\$?t\(\s*['"]([a-zA-Z][\w.]*)['"]/g;
	let m;
	const used = new Set();
	while ((m = re.exec(src)) !== null) used.add(m[1]);
	for (const k of used) {
		if (!catalog.has(k)) {
			failed = true;
			console.error(join(file).replace(root, '') + ': unknown key "' + k + '"');
		}
	}
}
if (failed) process.exit(1);
console.log('all t() references resolve (' + catalog.size + ' catalog keys)');
