<script lang="ts">
	import { Clock3 } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { t } from '$lib/i18n';

	let { value = $bindable('09:00'), id, label }: { value?: string; id: string; label: string } = $props();
	let open = $state(false);
	const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
	const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
	const selectedHour = $derived(value.split(':')[0]);
	const selectedMinute = $derived(value.split(':')[1]);

	function normalize() {
		const parts = value.replace(/^(\d{1,2})(\d{2})$/, '$1:$2').split(':');
		if (parts.length !== 2 || !parts.every((part) => /^\d{1,2}$/.test(part))) return;
		const [hour, minute] = parts.map(Number);
		if (hour < 24 && minute < 60) value = parts.map((part) => part.padStart(2, '0')).join(':');
	}

	function chooseHour(hour: string) {
		value = hour + ':' + (/^\d{2}$/.test(selectedMinute || '') ? selectedMinute : '00');
	}

	function chooseMinute(minute: string) {
		value = (/^\d{2}$/.test(selectedHour || '') ? selectedHour : '09') + ':' + minute;
		open = false;
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
			<span class="rounded-md bg-muted px-2 py-1 text-sm font-medium tabular-nums">{value}</span>
		</div>
		<p class="mb-2 text-xs text-muted-foreground">{$t('schedule.hours')}</p>
		<div class="grid grid-cols-6 gap-1">
			{#each hours as hour (hour)}
				<button type="button" aria-label={$t('schedule.hours') + ' ' + hour} aria-pressed={selectedHour === hour}
					onclick={() => chooseHour(hour)}
					class="rounded-md py-2 text-sm tabular-nums transition-colors {selectedHour === hour ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}">{hour}</button>
			{/each}
		</div>
		<p class="mb-2 mt-4 text-xs text-muted-foreground">{$t('schedule.minutes')}</p>
		<div class="grid grid-cols-6 gap-1">
			{#each minutes as minute (minute)}
				<button type="button" aria-label={$t('schedule.minutes') + ' ' + minute} aria-pressed={selectedMinute === minute}
					onclick={() => chooseMinute(minute)}
					class="rounded-md py-2 text-sm tabular-nums transition-colors {selectedMinute === minute ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}">{minute}</button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
