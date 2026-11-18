<script lang="ts">
	import { t } from '$lib/i18n';
	import { cn } from '$lib/utils.js';

	let { value = $bindable<number | undefined>(20), id, presets = [10, 15, 20, 30, 45, 60] }: {
		value?: number | undefined;
		id: string;
		presets?: number[];
	} = $props();

	const custom = $derived(value !== undefined && !presets.includes(value));
</script>

<div class="space-y-2">
	<div class="flex flex-wrap gap-1.5" role="group" aria-label={$t('schedule.duration')}>
		{#each presets as minutes (minutes)}
			<button type="button" aria-pressed={value === minutes} onclick={() => (value = minutes)}
				class={cn('h-8 rounded-md border px-2.5 text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary',
					value === minutes ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}>
				{minutes}
			</button>
		{/each}
	</div>
	<div class="flex items-center gap-2">
		<label for={id} class="text-xs text-muted-foreground">{$t('schedule.otherDuration')}</label>
		<input {id} type="number" min="1" max="1440" bind:value inputmode="numeric"
			class={cn('h-8 w-20 rounded-md border bg-background px-2 text-center text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20', custom ? 'border-primary' : 'border-input')} />
		<span class="text-xs text-muted-foreground">{$t('schedule.minuteUnit')}</span>
	</div>
</div>
