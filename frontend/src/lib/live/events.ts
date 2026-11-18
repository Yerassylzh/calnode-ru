// Push channel for live admin data: a Server-Sent Events stream (GET /v1/events) that says
// "bookings changed". It carries no data - callers refetch through their normal API calls - so
// it composes with the poller: while the stream is up polling slows to a safety net, and if the
// stream is unavailable (old server, proxy, 401) polling simply keeps its normal pace.

export type LiveEventsOptions = {
	/** A change happened (coalesced): refetch now. */
	onChange: () => void;
	/** The stream connected (true) or dropped/failed (false). */
	onState?: (connected: boolean) => void;
	/** Merge bursts of events into one callback. */
	debounceMs?: number;
	url?: string;
};

/** Opens the stream and returns a function that closes it. A no-op where EventSource is missing. */
export function connectLiveEvents({ onChange, onState, debounceMs = 250, url = '/v1/events' }: LiveEventsOptions): () => void {
	if (typeof EventSource === 'undefined') return () => {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	const source = new EventSource(url);
	source.addEventListener('open', () => onState?.(true));
	// EventSource reconnects on its own after a drop; a permanent failure (e.g. 401) leaves it
	// CLOSED, and either way the poller carries on at its normal pace.
	source.addEventListener('error', () => onState?.(false));
	source.addEventListener('bookings', () => {
		clearTimeout(timer);
		timer = setTimeout(onChange, debounceMs);
	});
	return () => {
		clearTimeout(timer);
		source.close();
		onState?.(false);
	};
}
