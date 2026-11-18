<script lang="ts" module>
	export type SavedResult = { kind: 'created' | 'updated' | 'rescheduled' | 'breakAdded' | 'dayOffAdded'; name?: string; startAt?: string };
</script>

<script lang="ts">
	import { parseAbsolute, parseDate, parseDateTime, today, toZoned } from '@internationalized/date';
	import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Mail, MapPin, Phone, UserRound } from '@lucide/svelte';
	import { api, type Booking, type DoctorBreak, type ScheduleDay } from '$lib/api';
	import { localeTag, t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import * as Select from '$lib/components/ui/select';
	import { createStartChecker } from '$lib/schedule/slots';
	import { isValidPhone, normalizePhone } from '$lib/phone';
	import TimePicker from './time-picker.svelte';
	import SlotPicker from './slot-picker.svelte';
	import DurationChips from './duration-chips.svelte';
	import PhoneField from './phone-field.svelte';

	let { kind, staffID, staffName, timezone, initialDate, initialTime, target, remoteNotice = '', dirty = $bindable(false), onLoadLatest, onCancelBooking, onSaved, onDismiss }: {
		kind: 'booking' | 'break' | 'details' | 'dayOff';
		staffID: string;
		staffName: string;
		timezone: string;
		initialDate: string;
		initialTime: string;
		target?: Booking | DoctorBreak | ScheduleDay;
		/** Set by the calendar when the open booking changed elsewhere while this form was open. */
		remoteNotice?: '' | 'changed' | 'cancelled' | 'removed';
		onLoadLatest?: () => void;
		/** True while there are edits that closing would lose. */
		dirty?: boolean;
		onCancelBooking?: () => void;
		onSaved: (result: SavedResult) => void;
		onDismiss: () => void;
	} = $props();

	const appointment = $derived(target && 'start_at' in target ? target : undefined);
	const attendee = $derived(appointment?.attendees[0]);
	let date = $state('');
	let start = $state('');
	let end = $state('');
	let title = $state('');
	let duration = $state<number | undefined>(20);
	let name = $state('');
	let notes = $state('');
	let contactMethod = $state<'phone' | 'email'>('phone');
	let contact = $state('');
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
	// The length is the chosen duration (chips); the end is derived from it, never typed.
	const endValid = $derived(!(kind === 'details' && editing) || (!!duration && duration > 0));
	const appointmentMinutes = $derived(kind === 'details' && appointment && !editing
		? Math.ceil((Date.parse(appointment.end_at) - Date.parse(appointment.start_at)) / 60000)
		: duration);
	const checker = $derived(createStartChecker({ windows: freeWindows, date, timezone, durationMinutes: appointmentMinutes ?? 0 }));
	const slotsReady = $derived(needsAvailability && !availabilityLoading && !availabilityError && !!date && !!appointmentMinutes);
	// undefined while loading (the picker shows its own status); chips step by 10 minutes, plus each window's own start.
	const startList = $derived(slotsReady ? checker.starts(10) : needsAvailability && !availabilityLoading ? [] : undefined);
	const timeAvailable = $derived(!needsAvailability || (slotsReady && clockRe.test(start) && checker.fits(toMinutes(start))));
	const endsAt = $derived(clockRe.test(start) && duration && duration > 0 ? toClock(Math.min(1439, toMinutes(start) + duration)) : '');

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
			const day = local.toString().slice(0, 10);
			date = day;
			start = [local.hour, local.minute].map((value) => String(value).padStart(2, '0')).join(':');
			notes = appointment.notes ?? '';
			const localEnd = parseAbsolute(appointment.end_at, timezone);
			// An end on a later calendar day can't be shown on one date; clamp to 23:59.
			end = localEnd.toString().slice(0, 10) === day
				? [localEnd.hour, localEnd.minute].map((value) => String(value).padStart(2, '0')).join(':')
				: '23:59';
			duration = Math.max(1, Math.round((Date.parse(appointment.end_at) - Date.parse(appointment.start_at)) / 60000));
		} else {
			date = initialDate;
			start = initialTime;
			const [hour, minute] = initialTime.split(':').map(Number);
			const endMinutes = Math.min(1439, hour * 60 + minute + 30);
			end = [Math.floor(endMinutes / 60), endMinutes % 60].map((value) => String(value).padStart(2, '0')).join(':');
		}
		error = '';
	});

	// While editing, the end always follows start + duration.
	$effect(() => {
		if (kind === 'details' && editing && endsAt) end = endsAt;
	});

	function shiftDate(days: number) {
		if (date) date = parseDate(date).add({ days }).toString();
	}

	function setDate(offset: number) {
		date = today(timezone).add({ days: offset }).toString();
	}

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

	// Anything typed or changed that closing the surface would throw away.
	const formDirty = $derived(
		kind === 'booking' ? !!(name.trim() || contact.trim() || notes.trim())
		: kind === 'details' ? editing && (timeDirty || notesDirty)
		: kind === 'break' ? !!title.trim()
		: kind === 'dayOff' ? !!notes.trim() : false
	);
	$effect(() => { dirty = formDirty; });

	function endAt() {
		return toZoned(parseDateTime(date + 'T' + end), timezone, 'reject').toDate().toISOString();
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		if (kind === 'booking' && contactMethod === 'phone') {
			contact = normalizePhone(contact);
			if (!isValidPhone(contact)) {
				error = $t('schedule.phoneInvalid');
				return;
			}
		}
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
		let result: SavedResult;
		try {
			if (kind === 'dayOff') {
				await api.post('/v1/availability-overrides', { user_id: staffID, date, reason: 'day_off', notes: notes.trim() || undefined });
				result = { kind: 'dayOffAdded' };
			} else if (kind === 'break') {
				await api.post('/v1/doctor-breaks', {
					user_id: staffID, kind: 'date', date, start_time: start, end_time: end,
					title: title.trim() || $t('doctorBreaks.defaultTitle')
				});
				result = { kind: 'breakAdded' };
			} else if (kind === 'details' && appointment && editing) {
				const id = encodeURIComponent(appointment.id);
				if (notesDirty) await api.patch('/v1/bookings/' + id, { notes: notes.trim() });
				if (timeDirty) await api.patch('/v1/bookings/' + id + '/reschedule', { start_at: startAt(), end_at: endAt() });
				result = timeDirty ? { kind: 'rescheduled', name: attendee?.name, startAt: startAt() } : { kind: 'updated', name: attendee?.name };
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
				result = { kind: 'created', name: name.trim(), startAt: payload.start_at };
			} else {
				return;
			}
			onSaved(result);
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
	<div class="space-y-5 px-5 py-5">
		{#if remoteNotice}
			<div role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
				<span>{$t(remoteNotice === 'changed' ? 'schedule.live.changedBanner' : remoteNotice === 'cancelled' ? 'schedule.live.cancelledBanner' : 'schedule.live.removedBanner')}</span>
				{#if remoteNotice === 'changed' && onLoadLatest}
					<Button type="button" variant="outline" size="sm" onclick={onLoadLatest}>{$t('schedule.live.loadLatest')}</Button>
				{/if}
			</div>
		{/if}
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
				<div class="grid grid-cols-2 gap-4 rounded-xl border bg-muted/15 p-4">
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
		{/if}

		{#if kind === 'booking'}
			<div class="space-y-2">
				<Label for="schedule-attendee">{$t('schedule.attendee')}</Label>
				<Input id="schedule-attendee" class="h-11 bg-muted/15 shadow-xs" bind:value={name} autocomplete="name" required />
			</div>
			<div class="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
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
					{#if contactMethod === 'phone'}
						<PhoneField id="schedule-contact" bind:value={contact} />
					{:else}
						<Input id="schedule-contact" class="h-11 bg-muted/15 shadow-xs" type="email" bind:value={contact} required />
					{/if}
				</div>
			</div>
		{/if}

		{#if kind === 'booking' || kind === 'break' || (kind === 'details' && editing)}
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2 {kind === 'break' ? '' : 'col-span-2'}">
					<Label for="schedule-date">{$t('schedule.date')}</Label>
					<div class="flex items-center gap-1.5">
						{#if kind !== 'break'}
							<Button type="button" variant="outline" size="icon" class="h-11 w-9 shrink-0" aria-label={$t('schedule.previousDay')} onclick={() => shiftDate(-1)}><ChevronLeft class="size-4" /></Button>
						{/if}
						<DatePicker id="schedule-date" ariaLabel={$t('schedule.date')} bind:value={date} {timezone}
							class="h-11 min-w-0 flex-1 bg-muted/15 shadow-xs" />
						{#if kind !== 'break'}
							<Button type="button" variant="outline" size="icon" class="h-11 w-9 shrink-0" aria-label={$t('schedule.nextDay')} onclick={() => shiftDate(1)}><ChevronRight class="size-4" /></Button>
						{/if}
					</div>
					{#if kind !== 'break'}
						<div class="flex gap-1.5">
							<Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={() => setDate(0)}>{$t('schedule.today')}</Button>
							<Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={() => setDate(1)}>{$t('schedule.tomorrow')}</Button>
						</div>
					{/if}
				</div>
				{#if kind === 'break'}
					<div class="space-y-2">
						<Label for="schedule-start">{$t('schedule.start')}</Label>
						<TimePicker id="schedule-start" label={$t('schedule.start')} bind:value={start} />
					</div>
				{:else}
					<div class="col-span-2 space-y-2">
						<Label for="schedule-start">{$t('schedule.start')}</Label>
						<SlotPicker id="schedule-start" label={$t('schedule.start')} bind:value={start} starts={startList} />
					</div>
					<div class="col-span-2 space-y-2">
						<Label for="schedule-duration">{$t('schedule.duration')}</Label>
						<DurationChips id="schedule-duration" bind:value={duration} />
						{#if endsAt}<p class="text-xs tabular-nums text-muted-foreground">{$t('schedule.endsAt', { time: endsAt })}</p>{/if}
					</div>
				{/if}
			</div>
			{#if kind === 'break'}
				<div class="grid grid-cols-2 gap-4">
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
				<!-- the slot picker shows its own loading state -->
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
		{#if kind === 'booking' || kind === 'dayOff' || editing}
			<div class="space-y-2">
				<Label for="schedule-notes">{$t(kind === 'dayOff' ? 'schedule.dayOffReason' : 'schedule.notes')} <span class="font-normal text-muted-foreground">{$t('common.optional')}</span></Label>
				<Textarea id="schedule-notes" bind:value={notes} rows={3} maxlength={5000} class="resize-y bg-muted/15 shadow-xs" />
			</div>
		{/if}
		{#if error}<p role="alert" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>{/if}
	</div>

	<div class="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-background px-5 py-3">
		{#if kind === 'details' && !editing}
			<Button variant="outline" type="button" onclick={onDismiss}>{$t('common.close')}</Button>
		{:else}
			{#if kind === 'details'}
				<Button variant="ghost" type="button" class="mr-auto text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={saving} onclick={onCancelBooking}>{$t('schedule.cancelBooking')}</Button>
			{/if}
			<Button variant="outline" type="button" disabled={saving} onclick={onDismiss}>{$t(kind === 'details' ? 'common.close' : 'common.cancel')}</Button>
			<Button type="submit" disabled={saving || (kind === 'details' ? (!timeDirty && !notesDirty) || timeBlocked : needsAvailability && !timeAvailable)}>
				{$t(saving ? 'common.saving' : kind === 'booking' ? 'schedule.newBooking' : 'common.save')}
			</Button>
		{/if}
	</div>
</form>

