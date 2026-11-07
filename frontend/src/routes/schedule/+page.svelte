<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { getDayOfWeek, today, type CalendarDate } from '@internationalized/date';
	import { ChevronLeft, ChevronRight, Coffee, Plus, Settings2, UserRound } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { api, type Booking, type DoctorBreak, type TeamMember } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { t, localeTag } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import ScheduleForm from './schedule-form.svelte';

	type Window = { start_at: string; end_at: string };
	type Block = { id: string; start: number; end: number; label: string; kind: 'free' | 'booking' | 'break'; item?: Booking | DoctorBreak };
	type Editor = 'booking' | 'break' | 'details' | 'removeBreak';

	let staff = $state<Pick<TeamMember, 'id' | 'name' | 'email' | 'timezone'>[]>([]);
	let staffID = $state('');
	const timezone = $derived(staff.find((member) => member.id === staffID)?.timezone || 'UTC');
	let week = $state<CalendarDate>(monday(today('UTC')));
	const days = $derived(Array.from({ length: 7 }, (_, i) => week.add({ days: i })));
	let bookings = $state<Booking[]>([]);
	let breaks = $state<DoctorBreak[]>([]);
	let windows = $state<Window[]>([]);
	let loading = $state(true);
	let calendarHeight = $state(0);
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
			if (span) items.push({ ...span, id: item.id, label: item.attendees[0]?.name || $t('schedule.appointment'), kind: 'booking', item });
		}
		for (const item of breaks) {
			if (item.kind === 'date' ? item.date !== day.toString() : item.day_of_week !== day.toDate('UTC').getUTCDay()) continue;
			items.push({ id: item.id, start: minutes(item.start_time), end: minutes(item.end_time), label: item.title, kind: 'break', item });
		}
		return items;
	}));
	const allBlocks = $derived(blocks.flat());
	const firstHour = $derived(allBlocks.length ? Math.min(...allBlocks.map((item) => Math.floor(item.start / 60))) : 8);
	const lastHour = $derived(allBlocks.length ? Math.max(...allBlocks.map((item) => Math.ceil(item.end / 60))) : 18);
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
			const clicked = event.detail ? block.start + (event.clientY - rect.top) / rect.height * (block.end - block.start) : block.start;
			const start = Math.min(block.end - 1, Math.max(block.start, Math.floor(clicked / 5) * 5));
			open('booking', day.toString(), clock(start));
		} else {
			open(block.kind === 'break' ? 'removeBreak' : 'details', day.toString(), clock(block.start), block.item);
		}
	}

	function saved() {
		dialogOpen = false;
		toast.success($t('schedule.saved'));
		void load();
	}
</script>

<svelte:head><title>{$t('schedule.title')} — Calnode</title></svelte:head>

<div class="mx-auto flex h-full min-h-0 max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-7 sm:py-6">
	<header class="flex shrink-0 flex-wrap items-center gap-3">
		<h1 class="mr-1 text-2xl font-semibold tracking-tight">{$t('schedule.title')}</h1>
		<div class="flex items-center gap-1">
			<Button variant="ghost" size="icon" aria-label={$t('schedule.previous')} onclick={() => goToWeek(week.subtract({ days: 7 }))}><ChevronLeft class="size-4" /></Button>
			<Button variant="ghost" size="icon" aria-label={$t('schedule.next')} onclick={() => goToWeek(week.add({ days: 7 }))}><ChevronRight class="size-4" /></Button>
			<h2 class="ml-1 text-sm font-medium whitespace-nowrap">
				{labelDate(week, { month: 'short', day: 'numeric' })} – {labelDate(week.add({ days: 6 }), { month: 'short', day: 'numeric', year: 'numeric' })}
			</h2>
		</div>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			<Select.Root type="single" value={staffID} onValueChange={(value) => { staffID = value; void load(); }}>
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
			<Button onclick={() => open('booking')} disabled={!staffID || loading}><Plus class="size-4" />{$t('schedule.newBooking')}</Button>
		</div>
	</header>

	<section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm" aria-label={$t('schedule.title')}>
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
			<div class="min-h-0 flex-1 overflow-x-auto">
				<div bind:clientHeight={calendarHeight} class="grid h-full min-w-[760px] grid-cols-[48px_repeat(7,minmax(0,1fr))] grid-rows-[44px_minmax(0,1fr)]">
					<div class="border-b bg-muted/20"></div>
					{#each days as day (day.toString())}
						{@const isToday = day.toString() === today(timezone).toString()}
						<div class="flex items-center gap-2 border-b border-l px-3 py-2.5 {isToday ? 'bg-primary/5' : 'bg-muted/20'}">
							<span class="grid size-7 place-items-center rounded-full text-sm font-semibold {isToday ? 'bg-primary text-primary-foreground' : ''}">{day.day}</span>
							<span class="text-xs font-medium text-muted-foreground">{labelDate(day, { weekday: 'short' })}</span>
						</div>
					{/each}
					<div class="relative min-h-0 bg-muted/20">
						{#each hours as hour (hour)}
							<div class="border-b px-1 text-center text-[10px] tabular-nums text-muted-foreground" style:height={100 / hours.length + '%'}>{clock(hour * 60)}</div>
						{/each}
						<span class="absolute inset-x-0 bottom-0 text-center text-[10px] tabular-nums text-muted-foreground">{clock(lastHour * 60)}</span>
					</div>
					{#each days as day, i (day.toString())}
						<div class="relative min-h-0 border-l bg-muted/25">
							{#each hours as hour (hour)}
								<div class="border-b border-border/80" style:height={100 / hours.length + '%'}></div>
							{/each}
							{#each blocks[i] as block (block.kind + block.id)}
								<button type="button" onclick={(event) => onBlock(day, block, event)}
									class="absolute inset-x-1 flex flex-col items-start justify-start overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left text-xs leading-tight transition hover:brightness-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-primary
										{block.kind === 'free' ? 'border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' : block.kind === 'booking' ? 'z-10 border-blue-500 bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100' : 'z-10 border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}"
									style:top={(block.start / 60 - firstHour) / hours.length * 100 + '%'}
									style:height={'calc(' + (block.end - block.start) / 60 / hours.length * 100 + '% - 1px)'}
									title={block.label + ' · ' + clock(block.start) + '–' + clock(block.end)}
									aria-label={block.label + ' · ' + clock(block.start) + '–' + clock(block.end)}>
									<span class="block w-full truncate font-medium">{block.label}</span>
									{#if (block.end - block.start) / 60 / hours.length * (calendarHeight - 44) >= 36}
										<span class="block w-full truncate text-[11px] tabular-nums opacity-75">{clock(block.start)}–{clock(block.end)}</span>
									{/if}
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
	<Dialog.Content class="max-h-[90dvh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-[640px]">
		<Dialog.Header class="border-b px-6 py-5 pr-12">
			<Dialog.Title>{$t(editor === 'break' ? 'schedule.addBreak' : editor === 'details' ? 'schedule.bookingDetails' : editor === 'removeBreak' ? 'schedule.removeBreak' : 'schedule.newBooking')}</Dialog.Title>
			<Dialog.Description class={editor === 'details' ? 'sr-only' : ''}>{staff.find((member) => member.id === staffID)?.name || timezone}</Dialog.Description>
		</Dialog.Header>
		{#if dialogOpen}
			<ScheduleForm kind={editor} {staffID} {timezone} {initialDate} {initialTime} {target} staffName={staff.find((member) => member.id === staffID)?.name || ''} onSaved={saved} onDismiss={() => dialogOpen = false} />
		{/if}
	</Dialog.Content>
</Dialog.Root>
