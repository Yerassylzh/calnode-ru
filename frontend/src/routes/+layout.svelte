<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import '../app.css';
	import { api, type User } from '$lib/api';
	import { currentUser, authStatus, type AuthStatus } from '$lib/stores';
	import { prefs, prefsFromUser } from '$lib/prefs';
	import { Toaster } from '$lib/components/ui/sonner';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import DemoBanner from '$lib/components/demo-banner.svelte';
	import LocaleSwitcher from '$lib/components/locale-switcher.svelte';
	import { t } from '$lib/i18n';
	import { CalendarDays, Clock, KeyRound, List, LogOut, Menu, MessageSquareWarning, PanelLeftClose, PanelLeftOpen, Settings, Users, Video } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let checking = $state(true);
	let reportOpen = $state(false);
	let scheduleMenuOpen = $state(false);
	// Desktop-only icon rail, remembered per browser. The phone menu always shows full labels.
	let collapsed = $state(false);
	function toggleCollapsed() {
		collapsed = !collapsed;
		try { localStorage.setItem('calnode.sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* storage unavailable */ }
	}
	let recordingsConfigured = $state(false);
	let version = $state('');

	const ISSUES_URL = 'https://github.com/Calnode/calnode/issues';
	const NEW_ISSUE_URL = 'https://github.com/Calnode/calnode/issues/new/choose';
	const RELEASES_URL = 'https://github.com/Calnode/calnode/releases';

	const isLogin = $derived($page.route.id === '/login');
	const isSchedule = $derived($page.route.id === '/');
	const isPublicRoute = $derived(
		$page.route.id === '/login' ||
		$page.route.id === '/claim' ||
		$page.route.id === '/forgot-password' ||
		$page.route.id === '/reset-password' ||
		$page.route.id === '/invite/[token]'
	);

	// Primary navigation. `group` only controls where dividers go; there are no section
	// headers - the list is short enough not to need them.
	type NavItem = {
		id: string;
		href: string;
		icon: typeof CalendarDays;
		labelKey: string;
		group: number;
		adminOnly?: boolean;
		requiresFeature?: 'recordings';
	};

	const navItems: NavItem[] = [
		{ id: 'calendar', href: `${base}/`, icon: CalendarDays, labelKey: 'layout.nav.calendar', group: 0 },
		{ id: 'bookings', href: `${base}/bookings`, icon: List, labelKey: 'layout.nav.bookings', group: 0 },
		{ id: 'availability', href: `${base}/availability`, icon: Clock, labelKey: 'layout.nav.availability', group: 0 },
		{ id: 'members', href: `${base}/members`, icon: Users, labelKey: 'layout.nav.members', group: 1, adminOnly: true },
		{ id: 'recordings', href: `${base}/recordings`, icon: Video, labelKey: 'layout.nav.recordings', group: 1, adminOnly: true, requiresFeature: 'recordings' },
		{ id: 'api-keys', href: `${base}/api-keys`, icon: KeyRound, labelKey: 'layout.nav.apiKeys', group: 1 },
		{ id: 'settings', href: `${base}/settings`, icon: Settings, labelKey: 'layout.nav.settings', group: 2 }
	];

	const visibleNavItems = $derived(
		navItems.filter(
			(item) =>
				(!item.adminOnly || $currentUser?.is_admin) &&
				(item.requiresFeature !== 'recordings' || recordingsConfigured)
		)
	);

	function isActive(item: NavItem, pathname: string) {
		if (item.id === 'calendar') return pathname === base || pathname === base + '/';
		return pathname === item.href || pathname.startsWith(item.href + '/');
	}

	onMount(async () => {
		try { collapsed = localStorage.getItem('calnode.sidebar') === 'collapsed'; } catch { /* storage unavailable */ }
		if (isPublicRoute) {
			checking = false;
			return;
		}
		try {
			const me = await api.get<User>('/v1/users/me');
			currentUser.set(me);
			prefs.set(prefsFromUser(me));
			if (me.is_admin) {
				try {
					const lk = await api.get<{ configured: boolean }>('/v1/settings/livekit');
					recordingsConfigured = lk.configured;
				} catch {
					// Non-critical — Recordings just stays hidden from nav.
				}
			}
		} catch {
			window.location.href = '/admin/login';
			return;
		}
		try {
			authStatus.set(await api.get<AuthStatus>('/v1/auth/status'));
		} catch {
			// Non-critical — the demo banner and calendar/Zoom hiding just won't show.
		}
		try {
			const v = await api.get<{ version: string }>('/version');
			version = v.version;
		} catch {
			// Non-critical - the sidebar version link just won't show.
		}
		checking = false;
	});

	async function logout() {
		await fetch('/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
		window.location.href = '/admin/login';
	}

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<Toaster position="bottom-right" />

{#if isPublicRoute}
	<div class="fixed right-3 top-3 z-50">
		<LocaleSwitcher />
	</div>
	{@render children()}
{:else if checking}
	<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
		{$t('layout.loading')}
	</div>
{:else}
	<div class="flex h-full flex-col">
	{#if $authStatus.demo_mode}
		<DemoBanner />
	{/if}
	{#if isSchedule}
		<div class="border-b bg-sidebar p-2 sm:hidden">
			<button type="button" class={buttonVariants({ variant: 'outline' })}
				aria-controls="admin-sidebar" aria-expanded={scheduleMenuOpen}
				onclick={() => (scheduleMenuOpen = !scheduleMenuOpen)}>
				<Menu class="size-4" />{$t('doctorBreaks.menu')}
			</button>
		</div>
	{/if}
	<div class="relative flex flex-1 overflow-hidden">
		<!-- Sidebar -->
		<aside id="admin-sidebar" class="w-56 shrink-0 flex-col transition-[width] {collapsed ? 'sm:w-14' : ''} border-r border-sidebar-border bg-sidebar {isSchedule
			? (scheduleMenuOpen ? 'absolute inset-y-0 left-0 z-10 flex overflow-y-auto shadow-lg sm:static sm:shadow-none' : 'hidden sm:flex')
			: 'flex'}">
			<!-- User section -->
			<a href="{base}/settings/profile" class="flex items-center gap-3 border-b border-sidebar-border px-4 py-3 transition-colors hover:bg-sidebar-accent/60 {collapsed ? 'sm:justify-center sm:px-0' : ''}"
				title={collapsed ? ($currentUser?.name ?? '') : undefined}>
				<!-- Fixed-size clip container: the image fills it and is clipped by the
				     parent's overflow-hidden (not its own border-radius). A rounded,
				     object-cover image on its own composited layer gets mis-painted by
				     Chrome — a smeared tile over the sidebar — when the main panel
				     repaints on scroll; clipping via the parent box prevents that. -->
				<span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
					{#if $currentUser?.avatar_url}
						<img src={$currentUser.avatar_url} alt={$currentUser.name} class="h-full w-full object-cover" />
					{:else}
						{initials($currentUser?.name ?? 'U')}
					{/if}
				</span>
				<div class="min-w-0 flex-1 {collapsed ? 'sm:hidden' : ''}">
					<p class="truncate text-sm font-medium text-sidebar-foreground">{$currentUser?.name ?? ''}</p>
				</div>
			</a>

			<!-- Nav -->
			<nav class="flex-1 space-y-0.5 p-2" aria-label={$t('layout.nav.primary')}>
					{#each visibleNavItems as item, i (item.id)}
						{#if i > 0 && item.group !== visibleNavItems[i - 1].group}
							<div class="my-2 border-t border-sidebar-border"></div>
						{/if}
						{@const active = isActive(item, $page.url.pathname)}
						<a
							href={item.href}
							onclick={() => (scheduleMenuOpen = false)}
							aria-current={active ? 'page' : undefined}
							title={collapsed ? $t(item.labelKey) : undefined}
							class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors {collapsed ? 'sm:justify-center sm:px-0' : ''}
								{active
									? 'bg-sidebar-accent text-sidebar-accent-foreground'
									: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'}"
						>
							<item.icon class="size-4 shrink-0 {active ? 'opacity-100' : 'opacity-60'}" />
							<span class={collapsed ? 'sm:sr-only' : ''}>{$t(item.labelKey)}</span>
						</a>
					{/each}
				</nav>

			<!-- Footer -->
			<div class="border-t border-sidebar-border p-2">
				<button type="button" onclick={toggleCollapsed}
					aria-pressed={collapsed} aria-label={$t(collapsed ? 'layout.sidebar.expand' : 'layout.sidebar.collapse')} title={$t(collapsed ? 'layout.sidebar.expand' : 'layout.sidebar.collapse')}
					class="mb-1 hidden w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/80 sm:flex {collapsed ? 'sm:justify-center sm:px-0' : ''}">
					{#if collapsed}<PanelLeftOpen class="size-4 shrink-0" />{:else}<PanelLeftClose class="size-4 shrink-0" />{/if}
					<span class={collapsed ? 'sm:sr-only' : ''}>{$t('layout.sidebar.collapse')}</span>
				</button>
				<div class="px-1 pb-2 {collapsed ? 'sm:hidden' : ''}">
					<LocaleSwitcher class="w-full" />
				</div>
				<button
					onclick={() => (reportOpen = true)}
					class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/70 {collapsed ? 'sm:justify-center sm:px-0' : ''}"
					title={collapsed ? $t('layout.reportIssue') : undefined}
				>
					<MessageSquareWarning class="size-4 shrink-0" />
					<span class={collapsed ? 'sm:sr-only' : ''}>{$t('layout.reportIssue')}</span>
				</button>
				<button
					onclick={logout}
					class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground {collapsed ? 'sm:justify-center sm:px-0' : ''}"
					title={collapsed ? $t('layout.signOut') : undefined}
				>
					<LogOut class="size-4 shrink-0" />
					<span class={collapsed ? 'sm:sr-only' : ''}>{$t('layout.signOut')}</span>
				</button>
				{#if version}
					<a
						href={RELEASES_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-1 block px-2.5 py-1 text-xs text-sidebar-foreground/35 transition-colors hover:text-sidebar-foreground/60 {collapsed ? 'sm:hidden' : ''}"
					>
						{version}
					</a>
				{/if}
			</div>
		</aside>

		<!-- Main content -->
		<main class="min-w-0 flex-1 bg-background {isSchedule ? 'overflow-hidden' : 'overflow-y-auto'}">
			<div class={isSchedule ? 'h-full min-h-0' : 'mx-auto max-w-4xl px-8 py-8'}>
				{@render children()}
			</div>
		</main>
	</div>
	</div>

	<Dialog.Root bind:open={reportOpen}>
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>{$t('layout.report.title')}</Dialog.Title>
				<Dialog.Description>
					{$t('layout.report.please')} <strong>{$t('layout.report.searchFirst')}</strong> {$t('layout.report.mayBeReported')}
					<strong>{$t('layout.report.reproducibleBugs')}</strong> {$t('layout.report.inCalnode')}
					{$t('layout.report.howDoI')} {$t('layout.report.questions')}
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer class="gap-2 sm:justify-between">
				<a
					href={ISSUES_URL}
					target="_blank"
					rel="noopener noreferrer"
					onclick={() => (reportOpen = false)}
					class={buttonVariants({ variant: 'outline' })}
				>
					{$t('layout.report.searchExisting')}
				</a>
				<a
					href={NEW_ISSUE_URL}
					target="_blank"
					rel="noopener noreferrer"
					onclick={() => (reportOpen = false)}
					class={buttonVariants()}
				>
					{$t('layout.report.reportBug')}
				</a>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
