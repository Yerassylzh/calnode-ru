<script lang="ts">
	import { clockLabel } from '$lib/datetime';
	import { prefs } from '$lib/prefs';
	import { t, localeTag } from '$lib/i18n';
	import { cn } from '$lib/utils.js';

	let { value = $bindable(''), starts, max = 8 }: {
		/** The chosen start as 'HH:MM'. */
		value?: string;
		/** Bookable start minutes; undefined while availability is loading. */
		starts?: number[];
		max?: number;
	} = $props();

	const toValue = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
	const current = $derived(/^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : undefined);

	// A short row of the free times closest to what is typed (or the first ones of the day).
	const nearby = $derived.by(() => {
		if (!starts?.length) return [];
		const ordered = current === undefined ? starts : [...starts].sort((a, b) => Math.abs(a - current) - Math.abs(b - current));
		return ordered.slice(0, max).sort((a, b) => a - b);
	});
</script>

{#if starts === undefined}
	<p role="status" class="text-xs text-muted-foreground">{$t('schedule.checkingAvailability')}</p>
{:else if nearby.length === 0}
	<p class="text-xs text-muted-foreground">{$t('schedule.slots.none')}</p>
{:else}
	<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label={$t('schedule.slots.nearby')}>
		{#each nearby as minute (minute)}
			{@const chosen = value === toValue(minute)}
			<button type="button" aria-pressed={chosen} onclick={() => (value = toValue(minute))}
				class={cn('h-7 rounded-md border px-2.5 text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary',
					chosen ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}>
				{clockLabel(minute, $prefs, $localeTag)}
			</button>
		{/each}
	</div>
{/if}
