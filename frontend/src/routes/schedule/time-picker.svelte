<script lang="ts">
	import { Clock3 } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { t } from '$lib/i18n';

	let { value = $bindable('09:00'), id, label, allowedMinutes }: {
		value?: string;
		id: string;
		label: string;
		allowedMinutes?: ReadonlySet<number>;
	} = $props();
	let open = $state(false);
	const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
	const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
	const selectedHour = $derived(value.split(':')[0]);
	const selectedMinute = $derived(value.split(':')[1]);
	const allowedHours = $derived(allowedMinutes === undefined ? undefined : new Set([...allowedMinutes].map((minute) => Math.floor(minute / 60))));

	function minuteAllowed(hour: string, minute: string) {
		return allowedMinutes === undefined || allowedMinutes.has(Number(hour) * 60 + Number(minute));
	}

	function normalize() {
		const parts = value.replace(/^(\d{1,2})(\d{2})$/, '$1:$2').split(':');
		if (parts.length !== 2 || !parts.every((part) => /^\d{1,2}$/.test(part))) return;
		const [hour, minute] = parts.map(Number);
		if (hour < 24 && minute < 60) value = parts.map((part) => part.padStart(2, '0')).join(':');
	}

	function chooseHour(hour: string) {
		let minute = /^\d{2}$/.test(selectedMinute || '') ? selectedMinute : '00';
		if (!minuteAllowed(hour, minute)) {
			const first = [...(allowedMinutes ?? [])].find((candidate) => Math.floor(candidate / 60) === Number(hour));
			if (first === undefined) return;
			minute = String(first % 60).padStart(2, '0');
		}
		value = hour + ':' + minute;
	}

	function chooseMinute(minute: string) {
		value = (/^\d{2}$/.test(selectedHour || '') ? selectedHour : '09') + ':' + minute;
		open = false;
	}

	function confirmCustom(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		normalize();
		if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) && minuteAllowed(selectedHour, selectedMinute)) open = false;
	}
</script>

<Popover.Root bind:open>
	<div class="flex h-11 items-center overflow-hidden rounded-lg border border-input bg-muted/15 shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
		<input {id} aria-label={label} bind:value onblur={normalize} type="text" inputmode="numeric" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
			maxlength="5" placeholder="09:00" required
			class="h-full min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums outline-none" />
		<Popover.Trigger class="grid h-full w-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			aria-label={$t('schedule.pickTime') + ' · ' + label}>
			<Clock3 class="size-4" />
		</Popover.Trigger>
	</div>
	<Popover.Content class="w-[300px] rounded-xl p-4 shadow-lg" align="start">
		<div class="mb-3 flex items-center justify-between">
			<span class="text-sm font-medium">{label}</span>
			<input aria-label={$t('schedule.customTime')} bind:value onblur={normalize} onkeydown={confirmCustom}
				type="text" inputmode="numeric" maxlength="5" placeholder="09:00"
				class="h-9 w-20 rounded-md border border-input bg-muted/30 px-2 text-center text-sm font-medium tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
		</div>
		<p class="mb-2 text-xs text-muted-foreground">{$t('schedule.hours')}</p>
		<div class="grid grid-cols-6 gap-1">
			{#each hours as hour (hour)}
				<button type="button" aria-label={$t('schedule.hours') + ' ' + hour} aria-pressed={selectedHour === hour}
					disabled={allowedHours !== undefined && !allowedHours.has(Number(hour))}
					onclick={() => chooseHour(hour)}
					class="rounded-md py-2 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-25 {selectedHour === hour ? 'bg-primary text-primary-foreground' : 'enabled:hover:bg-accent'}">{hour}</button>
			{/each}
		</div>
		<p class="mb-2 mt-4 text-xs text-muted-foreground">{$t('schedule.minutes')}</p>
		<div class="grid grid-cols-6 gap-1">
			{#each minutes as minute (minute)}
				<button type="button" aria-label={$t('schedule.minutes') + ' ' + minute} aria-pressed={selectedMinute === minute}
					disabled={!/^\d{2}$/.test(selectedHour) || !minuteAllowed(selectedHour, minute)}
					onclick={() => chooseMinute(minute)}
					class="rounded-md py-2 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-25 {selectedMinute === minute ? 'bg-primary text-primary-foreground' : 'enabled:hover:bg-accent'}">{minute}</button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
