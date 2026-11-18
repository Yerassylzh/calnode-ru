<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { replaceState } from '$app/navigation';
	import { parseDate, today, type CalendarDate } from '@internationalized/date';
	import { CalendarOff, ChevronLeft, ChevronRight, Coffee, Keyboard, Plus, RefreshCw, Settings2, UserRound, WifiOff } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { api, type Booking, type DoctorBreak, type ScheduleDay, type TeamMember } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { prefs } from '$lib/prefs';
	import { startOfWeek, clockLabel } from '$lib/datetime';
	import type { Span } from '$lib/schedule/layout';
	import { createPoller } from '$lib/live/poller';
	import { connectLiveEvents } from '$lib/live/events';
	import { diffBookings, isEmptyDiff } from '$lib/live/diff';
	import { t, localeTag } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { ConfirmDialog } from '$lib/components/ui/confirm-dialog';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { buttonVariants } from '$lib/components/ui/button';
	import ScheduleForm, { type SavedResult } from './schedule/schedule-form.svelte';
	import EventSurface, { type Anchor } from './schedule/event-surface.svelte';
	import CalendarGrid, { type GridBlock, type GridColumn } from './schedule/calendar-grid.svelte';

	type Window = { start_at: string; end_at: string };
	type Editor = 'booking' | 'break' | 'details' | 'dayOff';

	let staff = $state<Pick<TeamMember, 'id' | 'name' | 'email' | 'timezone'>[]>([]);
	let staffID = $state('');
	const timezone = $derived(staff.find((member) => member.id === staffID)?.timezone || 'UTC');
	let week = $state<CalendarDate>(weekOf(today('UTC')));
	// The day shown in day view; always inside `week`, which is what gets fetched.
	let focus = $state<CalendarDate>(today('UTC'));
	let view = $state<'week' | 'day'>('week');
	let jumpOpen = $state(false);
	let helpOpen = $state(false);
	const shortcuts = [
		['\u2190  \u2192', 'schedule.shortcuts.step'], ['T', 'schedule.shortcuts.today'], ['N', 'schedule.shortcuts.new'],
		['W', 'schedule.shortcuts.week'], ['D', 'schedule.shortcuts.day'], ['Esc', 'schedule.shortcuts.close'], ['?', 'schedule.shortcuts.help']
	];
	let loaded = $state(false);
	const days = $derived(view === 'week' ? Array.from({ length: 7 }, (_, i) => week.add({ days: i })) : [focus]);
	let bookings = $state<Booking[]>([]);
	let breaks = $state<DoctorBreak[]>([]);
	let windows = $state<Window[]>([]);
	let scheduleDays = $state<ScheduleDay[]>([]);
	const daysOff = $derived(new Map(scheduleDays.filter((day) => day.is_day_off).map((day) => [day.date, day])));
	let loading = $state(true);
	let loadError = $state('');
	let availabilityError = $state('');
	let version = 0;
	let dialogOpen = $state(false);
	let editor = $state<Editor>('booking');
	let initialDate = $state('');
	let initialTime = $state('');
	let target = $state<Booking | DoctorBreak | ScheduleDay>();
	// Where the open surface is anchored (null = centred dialog), unsaved-edit and confirmation state.
	let anchor = $state<Anchor | null>(null);
	let formDirty = $state(false);
	let discardOpen = $state(false);
	let cancelOpen = $state(false);
	let removal = $state<{ kind: 'break'; item: DoctorBreak } | { kind: 'dayOff'; item: ScheduleDay } | null>(null);
	let removalOpen = $state(false);

	// Live-update state. `lastUpdated`/`liveFailed` drive the header indicator; `pulse` marks
	// blocks that just arrived or changed remotely; `remoteNotice` warns an open booking form.
	let lastUpdated = $state<Date | null>(null);
	let liveFailed = $state(false);
	let refreshing = $state(false);
	let pulse = $state<Set<string>>(new Set());
	let remoteNotice = $state<'' | 'changed' | 'cancelled' | 'removed'>('');
	let remoteFresh = $state<Booking | undefined>();
	let pollTick = 0;
	// Changes this tab just made echo back over the push stream; do not announce them as remote.
	let quietUntil = 0;
	const markOwnEdit = () => (quietUntil = Date.now() + 4000);

	const columns = $derived<GridColumn[]>(days.map((day) => {
		const free: Span[] = [];
		for (const window of windows) {
			const span = project(day, window.start_at, window.end_at, timezone);
			if (span) free.push(span);
		}
		const blocks: GridBlock[] = [];
		for (const item of bookings) {
			const span = project(day, item.start_at, item.end_at, timezone);
			if (!span) continue;
			const who = item.attendees[0];
			blocks.push({ ...span, id: item.id, label: who?.name || $t('schedule.appointment'), kind: 'booking', status: item.status, phone: who?.phone || who?.email || undefined, item });
		}
		for (const item of breaks) {
			if (item.kind === 'date' ? item.date !== day.toString() : item.day_of_week !== day.toDate('UTC').getUTCDay()) continue;
			blocks.push({ id: item.id, start: minutes(item.start_time), end: minutes(item.end_time), label: item.title, kind: 'break', item });
		}
		return { day, free, blocks, off: daysOff.get(day.toString()) };
	}));
	// A week with no hours, no bookings and no deliberate day off is "not set up", which is
	// different from "closed" and gets one explanation instead of seven "day off" labels.
	const noHours = $derived(loaded && !loadError && !availabilityError && windows.length === 0 && bookings.length === 0
		&& !scheduleDays.some((day) => day.is_day_off && day.override_id));
	const availabilityHref = $derived(base + '/availability?' + new URLSearchParams({ staff_id: staffID }));
	const rangeLabel = $derived(view === 'week'
		? labelDate(week, { month: 'short', day: 'numeric' }) + ' – ' + labelDate(week.add({ days: 6 }), { month: 'short', day: 'numeric', year: 'numeric' })
		: labelDate(focus, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

	// First day of the week containing `day`, per the user's week-start preference.
	function weekOf(day: CalendarDate) {
		return startOfWeek(day, $prefs.week_start);
	}

	function minutes(value: string) {
		const [hour, minute] = value.split(':').map(Number);
		return hour * 60 + minute;
	}

	function clock(value: number) {
		return [Math.floor(value / 60), value % 60].map((part) => String(part).padStart(2, '0')).join(':');
	}

	// Display label honouring the 12/24 h preference; `clock` above stays 24 h for form values.
	const label12 = (value: number) => clockLabel(value, $prefs, $localeTag);

	function midnight(day: CalendarDate, zone: string) {
		return day.toDate(zone);
	}

	function project(day: CalendarDate, start: string, end: string, zone: string) {
		const from = new Date(start);
		const to = new Date(end);
		const lower = midnight(day, zone);
		const upper = midnight(day.add({ days: 1 }), zone);
		if (from >= upper || to <= lower) return;
		const format = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
		const startMinute = from <= lower ? 0 : minutes(format.format(from));
		const endMinute = to >= upper ? 1440 : minutes(format.format(to));
		return { start: startMinute, end: Math.max(startMinute + 1, endMinute) };
	}

	function labelDate(day: CalendarDate, options: Intl.DateTimeFormatOptions) {
		return day.toDate('UTC').toLocaleDateString($localeTag, { ...options, timeZone: 'UTC' });
	}

	async function initialize() {
		try {
			const user = $currentUser;
			if (!user) return;
			staff = user.is_admin
				? (await api.get<TeamMember[]>('/v1/users')).filter((member) => !member.archived)
				: [user];
			// ?staff= and ?week= make a refresh, a back-navigation or a shared link land where you were.
			const params = $page.url.searchParams;
			const wanted = user.is_admin ? params.get('staff') : null;
			staffID = staff.find((member) => member.id === wanted)?.id
				?? staff.find((member) => member.id === user.id)?.id ?? staff[0]?.id ?? '';
			const now = today(timezone);
			const wantsDay = params.get('view') === 'day'
				|| (!params.get('view') && window.matchMedia('(max-width: 639px)').matches);
			if (wantsDay) {
				view = 'day';
				focus = dateFromParam(params.get('day')) ?? dateFromParam(params.get('week')) ?? now;
				week = weekOf(focus);
			} else {
				week = weekFromParam(params.get('week')) ?? weekOf(now);
				focus = weekOf(now).compare(week) === 0 ? now : week;
			}
			await load();
		} catch (error) {
			loadError = message(error);
		} finally {
			loading = false;
			loaded = true;
		}
	}

	function dateFromParam(value: string | null) {
		if (!value) return undefined;
		try {
			return parseDate(value);
		} catch {
			return undefined;
		}
	}

	function weekFromParam(value: string | null) {
		const date = dateFromParam(value);
		return date ? weekOf(date) : undefined;
	}

	// Mirror week/staff into the URL without adding history entries; defaults stay out of it.
	function syncUrl() {
		const url = new URL(location.href);
		const now = today(timezone);
		if (view === 'day') {
			url.searchParams.set('view', 'day');
			if (focus.compare(now) === 0) url.searchParams.delete('day');
			else url.searchParams.set('day', focus.toString());
			url.searchParams.delete('week');
		} else {
			url.searchParams.delete('view');
			url.searchParams.delete('day');
			if (weekOf(now).compare(week) === 0) url.searchParams.delete('week');
			else url.searchParams.set('week', week.toString());
		}
		if (staffID && staffID !== $currentUser?.id) url.searchParams.set('staff', staffID);
		else url.searchParams.delete('staff');
		replaceState(url.pathname + url.search, {});
	}

	const poller = createPoller({ run: poll });

	onMount(() => {
		void initialize().then(() => poller.start());
		// Push: refetch the moment anything changes; polling slows to a safety net while connected.
		const stopEvents = connectLiveEvents({
			onChange: () => poller.trigger(),
			onState: (connected) => poller.setInterval(connected ? 60_000 : 15_000)
		});
		return () => {
			stopEvents();
			poller.stop();
		};
	});

	// Background refresh: bookings + availability every tick (free time depends on bookings);
	// breaks only change through this UI, so they ride along every fourth tick.
	async function poll() {
		if (!staffID || loading) return;
		await load({ silent: true, notify: true, breaks: ++pollTick % 4 === 0 });
	}

	async function refreshNow() {
		if (refreshing || !staffID) return;
		refreshing = true;
		try {
			await load({ silent: true, notify: true, breaks: true });
		} catch {
			// liveFailed already reflects it
		} finally {
			refreshing = false;
		}
	}

	function message(error: unknown) {
		return error instanceof Error ? error.message : $t('schedule.loadFailed');
	}

	type LoadOptions = { silent?: boolean; notify?: boolean; breaks?: boolean };

	const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

	// `silent` keeps the grid on screen (no loading state, previous data survives a failure) and
	// throws on failure so the poller can back off. `notify` announces what changed since the
	// last snapshot - never set it for loads that follow this tab's own edits.
	async function load({ silent = false, notify = false, breaks: withBreaks = !silent }: LoadOptions = {}) {
		if (!staffID) return;
		const request = ++version;
		const id = staffID;
		const from = midnight(week, timezone).toISOString();
		const to = midnight(week.add({ days: 7 }), timezone).toISOString();
		const bookingParams = new URLSearchParams({ host: id, scope: 'all', from: from.slice(0, 10), to: to.slice(0, 10), limit: '100' });
		const scheduleParams = new URLSearchParams({ staff_id: id, from, to });
		if (!silent) {
			loading = true;
			loadError = '';
			availabilityError = '';
		}
		try {
			const [bookingItems, breakItems, free] = await Promise.allSettled([
				loadBookings(bookingParams),
				withBreaks ? api.get<{ items: DoctorBreak[] }>('/v1/doctor-breaks?' + new URLSearchParams({ user_id: id })) : Promise.resolve(undefined),
				api.get<{ windows: Window[]; days: ScheduleDay[] }>('/v1/schedule/availability?' + scheduleParams)
			]);
			if (request !== version) return;
			if (silent) {
				if (bookingItems.status === 'rejected' || free.status === 'rejected') {
					liveFailed = true;
					throw new Error('live refresh failed');
				}
				liveFailed = false;
				lastUpdated = new Date();
				const nextWindows = free.value.windows;
				const nextDays = free.value.days ?? [];
				if (notify && Date.now() >= quietUntil) announce(bookings, bookingItems.value);
				if (!sameJSON(bookings, bookingItems.value)) bookings = bookingItems.value;
				if (!sameJSON(windows, nextWindows)) windows = nextWindows;
				if (!sameJSON(scheduleDays, nextDays)) scheduleDays = nextDays;
				if (breakItems.status === 'fulfilled' && breakItems.value && !sameJSON(breaks, breakItems.value.items)) breaks = breakItems.value.items;
				return;
			}
			bookings = bookingItems.status === 'fulfilled' ? bookingItems.value : [];
			breaks = breakItems.status === 'fulfilled' && breakItems.value ? breakItems.value.items : [];
			windows = free.status === 'fulfilled' ? free.value.windows : [];
			scheduleDays = free.status === 'fulfilled' ? free.value.days ?? [] : [];
			const failed = [bookingItems, breakItems].find((result) => result.status === 'rejected');
			if (failed?.status === 'rejected') loadError = message(failed.reason);
			if (free.status === 'rejected') availabilityError = message(free.reason);
			if (bookingItems.status === 'fulfilled' && free.status === 'fulfilled') {
				liveFailed = false;
				lastUpdated = new Date();
			}
		} finally {
			if (request === version) loading = false;
		}
	}

	function whenLabel(iso: string) {
		return new Date(iso).toLocaleString($localeTag, {
			timeZone: timezone, weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
			hour12: $prefs.time_format === '12h'
		});
	}

	// Turns a snapshot diff into highlights, toasts and - if the booking open in the dialog was
	// touched - a banner, instead of silently editing stale data.
	function announce(prev: Booking[], next: Booking[]) {
		const diff = diffBookings(prev, next);
		if (isEmptyDiff(diff)) return;
		const nameOf = (item: Booking) => item.attendees[0]?.name || $t('schedule.appointment');
		const events: string[] = [
			...diff.added.map((item) => $t('schedule.live.added', { name: nameOf(item), when: whenLabel(item.start_at) })),
			...diff.changed.map(({ booking, kind }) => kind === 'time'
				? $t('schedule.live.rescheduled', { name: nameOf(booking), when: whenLabel(booking.start_at) })
				: $t('schedule.live.edited', { name: nameOf(booking) })),
			...diff.cancelled.map((item) => $t('schedule.live.cancelled', { name: nameOf(item), when: whenLabel(item.start_at) })),
			...diff.removed.map((item) => $t('schedule.live.removed', { name: nameOf(item), when: whenLabel(item.start_at) }))
		];
		if (events.length > 3) toast.info($t('schedule.live.many', { count: events.length }));
		else for (const text of events) toast.info(text);

		const ids = [...diff.added.map((item) => item.id), ...diff.changed.map((item) => item.booking.id)];
		if (ids.length) {
			pulse = new Set(ids);
			setTimeout(() => (pulse = new Set()), 4000);
		}

		if (dialogOpen && editor === 'details' && target && 'start_at' in target) {
			const openId = target.id;
			const cancelled = diff.cancelled.find((item) => item.id === openId);
			const removed = diff.removed.find((item) => item.id === openId);
			const changed = diff.changed.find((item) => item.booking.id === openId);
			if (cancelled) {
				target = cancelled; // cancelled bookings render read-only
				remoteNotice = 'cancelled';
			} else if (removed) {
				remoteNotice = 'removed';
			} else if (changed) {
				remoteFresh = changed.booking;
				remoteNotice = 'changed';
			}
		}
	}

	function loadLatest() {
		if (remoteFresh) target = remoteFresh;
		remoteFresh = undefined;
		remoteNotice = '';
	}

	async function loadBookings(params: URLSearchParams) {
		const items: Booking[] = [];
		for (;;) {
			params.set('offset', String(items.length));
			const page = await api.get<{ items: Booking[]; total: number }>('/v1/bookings?' + params);
			items.push(...page.items);
			if (items.length >= page.total || !page.items.length) return items;
		}
	}

	function goToWeek(day: CalendarDate, focusDay: CalendarDate = day) {
		week = day;
		focus = focusDay;
		syncUrl();
		void load();
	}

	function goToDay(day: CalendarDate) {
		focus = day;
		const start = weekOf(day);
		if (start.compare(week) !== 0) {
			week = start;
			syncUrl();
			void load();
		} else {
			syncUrl();
		}
	}

	function setView(next: 'week' | 'day', day?: CalendarDate) {
		if (next === 'day') {
			const now = today(timezone);
			focus = day ?? (weekOf(now).compare(week) === 0 ? now : week);
		}
		view = next;
		syncUrl();
	}

	function step(direction: 1 | -1) {
		if (view === 'week') goToWeek(week.add({ days: 7 * direction }));
		else goToDay(focus.add({ days: direction }));
	}

	function goToday() {
		const now = today(timezone);
		if (view === 'week') goToWeek(weekOf(now), now);
		else goToDay(now);
	}

	function jumpTo(date: CalendarDate | undefined) {
		if (!date) return;
		jumpOpen = false;
		if (view === 'week') goToWeek(weekOf(date), date);
		else goToDay(date);
	}

	// Keyboard: arrows move, T = today, N = new booking, D/W = day/week view. Ignored while typing
	// or while any dialog/menu is open (and for physical keys, so it works on any keyboard layout).
	function onKey(event: KeyboardEvent) {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || dialogOpen || jumpOpen || helpOpen || !staffID) return;
		const el = event.target;
		if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.closest('[role=dialog],[role=listbox],[role=menu]'))) return;
		if (event.key === '?') {
			helpOpen = true;
			event.preventDefault();
			return;
		}
		switch (event.code) {
			case 'ArrowLeft': step(-1); break;
			case 'ArrowRight': step(1); break;
			case 'KeyT': goToday(); break;
			case 'KeyN': open('booking'); break;
			case 'KeyD': setView('day'); break;
			case 'KeyW': setView('week'); break;
			default: return;
		}
		event.preventDefault();
	}

	function open(kind: Editor, date = defaultDate(), time = '09:00', item?: Booking | DoctorBreak | ScheduleDay, at: Anchor | null = null) {
		editor = kind;
		anchor = at;
		formDirty = false;
		initialDate = date;
		initialTime = time;
		target = item;
		remoteNotice = '';
		remoteFresh = undefined;
		// A popover opened inside the click that triggered it would see that same click as an
		// outside interaction and close at once, so anchored surfaces open on the next tick.
		if (at) setTimeout(() => (dialogOpen = true), 0);
		else dialogOpen = true;
	}

	function defaultDate() {
		if (view === 'day') return focus.toString();
		const current = today(timezone);
		return (weekOf(current).compare(week) === 0 ? current : week).toString();
	}

	function onSlot(day: CalendarDate, minute: number, at: Anchor) {
		open('booking', day.toString(), clock(minute), undefined, at);
	}

	function onBlock(day: CalendarDate, block: GridBlock, at: Anchor) {
		if (block.kind === 'break') {
			removal = { kind: 'break', item: block.item as DoctorBreak };
			removalOpen = true;
		} else {
			open('details', day.toString(), clock(block.start), block.item, at);
		}
	}

	function onDayOff(off: ScheduleDay) {
		removal = { kind: 'dayOff', item: off };
		removalOpen = true;
	}

	// Every way of dismissing the surface goes through here so unsaved edits are never lost silently.
	function requestClose() {
		if (formDirty) discardOpen = true;
		else dialogOpen = false;
	}

	function quietRefresh() {
		// Own edit: refresh quietly and do not announce it back as a remote change.
		void load({ silent: true, notify: false, breaks: true }).catch(() => {});
	}

	function saved(result: SavedResult) {
		dialogOpen = false;
		formDirty = false;
		const name = result.name || $t('schedule.appointment');
		const when = result.startAt ? whenLabel(result.startAt) : '';
		toast.success(
			result.kind === 'created' ? $t('schedule.toast.created', { name, when })
			: result.kind === 'rescheduled' ? $t('schedule.toast.rescheduled', { name, when })
			: result.kind === 'updated' ? $t('schedule.toast.updated', { name })
			: result.kind === 'breakAdded' ? $t('schedule.toast.breakAdded')
			: $t('schedule.toast.dayOffAdded')
		);
		quietRefresh();
	}

	async function cancelBooking() {
		const booking = target && 'start_at' in target ? target : undefined;
		if (!booking) return;
		markOwnEdit();
		try {
			await api.post('/v1/bookings/' + encodeURIComponent(booking.id) + '/cancel', {});
			dialogOpen = false;
			formDirty = false;
			toast.success($t('schedule.toast.cancelled', { name: booking.attendees[0]?.name || $t('schedule.appointment'), when: whenLabel(booking.start_at) }));
			quietRefresh();
		} catch (failure) {
			toast.error(failure instanceof Error ? failure.message : $t('common.error'));
		}
	}

	async function confirmRemoval() {
		const current = removal;
		if (!current) return;
		markOwnEdit();
		try {
			if (current.kind === 'break') {
				await api.del('/v1/doctor-breaks/' + encodeURIComponent(current.item.id));
				toast.success($t('schedule.toast.breakRemoved'));
			} else if (current.item.override_id) {
				await api.del('/v1/availability-overrides/' + encodeURIComponent(current.item.override_id));
				toast.success($t('schedule.toast.dayOffRemoved'));
			}
			quietRefresh();
		} catch (failure) {
			toast.error(failure instanceof Error ? failure.message : $t('common.error'));
		}
	}

	const surfaceTitle = $derived($t(editor === 'dayOff' ? 'schedule.addDayOff' : editor === 'break' ? 'schedule.addBreak' : editor === 'details' ? 'schedule.bookingDetails' : 'schedule.newBooking'));
	const removalText = $derived(removal?.kind === 'break'
		? { title: $t('schedule.removeBreak'), description: removal.item.title + ' · ' + removal.item.start_time + '–' + removal.item.end_time + '. ' + $t(removal.item.kind === 'weekly' ? 'schedule.removeRecurringBreakHelp' : 'schedule.removeBreakHelp') }
		: { title: $t('schedule.removeDayOff'), description: (removal?.item.date ?? '') + '. ' + $t('schedule.removeDayOffHelp') });
</script>

<svelte:head><title>{$t('schedule.title')} — Calnode</title></svelte:head>

<svelte:window onkeydown={onKey} />

<div class="mx-auto flex h-full min-h-0 max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-7 sm:py-6">
	<header class="flex shrink-0 flex-wrap items-center gap-3">
		<h1 class="mr-1 text-2xl font-semibold tracking-tight">{$t('schedule.title')}</h1>
		<div class="flex flex-wrap items-center gap-1">
			<Button variant="outline" size="sm" onclick={goToday} disabled={!staffID}>{$t('schedule.today')}</Button>
			<Button variant="ghost" size="icon" aria-label={$t(view === 'week' ? 'schedule.previous' : 'schedule.previousDay')} onclick={() => step(-1)}><ChevronLeft class="size-4" /></Button>
			<Button variant="ghost" size="icon" aria-label={$t(view === 'week' ? 'schedule.next' : 'schedule.nextDay')} onclick={() => step(1)}><ChevronRight class="size-4" /></Button>
			<Popover.Root bind:open={jumpOpen}>
				<Popover.Trigger disabled={!staffID} class={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' text-sm font-medium whitespace-nowrap'} aria-label={$t('schedule.jumpToDate') + ' · ' + rangeLabel}>
					{rangeLabel}
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0" align="start">
					<Calendar value={focus} onValueChange={(value) => jumpTo(value as CalendarDate | undefined)} locale={$localeTag} weekStartsOn={$prefs.week_start as 0 | 1 | 2 | 3 | 4 | 5 | 6} />
				</Popover.Content>
			</Popover.Root>
			<div class="ml-1 flex rounded-md border p-0.5" role="group" aria-label={$t('schedule.view')}>
				{#each ['week', 'day'] as const as option (option)}
					<Button size="sm" variant={view === option ? 'secondary' : 'ghost'} class="h-7 px-2.5" aria-pressed={view === option} disabled={!staffID} onclick={() => setView(option)}>{$t(option === 'week' ? 'schedule.view.week' : 'schedule.view.day')}</Button>
				{/each}
			</div>
		</div>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			<div class="flex items-center gap-1 text-xs text-muted-foreground">
				{#if liveFailed}
					<span role="status" class="flex items-center gap-1 text-amber-700 dark:text-amber-400"><WifiOff class="size-3.5" />{$t('schedule.live.offline')}</span>
				{:else if lastUpdated}
					<span class="hidden tabular-nums lg:inline">{$t('schedule.live.updatedAt', { time: lastUpdated.toLocaleTimeString($localeTag, { hour: '2-digit', minute: '2-digit', hour12: $prefs.time_format === '12h' }) })}</span>
				{/if}
				<Button variant="ghost" size="icon" class="size-8" onclick={() => (helpOpen = true)} aria-label={$t('schedule.shortcuts.title')} title={$t('schedule.shortcuts.title') + ' (?)'}>
					<Keyboard class="size-3.5" />
				</Button>
				<Button variant="ghost" size="icon" class="size-8" onclick={refreshNow} disabled={!staffID || refreshing}
					aria-label={$t('schedule.live.refresh')} title={$t('schedule.live.refresh')}>
					<RefreshCw class="size-3.5 {refreshing ? 'animate-spin' : ''}" />
				</Button>
			</div>
			<Select.Root type="single" value={staffID} onValueChange={(value) => { staffID = value; syncUrl(); void load(); }}>
				<Select.Trigger class="data-[size=default]:h-9 w-[180px] bg-background shadow-xs" aria-label={$t('schedule.staff')} disabled={!staff.length}>
					<span class="flex min-w-0 items-center gap-2"><UserRound class="size-4 text-muted-foreground" /><span class="truncate">{staff.find((member) => member.id === staffID)?.name || staff.find((member) => member.id === staffID)?.email || $t('common.select')}</span></span>
				</Select.Trigger>
				<Select.Content>
					{#each staff as member (member.id)}
						<Select.Item value={member.id} label={member.name || member.email}>{member.name || member.email}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button variant="ghost" size="icon" href={base + '/availability?' + new URLSearchParams({ staff_id: staffID })}
				aria-label={$t('availability.weeklyHours')} title={$t('availability.weeklyHours')}><Settings2 class="size-4" /></Button>
			<Button variant="outline" onclick={() => open('break')} disabled={!staffID || loading} aria-label={$t('schedule.addBreak')}>
				<Coffee class="size-4" /><span class="hidden xl:inline">{$t('schedule.addBreak')}</span>
			</Button>
			<Button variant="outline" onclick={() => open('dayOff')} disabled={!staffID || loading} aria-label={$t('schedule.addDayOff')} title={$t('schedule.addDayOff')}>
				<CalendarOff class="size-4" /><span class="hidden xl:inline">{$t('schedule.dayOff')}</span>
			</Button>
			<Button onclick={() => open('booking')} disabled={!staffID || loading}><Plus class="size-4" />{$t('schedule.newBooking')}</Button>
		</div>
	</header>

	<section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm" aria-label={$t('schedule.title')}>
		{#if loadError || availabilityError}
			<div class="flex flex-wrap items-center gap-3 border-b bg-muted/50 px-4 py-2 text-sm" role="alert">
				<span>{loadError || availabilityError}</span>
				<Button variant="outline" size="sm" onclick={() => (staffID ? load() : initialize())}>{$t('doctorBreaks.retry')}</Button>
			</div>
		{/if}
		{#if noHours}
			<div role="status" class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
				<span class="font-medium">{$t('schedule.noHours.title')}</span>
				<span class="text-amber-800/80 dark:text-amber-200/80">{$t('schedule.noHours.body')}</span>
				<Button variant="outline" size="sm" href={availabilityHref} class="ml-auto">{$t('schedule.noHours.cta')}</Button>
			</div>
		{/if}
		{#if !loaded && loading}
			<div role="status" aria-busy="true" class="flex min-h-0 flex-1 flex-col">
				<span class="sr-only">{$t('common.loading')}</span>
				<div class="grid h-11 grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b" aria-hidden="true">
					<div></div>
					{#each Array.from({ length: 7 }) as _, i (i)}<div class="flex items-center gap-2 border-l px-3"><Skeleton class="size-7 rounded-full" /><Skeleton class="h-3 w-8" /></div>{/each}
				</div>
				<div class="grid flex-1 grid-cols-[56px_repeat(7,minmax(0,1fr))]" aria-hidden="true">
					<div class="space-y-12 px-3 pt-8">{#each Array.from({ length: 6 }) as _, i (i)}<Skeleton class="h-2.5 w-8" />{/each}</div>
					{#each Array.from({ length: 7 }) as _, i (i)}<div class="space-y-6 border-l p-2 pt-10">{#each Array.from({ length: (i * 3) % 4 + 1 }) as _, j (j)}<Skeleton class="h-16 w-full" />{/each}</div>{/each}
				</div>
			</div>
		{:else if !staffID}
			<p class="px-4 py-6 text-sm text-muted-foreground">{$t('schedule.noStaff')}</p>
		{:else}
			<!-- Stays mounted while a new week loads (dimmed), so scroll position and context survive. -->
			<div class="flex min-h-0 flex-1 flex-col transition-opacity {loading ? 'opacity-60' : ''}" aria-busy={loading}>
				<CalendarGrid {columns} {timezone} {pulse} {noHours} single={view === 'day'} {onSlot} {onBlock} {onDayOff} onDayClick={(day) => setView('day', day)} />
			</div>
		{/if}
	</section>
</div>

<EventSurface open={dialogOpen} {anchor} title={surfaceTitle} description={staff.find((member) => member.id === staffID)?.name || timezone} onRequestClose={requestClose} locked={discardOpen || cancelOpen || removalOpen}>
	{#if dialogOpen}
		<ScheduleForm kind={editor} {staffID} {timezone} {initialDate} {initialTime} {target} staffName={staff.find((member) => member.id === staffID)?.name || ''} remoteNotice={remoteNotice} bind:dirty={formDirty} onLoadLatest={loadLatest} onCancelBooking={() => (cancelOpen = true)} onMutating={markOwnEdit} onSaved={saved} onDismiss={requestClose} />
	{/if}
</EventSurface>

<ConfirmDialog bind:open={discardOpen} title={$t('schedule.discard.title')} description={$t('schedule.discard.description')} confirmText={$t('schedule.discard.confirm')} cancelText={$t('schedule.discard.keep')} destructive onConfirm={() => { dialogOpen = false; formDirty = false; }} />
<ConfirmDialog bind:open={cancelOpen} title={$t('schedule.cancelBooking')} description={$t('schedule.cancelHelp')} confirmText={$t('schedule.cancelBooking')} destructive onConfirm={cancelBooking} />
<ConfirmDialog bind:open={removalOpen} title={removalText.title} description={removalText.description} confirmText={$t('common.delete')} destructive onConfirm={confirmRemoval} />

<Dialog.Root bind:open={helpOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{$t('schedule.shortcuts.title')}</Dialog.Title>
			<Dialog.Description>{$t('schedule.shortcuts.hint')}</Dialog.Description>
		</Dialog.Header>
		<dl class="space-y-2 text-sm">
			{#each shortcuts as [keys, label] (keys)}
				<div class="flex items-center justify-between gap-4">
					<dt class="text-muted-foreground">{$t(label)}</dt>
					<dd><kbd class="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{keys}</kbd></dd>
				</div>
			{/each}
		</dl>
	</Dialog.Content>
</Dialog.Root>
