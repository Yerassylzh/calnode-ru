import { describe, test, expect } from 'vitest';
import { CalendarDate } from '@internationalized/date';
import { startOfWeek, clockLabel, hourLabel } from './datetime';

describe('startOfWeek', () => {
	const wed = new CalendarDate(2026, 11, 18); // Wednesday
	test('Monday-first', () => expect(startOfWeek(wed, 1).toString()).toBe('2026-11-16'));
	test('Sunday-first', () => expect(startOfWeek(wed, 0).toString()).toBe('2026-11-15'));
	test('a day that already starts the week is unchanged', () =>
		expect(startOfWeek(new CalendarDate(2026, 11, 16), 1).toString()).toBe('2026-11-16'));
	test('Saturday-first across a month boundary', () =>
		expect(startOfWeek(new CalendarDate(2026, 12, 1), 6).toString()).toBe('2026-11-28'));
});

describe('clock labels', () => {
	test('24 h is zero-padded', () => {
		expect(clockLabel(9 * 60 + 5, { time_format: '24h' }, 'en')).toBe('09:05');
		expect(clockLabel(1440, { time_format: '24h' }, 'en')).toBe('00:00');
		expect(hourLabel(14 * 60, { time_format: '24h' }, 'en')).toBe('14:00');
	});
	test('12 h shows a day-period marker', () => {
		expect(clockLabel(13 * 60 + 30, { time_format: '12h' }, 'en')).toMatch(/^1:30\s?PM$/i);
		expect(hourLabel(9 * 60, { time_format: '12h' }, 'en')).toMatch(/^9\s?AM$/i);
	});
});
