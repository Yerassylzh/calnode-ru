<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div data-slot="skeleton" class={cn('animate-pulse rounded-md bg-accent', className)} {...restProps}></div>
