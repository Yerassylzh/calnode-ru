// Pure geometry helpers for the calendar grid. Everything is in minutes since local midnight
// (0..1440); the grid turns minutes into pixels, so none of this knows about the DOM.

export type Span = { start: number; end: number };

/** Sorts and merges overlapping or touching spans. */
export function mergeSpans(spans: Span[]): Span[] {
	const sorted = spans
		.filter((span) => span.end > span.start)
		.map((span) => ({ start: span.start, end: span.end }))
		.sort((a, b) => a.start - b.start || a.end - b.end);
	const out: Span[] = [];
	for (const span of sorted) {
		const last = out[out.length - 1];
		if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
		else out.push(span);
	}
	return out;
}

/** The parts of [from, to) not covered by `covered` (which need not be merged). */
export function complementSpans(covered: Span[], from = 0, to = 1440): Span[] {
	const out: Span[] = [];
	let cursor = from;
	for (const span of mergeSpans(covered)) {
		if (span.end <= cursor) continue;
		if (span.start >= to) break;
		if (span.start > cursor) out.push({ start: cursor, end: Math.min(span.start, to) });
		cursor = Math.max(cursor, span.end);
		if (cursor >= to) break;
	}
	if (cursor < to) out.push({ start: cursor, end: to });
	return out;
}

export type Placed<T extends Span> = { item: T; col: number; cols: number };

/**
 * Side-by-side layout for overlapping items. Items that overlap (directly or through a chain)
 * share a cluster; within a cluster each item takes the first free column, and every item in the
 * cluster is as narrow as the cluster is wide.
 */
export function packColumns<T extends Span>(items: T[]): Placed<T>[] {
	const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
	const placed: Placed<T>[] = [];
	let cluster: Placed<T>[] = [];
	let clusterEnd = -Infinity;
	let columnEnds: number[] = [];

	const flush = () => {
		for (const entry of cluster) entry.cols = columnEnds.length;
		placed.push(...cluster);
		cluster = [];
		columnEnds = [];
		clusterEnd = -Infinity;
	};

	for (const item of sorted) {
		if (cluster.length && item.start >= clusterEnd) flush();
		let col = columnEnds.findIndex((end) => end <= item.start);
		if (col === -1) col = columnEnds.length;
		columnEnds[col] = item.end;
		clusterEnd = Math.max(clusterEnd, item.end);
		cluster.push({ item, col, cols: 1 });
	}
	flush();
	return placed;
}

/** Floors `raw` to `step` and keeps it inside the span (the last bookable minute is end - 1). */
export function snapInSpan(raw: number, span: Span, step = 5): number {
	return Math.min(span.end - 1, Math.max(span.start, Math.floor(raw / step) * step));
}

/** Where the grid should open: shortly before the earliest thing on the page. */
export function initialScrollMinute(spans: Span[], fallback = 8 * 60, lead = 30): number {
	if (!spans.length) return Math.max(0, fallback - lead);
	return Math.max(0, Math.min(...spans.map((span) => span.start)) - lead);
}
