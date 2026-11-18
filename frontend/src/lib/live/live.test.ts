import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { diffBookings, isEmptyDiff, type DiffBooking } from './diff';
import { createPoller, delayFor } from './poller';

const b = (id: string, over: Partial<DiffBooking> = {}): DiffBooking => ({
	id,
	start_at: '2026-11-19T10:00:00Z',
	end_at: '2026-11-19T10:30:00Z',
	status: 'confirmed',
	attendees: [{ name: 'Ann', phone: '+7701' }],
	...over
});

describe('diffBookings', () => {
	test('identical snapshots are empty', () => {
		expect(isEmptyDiff(diffBookings([b('1')], [b('1')]))).toBe(true);
	});
	test('detects added, time change, details change', () => {
		const d = diffBookings(
			[b('1'), b('2')],
			[b('1', { start_at: '2026-11-19T11:00:00Z' }), b('2', { notes: 'hi' }), b('3')]
		);
		expect(d.added.map((x) => x.id)).toEqual(['3']);
		expect(d.changed.map((x) => [x.booking.id, x.kind])).toEqual([
			['1', 'time'],
			['2', 'details']
		]);
	});
	test('status flip is cancelled, vanishing is removed', () => {
		const d = diffBookings([b('1'), b('2')], [b('1', { status: 'cancelled' })]);
		expect(d.cancelled.map((x) => x.id)).toEqual(['1']);
		expect(d.removed.map((x) => x.id)).toEqual(['2']);
	});
	test('an unseen cancelled row is not an arrival', () => {
		expect(isEmptyDiff(diffBookings([], [b('9', { status: 'cancelled' })]))).toBe(true);
	});
});

describe('delayFor', () => {
	test('backs off exponentially and caps', () => {
		expect(delayFor(0, 15000, 120000)).toBe(15000);
		expect(delayFor(2, 15000, 120000)).toBe(60000);
		expect(delayFor(9, 15000, 120000)).toBe(120000);
	});
});

describe('createPoller', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	test('runs on the interval, stops when stopped', async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const p = createPoller({ run, interval: 1000 });
		p.start();
		await vi.advanceTimersByTimeAsync(3100);
		expect(run).toHaveBeenCalledTimes(3);
		p.stop();
		await vi.advanceTimersByTimeAsync(5000);
		expect(run).toHaveBeenCalledTimes(3);
	});

	test('backs off after a failure and recovers', async () => {
		const run = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
		const p = createPoller({ run, interval: 1000, maxDelay: 10000 });
		p.start();
		await vi.advanceTimersByTimeAsync(1100); // fails -> next in 2000
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1500);
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(600);
		expect(run).toHaveBeenCalledTimes(2);
		expect(p.failures).toBe(0);
		p.stop();
	});

	test('trigger runs immediately and does not overlap', async () => {
		let release!: () => void;
		const run = vi.fn(() => new Promise<void>((r) => (release = r)));
		const p = createPoller({ run, interval: 1000 });
		p.start();
		p.trigger();
		p.trigger();
		expect(run).toHaveBeenCalledTimes(1);
		release();
		p.stop();
	});
});
