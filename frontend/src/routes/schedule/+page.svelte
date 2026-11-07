<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { getDayOfWeek, today, type CalendarDate } from '@internationalized/date';
	import { ChevronLeft, ChevronRight, Coffee, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { api, type Booking, type DoctorBreak, type TeamMember } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { t, localeTag } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import ScheduleForm from './schedule-form.svelte';

	type Window = { start_at: string; end_at: string };
	type Block = { id: string; start: number; end: number; label: string; kind: 'free' | 'booking' | 'break'; item?: Booking | DoctorBreak };
	type Editor = 'booking' | 'break' | 'reschedule' | 'removeBreak';
	const hourHeight = 56;
	const selectStyle = 'h-9 rounded-md border border-input bg-background px-3 text-sm';
	let staff = $state<Pick<TeamMember, 'id' | 'name' | 'email' | 'timezone'>[]>([]);
	let staffID = $state('');
	const timezone = $derived(staff.find((member) => member.id === staffID)?.timezone || 'UTC');
	let week = $state<CalendarDate>(monday(today('UTC')));
	const days = $derived(Array.from({ length: 7 }, (_, i) => week.add({ days: i })));
	let bookings = $state<Booking[]>([]);
	let breaks = $state<DoctorBreak[]>([]);
	let windows = $state<Window[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let availabilityError = $state('');
	let version = 0;
	let dialogOpen = $state(false);
	let editor = $state<Editor>('booking');
	let initialDate = $state('');
	let initialTime = $state('');
	let target = $state<Booking | DoctorBreak>();

	const blocks = $derived(days.map((day) => {
		const items: Block[] = [];
		for (const window of windows) {
			const span = project(day, window.start_at, window.end_at, timezone);
			if (span) items.push({ ...span, id: window.start_at, label: $t('schedule.free'), kind: 'free' });
		}
		for (const item of bookings) {
			const span = project(day, item.start_at, item.end_at, timezone);
			if (span) items.push({ ...span, id: item.id, label: item.attendees[0]?.name || item.event_type_slug, kind: 'booking', item });
		}
		for (const item of breaks) {
			if (item.kind === 'date' ? item.date !== day.toString() : item.day_of_week !== day.toDate('UTC').getUTCDay()) continue;
			items.push({ id: item.id, start: minutes(item.start_time), end: minutes(item.end_time), label: item.title, kind: 'break', item });
		}
		return items;
	}));
	const firstHour = $derived(Math.min(8, ...blocks.flat().map((item) => Math.floor(item.start / 60))));
	const lastHour = $derived(Math.max(18, ...blocks.flat().map((item) => Math.ceil(item.end / 60))));
	const hours = $derived(Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i));

	function monday(day: CalendarDate) {
		return day.subtract({ days: getDayOfWeek(day, 'en-GB') });
	}

	function minutes(value: string) {
		const [hour, minute] = value.split(':').map(Number);
		return hour * 60 + minute;
	}

	function clock(value: number) {
		return [Math.floor(value / 60), value % 60].map((part) => String(part).padStart(2, '0')).join(':');
	}

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
			staffID = staff.find((member) => member.id === user.id)?.id ?? staff[0]?.id ?? '';
			week = monday(today(timezone));
			await load();
		} catch (error) {
			loadError = message(error);
		} finally {
			loading = false;
		}
	}

	onMount(() => { void initialize(); });

	function message(error: unknown) {
		return error instanceof Error ? error.message : $t('schedule.loadFailed');
	}

	async function load() {
		if (!staffID) return;
		const request = ++version;
		const id = staffID;
		const from = midnight(week, timezone).toISOString();
		const to = midnight(week.add({ days: 7 }), timezone).toISOString();
		const bookingParams = new URLSearchParams({ host: id, scope: 'all', from: from.slice(0, 10), to: to.slice(0, 10), limit: '100' });
		const scheduleParams = new URLSearchParams({ staff_id: id, from, to });
		loading = true;
		loadError = '';
		availabilityError = '';
		try {
			const [bookingItems, breakItems, free] = await Promise.allSettled([
				loadBookings(bookingParams),
				api.get<{ items: DoctorBreak[] }>('/v1/doctor-breaks?' + new URLSearchParams({ user_id: id })),
				api.get<{ windows: Window[] }>('/v1/schedule/availability?' + scheduleParams)
			]);
			if (request !== version) return;
			bookings = bookingItems.status === 'fulfilled' ? bookingItems.value : [];
			breaks = breakItems.status === 'fulfilled' ? breakItems.value.items : [];
			windows = free.status === 'fulfilled' ? free.value.windows : [];
			const failed = [bookingItems, breakItems].find((result) => result.status === 'rejected');
			if (failed?.status === 'rejected') loadError = message(failed.reason);
			if (free.status === 'rejected') availabilityError = message(free.reason);
		} finally {
			if (request === version) loading = false;
		}
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

	function goToWeek(day: CalendarDate) {
		week = day;
		void load();
	}

	function open(kind: Editor, date = defaultDate(), time = '09:00', item?: Booking | DoctorBreak) {
		editor = kind;
		initialDate = date;
		initialTime = time;
		target = item;
		dialogOpen = true;
	}

	function defaultDate() {
		const current = today(timezone);
		return (monday(current).compare(week) === 0 ? current : week).toString();
	}

	function onBlock(day: CalendarDate, block: Block, event: MouseEvent) {
		if (block.kind === 'free') {
			const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
			const clicked = event.detail ? block.start + (event.clientY - rect.top) / hourHeight * 60 : block.start;
			const start = Math.min(block.end - 1, Math.max(block.start, Math.floor(clicked / 5) * 5));
			open('booking', day.toString(), clock(start));
		} else {
			open(block.kind === 'break' ? 'removeBreak' : 'reschedule', day.toString(), clock(block.start), block.item);
		}
	}

	function saved() {
		dialogOpen = false;
		toast.success($t('schedule.saved'));
		void load();
	}
</script>

<svelte:head><title>{$t('schedule.title')} — Calnode</title></svelte:head>

<div class="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-7 sm:py-7">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<h1 class="text-3xl font-semibold tracking-tight">{$t('schedule.title')}</h1>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={() => open('break')} disabled={!staffID || loading}><Coffee class="size-4" />{$t('schedule.addBreak')}</Button>
			<Button onclick={() => open('booking')} disabled={!staffID || loading}><Plus class="size-4" />{$t('schedule.newBooking')}</Button>
		</div>
	</header>

	<section class="overflow-hidden rounded-xl border bg-card shadow-sm" aria-label={$t('schedule.title')}>
		<div class="flex flex-wrap items-center justify-between gap-3 border-b p-3 sm:p-4">
			<div class="flex flex-wrap items-center gap-2">
				<Button variant="outline" size="icon" aria-label={$t('schedule.previous')} onclick={() => goToWeek(week.subtract({ days: 7 }))}><ChevronLeft /></Button>
				<Button variant="outline" size="icon" aria-label={$t('schedule.next')} onclick={() => goToWeek(week.add({ days: 7 }))}><ChevronRight /></Button>
				<Button variant="outline" onclick={() => goToWeek(monday(today(timezone)))}>{$t('schedule.today')}</Button>
				<h2 class="ml-1 text-sm font-semibold sm:text-base">
					{labelDate(week, { month: 'short', day: 'numeric' })} – {labelDate(week.add({ days: 6 }), { month: 'short', day: 'numeric', year: 'numeric' })}
				</h2>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<label for="schedule-staff" class="text-sm font-medium">{$t('schedule.staff')}</label>
				<select id="schedule-staff" class={selectStyle} bind:value={staffID} onchange={load} disabled={!staff.length}>
					{#each staff as member (member.id)}
						<option value={member.id}>{member.name || member.email}</option>
					{/each}
				</select>
				<span class="text-xs text-muted-foreground">{timezone}</span>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-4 border-b px-4 py-2.5 text-xs text-muted-foreground">
			<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-emerald-500"></span>{$t('schedule.free')}</span>
			<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-blue-500"></span>{$t('layout.nav.bookings')}</span>
			<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-amber-500"></span>{$t('schedule.breaks')}</span>
			<a href={base + '/availability?' + new URLSearchParams({ staff_id: staffID })} class="ml-auto hover:underline">{$t('availability.weeklyHours')}</a>
		</div>
		{#if loadError || availabilityError}
			<div class="flex flex-wrap items-center gap-3 border-b bg-muted/50 px-4 py-2 text-sm" role="alert">
				<span>{loadError || availabilityError}</span>
				<Button variant="outline" size="sm" onclick={staffID ? load : initialize}>{$t('doctorBreaks.retry')}</Button>
			</div>
		{/if}
		{#if loading}
			<p class="px-4 py-3 text-sm text-muted-foreground" role="status">{$t('common.loading')}</p>
		{:else if !staffID}
			<p class="px-4 py-6 text-sm text-muted-foreground">{$t('schedule.noStaff')}</p>
		{:else}
			<div class="overflow-x-auto">
				<div class="grid min-w-[850px] grid-cols-[52px_repeat(7,minmax(0,1fr))]">
					<div class="border-b bg-muted/20"></div>
					{#each days as day (day.toString())}
						{@const isToday = day.toString() === today(timezone).toString()}
						<div class="flex items-center gap-2 border-b border-l px-3 py-2.5 {isToday ? 'bg-primary/5' : 'bg-muted/20'}">
							<span class="grid size-7 place-items-center rounded-full text-sm font-semibold {isToday ? 'bg-primary text-primary-foreground' : ''}">{day.day}</span>
							<span class="text-xs font-medium text-muted-foreground">{labelDate(day, { weekday: 'short' })}</span>
						</div>
					{/each}
					<div class="bg-muted/20">
						{#each hours as hour (hour)}
							<div class="border-b px-1 text-center text-[10px] tabular-nums text-muted-foreground" style:height={hourHeight + 'px'}>{clock(hour * 60)}</div>
						{/each}
					</div>
					{#each days as day, i (day.toString())}
						<div class="relative border-l bg-muted/25" style:height={hours.length * hourHeight + 'px'}>
							{#each hours as hour (hour)}
								<div class="border-b border-border/80" style:height={hourHeight + 'px'}></div>
							{/each}
							{#each blocks[i] as block (block.kind + block.id)}
								<button type="button" onclick={(event) => onBlock(day, block, event)}
									class="absolute inset-x-1 overflow-hidden rounded-md border-l-2 px-1.5 text-left text-xs leading-tight transition hover:brightness-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-primary
										{block.kind === 'free' ? 'border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' : block.kind === 'booking' ? 'z-10 border-blue-500 bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100' : 'z-10 border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}"
									style:top={(block.start / 60 - firstHour) * hourHeight + 'px'}
									style:height={Math.max(9, (block.end - block.start) / 60 * hourHeight - 1) + 'px'}
									title={block.label + ' · ' + clock(block.start) + '–' + clock(block.end)}
									aria-label={block.label + ' · ' + clock(block.start) + '–' + clock(block.end)}>
									<span class="block truncate font-semibold">{block.label}</span>
									<span class="block truncate tabular-nums opacity-75">{clock(block.start)}–{clock(block.end)}</span>
								</button>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t(editor === 'break' ? 'schedule.addBreak' : editor === 'reschedule' ? 'schedule.reschedule' : editor === 'removeBreak' ? 'schedule.removeBreak' : 'schedule.newBooking')}</Dialog.Title>
			<Dialog.Description>{staff.find((member) => member.id === staffID)?.name || timezone}</Dialog.Description>
		</Dialog.Header>
		{#if dialogOpen}
			<ScheduleForm kind={editor} {staffID} {timezone} {initialDate} {initialTime} {target} onSaved={saved}
				onSwitchToBreak={(date, start) => open('break', date, start)} />
		{/if}
	</Dialog.Content>
</Dialog.Root>
