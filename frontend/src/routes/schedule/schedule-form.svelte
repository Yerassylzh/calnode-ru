<script lang="ts">
	import { untrack } from 'svelte';
	import { parseAbsolute, parseDate, parseDateTime, toZoned } from '@internationalized/date';
	import { CalendarDays, Clock3, Mail, MapPin, Phone, UserRound } from '@lucide/svelte';
	import { api, type Booking, type DoctorBreak, type ScheduleDay } from '$lib/api';
	import { localeTag, t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import * as Select from '$lib/components/ui/select';
	import TimePicker from './time-picker.svelte';

	let { kind, staffID, staffName, timezone, initialDate, initialTime, target, onSaved, onDismiss }: {
		kind: 'booking' | 'break' | 'details' | 'removeBreak' | 'dayOff' | 'removeDayOff';
		staffID: string;
		staffName: string;
		timezone: string;
		initialDate: string;
		initialTime: string;
		target?: Booking | DoctorBreak | ScheduleDay;
		onSaved: () => void;
		onDismiss: () => void;
	} = $props();

	const appointment = $derived(target && 'start_at' in target ? target : undefined);
	const breakItem = $derived(target && 'start_time' in target ? target : undefined);
	const dayOff = $derived(target && 'is_day_off' in target ? target : undefined);
	const attendee = $derived(appointment?.attendees[0]);
	let date = $state('');
	let start = $state('');
	let end = $state('');
	let title = $state('');
	let duration = $state<number | undefined>(20);
	let name = $state('');
	let notes = $state('');
	let contactMethod = $state<'phone' | 'email'>('email');
	let contact = $state('');
	let confirmingCancel = $state(false);
	let saving = $state(false);
	let error = $state('');
	let lastPayload = '';
	let idempotencyKey = '';
	let freeWindows = $state<{ start_at: string; end_at: string }[]>([]);
	let availabilityDayOff = $state<ScheduleDay>();
	let availabilityLoading = $state(false);
	let availabilityError = $state('');
	let availabilityVersion = $state(0);
	// An active appointment opens straight into its edit form - no 'Reschedule' step.
	const editing = $derived(kind === 'details' && !!appointment && appointment.status !== 'cancelled');
	const needsAvailability = $derived(kind === 'booking' || (kind === 'details' && editing));
	const clockRe = /^([01]\d|2[0-3]):[0-5]\d$/;
	const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
	const toClock = (minutes: number) => [Math.floor(minutes / 60), minutes % 60].map((part) => String(part).padStart(2, '0')).join(':');
	// While editing an appointment the length is whatever start..end the manager
	// picked, so the free-window check below runs against the new length.
	const editedMinutes = $derived(clockRe.test(start) && clockRe.test(end) ? toMinutes(end) - toMinutes(start) : 0);
	const endValid = $derived(!(kind === 'details' && editing) || editedMinutes > 0);
	const appointmentMinutes = $derived(kind === 'details' && appointment
		? (editing && editedMinutes > 0 ? editedMinutes : Math.ceil((Date.parse(appointment.end_at) - Date.parse(appointment.start_at)) / 60000))
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
			availabilityDayOff = undefined;
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
		availabilityDayOff = undefined;
		availabilityLoading = true;
		availabilityError = '';
		api.get<{ windows: { start_at: string; end_at: string }[]; days?: ScheduleDay[] }>('/v1/schedule/availability?' + query)
			.then((response) => {
				if (current) {
					freeWindows = response.windows;
					availabilityDayOff = response.days?.find((day) => day.date === date && day.is_day_off);
				}
			})
			.catch((failure) => { if (current) availabilityError = failure instanceof Error ? failure.message : $t('schedule.loadFailed'); })
			.finally(() => { if (current) availabilityLoading = false; });
		return () => { current = false; };
	});

	$effect(() => {
		if (kind === 'details' && appointment) {
			const local = parseAbsolute(appointment.start_at, timezone);
			date = local.toString().slice(0, 10);
			start = [local.hour, local.minute].map((value) => String(value).padStart(2, '0')).join(':');
			notes = appointment.notes ?? '';
			const localEnd = parseAbsolute(appointment.end_at, timezone);
			// An end on a later calendar day can't be shown on one date; clamp to 23:59.
			end = localEnd.toString().slice(0, 10) === date
				? [localEnd.hour, localEnd.minute].map((value) => String(value).padStart(2, '0')).join(':')
				: '23:59';
		} else {
			date = initialDate;
			start = initialTime;
			const [hour, minute] = initialTime.split(':').map(Number);
			const endMinutes = Math.min(1439, hour * 60 + minute + 30);
			end = [Math.floor(endMinutes / 60), endMinutes % 60].map((value) => String(value).padStart(2, '0')).join(':');
		}
		error = '';
	});

	// Moving the start while editing carries the end with it, so the length is
	// kept until the manager edits the end themselves.
	let prevStart = '';
	$effect(() => {
		const next = start;
		if (kind === 'details' && editing && clockRe.test(next) && clockRe.test(prevStart)) {
			untrack(() => {
				if (clockRe.test(end)) end = toClock(Math.max(0, Math.min(1439, toMinutes(end) + toMinutes(next) - toMinutes(prevStart))));
			});
		}
		prevStart = next;
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

	// Only what the manager actually changed gets sent and validated, so fixing a
	// note on an appointment whose time is no longer 'available' still saves.
	const timeDirty = $derived.by(() => {
		if (!(kind === 'details' && appointment)) return false;
		try {
			return Date.parse(startAt()) !== Date.parse(appointment.start_at) || Date.parse(endAt()) !== Date.parse(appointment.end_at);
		} catch {
			return true;
		}
	});
	const notesDirty = $derived(kind === 'details' && !!appointment && notes.trim() !== (appointment.notes ?? '').trim());
	const timeBlocked = $derived(kind === 'details' ? timeDirty && (!endValid || !timeAvailable) : needsAvailability && !timeAvailable);

	function endAt() {
		return toZoned(parseDateTime(date + 'T' + end), timezone, 'reject').toDate().toISOString();
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
		if (timeDirty && !endValid) {
			error = $t('schedule.endBeforeStart');
			return;
		}
		if (timeBlocked) {
			error = $t('schedule.timeUnavailable');
			return;
		}
		saving = true;
		error = '';
		try {
			if (kind === 'dayOff') {
				await api.post('/v1/availability-overrides', { user_id: staffID, date, reason: 'day_off', notes: notes.trim() || undefined });
			} else if (kind === 'removeDayOff' && dayOff?.override_id) {
				await api.del('/v1/availability-overrides/' + encodeURIComponent(dayOff.override_id));
			} else if (kind === 'break') {
				await api.post('/v1/doctor-breaks', {
					user_id: staffID, kind: 'date', date, start_time: start, end_time: end,
					title: title.trim() || $t('doctorBreaks.defaultTitle')
				});
			} else if (kind === 'removeBreak' && breakItem) {
				await api.del('/v1/doctor-breaks/' + encodeURIComponent(breakItem.id));
			} else if (kind === 'details' && appointment && editing) {
				const id = encodeURIComponent(appointment.id);
				if (notesDirty) await api.patch('/v1/bookings/' + id, { notes: notes.trim() });
				if (timeDirty) await api.patch('/v1/bookings/' + id + '/reschedule', { start_at: startAt(), end_at: endAt() });
			} else if (kind === 'booking') {
				const payload = {
					staff_id: staffID, start_at: startAt(), duration_minutes: duration,
					notes: notes.trim() || undefined,
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
			{#if !editing && appointment.notes}
				<div class="space-y-2">
					<p class="text-sm font-medium">{$t('schedule.notes')}</p>
					<p class="whitespace-pre-wrap break-words rounded-xl border bg-muted/15 p-4 text-sm">{appointment.notes}</p>
				</div>
			{/if}
		{:else if kind === 'removeDayOff' && dayOff}
			<div class="space-y-3 rounded-xl border bg-muted/15 p-4 text-sm">
				<p class="font-medium">{parseDate(dayOff.date).toDate('UTC').toLocaleDateString($localeTag, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
				{#if dayOff.notes}<p class="whitespace-pre-wrap break-words text-muted-foreground">{dayOff.notes}</p>{/if}
			</div>
			<p class="text-sm text-muted-foreground">{$t('schedule.removeDayOffHelp')}</p>
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
					<Input id="schedule-contact" class="h-11 bg-muted/15 shadow-xs" type={contactMethod === 'email' ? 'email' : 'tel'} bind:value={contact}
						pattern={contactMethod === 'phone' ? '\\+[1-9][0-9]{6,14}' : undefined}
						placeholder={contactMethod === 'phone' ? '+77011234567' : undefined} required />
				</div>
			</div>
		{/if}

		{#if kind === 'booking' || kind === 'break' || (kind === 'details' && editing)}
			<div class="grid gap-4 {kind === 'booking' ? 'sm:grid-cols-3' : kind === 'details' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}">
				<div class="space-y-2">
					<Label for="schedule-date">{$t('schedule.date')}</Label>
					<DatePicker id="schedule-date" ariaLabel={$t('schedule.date')} bind:value={date} {timezone}
						class="h-11 w-full bg-muted/15 shadow-xs" />
				</div>
				<div class="space-y-2">
					<Label for="schedule-start">{$t('schedule.start')}</Label>
					<TimePicker id="schedule-start" label={$t('schedule.start')} bind:value={start} allowedMinutes={allowedStarts} />
				</div>
				{#if kind === 'details'}
					<div class="space-y-2">
						<Label for="schedule-edit-end">{$t('schedule.end')}</Label>
						<TimePicker id="schedule-edit-end" label={$t('schedule.end')} bind:value={end} />
					</div>
				{/if}
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
		{#if kind === 'dayOff'}
			<div class="space-y-2">
				<Label for="schedule-day-off-date">{$t('schedule.date')}</Label>
				<DatePicker id="schedule-day-off-date" ariaLabel={$t('schedule.date')} bind:value={date} {timezone} class="h-11 w-full bg-muted/15 shadow-xs" />
			</div>
		{/if}
		{#if needsAvailability}
			{#if availabilityLoading}
				<p role="status" class="text-sm text-muted-foreground">{$t('schedule.checkingAvailability')}</p>
			{:else if availabilityError}
				<div role="alert" class="flex items-center justify-between gap-3 text-sm text-destructive">
					<span>{availabilityError}</span>
					<Button type="button" variant="outline" size="sm" onclick={() => availabilityVersion++}>{$t('common.retry')}</Button>
				</div>
			{:else if availabilityDayOff}
				<p role="status" class="break-words text-sm text-muted-foreground">{$t('schedule.dayOff')}{#if availabilityDayOff.notes} · {availabilityDayOff.notes}{/if}</p>
			{:else if !timeAvailable && /^([01]\d|2[0-3]):[0-5]\d$/.test(start)}
				<p role="status" class="text-sm text-muted-foreground">{$t('schedule.timeUnavailable')}</p>
			{/if}
		{/if}
		{#if confirmingCancel}<p class="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{$t('schedule.cancelHelp')}</p>{/if}
		{#if kind === 'booking' || kind === 'dayOff' || editing}
			<div class="space-y-2">
				<Label for="schedule-notes">{$t(kind === 'dayOff' ? 'schedule.dayOffReason' : 'schedule.notes')} <span class="font-normal text-muted-foreground">{$t('common.optional')}</span></Label>
				<Textarea id="schedule-notes" bind:value={notes} rows={3} maxlength={5000} class="resize-y bg-muted/15 shadow-xs" />
			</div>
		{/if}
		{#if error}<p role="alert" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>{/if}
	</div>

	<div class="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/10 px-6 py-4">
		{#if kind === 'details' && !editing}
			<Button variant="outline" type="button" onclick={onDismiss}>{$t('common.close')}</Button>
		{:else if kind === 'details' && confirmingCancel}
			<Button variant="outline" type="button" disabled={saving} onclick={() => confirmingCancel = false}>{$t('common.back')}</Button>
			<Button variant="destructive" type="button" disabled={saving} onclick={cancelAppointment}>{$t(saving ? 'common.saving' : 'schedule.cancelBooking')}</Button>
		{:else}
			{#if kind === 'details'}
				<Button variant="ghost" type="button" class="mr-auto text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={saving} onclick={() => confirmingCancel = true}>{$t('schedule.cancelBooking')}</Button>
			{/if}
			<Button variant="outline" type="button" disabled={saving} onclick={onDismiss}>{$t(kind === 'details' ? 'common.close' : 'common.cancel')}</Button>
			<Button type="submit" variant={kind === 'removeBreak' || kind === 'removeDayOff' ? 'destructive' : 'default'} disabled={saving || (kind === 'details' ? (!timeDirty && !notesDirty) || timeBlocked : needsAvailability && !timeAvailable)}>
				{$t(saving ? 'common.saving' : kind === 'removeBreak' || kind === 'removeDayOff' ? 'common.delete' : kind === 'booking' ? 'schedule.newBooking' : 'common.save')}
			</Button>
		{/if}
	</div>
</form>

