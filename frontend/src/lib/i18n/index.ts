import { writable, derived, get } from 'svelte/store';
import { en, ru } from './catalogs';

/**
 * Admin locale store — English (en) and Russian (ru-RU) catalogs.
 *
 * Catalog path (documented per TRANSLATION_WORKLIST.md): there was no existing
 * admin catalog to reuse, so admin strings live in
 * `src/lib/i18n/catalogs/<module>.ts`, one file per source-file group. Each
 * module exports `en` and `ru` objects keyed with a `<module>.*` namespace
 * prefix (the prefix MUST match its module file so keys stay globally unique).
 * `catalogs/index.ts` registers every module up front; a new module is added by
 * creating its file and adding one import line there.
 *
 * `t` is a derived store, so every `{$t('key')}` re-resolves when the locale
 * changes — text is never baked in once at init. Plurals go through
 * Intl.PluralRules (`t.plural`); dates/numbers go through Intl with the
 * selected tag (`localeTag`, `fmtDateIntl`, `fmtNumberIntl`).
 */

export type LocaleCode = 'en' | 'ru';

const STORAGE_KEY = 'calnode.locale';

/** Intl tags used for formatting; `ru` selects the ru-RU catalog. */
export const LOCALE_TAGS: Record<LocaleCode, string> = { en: 'en', ru: 'ru-RU' };

const VALID: LocaleCode[] = ['en', 'ru'];

export type PluralMessages = { one?: string; few?: string; many?: string; other?: string };
export type CatalogEntry = string | PluralMessages;

export type InterpolationParams = Record<string, string | number>;

function isPluralEntry(entry: CatalogEntry): entry is PluralMessages {
	return typeof entry === 'object' && entry !== null;
}

function interpolate(template: string, params?: InterpolationParams): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		params[key] !== undefined ? String(params[key]) : match
	);
}

function readStoredLocale(): LocaleCode | null {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		return VALID.includes(v as LocaleCode) ? (v as LocaleCode) : null;
	} catch {
		// Storage unavailable (private mode, blocked cookies) — fall through.
		return null;
	}
}

function detectLocale(): LocaleCode {
	const stored = readStoredLocale();
	if (stored) return stored;
	try {
		const candidates = navigator.languages ?? [navigator.language];
		for (const c of candidates) {
			const primary = (c || '').split('-')[0].toLowerCase();
			if (VALID.includes(primary as LocaleCode)) return primary as LocaleCode;
		}
	} catch {
		// navigator unavailable in some embedded contexts — fall back to en.
	}
	return 'en';
}

export const locale = writable<LocaleCode>(detectLocale());

// Persist and reflect the selection. Runs on every change; safe when storage
// is unavailable or no document exists (tests).
locale.subscribe((code) => {
	try {
		localStorage.setItem(STORAGE_KEY, code);
	} catch {
		// Ignore persistence failures — the selection still applies for the session.
	}
	try {
		document.documentElement.lang = code;
	} catch {
		// No document — nothing to update.
	}
});

/** Set the locale explicitly (language switcher). */
export function setLocale(code: LocaleCode) {
	locale.set(code);
}

/** Current Intl tag ('en' | 'ru-RU'), reactive in .svelte files via `$localeTag`. */
export const localeTag = derived(locale, (code) => LOCALE_TAGS[code]);

function lookup(dict: Record<string, CatalogEntry>, key: string): CatalogEntry | undefined {
	const entry = dict[key];
	if (entry !== undefined) return entry;
	return en[key];
}

function makeT(code: LocaleCode) {
	const dict = code === 'ru' ? ru : en;
	const pluralRules = new Intl.PluralRules(LOCALE_TAGS[code]);

	const t = (key: string, params?: InterpolationParams): string => {
		const entry = lookup(dict, key);
		if (entry === undefined) return key;
		if (isPluralEntry(entry)) {
			// Used as plain t() on a plural entry (e.g. no count known) — degrade
			// to the most neutral form rather than rendering "[object Object]".
			return interpolate(entry.other ?? key, params);
		}
		return interpolate(entry, params);
	};

	t.plural = (key: string, count: number, params?: InterpolationParams): string => {
		const entry = lookup(dict, key);
		const forms: PluralMessages = entry !== undefined && isPluralEntry(entry)
			? entry
			: { other: typeof entry === 'string' ? entry : key };
		const category = pluralRules.select(count);
		const form = (forms as Record<string, string | undefined>)[category] ?? forms.other ?? key;
		return interpolate(form, { ...params, count });
	};

	return t;
}

/** Translate a key. Reactive: in .svelte files use `{$t('ns.key', { name })}`. */
export const t = derived(locale, makeT);

export type Translator = ReturnType<typeof makeT>;

/** Current-locale snapshot lookup for non-reactive contexts (.ts helpers). */
export function tSync(key: string, params?: InterpolationParams): string {
	return makeT(get(locale))(key, params);
}

/**
 * Format a Date with the selected locale while the user's existing timezone /
 * time-format preferences stay intact — callers keep passing timeZone and
 * hour12; only the language comes from here.
 */
export function fmtDateIntl(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
	return new Intl.DateTimeFormat(LOCALE_TAGS[get(locale)], options).format(date);
}

/** Locale-aware number formatting for non-reactive contexts. */
export function fmtNumberIntl(value: number, options: Intl.NumberFormatOptions = {}): string {
	return new Intl.NumberFormat(LOCALE_TAGS[get(locale)], options).format(value);
}

export const LOCALES: { code: LocaleCode; label: string }[] = [
	{ code: 'en', label: 'English' },
	{ code: 'ru', label: 'Русский' }
];
