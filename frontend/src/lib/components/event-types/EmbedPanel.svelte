<script lang="ts">
	import { page } from '$app/stores';
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';

	let { slug }: { slug: string } = $props();

	// The widget derives its API base from the script's own origin, so the
	// instance origin is all the snippet needs.
	const embedOrigin = $derived($page.url.origin);
	const inlineSnippet = $derived(
		`<script src="${embedOrigin}/embed.js" async><\/script>\n<calnode-booking slug="${slug}"></calnode-booking>`
	);
	const popupSnippet = $derived(
		`<script src="${embedOrigin}/embed.js" async><\/script>\n<button data-calnode-popup="${slug}">Book a call</button>`
	);
	let copied = $state('');
	function copyEmbed(kind: string, text: string) {
		navigator.clipboard.writeText(text).then(() => {
			copied = kind;
			setTimeout(() => { if (copied === kind) copied = ''; }, 1500);
		}).catch(() => toast.error($t('embedPanel.clipboardError')));
	}
</script>

<!-- Embed -->
<div class="mt-8">
	<h2 class="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{$t('embedPanel.heading')}</h2>
	<p class="mb-3 text-sm text-muted-foreground">{$t('embedPanel.intro')} <code>&lt;/body&gt;</code>.</p>
	<div class="space-y-5 rounded-lg border bg-card p-6">
		{#each [{ key: 'inline', label: $t('embedPanel.inline.label'), hint: $t('embedPanel.inline.hint'), code: inlineSnippet }, { key: 'popup', label: $t('embedPanel.popup.label'), hint: $t('embedPanel.popup.hint'), code: popupSnippet }] as snip}
			<div>
				<div class="mb-1.5 flex items-center justify-between">
					<div>
						<span class="text-sm font-medium">{snip.label}</span>
						<span class="ml-2 text-xs text-muted-foreground">{snip.hint}</span>
					</div>
					<Button variant="outline" size="sm" onclick={() => copyEmbed(snip.key, snip.code)}>
						{copied === snip.key ? $t('embedPanel.copied') : $t('common.copy')}
					</Button>
				</div>
				<pre class="overflow-x-auto rounded-md bg-muted px-3 py-2.5 text-xs leading-relaxed"><code>{snip.code}</code></pre>
			</div>
		{/each}
		<p class="text-xs text-muted-foreground">{$t('embedPanel.apiNote')} <code>EMBED_ALLOWED_ORIGINS</code>.</p>
	</div>
</div>
