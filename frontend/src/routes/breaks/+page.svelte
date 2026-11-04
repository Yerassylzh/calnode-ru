<script lang="ts">
	import { onMount } from 'svelte';
	import { CalendarDays, ChevronDown, Clock, Plus, Repeat, UserRound } from '@lucide/svelte';
	import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date';
	import { toast } from 'svelte-sonner';
	import { api, type AvailabilityRule, type DoctorBreak, type TeamMember } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { t, localeTag } from '$lib/i18n';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Input } from '$lib/components/ui/input';
	import { ConfirmDialog } from '$lib/components/ui/confirm-dialog';
	import * as Popover from '$lib/components/ui/popover';
	import BreakTimePicker from './break-time-picker.svelte';

	let doctors = $state<Pick<TeamMember, 'id' | 'name' | 'email' | 'timezone'>[]>([]);
	let selectedDoctorId = $state('');
	let doctorsLoading = $state(true);
	let doctorsFailed = $state(false);
	let breaks = $state<DoctorBreak[]>([]);
	let breaksLoading = $state(false);
	let breaksFailed = $state(false);
	let needsHours = $state(false);
	let loadVersion = 0;

	let selectedDate = $state('');
	let dateOpen = $state(false);
	let startTime = $state('13:00');
	let endTime = $state('14:00');
	let breakTitle = $state('');
	let formError = $state('');
	let saving = $state(false);
	let settingHours = $state(false);
	let deleting = $state(false);
	let deleteOpen = $state(false);
	let deleteTarget = $state<DoctorBreak | null>(null);

	const busy = $derived(saving || settingHours || deleting || deleteOpen);
	const selectedDoctor = $derived(doctors.find((doctor) => doctor.id === selectedDoctorId));
	const timezone = $derived(selectedDoctor?.timezone || getLocalTimeZone());
	const earliestDate = $derived(today(timezone));
	const todayIso = $derived(earliestDate.toString());
	const scheduledDays = $derived.by(() => {
		const days = new Map<string, DoctorBreak[]>();
		const dated = breaks.filter((item) => item.kind === 'date' && item.date);
		dated.sort((a, b) =>
			a.date!.localeCompare(b.date!) || a.start_time.localeCompare(b.start_time)
		);
		for (const item of dated) {
			const date = item.date!;
			const items = days.get(date) ?? [];
			items.push(item);
			days.set(date, items);
		}
		return [...days];
	});
	const upcoming = $derived(scheduledDays.filter(([date]) => date >= todayIso));
	const past = $derived(scheduledDays.filter(([date]) => date < todayIso).reverse());
	const recurring = $derived(breaks.filter((item) => item.kind === 'weekly'));

	function formatDate(date: string) {
		return parseDate(date).toDate('UTC').toLocaleDateString($localeTag, {
			weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
		});
	}

	function pickDate(date: DateValue | undefined) {
		if (!date) return;
		selectedDate = date.toString();
		dateOpen = false;
	}

	onMount(() => { void loadDoctors(); });

	async function loadDoctors() {
		doctorsLoading = true;
		doctorsFailed = false;
		try {
			const user = $currentUser;
			if (user?.is_admin) {
				doctors = await api.get<TeamMember[]>('/v1/users') ?? [];
			} else if (user) {
				doctors = [user];
			}
			if (doctors.length) void selectDoctor(doctors[0].id);
		} catch {
			doctorsFailed = true;
		} finally {
			doctorsLoading = false;
		}
	}

	async function selectDoctor(id: string) {
		selectedDoctorId = id;
		selectedDate = todayIso;
		startTime = '13:00';
		endTime = '14:00';
		breakTitle = '';
		formError = '';
		breaks = [];
		needsHours = false;
		await loadSchedule();
	}

	async function loadSchedule() {
		const id = encodeURIComponent(selectedDoctorId);
		const version = ++loadVersion;
		breaksLoading = true;
		breaksFailed = false;
		await Promise.all([
			api.get<{ items: DoctorBreak[] }>(`/v1/doctor-breaks?user_id=${id}`)
				.then((result) => {
					if (version === loadVersion) breaks = result.items ?? [];
				})
				.catch(() => {
					if (version === loadVersion) breaksFailed = true;
				})
				.finally(() => {
					if (version === loadVersion) breaksLoading = false;
				}),
			api.get<{ items: AvailabilityRule[] }>(`/v1/availability-rules?user_id=${id}`)
				.then((result) => {
					if (version === loadVersion) needsHours = !result.items?.length;
				})
				.catch(() => {
					if (version === loadVersion) needsHours = false;
				})
		]);
	}

	async function setStandardWorkingHours() {
		if (busy) return;
		settingHours = true;
		try {
			for (let day = 1; day <= 5; day++) {
				await api.post('/v1/availability-rules', {
					user_id: selectedDoctorId, day_of_week: day, start_time: '09:00', end_time: '18:00'
				});
			}
			toast.success($t('doctorBreaks.hoursUpdated'));
		} catch {
			toast.error($t('doctorBreaks.hoursFailed'));
		} finally {
			await loadSchedule();
			settingHours = false;
		}
	}

	async function saveBreak(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !selectedDoctorId) return;
		formError = '';
		if (startTime >= endTime) {
			formError = $t('doctorBreaks.error.timeInvalid');
			return;
		}
		saving = true;
		try {
			const item = await api.post<DoctorBreak>('/v1/doctor-breaks', {
				user_id: selectedDoctorId,
				kind: 'date',
				date: selectedDate,
				start_time: startTime,
				end_time: endTime,
				title: breakTitle.trim() || $t('doctorBreaks.defaultTitle')
			});
			breaks = [...breaks, item];
			breakTitle = '';
			toast.success($t('doctorBreaks.addedSuccess'));
		} catch {
			formError = $t('doctorBreaks.error.saveFailed');
		} finally {
			saving = false;
		}
	}

	function confirmDelete(item: DoctorBreak) {
		deleteTarget = item;
		deleteOpen = true;
	}

	async function deleteBreak() {
		if (!deleteTarget || deleting) return;
		const id = deleteTarget.id;
		deleting = true;
		try {
			await api.del(`/v1/doctor-breaks/${id}`);
			breaks = breaks.filter((item) => item.id !== id);
			toast.success($t('doctorBreaks.deletedSuccess'));
		} catch {
			toast.error($t('doctorBreaks.error.deleteFailed'));
		} finally {
			deleting = false;
			deleteTarget = null;
		}
	}
</script>

<svelte:head>
	<title>{$t('doctorBreaks.pageTitle')}</title>
</svelte:head>

{#snippet breakRow(item: DoctorBreak)}
	<li class="flex items-center gap-3 px-4 py-3 sm:px-5">
		<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
			{#if item.kind === 'weekly'}
				<Repeat class="size-4" aria-hidden="true" />
			{:else}
				<Clock class="size-4" aria-hidden="true" />
			{/if}
		</div>
		<div class="min-w-0 flex-1">
			<div class="text-sm font-semibold tabular-nums">{item.start_time}–{item.end_time}</div>
			<div class="wrap-break-word text-sm text-muted-foreground">{item.title}</div>
			{#if item.kind === 'weekly'}
				<div class="text-xs text-muted-foreground">{$t(`doctorBreaks.day.${item.day_of_week}`)}</div>
			{/if}
		</div>
		<Button variant="ghost" class="h-10 text-muted-foreground hover:text-destructive"
			disabled={busy} onclick={() => confirmDelete(item)}>
			{$t('common.delete')}
		</Button>
	</li>
{/snippet}

{#snippet dayList(days: typeof upcoming)}
	{#each days as [date, items] (date)}
		<div class="overflow-hidden rounded-xl border bg-card">
			<h3 class="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-medium sm:px-5">
				{#if date === todayIso}
					<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold">{$t('doctorBreaks.today')}</span>
				{/if}
				<time datetime={date} class="capitalize">{formatDate(date)}</time>
			</h3>
			<ul class="divide-y">
				{#each items as item (item.id)}
					{@render breakRow(item)}
				{/each}
			</ul>
		</div>
	{/each}
{/snippet}

<div class="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-9">
	<header class="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
		<h1 class="text-3xl font-bold tracking-tight">{$t('doctorBreaks.heading')}</h1>
		{#if selectedDoctor}
			<div class="min-w-0 space-y-1.5 sm:w-64 sm:shrink-0">
				{#if doctors.length > 1}
					<label for="break-specialist" class="block text-sm font-medium">{$t('doctorBreaks.selectDoctor')}</label>
					<select id="break-specialist"
						class="h-11 w-full rounded-lg border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
						value={selectedDoctorId} disabled={busy}
						onchange={(event) => selectDoctor(event.currentTarget.value)}>
						{#each doctors as doctor (doctor.id)}
							<option value={doctor.id}>{doctor.name || doctor.email}</option>
						{/each}
					</select>
				{:else}
					<div class="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium">
						<UserRound class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<span class="wrap-break-word min-w-0">{selectedDoctor.name || selectedDoctor.email}</span>
					</div>
				{/if}
			</div>
		{/if}
	</header>

	{#if doctorsLoading}
		<p role="status" class="text-sm text-muted-foreground">{$t('common.loading')}</p>
	{:else if doctorsFailed}
		<div class="flex flex-wrap items-center gap-3 rounded-xl border p-4">
			<p role="alert" class="text-sm">{$t('doctorBreaks.doctorsFailed')}</p>
			<Button variant="outline" onclick={loadDoctors}>{$t('doctorBreaks.retry')}</Button>
		</div>
	{:else if !selectedDoctor}
		<p class="rounded-xl border p-4 text-sm text-muted-foreground">{$t('doctorBreaks.noDoctors')}</p>
	{:else}
		{#if needsHours}
			<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
				<p>{$t('doctorBreaks.noHoursSet')}</p>
				<Button variant="outline" class="h-auto min-h-9 whitespace-normal text-left"
					disabled={busy} onclick={setStandardWorkingHours}>
					{$t('doctorBreaks.setStandardHours')}
				</Button>
			</div>
		{/if}

		<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<section aria-labelledby="upcoming-breaks" class="min-w-0 space-y-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 id="upcoming-breaks" class="text-xl font-semibold">{$t('doctorBreaks.upcoming')}</h2>
						<p class="mt-1 text-sm text-muted-foreground">{$t('doctorBreaks.upcomingDesc')}</p>
					</div>
					<Button href="#add-break" variant="outline" class="h-10 lg:hidden">
						<Plus aria-hidden="true" /> {$t('doctorBreaks.addBreak')}
					</Button>
				</div>
				{#if breaksLoading}
					<p role="status" class="rounded-xl border p-5 text-sm text-muted-foreground">{$t('common.loading')}</p>
				{:else if breaksFailed}
					<div class="flex flex-wrap items-center gap-3 rounded-xl border p-4">
						<p role="alert" class="text-sm">{$t('doctorBreaks.loadFailed')}</p>
						<Button variant="outline" disabled={busy} onclick={loadSchedule}>{$t('doctorBreaks.retry')}</Button>
					</div>
				{:else if upcoming.length}
					{@render dayList(upcoming)}
				{:else}
					<div class="flex gap-3 rounded-xl border border-dashed bg-muted/20 p-5">
						<CalendarDays class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						<p class="text-sm text-muted-foreground">{$t('doctorBreaks.upcomingEmpty')}</p>
					</div>
				{/if}
			</section>

			<section id="add-break" aria-labelledby="add-break-title" class="scroll-mt-24 rounded-2xl border bg-card p-5 shadow-sm lg:col-start-2 lg:row-start-1 lg:row-span-2">
				<h2 id="add-break-title" class="text-xl font-semibold">{$t('doctorBreaks.addBreak')}</h2>
				<p class="mt-1 text-sm text-muted-foreground">{$t('doctorBreaks.addBreakDesc')}</p>
				<form onsubmit={saveBreak} class="mt-5 space-y-4">
					<div class="space-y-1.5">
						<label for="break-date" class="block text-sm font-medium">{$t('doctorBreaks.date')}</label>
						<Popover.Root bind:open={dateOpen}>
							<Popover.Trigger id="break-date" disabled={busy} aria-labelledby="break-date-label break-date-value"
								class={buttonVariants({ variant: 'outline', class: 'h-11 w-full justify-start gap-2 px-3 font-normal' })}>
								<span id="break-date-label" class="sr-only">{$t('doctorBreaks.date')}</span>
								<CalendarDays class="size-4 text-muted-foreground" aria-hidden="true" />
								<span id="break-date-value" class="truncate capitalize">{formatDate(selectedDate)}</span>
								<ChevronDown class="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
							</Popover.Trigger>
							<Popover.Content align="start" sideOffset={8} role="dialog" aria-label={$t('doctorBreaks.date')}
								class="max-h-(--bits-popover-content-available-height) w-fit overflow-y-auto rounded-xl p-0 shadow-lg">
								<Calendar value={parseDate(selectedDate)} minValue={earliestDate} preventDeselect
									onValueChange={pickDate} locale={$localeTag} weekdayFormat="short" calendarLabel={$t('doctorBreaks.date')}
									class="px-4 [&_[data-calendar-head-cell]]:w-9 [&_[data-calendar-cell]]:size-9 [&_[data-calendar-day]]:size-9" />
								<div class="grid grid-cols-2 gap-2 border-t bg-muted/30 p-3">
									<Button variant="outline" class="h-9" onclick={() => pickDate(earliestDate)}>
										{$t('doctorBreaks.today')}
									</Button>
									<Button variant="outline" class="h-9" onclick={() => pickDate(earliestDate.add({ days: 1 }))}>
										{$t('doctorBreaks.tomorrow')}
									</Button>
								</div>
							</Popover.Content>
						</Popover.Root>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="min-w-0 space-y-1.5">
							<BreakTimePicker id="break-start" label={$t('doctorBreaks.timeFrom')} bind:value={startTime} disabled={busy} />
						</div>
						<div class="min-w-0 space-y-1.5">
							<BreakTimePicker id="break-end" label={$t('doctorBreaks.timeTo')} bind:value={endTime} disabled={busy} />
						</div>
					</div>
					<p class="text-xs text-muted-foreground">{$t('doctorBreaks.timezone', { timezone })}</p>
					<div class="space-y-1.5">
						<label for="break-title" class="block text-sm font-medium">{$t('doctorBreaks.titleLabel')}</label>
						<Input id="break-title" type="text" bind:value={breakTitle}
							placeholder={$t('doctorBreaks.titlePlaceholder')} disabled={busy} class="h-11" />
					</div>
					{#if formError}
						<p role="alert" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>
					{/if}
					<Button type="submit" class="h-11 w-full" disabled={busy || breaksLoading || breaksFailed}>
						<Plus aria-hidden="true" /> {saving ? $t('doctorBreaks.submitting') : $t('doctorBreaks.submit')}
					</Button>
				</form>
			</section>

			{#if !breaksLoading && !breaksFailed && (recurring.length || past.length)}
				<div class="space-y-6 lg:col-start-1">
					{#if recurring.length}
						<section aria-labelledby="recurring-breaks" class="space-y-3">
							<h2 id="recurring-breaks" class="text-lg font-semibold">{$t('doctorBreaks.recurring')}</h2>
							<p class="text-sm text-muted-foreground">{$t('doctorBreaks.recurringDesc')}</p>
							<ul class="divide-y rounded-xl border bg-card">
								{#each recurring as item (item.id)}
									{@render breakRow(item)}
								{/each}
							</ul>
						</section>
					{/if}
					{#if past.length}
						<section aria-labelledby="past-breaks" class="space-y-3">
							<h2 id="past-breaks" class="text-lg font-semibold">{$t('doctorBreaks.past')}</h2>
							{@render dayList(past)}
						</section>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title={$t('doctorBreaks.deleteConfirmTitle')}
	description={deleteTarget ? $t('doctorBreaks.deleteConfirmDesc', {
		title: deleteTarget.title,
		date: deleteTarget.date ? formatDate(deleteTarget.date) : $t(`doctorBreaks.day.${deleteTarget.day_of_week}`),
		start: deleteTarget.start_time,
		end: deleteTarget.end_time
	}) : ''}
	confirmText={$t('common.delete')}
	destructive
	onConfirm={deleteBreak}
/>
