<script lang="ts">
	import { clockLabel } from '$lib/datetime';
	import { prefs } from '$lib/prefs';
	import { dayPart, type DayPart } from '$lib/schedule/slots';
	import { t, localeTag } from '$lib/i18n';
	import { cn } from '$lib/utils.js';

	let { value = $bindable(''), starts, id, label }: {
		/** The chosen start as 'HH:MM' (24 h, whatever the display preference is). */
		value?: string;
		/** Bookable start minutes; undefined while availability is still loading. */
		starts?: number[];
		id: string;
		label: string;
	} = $props();

	const toValue = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
	const parts: DayPart[] = ['morning', 'afternoon', 'evening'];
	const grouped = $derived(parts
		.map((part) => ({ part, items: (starts ?? []).filter((minute) => dayPart(minute) === part) }))
		.filter((group) => group.items.length));

	// Free-text fallback for a time that is not offered as a chip (validated by the caller).
	function normalize() {
		const parts = value.replace(/^(\d{1,2})(\d{2})$/, '$1:$2').split(':');
		if (parts.length !== 2 || !parts.every((part) => /^\d{1,2}$/.test(part))) return;
		const [hour, minute] = parts.map(Number);
		if (hour < 24 && minute < 60) value = parts.map((part) => part.padStart(2, '0')).join(':');
	}
</script>

<div class="space-y-2" role="group" aria-label={label}>
	{#if starts === undefined}
		<p role="status" class="py-2 text-sm text-muted-foreground">{$t('schedule.checkingAvailability')}</p>
	{:else if grouped.length === 0}
		<p class="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">{$t('schedule.slots.none')}</p>
	{:else}
		<div class="max-h-44 space-y-2.5 overflow-y-auto pr-1">
			{#each grouped as group (group.part)}
				<div>
					<p class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{$t('schedule.slots.' + group.part)}</p>
					<div class="grid grid-cols-4 gap-1.5">
						{#each group.items as minute (minute)}
							{@const chosen = value === toValue(minute)}
							<button type="button" aria-pressed={chosen} onclick={() => (value = toValue(minute))}
								class={cn('h-8 rounded-md border text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary',
									chosen ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}>
								{clockLabel(minute, $prefs, $localeTag)}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
	<div class="flex items-center gap-2">
		<label for={id} class="text-xs text-muted-foreground">{$t('schedule.otherTime')}</label>
		<input {id} bind:value onblur={normalize} type="text" inputmode="numeric" maxlength="5" placeholder="09:00" autocomplete="off"
			class="h-8 w-20 rounded-md border border-input bg-background px-2 text-center text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
	</div>
</div>
