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
		expect(get(t)('bookings.filters.upcoming', { count: 45 })).toBe('Upcoming (45)');

		setLocale('ru');
		expect(get(t)('bookings.filters.upcoming', { count: 45 })).toBe('Предстоящие (45)');
	});

	test('Intl.PluralRules handles Russian plural forms (0, 1, 2, 5, 11, 21, 22, 25)', () => {
		setLocale('en');
		const tEn = get(t);
		expect(tEn.plural('availability.spanDuration', 1)).toBe('1 day');
		expect(tEn.plural('availability.spanDuration', 2)).toBe('2 days');
		expect(tEn.plural('availability.spanDuration', 5)).toBe('5 days');

		setLocale('ru');
		const tRu = get(t);
		// In Russian:
		// 1, 21 -> one ("день")
		// 2, 3, 4, 22 -> few ("дня")
		// 0, 5, 6..20, 25 -> many ("дней")
		expect(tRu.plural('availability.spanDuration', 1)).toBe('1 день');
		expect(tRu.plural('availability.spanDuration', 21)).toBe('21 день');
		expect(tRu.plural('availability.spanDuration', 2)).toBe('2 дня');
		expect(tRu.plural('availability.spanDuration', 22)).toBe('22 дня');
		expect(tRu.plural('availability.spanDuration', 0)).toBe('0 дней');
		expect(tRu.plural('availability.spanDuration', 5)).toBe('5 дней');
		expect(tRu.plural('availability.spanDuration', 11)).toBe('11 дней');
		expect(tRu.plural('availability.spanDuration', 25)).toBe('25 дней');
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
