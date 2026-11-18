<script lang="ts">
	import { locale, setLocale, LOCALES, type LocaleCode, t } from '$lib/i18n';
	import * as Select from '$lib/components/ui/select';
	import { cn } from '$lib/utils.js';

	let {
		class: className = ''
	}: { class?: string } = $props();

	const current = $derived(LOCALES.find((l) => l.code === $locale)?.label ?? $locale);
</script>

<Select.Root type="single" value={$locale} onValueChange={(v) => { if (v) setLocale(v as LocaleCode); }}>
	<Select.Trigger aria-label={$t('common.language')} class={cn('data-[size=default]:h-8 w-auto min-w-28 bg-transparent px-2 text-sm shadow-none', className)}>
		{current}
	</Select.Trigger>
	<Select.Content>
		{#each LOCALES as l (l.code)}
			<Select.Item value={l.code} label={l.label}>{l.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
