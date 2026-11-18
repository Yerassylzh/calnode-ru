import { describe, test, expect } from 'vitest';
import { complementSpans, initialScrollMinute, mergeSpans, packColumns, snapInSpan } from './layout';

describe('mergeSpans', () => {
	test('merges overlapping and touching, drops empty', () => {
		expect(mergeSpans([{ start: 60, end: 120 }, { start: 100, end: 180 }, { start: 180, end: 200 }, { start: 300, end: 300 }]))
			.toEqual([{ start: 60, end: 200 }]);
	});
	test('keeps gaps and sorts', () => {
		expect(mergeSpans([{ start: 300, end: 400 }, { start: 0, end: 60 }])).toEqual([{ start: 0, end: 60 }, { start: 300, end: 400 }]);
	});
});

describe('complementSpans', () => {
	test('whole day when nothing is covered', () => {
		expect(complementSpans([])).toEqual([{ start: 0, end: 1440 }]);
	});
	test('gaps around covered spans', () => {
		expect(complementSpans([{ start: 540, end: 720 }, { start: 780, end: 1020 }]))
			.toEqual([{ start: 0, end: 540 }, { start: 720, end: 780 }, { start: 1020, end: 1440 }]);
	});
	test('nothing left when the day is covered', () => {
		expect(complementSpans([{ start: 0, end: 1440 }])).toEqual([]);
	});
	test('ignores spans outside the range', () => {
		expect(complementSpans([{ start: 0, end: 100 }], 200, 300)).toEqual([{ start: 200, end: 300 }]);
	});
});

describe('packColumns', () => {
	const s = (start: number, end: number) => ({ start, end });
	test('non-overlapping items use one full-width column each', () => {
		const out = packColumns([s(0, 30), s(30, 60)]);
		expect(out.map((p) => [p.col, p.cols])).toEqual([[0, 1], [0, 1]]);
	});
	test('two overlapping items sit side by side', () => {
		const out = packColumns([s(0, 60), s(30, 90)]);
		expect(out.map((p) => [p.col, p.cols])).toEqual([[0, 2], [1, 2]]);
	});
	test('a chain shares one cluster width, columns are reused', () => {
		// A 0-60, B 30-90 (overlaps A), C 60-120 (overlaps B, not A) -> C reuses A's column.
		const out = packColumns([s(0, 60), s(30, 90), s(60, 120)]);
		expect(out.map((p) => [p.col, p.cols])).toEqual([[0, 2], [1, 2], [0, 2]]);
	});
	test('a later, separate cluster is independent', () => {
		const out = packColumns([s(0, 60), s(30, 90), s(200, 230)]);
		expect(out.map((p) => p.cols)).toEqual([2, 2, 1]);
	});
	test('three-way overlap makes three columns', () => {
		expect(packColumns([s(0, 100), s(10, 90), s(20, 80)]).map((p) => p.cols)).toEqual([3, 3, 3]);
	});
});

describe('snapInSpan / initialScrollMinute', () => {
	test('snaps down to the step and clamps to the span', () => {
		expect(snapInSpan(547, { start: 540, end: 600 })).toBe(545);
		expect(snapInSpan(10, { start: 540, end: 600 })).toBe(540);
		expect(snapInSpan(9999, { start: 540, end: 600 })).toBe(599);
	});
	test('opens a little before the earliest span, or at the fallback', () => {
		expect(initialScrollMinute([{ start: 600, end: 660 }, { start: 540, end: 570 }])).toBe(510);
		expect(initialScrollMinute([])).toBe(450);
		expect(initialScrollMinute([{ start: 10, end: 20 }])).toBe(0);
	});
});
