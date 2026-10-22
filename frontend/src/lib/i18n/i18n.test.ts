import { describe, test, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { locale, setLocale, t, tSync, fmtDateIntl, fmtNumberIntl, LOCALE_TAGS } from './index';

describe('Admin i18n store', () => {
	beforeEach(() => {
		localStorage.clear();
		setLocale('en');
	});

	test('default and switching locale updates store and tags', () => {
		expect(get(locale)).toBe('en');
		expect(LOCALE_TAGS[get(locale)]).toBe('en');

		setLocale('ru');
		expect(get(locale)).toBe('ru');
		expect(LOCALE_TAGS[get(locale)]).toBe('ru-RU');
		expect(localStorage.getItem('calnode.locale')).toBe('ru');

		setLocale('en');
		expect(get(locale)).toBe('en');
		expect(localStorage.getItem('calnode.locale')).toBe('en');
	});

	test('reactive t() updates translations immediately when locale changes', () => {
		setLocale('en');
		const translatorEn = get(t);
		expect(translatorEn('common.language')).toBe('Language');
		expect(translatorEn('common.save')).toBe('Save');

		setLocale('ru');
		const translatorRu = get(t);
		expect(translatorRu('common.language')).toBe('Язык');
		expect(translatorRu('common.save')).toBe('Сохранить');
	});

	test('interpolation works for placeholders', () => {
		setLocale('en');
		expect(get(t)('settingsAI.connectionOk', { latency: 45 })).toBe('Connection OK (45 ms)');

		setLocale('ru');
		expect(get(t)('settingsAI.connectionOk', { latency: 45 })).toBe('Подключение успешно (45 мс)');
	});

	test('Intl.PluralRules handles Russian plural forms (0, 1, 2, 5, 11, 21, 22, 25)', () => {
		setLocale('en');
		const tEn = get(t);
		expect(tEn.plural('webhooks.table.fieldsCount', 1)).toBe('1 field');
		expect(tEn.plural('webhooks.table.fieldsCount', 2)).toBe('2 fields');
		expect(tEn.plural('webhooks.table.fieldsCount', 5)).toBe('5 fields');

		setLocale('ru');
		const tRu = get(t);
		// In Russian:
		// 1, 21 -> one ("поле")
		// 2, 3, 4, 22 -> few ("поля")
		// 0, 5, 6..20, 25 -> many ("полей")
		expect(tRu.plural('webhooks.table.fieldsCount', 1)).toBe('1 поле');
		expect(tRu.plural('webhooks.table.fieldsCount', 21)).toBe('21 поле');
		expect(tRu.plural('webhooks.table.fieldsCount', 2)).toBe('2 поля');
		expect(tRu.plural('webhooks.table.fieldsCount', 22)).toBe('22 поля');
		expect(tRu.plural('webhooks.table.fieldsCount', 0)).toBe('0 полей');
		expect(tRu.plural('webhooks.table.fieldsCount', 5)).toBe('5 полей');
		expect(tRu.plural('webhooks.table.fieldsCount', 11)).toBe('11 полей');
		expect(tRu.plural('webhooks.table.fieldsCount', 25)).toBe('25 полей');
	});

	test('fmtDateIntl and fmtNumberIntl respect active locale', () => {
		const sampleDate = new Date(Date.UTC(2026, 9, 23, 12, 0, 0));

		setLocale('en');
		const enFormatted = fmtDateIntl(sampleDate, { month: 'short', timeZone: 'UTC' });
		expect(enFormatted).toBe('Oct');

		setLocale('ru');
		const ruFormatted = fmtDateIntl(sampleDate, { month: 'short', timeZone: 'UTC' });
		expect(ruFormatted).toBe('окт.');
	});

	test('tSync provides current-locale lookup for non-reactive helpers', () => {
		setLocale('en');
		expect(tSync('common.cancel')).toBe('Cancel');

		setLocale('ru');
		expect(tSync('common.cancel')).toBe('Отмена');
	});
});
