// Catalog parity checker: every catalog module's `en` and `ru` objects must
// define exactly the same key set, keys must carry their module's namespace,
// and no key may appear in two modules. Run: node scripts/check-catalogs.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'i18n', 'catalogs');

function extractKeys(source, name) {
	const re = new RegExp('export const ' + name + '[^=]*=\\s*\\{([\\s\\S]*?)\\};');
	const m = source.match(re);
	if (!m) return null;
	const keys = [];
	const keyRe = /['"]([a-zA-Z][\w.]*)['"]\s*:/g;
	let match;
	while ((match = keyRe.exec(m[1])) !== null) keys.push(match[1]);
	return keys;
}

// core.ts owns several namespaces (common.*, layout.*); every other module
// must prefix its keys with its own filename.
const prefixExceptions = { 'core.ts': ['common.', 'layout.'] };

let failed = false;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()) {
	if (file === 'index.ts') continue;
	const src = readFileSync(join(dir, file), 'utf8');
	const ns = file.replace(/\.ts$/, '');
	const en = extractKeys(src, 'en');
	const ru = extractKeys(src, 'ru');
	const problems = [];
	if (!en || !ru) {
		problems.push('could not parse en/ru objects');
	} else {
		const enSet = new Set(en);
		const ruSet = new Set(ru);
		for (const k of enSet) if (!ruSet.has(k)) problems.push('missing in ru: ' + k);
		for (const k of ruSet) if (!enSet.has(k)) problems.push('missing in en (typo?): ' + k);
		for (const k of en) if (en.indexOf(k) !== en.lastIndexOf(k)) problems.push('duplicate key in en: ' + k);
		for (const k of ru) if (ru.indexOf(k) !== ru.lastIndexOf(k)) problems.push('duplicate key in ru: ' + k);
		const allowed = prefixExceptions[file] ?? [ns + '.'];
		for (const k of [...enSet, ...ruSet]) if (!allowed.some((p) => k.startsWith(p))) problems.push('key outside namespace: ' + k);
	}
	if (problems.length) {
		failed = true;
		console.error(file + ':');
		for (const p of problems) console.error('  - ' + p);
	} else {
		console.log(file + ': OK (' + en.length + ' keys)');
	}
}

// Cross-module uniqueness: the same key must not appear in two modules.
const seen = new Map();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()) {
	if (file === 'index.ts') continue;
	const src = readFileSync(join(dir, file), 'utf8');
	for (const name of ['en', 'ru']) {
		for (const k of extractKeys(src, name) ?? []) {
			if (seen.has(k) && seen.get(k) !== file) {
				failed = true;
				console.error('duplicate key "' + k + '" in both ' + seen.get(k) + ' and ' + file);
			}
			seen.set(k, file);
		}
	}
}

process.exit(failed ? 1 : 0);
