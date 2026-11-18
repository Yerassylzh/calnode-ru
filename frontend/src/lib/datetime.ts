// Shared date/time helpers that honour the signed-in user's preferences
// (time_format, week_start). Pure functions: callers pass prefs and the Intl tag
// so they are trivially testable and reactive when used inside $derived.
import type { CalendarDate } from '@internationalized/date';
import type { UserPrefs } from './prefs';

type ClockPrefs = Pick<UserPrefs, 'time_format'>;

/** Monday-first by default; `weekStart` uses the prefs numbering (0 = Sunday … 6 = Saturday). */
export function startOfWeek(day: CalendarDate, weekStart: number): CalendarDate {
	const dow = day.toDate('UTC').getUTCDay();
	return day.subtract({ days: (dow - weekStart + 7) % 7 });
}

/** Minutes since midnight → 'HH:MM' (24 h) or a locale 12 h label, per the user's preference. */
export function clockLabel(minutes: number, prefs: ClockPrefs, tag: string): string {
	const m = Math.max(0, Math.min(1440, Math.round(minutes)));
	if (prefs.time_format !== '12h') {
		const h = Math.floor(m / 60) % 24;
		return String(h).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
	}
	return new Date(Date.UTC(2000, 0, 1, 0, m)).toLocaleTimeString(tag, {
		timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true
	});
}

/** Compact label for a time-grid gutter: '09:00' in 24 h, '9 AM' in 12 h. */
export function hourLabel(minutes: number, prefs: ClockPrefs, tag: string): string {
	if (prefs.time_format !== '12h') return clockLabel(minutes, prefs, tag);
	const m = Math.max(0, Math.min(1440, Math.round(minutes)));
	return new Date(Date.UTC(2000, 0, 1, 0, m)).toLocaleTimeString(tag, {
		timeZone: 'UTC', hour: 'numeric', hour12: true
	});
}
