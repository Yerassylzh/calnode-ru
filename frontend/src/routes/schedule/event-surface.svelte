<script lang="ts" module>
	/** Anything with a bounding rect: a block element, or a rect snapshot for an empty slot. */
	export type Anchor = { getBoundingClientRect(): DOMRect };

	/** Snapshot a rect so the popover does not chase an element the live refresh has replaced. */
	export const anchorFromRect = (rect: DOMRect): Anchor => ({ getBoundingClientRect: () => rect });
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { X } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { t } from '$lib/i18n';

	let {
		open,
		anchor = null,
		title,
		description = '',
		onRequestClose,
		locked = false,
		children
	}: {
		open: boolean;
		/** Where the click happened. Without one (header button, keyboard) the surface is a dialog. */
		anchor?: Anchor | null;
		title: string;
		description?: string;
		/** Every dismiss path (Escape, outside click, X) lands here so the caller can guard unsaved edits. */
		onRequestClose: () => void;
		/** A confirmation is open on top: clicks there are not "outside" the surface. */
		locked?: boolean;
		children: Snippet;
	} = $props();

	// Anchored popover on desktop; bottom-sheet style dialog on phones or when there is no anchor.
	let wide = $state(true);
	onMount(() => {
		const query = window.matchMedia('(min-width: 640px)');
		const update = () => (wide = query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});
	const anchored = $derived(!!anchor && wide);

	// The click that opens an anchored popover can still be finishing (pointerup/click land after
	// it mounts) and would read as an outside interaction; ignore dismissals for a beat after open.
	let openedAt = 0;
	$effect(() => {
		if (open) openedAt = performance.now();
	});
	function dismiss(next: boolean) {
		if (!next && !locked && performance.now() - openedAt > 300) onRequestClose();
	}
</script>

{#if anchored}
	<Popover.Root {open} onOpenChange={dismiss}>
		<Popover.Content
			customAnchor={anchor}
			side="right"
			align="start"
			sideOffset={8}
			collisionPadding={12}
			aria-label={title}
			class="max-h-[min(85dvh,720px)] w-[420px] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl p-0 shadow-xl"
		>
			<div class="flex items-start justify-between gap-3 border-b px-5 py-3.5">
				<div class="min-w-0">
					<h2 class="text-base font-semibold leading-tight">{title}</h2>
					{#if description}<p class="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>{/if}
				</div>
				<Button variant="ghost" size="icon" class="-mr-2 size-8 shrink-0" aria-label={$t('common.close')} onclick={onRequestClose}><X class="size-4" /></Button>
			</div>
			{@render children()}
		</Popover.Content>
	</Popover.Root>
{:else}
	<Dialog.Root {open} onOpenChange={dismiss}>
		<Dialog.Content class="max-h-[90dvh] gap-0 overflow-y-auto rounded-2xl p-0 max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-[480px]">
			<Dialog.Header class="border-b px-5 py-4 pr-12">
				<Dialog.Title>{title}</Dialog.Title>
				<Dialog.Description class={description ? '' : 'sr-only'}>{description || title}</Dialog.Description>
			</Dialog.Header>
			{@render children()}
		</Dialog.Content>
	</Dialog.Root>
{/if}
