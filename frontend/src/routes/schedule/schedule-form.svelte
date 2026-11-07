<script lang="ts">
	import { parseDateTime, toZoned } from '@internationalized/date';
	import { api, type Booking, type DoctorBreak } from '$lib/api';
	import { localeTag, t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { kind, staffID, timezone, initialDate, initialTime, target, onSaved, onSwitchToBreak }: {
		kind: 'booking' | 'break' | 'reschedule' | 'removeBreak';
		staffID: string;
		timezone: string;
		initialDate: string;
		initialTime: string;
		target?: Booking | DoctorBreak;
		onSaved: () => void;
		onSwitchToBreak: (date: string, start: string) => void;
	} = $props();

	let date = $state('');
	let start = $state('');
	let end = $state('');
	let title = $state('');
	let duration = $state<number | undefined>(20);
	let name = $state('');
	let contactMethod = $state<'phone' | 'email'>('email');
	let contact = $state('');
	let saving = $state(false);
	let error = $state('');
	let lastPayload = '';
	let idempotencyKey = '';

	$effect(() => {
		date = initialDate;
		start = initialTime;
		const [hour, minute] = initialTime.split(':').map(Number);
		const endMinutes = Math.min(1439, hour * 60 + minute + 30);
		end = [Math.floor(endMinutes / 60), endMinutes % 60].map((value) => String(value).padStart(2, '0')).join(':');
		error = '';
	});

	function startAt() {
		return toZoned(parseDateTime(date + 'T' + start), timezone, 'reject').toDate().toISOString();
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		saving = true;
		error = '';
		try {
			if (kind === 'break') {
				await api.post('/v1/doctor-breaks', {
					user_id: staffID, kind: 'date', date, start_time: start, end_time: end,
					title: title.trim() || $t('doctorBreaks.defaultTitle')
				});
			} else if (kind === 'removeBreak' && target) {
				await api.del('/v1/doctor-breaks/' + encodeURIComponent(target.id));
			} else if (kind === 'reschedule' && target) {
				await api.patch('/v1/bookings/' + encodeURIComponent(target.id) + '/reschedule', { start_at: startAt() });
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
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={save} class="space-y-4">
	{#if kind === 'removeBreak'}
		<p class="text-sm text-muted-foreground">{$t(target && 'kind' in target && target.kind === 'weekly' ? 'schedule.removeRecurringBreakHelp' : 'schedule.removeBreakHelp')}</p>
	{:else}
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1.5">
				<Label for="schedule-date">{$t('schedule.date')}</Label>
				<Input id="schedule-date" type="date" bind:value={date} required />
			</div>
			<div class="space-y-1.5">
				<Label for="schedule-start">{$t('schedule.start')}</Label>
				<Input id="schedule-start" type="time" bind:value={start} required />
			</div>
		</div>
		{#if kind === 'break'}
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="schedule-end">{$t('schedule.end')}</Label>
					<Input id="schedule-end" type="time" bind:value={end} required />
				</div>
				<div class="space-y-1.5">
					<Label for="schedule-break-title">{$t('schedule.breakTitle')}</Label>
					<Input id="schedule-break-title" bind:value={title} placeholder={$t('doctorBreaks.defaultTitle')} />
				</div>
			</div>
		{:else if kind === 'booking'}
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="schedule-attendee">{$t('schedule.attendee')}</Label>
					<Input id="schedule-attendee" bind:value={name} required />
				</div>
				<div class="space-y-1.5">
					<Label for="schedule-duration">{$t('schedule.duration')}</Label>
					<Input id="schedule-duration" type="number" min="1" max="1440" bind:value={duration} required />
				</div>
			</div>
			<div class="grid grid-cols-[auto_1fr] gap-3">
				<div class="space-y-1.5">
					<Label for="schedule-contact-method">{$t('schedule.contactMethod')}</Label>
					<select id="schedule-contact-method" class="h-8 rounded-md border border-input bg-background px-2 text-sm"
						bind:value={contactMethod} onchange={() => contact = ''}>
						<option value="email">{$t('schedule.email')}</option>
						<option value="phone">{$t('schedule.phone')}</option>
					</select>
				</div>
				<div class="space-y-1.5">
					<Label for="schedule-contact">{$t(contactMethod === 'email' ? 'schedule.email' : 'schedule.phone')}</Label>
					<Input id="schedule-contact" type={contactMethod === 'email' ? 'email' : 'tel'} bind:value={contact} required />
				</div>
			</div>
		{/if}
	{/if}
	{#if error}<p role="alert" class="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>{/if}
	<div class="flex flex-wrap justify-end gap-2">
		{#if kind === 'booking'}
			<Button variant="outline" disabled={saving} onclick={() => onSwitchToBreak(date, start)}>{$t('schedule.addBreak')}</Button>
		{/if}
		<Button type="submit" variant={kind === 'removeBreak' ? 'destructive' : 'default'} disabled={saving}>
			{$t(saving ? 'common.saving' : kind === 'removeBreak' ? 'common.delete' : 'common.save')}
		</Button>
	</div>
</form>

