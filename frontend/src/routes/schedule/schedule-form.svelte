<script lang="ts">
	import { parseAbsolute, parseDate, parseDateTime, toZoned } from '@internationalized/date';
	import { CalendarDays, Clock3, Mail, MapPin, Phone, UserRound } from '@lucide/svelte';
	import { api, type Booking, type DoctorBreak } from '$lib/api';
	import { localeTag, t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import * as Select from '$lib/components/ui/select';
	import TimePicker from './time-picker.svelte';

	let { kind, staffID, staffName, timezone, initialDate, initialTime, target, onSaved, onDismiss }: {
		kind: 'booking' | 'break' | 'details' | 'removeBreak';
		staffID: string;
		staffName: string;
		timezone: string;
		initialDate: string;
		initialTime: string;
		target?: Booking | DoctorBreak;
		onSaved: () => void;
		onDismiss: () => void;
	} = $props();

	const appointment = $derived(target && 'start_at' in target ? target : undefined);
	const breakItem = $derived(target && 'start_time' in target ? target : undefined);
	const attendee = $derived(appointment?.attendees[0]);
	let date = $state('');
	let start = $state('');
	let end = $state('');
	let title = $state('');
	let duration = $state<number | undefined>(20);
	let name = $state('');
	let contactMethod = $state<'phone' | 'email'>('email');
	let contact = $state('');
	let editing = $state(false);
	let confirmingCancel = $state(false);
	let saving = $state(false);
	let error = $state('');
	let lastPayload = '';
	let idempotencyKey = '';
	let freeWindows = $state<{ start_at: string; end_at: string }[]>([]);
	let availabilityLoading = $state(false);
	let availabilityError = $state('');
	let availabilityVersion = $state(0);
	const needsAvailability = $derived(kind === 'booking' || (kind === 'details' && editing));
	const appointmentMinutes = $derived(kind === 'details' && appointment
		? Math.ceil((Date.parse(appointment.end_at) - Date.parse(appointment.start_at)) / 60000)
		: duration);
	const allowedStarts = $derived.by(() => {
		if (!needsAvailability) return undefined;
		const result = new Set<number>();
		if (availabilityLoading || availabilityError || !date || !appointmentMinutes) return result;
		const windows = freeWindows.map((window) => ({ start: Date.parse(window.start_at), end: Date.parse(window.end_at) }));
		for (let minute = 0; minute < 24 * 60; minute++) {
			const time = [Math.floor(minute / 60), minute % 60].map((part) => String(part).padStart(2, '0')).join(':');
			try {
				const instant = toZoned(parseDateTime(date + 'T' + time), timezone, 'reject').toDate().getTime();
				if (windows.some((window) => instant >= window.start && instant + appointmentMinutes * 60000 <= window.end)) result.add(minute);
			} catch {
				// A wall-clock minute can be absent or ambiguous at a timezone transition.
			}
		}
		return result;
	});
	const timeAvailable = $derived(allowedStarts === undefined || (
		/^([01]\d|2[0-3]):[0-5]\d$/.test(start) && allowedStarts.has(Number(start.slice(0, 2)) * 60 + Number(start.slice(3)))
	));

	$effect(() => {
		availabilityVersion;
		if (!needsAvailability || !date || !Number.isInteger(appointmentMinutes) || !appointmentMinutes || appointmentMinutes < 1 || appointmentMinutes > 1440) {
			freeWindows = [];
			availabilityLoading = false;
			availabilityError = '';
			return;
		}
		const day = parseDate(date);
		const query = new URLSearchParams({
			staff_id: staffID,
			from: day.toDate(timezone).toISOString(),
			to: day.add({ days: 1 }).toDate(timezone).toISOString(),
			duration_minutes: String(appointmentMinutes)
		});
		if (kind === 'details' && appointment) query.set('exclude_booking_id', appointment.id);
		let current = true;
		freeWindows = [];
		availabilityLoading = true;
		availabilityError = '';
		api.get<{ windows: { start_at: string; end_at: string }[] }>('/v1/schedule/availability?' + query)
			.then((response) => { if (current) freeWindows = response.windows; })
			.catch((failure) => { if (current) availabilityError = failure instanceof Error ? failure.message : $t('schedule.loadFailed'); })
			.finally(() => { if (current) availabilityLoading = false; });
		return () => { current = false; };
	});

	$effect(() => {
		if (kind === 'details' && appointment) {
			const local = parseAbsolute(appointment.start_at, timezone);
			date = local.toString().slice(0, 10);
			start = [local.hour, local.minute].map((value) => String(value).padStart(2, '0')).join(':');
		} else {
			date = initialDate;
			start = initialTime;
		}
		const [hour, minute] = initialTime.split(':').map(Number);
		const endMinutes = Math.min(1439, hour * 60 + minute + 30);
		end = [Math.floor(endMinutes / 60), endMinutes % 60].map((value) => String(value).padStart(2, '0')).join(':');
		error = '';
	});

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString($localeTag, { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString($localeTag, { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
	}

	function startAt() {
		return toZoned(parseDateTime(date + 'T' + start), timezone, 'reject').toDate().toISOString();
	}

	async function cancelAppointment() {
		if (!appointment || saving) return;
		saving = true;
		error = '';
		try {
			await api.post('/v1/bookings/' + encodeURIComponent(appointment.id) + '/cancel', {});
			onSaved();
		} catch (failure) {
			error = failure instanceof Error ? failure.message : $t('common.error');
		} finally {
			saving = false;
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		if (needsAvailability && !timeAvailable) {
			error = $t('schedule.timeUnavailable');
			return;
		}
		saving = true;
		error = '';
		try {
			if (kind === 'break') {
				await api.post('/v1/doctor-breaks', {
					user_id: staffID, kind: 'date', date, start_time: start, end_time: end,
					title: title.trim() || $t('doctorBreaks.defaultTitle')
				});
			} else if (kind === 'removeBreak' && breakItem) {
				await api.del('/v1/doctor-breaks/' + encodeURIComponent(breakItem.id));
			} else if (kind === 'details' && appointment && editing) {
				await api.patch('/v1/bookings/' + encodeURIComponent(appointment.id) + '/reschedule', { start_at: startAt() });
			} else if (kind === 'booking') {
				const payload = {
					staff_id: staffID, start_at: startAt(), duration_minutes: duration,
					name: name.trim(), contact_method: contactMethod, language: $localeTag, timezone,
					email: contactMethod === 'email' ? contact.trim() : undefined,
					contact_phone: contactMethod === 'phone' ? contact.trim() : undefined
				};
				const serialized = JSON.stringify(payload);
				if (serialized !== lastPayload) {
					lastPayload = serialized;
					idempotencyKey = crypto.getRandomValues(new Uint32Array(4)).join('-');
				}
				await api.post('/v1/schedule/bookings', payload, { 'Idempotency-Key': idempotencyKey });
			} else {
				return;
			}
			onSaved();
		} catch (failure) {
			error = failure instanceof RangeError ? $t('schedule.invalidTime')
				: failure instanceof Error ? failure.message : $t('common.error');
			if (needsAvailability && (failure as { status?: number })?.status === 409) availabilityVersion++;
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={save}>
	<div class="space-y-6 px-6 py-6">
		{#if kind === 'details' && appointment}
			<div class="flex items-start gap-3">
				<div class="grid size-11 shrink-0 place-items-center rounded-full bg-primary/5 text-primary"><UserRound class="size-5" /></div>
				<div class="min-w-0 flex-1">
					<h3 class="break-words text-lg font-semibold tracking-tight">{attendee?.name || $t('schedule.appointment')}</h3>
					<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
						{#if attendee?.email}<a href={'mailto:' + attendee.email} class="flex items-center gap-1.5 hover:text-foreground"><Mail class="size-3.5" />{attendee.email}</a>{/if}
						{#if attendee?.phone}<a href={'tel:' + attendee.phone} class="flex items-center gap-1.5 hover:text-foreground"><Phone class="size-3.5" />{attendee.phone}</a>{/if}
					</div>
				</div>
				<span class="rounded-full px-2.5 py-1 text-xs font-medium {appointment.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'}">
					{$t(appointment.status === 'cancelled' ? 'bookings.status.cancelled' : 'bookings.status.confirmed')}
				</span>
			</div>
			{#if !editing}
				<div class="grid gap-4 rounded-xl border bg-muted/15 p-4 sm:grid-cols-2">
					<div class="flex items-start gap-2.5 text-sm"><CalendarDays class="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{formatDate(appointment.start_at)}</span></div>
					<div class="flex items-start gap-2.5 text-sm"><Clock3 class="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span class="tabular-nums">{formatTime(appointment.start_at)}–{formatTime(appointment.end_at)} <span class="text-muted-foreground">· {Math.round((Date.parse(appointment.end_at) - Date.parse(appointment.start_at)) / 60000)} {$t('schedule.minuteUnit')}</span></span></div>
					<div class="flex items-start gap-2.5 text-sm"><UserRound class="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{appointment.host_name || staffName}</span></div>
					{#if appointment.location_value}<div class="flex items-start gap-2.5 break-words text-sm"><MapPin class="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{appointment.location_value}</span></div>{/if}
				</div>
			{/if}
		{:else if kind === 'removeBreak' && breakItem}
			<div class="rounded-xl border bg-muted/15 p-4">
				<p class="font-medium">{breakItem.title}</p>
				<p class="mt-1 text-sm tabular-nums text-muted-foreground">{breakItem.date || initialDate} · {breakItem.start_time}–{breakItem.end_time}</p>
			</div>
			<p class="text-sm text-muted-foreground">{$t(breakItem.kind === 'weekly' ? 'schedule.removeRecurringBreakHelp' : 'schedule.removeBreakHelp')}</p>
		{/if}

		{#if kind === 'booking'}
			<div class="space-y-2">
				<Label for="schedule-attendee">{$t('schedule.attendee')}</Label>
				<Input id="schedule-attendee" class="h-11 bg-muted/15 shadow-xs" bind:value={name} autocomplete="name" required />
			</div>
			<div class="grid grid-cols-[150px_minmax(0,1fr)] gap-3">
				<div class="space-y-2">
					<Label for="schedule-contact-method">{$t('schedule.contactMethod')}</Label>
					<Select.Root type="single" bind:value={contactMethod} onValueChange={() => contact = ''}>
						<Select.Trigger id="schedule-contact-method" class="data-[size=default]:h-11 w-full bg-muted/15 shadow-xs">
							{$t(contactMethod === 'email' ? 'schedule.email' : 'schedule.phone')}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="email" label={$t('schedule.email')}>{$t('schedule.email')}</Select.Item>
							<Select.Item value="phone" label={$t('schedule.phone')}>{$t('schedule.phone')}</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label for="schedule-contact">{$t(contactMethod === 'email' ? 'schedule.email' : 'schedule.phone')}</Label>
					<Input id="schedule-contact" class="h-11 bg-muted/15 shadow-xs" type={contactMethod === 'email' ? 'email' : 'tel'} bind:value={contact} required />
				</div>
			</div>
		{/if}

		{#if kind === 'booking' || kind === 'break' || (kind === 'details' && editing)}
			<div class="grid gap-4 {kind === 'booking' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}">
				<div class="space-y-2">
					<Label for="schedule-date">{$t('schedule.date')}</Label>
					<DatePicker id="schedule-date" ariaLabel={$t('schedule.date')} bind:value={date} {timezone}
						class="h-11 w-full bg-muted/15 shadow-xs" />
				</div>
				<div class="space-y-2">
					<Label for="schedule-start">{$t('schedule.start')}</Label>
					<TimePicker id="schedule-start" label={$t('schedule.start')} bind:value={start} allowedMinutes={allowedStarts} />
				</div>
				{#if kind === 'booking'}
					<div class="space-y-2">
						<Label for="schedule-duration">{$t('schedule.duration')}</Label>
						<Input id="schedule-duration" class="h-11 bg-muted/15 shadow-xs" type="number" min="1" max="1440" bind:value={duration} required />
					</div>
				{/if}
			</div>
			{#if kind === 'break'}
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="schedule-end">{$t('schedule.end')}</Label>
						<TimePicker id="schedule-end" label={$t('schedule.end')} bind:value={end} />
					</div>
					<div class="space-y-2">
						<Label for="schedule-break-title">{$t('schedule.breakTitle')}</Label>
						<Input id="schedule-break-title" class="h-11 bg-muted/15 shadow-xs" bind:value={title} placeholder={$t('doctorBreaks.defaultTitle')} />
					</div>
				</div>
			{/if}
		{/if}
		{#if needsAvailability}
			{#if availabilityLoading}
				<p role="status" class="text-sm text-muted-foreground">{$t('schedule.checkingAvailability')}</p>
			{:else if availabilityError}
				<div role="alert" class="flex items-center justify-between gap-3 text-sm text-destructive">
					<span>{availabilityError}</span>
					<Button type="button" variant="outline" size="sm" onclick={() => availabilityVersion++}>{$t('common.retry')}</Button>
				</div>
			{:else if !timeAvailable && /^([01]\d|2[0-3]):[0-5]\d$/.test(start)}
				<p role="status" class="text-sm text-muted-foreground">{$t('schedule.timeUnavailable')}</p>
			{/if}
		{/if}
		{#if confirmingCancel}<p class="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{$t('schedule.cancelHelp')}</p>{/if}
		{#if error}<p role="alert" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>{/if}
	</div>

	<div class="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/10 px-6 py-4">
		{#if kind === 'details' && !editing}
			{#if appointment?.status !== 'cancelled'}
				{#if confirmingCancel}
					<Button variant="outline" type="button" disabled={saving} onclick={() => confirmingCancel = false}>{$t('common.back')}</Button>
					<Button variant="destructive" type="button" disabled={saving} onclick={cancelAppointment}>{$t(saving ? 'common.saving' : 'schedule.cancelBooking')}</Button>
				{:else}
					<Button variant="ghost" type="button" class="mr-auto text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={saving} onclick={() => confirmingCancel = true}>{$t('schedule.cancelBooking')}</Button>
					<Button variant="outline" type="button" onclick={onDismiss}>{$t('common.close')}</Button>
					<Button type="button" onclick={() => { editing = true; error = ''; }}>{$t('bookings.reschedule.action')}</Button>
				{/if}
			{:else}
				<Button variant="outline" type="button" onclick={onDismiss}>{$t('common.close')}</Button>
			{/if}
		{:else}
			<Button variant="outline" type="button" disabled={saving} onclick={() => { if (editing) { editing = false; error = ''; } else onDismiss(); }}>{$t('common.cancel')}</Button>
			<Button type="submit" variant={kind === 'removeBreak' ? 'destructive' : 'default'} disabled={saving || (needsAvailability && !timeAvailable)}>
				{$t(saving ? 'common.saving' : kind === 'removeBreak' ? 'common.delete' : kind === 'booking' ? 'schedule.newBooking' : 'common.save')}
			</Button>
		{/if}
	</div>
</form>

