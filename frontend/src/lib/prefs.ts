import { writable, get } from 'svelte/store';
import { localeTag } from '$lib/i18n';
import type { User } from './api';

export interface UserPrefs {
	timezone: string;
	time_format: '12h' | '24h';
	week_start: number;
	date_format: 'dmy' | 'mdy' | 'ymd';
}

const defaults: UserPrefs = {
	timezone: 'UTC',
	time_format: '12h',
	week_start: 1,
	date_format: 'dmy'
};

export const prefs = writable<UserPrefs>(defaults);

export function prefsFromUser(u: User): UserPrefs {
	return {
		timezone: u.timezone,
		time_format: u.time_format ?? '12h',
		week_start: u.week_start ?? 1,
		date_format: u.date_format ?? 'dmy'
	};
}

function fmtDatePart(date: Date, format: 'dmy' | 'mdy' | 'ymd'): string {
	const d = String(date.getDate()).padStart(2, '0');
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const y = date.getFullYear();
	if (format === 'mdy') return `${m}/${d}/${y}`;
	if (format === 'ymd') return `${y}-${m}-${d}`;
	return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso: string, p: UserPrefs = get(prefs)): string {
	const date = new Date(iso);
	const datePart = fmtDatePart(date, p.date_format);
	const timePart = date.toLocaleTimeString(get(localeTag), {
		hour: '2-digit',
		minute: '2-digit',
		hour12: p.time_format === '12h'
	});
	return `${datePart}, ${timePart}`;
}

export function fmtDate(ymd: string, p: UserPrefs = get(prefs)): string {
	// ymd is always YYYY-MM-DD from the API — parse directly to avoid TZ shift from new Date()
	const [y, m, d] = ymd.split('-');
	if (p.date_format === 'mdy') return `${m}/${d}/${y}`;
	if (p.date_format === 'ymd') return `${y}-${m}-${d}`;
	return `${d}/${m}/${y}`;
}

export function fmtTime(iso: string, p: UserPrefs = get(prefs)): string {
	return new Date(iso).toLocaleTimeString(get(localeTag), {
		hour: '2-digit',
		minute: '2-digit',
		hour12: p.time_format === '12h'
	});
}

export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Full weekday names in the selected UI locale (CLDR order, Monday-first not
// assumed — index 0 is always Sunday to match UserPrefs.week_start numbering).
export function weekDayNames(): string[] {
	const tag = get(localeTag);
	// 2024-01-07 was a Sunday; formatting consecutive days gives Sun..Sat.
	const names = new Intl.DateTimeFormat(tag, { weekday: 'long', timeZone: 'UTC' });
	return Array.from({ length: 7 }, (_, i) => names.format(new Date(Date.UTC(2024, 0, 7 + i))));
}

export const TIMEZONES = [
	'Pacific/Auckland',
	'Australia/Sydney',
	'Australia/Melbourne',
	'Asia/Tokyo',
	'Asia/Singapore',
	'Asia/Dubai',
	'Europe/London',
	'Europe/Paris',
	'Europe/Berlin',
	'Europe/Amsterdam',
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'UTC'
];
