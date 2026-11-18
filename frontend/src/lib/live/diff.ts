// Pure diff between two snapshots of the same booking list, used to decide what
// changed remotely (another admin, the public page, the API) between two polls.

export type DiffBooking = {
	id: string;
	start_at: string;
	end_at: string;
	status: string;
	notes?: string;
	attendees?: { name?: string; email?: string; phone?: string }[];
};

export type BookingChange<T extends DiffBooking> = {
	booking: T;
	/** `time` = start/end moved; `details` = notes or attendee changed. */
	kind: 'time' | 'details';
};

export type BookingDiff<T extends DiffBooking> = {
	added: T[];
	changed: BookingChange<T>[];
	/** Status flipped to cancelled. */
	cancelled: T[];
	/** Present before, gone now (cancelled-and-hidden, deleted, or moved out of the range). */
	removed: T[];
};

const who = (b: DiffBooking) => {
	const a = b.attendees?.[0];
	return [a?.name ?? '', a?.email ?? '', a?.phone ?? ''].join('|');
};

export function diffBookings<T extends DiffBooking>(prev: T[], next: T[]): BookingDiff<T> {
	const before = new Map(prev.map((b) => [b.id, b]));
	const after = new Map(next.map((b) => [b.id, b]));
	const out: BookingDiff<T> = { added: [], changed: [], cancelled: [], removed: [] };

	for (const b of next) {
		const old = before.get(b.id);
		if (!old) {
			// A cancelled row we never saw is not news.
			if (b.status !== 'cancelled') out.added.push(b);
			continue;
		}
		if (old.status !== 'cancelled' && b.status === 'cancelled') {
			out.cancelled.push(b);
		} else if (b.status === 'cancelled') {
			continue;
		} else if (old.start_at !== b.start_at || old.end_at !== b.end_at) {
			out.changed.push({ booking: b, kind: 'time' });
		} else if ((old.notes ?? '') !== (b.notes ?? '') || who(old) !== who(b)) {
			out.changed.push({ booking: b, kind: 'details' });
		}
	}
	for (const b of prev) {
		if (!after.has(b.id) && b.status !== 'cancelled') out.removed.push(b);
	}
	return out;
}

export const isEmptyDiff = (d: BookingDiff<DiffBooking>) =>
	!d.added.length && !d.changed.length && !d.cancelled.length && !d.removed.length;
