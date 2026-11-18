// Which start times of a given day can hold a booking of a given length, derived from the
// server's free windows (instants). Everything is expressed as wall-clock minutes in `timezone`.
import { parseAbsolute, parseDateTime, toZoned } from '@internationalized/date';

export type FreeWindow = { start_at: string; end_at: string };

export type StartChecker = {
	/** Can a booking of the configured length start at this wall-clock minute of `date`? */
	fits(minute: number): boolean;
	/** Bookable start minutes: every multiple of `step`, plus each free window's own start. */
	starts(step?: number): number[];
};

const pad = (n: number) => String(n).padStart(2, '0');

export function createStartChecker(options: {
	windows: FreeWindow[];
	date: string;
	timezone: string;
	durationMinutes: number;
}): StartChecker {
	const { windows, date, timezone, durationMinutes } = options;
	const spans = windows
		.map((window) => ({ start: Date.parse(window.start_at), end: Date.parse(window.end_at) }))
		.filter((span) => span.end > span.start);
	const valid = !!date && durationMinutes > 0 && spans.length > 0;

	function fits(minute: number): boolean {
		if (!valid || !Number.isInteger(minute) || minute < 0 || minute >= 1440) return false;
		let instant: number;
		try {
			instant = toZoned(parseDateTime(`${date}T${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`), timezone, 'reject').toDate().getTime();
		} catch {
			return false; // the wall-clock minute does not exist (DST gap) or is ambiguous
		}
		return spans.some((span) => instant >= span.start && instant + durationMinutes * 60000 <= span.end);
	}

	function starts(step = 5): number[] {
		if (!valid) return [];
		const candidates = new Set<number>();
		for (let minute = 0; minute < 1440; minute += step) candidates.add(minute);
		for (const span of spans) {
			try {
				const local = parseAbsolute(new Date(span.start).toISOString(), timezone);
				if (local.toString().slice(0, 10) === date) candidates.add(local.hour * 60 + local.minute);
			} catch {
				// unparsable window: ignore
			}
		}
		return [...candidates].sort((a, b) => a - b).filter(fits);
	}

	return { fits, starts };
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export const dayPart = (minute: number): DayPart => (minute < 12 * 60 ? 'morning' : minute < 17 * 60 ? 'afternoon' : 'evening');
