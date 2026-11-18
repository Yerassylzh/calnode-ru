// Visibility-aware polling loop for "live" admin data.
//
// - runs `run` every `interval` ms while the tab is visible and online
// - pauses while hidden/offline; refetches immediately on visibility, focus and online
// - never overlaps two runs; a failed run backs off exponentially (capped), a success resets
// Deliberately transport-agnostic: swapping polling for a push channel later only changes
// what calls `trigger()`.

export type PollerOptions = {
	run: () => Promise<void>;
	/** Base delay between runs, ms. */
	interval?: number;
	/** Upper bound for the backed-off delay, ms. */
	maxDelay?: number;
};

export function delayFor(failures: number, interval: number, maxDelay: number): number {
	return Math.min(maxDelay, interval * 2 ** Math.max(0, failures));
}

export function createPoller({ run, interval: initialInterval = 15_000, maxDelay = 120_000 }: PollerOptions) {
	let interval = initialInterval;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	let active = false;
	let failures = 0;

	const canRun = () =>
		typeof document === 'undefined' ||
		(document.visibilityState !== 'hidden' && (typeof navigator === 'undefined' || navigator.onLine !== false));

	function schedule(delay: number) {
		clearTimeout(timer);
		if (active) timer = setTimeout(tick, delay);
	}

	async function tick() {
		if (!active) return;
		if (!canRun() || running) return schedule(interval);
		running = true;
		try {
			await run();
			failures = 0;
		} catch {
			failures++;
		} finally {
			running = false;
		}
		schedule(delayFor(failures, interval, maxDelay));
	}

	/** Run as soon as possible (no-op while hidden/offline; the resume events call this). */
	function trigger() {
		if (!active) return;
		clearTimeout(timer);
		void tick();
	}

	const onResume = () => {
		if (canRun()) trigger();
	};

	function start() {
		if (active) return;
		active = true;
		document.addEventListener('visibilitychange', onResume);
		window.addEventListener('focus', onResume);
		window.addEventListener('online', onResume);
		schedule(interval);
	}

	function stop() {
		active = false;
		clearTimeout(timer);
		document.removeEventListener('visibilitychange', onResume);
		window.removeEventListener('focus', onResume);
		window.removeEventListener('online', onResume);
	}

	/** Change the base delay (e.g. slow down while a push stream is connected). Applies from the next run. */
	function setInterval(ms: number) {
		interval = ms;
	}

	return {
		start,
		stop,
		trigger,
		setInterval,
		get failures() {
			return failures;
		}
	};
}
