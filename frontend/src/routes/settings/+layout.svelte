<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { currentUser } from '$lib/stores';
	import { t } from '$lib/i18n';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	// $derived so nav labels follow the active locale reactively.
	const navItems = $derived([
		{ section: $t('settingsLayout.section.account'), href: `${base}/settings/profile`, label: $t('settingsLayout.nav.profile') },
		{ section: $t('settingsLayout.section.account'), href: `${base}/settings/notifications`, label: $t('settingsLayout.nav.notifications') },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/branding`, label: $t('settingsLayout.nav.branding'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/email`, label: $t('settingsLayout.nav.email'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/google`, label: $t('settingsLayout.nav.googleOAuth'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/zoom`, label: $t('settingsLayout.nav.zoom'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/video`, label: $t('settingsLayout.nav.video'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/storage`, label: $t('settingsLayout.nav.storage'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/payments`, label: $t('settingsLayout.nav.payments'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/ai`, label: $t('settingsLayout.nav.ai'), adminOnly: true },
		{ section: $t('settingsLayout.section.workspace'), href: `${base}/settings/tracking`, label: $t('settingsLayout.nav.tracking'), adminOnly: true },
	]);

	const visibleNavItems = $derived(navItems.filter((item) => !item.adminOnly || $currentUser?.is_admin));
</script>

<svelte:head><title>{$t('settingsLayout.pageTitle')}</title></svelte:head>

<div class="mb-8">
	<h1 class="text-2xl font-semibold tracking-tight">{$t('settingsLayout.heading')}</h1>
	<p class="mt-1 text-sm text-muted-foreground">{$t('settingsLayout.subtitle')}</p>
</div>

<div class="flex gap-8">
	<nav class="w-44 shrink-0">
		<ul class="space-y-0.5">
			{#each visibleNavItems as item, i}
				{#if item.section !== visibleNavItems[i - 1]?.section}
					<li class="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 first:mt-0 mt-4">
						{item.section}
					</li>
				{/if}
				{@const active = $page.url.pathname.startsWith(item.href)}
				<li>
					<a
						href={item.href}
						class="block rounded-md px-3 py-2 text-sm font-medium transition-colors
							{active
								? 'bg-accent text-accent-foreground'
								: 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'}"
					>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
