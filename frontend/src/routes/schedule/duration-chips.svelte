<script lang="ts">
	import { t } from '$lib/i18n';
	import { cn } from '$lib/utils.js';

	let { value = $bindable<number | undefined>(20), id, endsAt = '', presets = [10, 15, 20, 30, 45, 60] }: {
		value?: number | undefined;
		id: string;
		/** 'HH:MM' the booking would end at, shown on the right. */
		endsAt?: string;
		presets?: number[];
	} = $props();

	const custom = $derived(value !== undefined && !presets.includes(value));
</script>

<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label={$t('schedule.duration')}>
	{#each presets as minutes (minutes)}
		<button type="button" aria-pressed={value === minutes} onclick={() => (value = minutes)}
			class={cn('h-8 rounded-md border px-2.5 text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary',
				value === minutes ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}>
			{minutes}
		</button>
	{/each}
	<input {id} type="number" min="1" max="1440" bind:value inputmode="numeric" aria-label={$t('schedule.otherDuration')} placeholder={$t('schedule.otherDuration')}
		class={cn('h-8 w-16 rounded-md border bg-background px-2 text-center text-sm tabular-nums outline-none placeholder:text-xs focus:border-ring focus:ring-2 focus:ring-ring/20', custom ? 'border-primary' : 'border-input')} />
	{#if endsAt}<span class="ml-auto text-xs tabular-nums text-muted-foreground">{$t('schedule.endsAt', { time: endsAt })}</span>{/if}
</div>
