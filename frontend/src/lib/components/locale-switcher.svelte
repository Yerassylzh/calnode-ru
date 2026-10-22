<script lang="ts">
	import { locale, setLocale, LOCALES, type LocaleCode } from '$lib/i18n';
	import { t } from '$lib/i18n';

	let {
		class: className = ''
	}: { class?: string } = $props();
</script>

<select
	aria-label={$t('common.language')}
	class={`h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
	value={$locale}
	onchange={(e) => setLocale(e.currentTarget.value as LocaleCode)}
>
	{#each LOCALES as l (l.code)}
		<option value={l.code}>{l.label}</option>
	{/each}
</select>
