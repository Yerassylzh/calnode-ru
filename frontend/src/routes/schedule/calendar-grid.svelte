<script lang="ts" module>
	import type { CalendarDate } from '@internationalized/date';
	import type { Booking, DoctorBreak, ScheduleDay } from '$lib/api';
	import type { Span } from '$lib/schedule/layout';

	export type GridBlock = {
		id: string;
		start: number;
		end: number;
		label: string;
		kind: 'booking' | 'break';
		status?: string;
		phone?: string;
		item: Booking | DoctorBreak;
	};
	export type GridColumn = { day: CalendarDate; free: Span[]; blocks: GridBlock[]; off?: ScheduleDay };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { today } from '@internationalized/date';
	import { CalendarOff } from '@lucide/svelte';
	import { clockLabel, hourLabel } from '$lib/datetime';
	import { prefs } from '$lib/prefs';
	import { t, localeTag } from '$lib/i18n';
	import { anchorFromRect, type Anchor } from './event-surface.svelte';
	import { complementSpans, initialScrollMinute, packColumns, snapInSpan } from '$lib/schedule/layout';

	let {
		columns,
		timezone,
		pulse,
		noHours = false,
		hourPx = 64,
		single = false,
		onSlot,
		onBlock,
		onDayOff,
		onDayClick
	}: {
		columns: GridColumn[];
		timezone: string;
		pulse: Set<string>;
		/** No working hours at all this week: the page shows one banner, so columns stay quiet. */
		noHours?: boolean;
		hourPx?: number;
		/** One day wide (day view): headers are not links and the grid has no minimum width. */
		single?: boolean;
		onSlot: (day: CalendarDate, minute: number, anchor: Anchor) => void;
		onBlock: (day: CalendarDate, block: GridBlock, anchor: Anchor) => void;
		onDayOff: (off: ScheduleDay) => void;
		onDayClick: (day: CalendarDate) => void;
	} = $props();

	const px = (minutes: number) => (minutes / 60) * hourPx;
	const bodyHeight = $derived(24 * hourPx);
	const label = (minutes: number) => clockLabel(minutes, $prefs, $localeTag);
	const weekday = (day: CalendarDate, options: Intl.DateTimeFormatOptions) =>
		day.toDate('UTC').toLocaleDateString($localeTag, { ...options, timeZone: 'UTC' });

	let scroller: HTMLDivElement | undefined = $state();
	let nowTick = $state(Date.now());
	const todayKey = $derived.by(() => {
		nowTick;
		return today(timezone).toString();
	});
	const nowMinute = $derived.by(() => {
		const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
			.format(new Date(nowTick)).split(':').map(Number);
		return parts[0] * 60 + parts[1];
	});

	// Free time is the page background; what is neither free nor busy is "closed" and is hatched.
	const prepared = $derived(columns.map((column) => ({
		...column,
		closed: complementSpans([...column.free, ...column.blocks]),
		placed: packColumns(column.blocks)
	})));

	onMount(() => {
		const spans = columns.flatMap((column) => [...column.free, ...column.blocks]);
		if (scroller) scroller.scrollTop = px(initialScrollMinute(spans));
		const timer = setInterval(() => (nowTick = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	let ghost = $state<{ column: number; start: number; end: number } | null>(null);

	function minuteAt(event: { clientY: number }, element: HTMLElement, span: Span) {
		const rect = element.getBoundingClientRect();
		return snapInSpan(span.start + ((event.clientY - rect.top) / hourPx) * 60, span);
	}

	function hover(event: PointerEvent, column: number, span: Span) {
		if (event.pointerType === 'touch') return;
		const start = minuteAt(event, event.currentTarget as HTMLElement, span);
		ghost = { column, start, end: Math.min(span.end, start + 30) };
	}

	function pick(event: MouseEvent, day: CalendarDate, span: Span) {
		ghost = null;
		// detail 0 = keyboard activation: there is no pointer position, so use the span start.
		const element = event.currentTarget as HTMLElement;
		const start = event.detail ? minuteAt(event, element, span) : span.start;
		const rect = element.getBoundingClientRect();
		onSlot(day, start, anchorFromRect(new DOMRect(rect.left, rect.top + px(start - span.start), rect.width, px(30))));
	}

	function tone(block: GridBlock) {
		if (block.kind === 'break') return 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100';
		if (block.status === 'cancelled') return 'border-muted-foreground/40 bg-muted text-muted-foreground line-through';
		if (block.status === 'rescheduled') return 'border-violet-500 bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100';
		return 'border-blue-500 bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100';
	}
</script>

<div bind:this={scroller} class="relative min-h-0 flex-1 overflow-auto">
	<div class="grid" style:grid-template-columns={`56px repeat(${columns.length}, minmax(0, 1fr))`} style:min-width={single ? undefined : '760px'}>
		<div class="sticky left-0 top-0 z-40 h-11 border-b bg-card"></div>
		{#each prepared as column (column.day.toString())}
			{@const isToday = column.day.toString() === todayKey}
			{#snippet dayLabel()}
				<span class="grid size-7 place-items-center rounded-full text-sm font-semibold {isToday ? 'bg-primary text-primary-foreground' : ''}">{column.day.day}</span>
				<span class="text-xs font-medium text-muted-foreground">{weekday(column.day, { weekday: 'short' })}</span>
			{/snippet}
			{#if single}
				<div class="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-l px-3 {isToday ? 'bg-primary/5' : 'bg-card'}">{@render dayLabel()}</div>
			{:else}
				<button type="button" onclick={() => onDayClick(column.day)}
					class="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-l px-3 text-left transition-colors hover:bg-accent/60 {isToday ? 'bg-primary/5' : 'bg-card'}"
					aria-label={weekday(column.day, { weekday: 'long', day: 'numeric', month: 'long' })}>{@render dayLabel()}</button>
			{/if}
		{/each}

		<!-- Hour gutter -->
		<div class="sticky left-0 z-20 border-r bg-card" style:height={bodyHeight + 'px'}>
			{#each Array.from({ length: 23 }, (_, i) => i + 1) as hour (hour)}
				<span class="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground" style:top={px(hour * 60) + 'px'}>{hourLabel(hour * 60, $prefs, $localeTag)}</span>
			{/each}
		</div>

		{#each prepared as column, ci (column.day.toString())}
			<div class="relative border-l" style:height={bodyHeight + 'px'}>
				{#each column.closed as span (span.start)}
					<div class="calendar-closed pointer-events-none absolute inset-x-0" style:top={px(span.start) + 'px'} style:height={px(span.end - span.start) + 'px'}></div>
				{/each}

				{#each column.free as span (span.start)}
					<button type="button"
						class="absolute inset-x-0 z-[1] cursor-cell transition-colors hover:bg-primary/[0.04] focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
						style:top={px(span.start) + 'px'} style:height={px(span.end - span.start) + 'px'}
						aria-label={$t('schedule.free') + ' · ' + label(span.start) + '–' + label(span.end)}
						onpointermove={(event) => hover(event, ci, span)}
						onpointerleave={() => (ghost = null)}
						onclick={(event) => pick(event, column.day, span)}></button>
				{/each}

				<!-- Hour and half-hour rules, above the hatching but under the blocks. -->
				<div class="pointer-events-none absolute inset-0 z-[5]"
					style:background-image="linear-gradient(to bottom, var(--border) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 40%, transparent) 1px, transparent 1px)"
					style:background-size={`100% ${hourPx}px, 100% ${hourPx}px`}
					style:background-position={`0 0, 0 ${hourPx / 2}px`}></div>

				{#if !noHours && column.off}
					<div class="sticky top-14 z-20 px-1.5 pt-1.5">
						{#if column.off.override_id}
							{@const off = column.off}
							<button type="button" onclick={() => onDayOff(off)}
								class="w-full rounded-lg border border-dashed bg-card/90 px-2 py-2 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:bg-card">
								<span class="flex items-center gap-1.5 font-medium"><CalendarOff class="size-3.5 shrink-0" />{$t('schedule.dayOff')}</span>
								{#if off.notes}<span class="mt-1 block line-clamp-3 break-words" title={off.notes}>{off.notes}</span>{/if}
							</button>
						{:else}
							<p class="flex items-center justify-center gap-1.5 rounded-md bg-card/80 px-2 py-1 text-xs text-muted-foreground"><CalendarOff class="size-3.5" />{$t('schedule.closed')}</p>
						{/if}
					</div>
				{/if}

				{#each column.placed as placed (placed.item.kind + placed.item.id)}
					{@const block = placed.item}
					{@const height = Math.max(px(block.end - block.start) - 2, 18)}
					<button type="button" onclick={(event) => onBlock(column.day, block, anchorFromRect((event.currentTarget as HTMLElement).getBoundingClientRect()))}
						class="absolute z-10 flex flex-col items-start overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs leading-tight shadow-sm ring-1 ring-inset ring-black/5 transition hover:brightness-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-primary {tone(block)} {block.kind === 'booking' && pulse.has(block.id) ? 'live-flash' : ''}"
						style:top={px(block.start) + 1 + 'px'} style:height={height + 'px'}
						style:left={`calc(${(placed.col / placed.cols) * 100}% + 2px)`} style:width={`calc(${100 / placed.cols}% - 4px)`}
						title={block.label + ' · ' + label(block.start) + '–' + label(block.end)}
						aria-label={block.label + ' · ' + label(block.start) + '–' + label(block.end)}>
						<span class="block w-full truncate font-medium">{block.label}</span>
						{#if height >= 34}<span class="block w-full truncate text-[11px] tabular-nums opacity-75">{label(block.start)}–{label(block.end)}</span>{/if}
						{#if height >= 52 && block.phone}<span class="block w-full truncate text-[11px] tabular-nums opacity-75">{block.phone}</span>{/if}
					</button>
				{/each}

				{#if ghost && ghost.column === ci}
					<div class="pointer-events-none absolute inset-x-1 z-[8] overflow-hidden rounded-md border border-dashed border-primary/60 bg-primary/10 px-1.5 py-0.5 text-xs leading-tight text-primary"
						style:top={px(ghost.start) + 'px'} style:height={Math.max(px(ghost.end - ghost.start) - 1, 18) + 'px'}>
						<span class="block truncate font-medium tabular-nums">{label(ghost.start)}</span>
						<span class="block truncate opacity-80">{$t('schedule.newBooking')}</span>
					</div>
				{/if}

				{#if column.day.toString() === todayKey}
					<div class="pointer-events-none absolute inset-x-0 z-[15]" style:top={px(nowMinute) + 'px'} aria-hidden="true">
						<div class="h-px bg-red-500"></div>
						<span class="absolute -left-1 -top-[3px] size-[7px] rounded-full bg-red-500"></span>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
