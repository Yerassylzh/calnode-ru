import { describe, test, expect } from 'vitest';
import { createStartChecker, dayPart } from './slots';
import { isValidPhone, normalizePhone } from '../phone';

describe('createStartChecker', () => {
	// 09:00-12:00 UTC on 2026-11-18, UTC wall clock.
	const windows = [{ start_at: '2026-11-18T09:00:00Z', end_at: '2026-11-18T12:00:00Z' }];
	const base = { windows, date: '2026-11-18', timezone: 'UTC' };

	test('a booking must fit entirely inside a free window', () => {
		const c = createStartChecker({ ...base, durationMinutes: 30 });
		expect(c.fits(9 * 60)).toBe(true);
		expect(c.fits(11 * 60 + 30)).toBe(true);
		expect(c.fits(11 * 60 + 31)).toBe(false);
		expect(c.fits(8 * 60 + 59)).toBe(false);
	});
	test('start list follows the step and respects the duration', () => {
		const c = createStartChecker({ ...base, durationMinutes: 60 });
		const starts = c.starts(15);
		expect(starts[0]).toBe(9 * 60);
		expect(starts[starts.length - 1]).toBe(11 * 60);
		expect(starts).toHaveLength(9);
	});
	test("a window that starts off-grid contributes its own start", () => {
		const c = createStartChecker({
			windows: [{ start_at: '2026-11-18T09:07:00Z', end_at: '2026-11-18T10:00:00Z' }],
			date: '2026-11-18', timezone: 'UTC', durationMinutes: 20
		});
		expect(c.starts(10)[0]).toBe(9 * 60 + 7);
	});
	test('uses wall-clock time in the given zone', () => {
		const c = createStartChecker({ windows, date: '2026-11-18', timezone: 'Asia/Almaty', durationMinutes: 30 }); // UTC+5
		expect(c.fits(14 * 60)).toBe(true);
		expect(c.fits(9 * 60)).toBe(false);
	});
	test('a nonexistent DST wall-clock minute is never offered', () => {
		// Europe/Berlin springs forward 2026-03-29: 02:00-03:00 local does not exist.
		const c = createStartChecker({
			windows: [{ start_at: '2026-03-29T00:00:00Z', end_at: '2026-03-29T08:00:00Z' }],
			date: '2026-03-29', timezone: 'Europe/Berlin', durationMinutes: 15
		});
		expect(c.fits(2 * 60 + 30)).toBe(false);
		expect(c.fits(4 * 60)).toBe(true);
	});
	test('no windows, no duration or no date means nothing fits', () => {
		expect(createStartChecker({ ...base, windows: [], durationMinutes: 30 }).starts()).toEqual([]);
		expect(createStartChecker({ ...base, durationMinutes: 0 }).fits(600)).toBe(false);
	});
	test('dayPart buckets', () => {
		expect([dayPart(9 * 60), dayPart(12 * 60), dayPart(16 * 60 + 59), dayPart(17 * 60)]).toEqual(['morning', 'afternoon', 'afternoon', 'evening']);
	});
});

describe('normalizePhone', () => {
	test('formatted and trunk-prefixed Russian/Kazakh numbers', () => {
		expect(normalizePhone('+7 (701) 123-45-67')).toBe('+77011234567');
		expect(normalizePhone('8 701 123 45 67')).toBe('+77011234567');
		expect(normalizePhone('7011234567')).toBe('+77011234567');
		expect(normalizePhone('77011234567')).toBe('+77011234567');
	});
	test('international prefixes', () => {
		expect(normalizePhone('0044 20 7946 0958')).toBe('+442079460958');
		expect(normalizePhone('+1 (415) 555-0132')).toBe('+14155550132');
	});
	test('empty and junk', () => {
		expect(normalizePhone('   ')).toBe('');
		expect(normalizePhone('abc')).toBe('');
	});
	test('validation', () => {
		expect(isValidPhone('+77011234567')).toBe(true);
		expect(isValidPhone('77011234567')).toBe(false);
		expect(isValidPhone('+0123456789')).toBe(false);
		expect(isValidPhone('+123')).toBe(false);
	});
});
