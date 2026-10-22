<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type GoogleSettings } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { createAsyncFlag } from '$lib/async-action.svelte';
	import { t } from '$lib/i18n';

	const loadingFlag = createAsyncFlag(true);
	const savingFlag = createAsyncFlag();

	let googleSettings = $state<GoogleSettings | null>(null);
	let clientID = $state('');
	let clientSecret = $state('');

	// Host the server builds its OAuth redirect URIs from. Prefer the server's
	// configured base_url so the displayed URIs match exactly what we send to
	// Google; fall back to the current origin if it's somehow blank.
	const redirectBase = $derived(
		googleSettings?.base_url || (typeof window !== 'undefined' ? window.location.origin : '')
	);
	const isLocal = $derived(redirectBase.includes('localhost') || redirectBase.includes('127.0.0.1'));

	// Catches the "moved to a custom domain but never updated BASE_URL" trap: the server
	// still computes redirect URIs from its own configured base_url, which can silently
	// drift from whatever domain an admin is actually browsing this page at (e.g. after
	// pointing a custom domain at a host whose BASE_URL secret still says the old default).
	const browserOrigin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
	const originMismatch = $derived(
		!!googleSettings?.base_url && !!browserOrigin &&
		googleSettings.base_url.replace(/\/+$/, '') !== browserOrigin
	);

	onMount(() => loadingFlag.run(async () => {
		googleSettings = await api.get<GoogleSettings>('/v1/settings/google');
		clientID = googleSettings.client_id;
	}, $t('settingsGoogle.loadFailed')));

	async function save() {
		await savingFlag.run(async () => {
			const body: Record<string, unknown> = { client_id: clientID };
			if (clientSecret) body.client_secret = clientSecret;
			googleSettings = await api.patch<GoogleSettings>('/v1/settings/google', body);
			clientSecret = '';
			toast.success($t('settingsGoogle.saved'));
		}, $t('settingsGoogle.saveFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if !$currentUser?.is_admin}
	<p class="text-sm text-muted-foreground">{$t('settingsGoogle.adminRequired')}</p>
{:else}

{#if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-lg space-y-4">

		{#if originMismatch}
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
				<p class="font-medium">{$t('settingsGoogle.domainMismatchTitle')}</p>
				<p class="mt-1 text-amber-800">
					{$t('settingsGoogle.domainMismatchText1')}<code class="rounded bg-amber-100 px-1 font-mono">{browserOrigin}</code>{$t('settingsGoogle.domainMismatchText2')}<code class="rounded bg-amber-100 px-1 font-mono">{googleSettings?.base_url}</code>{$t('settingsGoogle.domainMismatchText3')}<code class="rounded bg-amber-100 px-1 font-mono">{browserOrigin}</code>{$t('settingsGoogle.domainMismatchText4')}
				</p>
			</div>
		{/if}

		{#if !googleSettings?.configured}
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-4 text-sm font-semibold">{$t('settingsGoogle.instructionsTitle')}</h2>
			<ol class="space-y-4 text-sm">
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">1</span>
					<div>
						{$t('settingsGoogle.step1Part1')}<a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline">console.cloud.google.com</a>{$t('settingsGoogle.step1Part2')}
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">2</span>
					<div>
						{$t('settingsGoogle.step2Part1')}<span class="font-medium">{$t('settingsGoogle.step2Apis')}</span>{$t('settingsGoogle.step2Part2')}<span class="font-medium">{$t('settingsGoogle.step2ApiName')}</span>{$t('settingsGoogle.step2Part3')}
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">3</span>
					<div>
						{$t('settingsGoogle.step3Part1')}<span class="font-medium">{$t('settingsGoogle.step3Consent')}</span>{$t('settingsGoogle.step3Part2')}<span class="font-medium">{$t('settingsGoogle.step3External')}</span>{$t('settingsGoogle.step3Part3')}
						<p class="mt-1.5 text-xs text-muted-foreground">
							{$t('settingsGoogle.step3Note1')}<span class="font-medium">{$t('settingsGoogle.step3Testing')}</span>{$t('settingsGoogle.step3Note2')}<span class="font-medium">{$t('settingsGoogle.step3PublishApp')}</span>{$t('settingsGoogle.step3Note3')}<a href="https://support.google.com/cloud/answer/15549945" target="_blank" rel="noopener noreferrer" class="text-primary underline">{$t('settingsGoogle.step3Guide')}</a>.
						</p>
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">4</span>
					<div>
						{$t('settingsGoogle.step4Part1')}<span class="font-medium">{$t('settingsGoogle.step4Creds')}</span>{$t('settingsGoogle.step4Part2')}<span class="font-medium">{$t('settingsGoogle.step4WebApp')}</span>.
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">5</span>
					<div>
						{$t('settingsGoogle.step5Part1')}<span class="font-medium">{$t('settingsGoogle.step5RedirectUris')}</span>{$t('settingsGoogle.step5Part2')}
						<code class="mt-1 block rounded bg-muted px-2 py-1 text-xs font-mono break-all">{redirectBase}/v1/calendar/callback</code>
						<code class="mt-1 block rounded bg-muted px-2 py-1 text-xs font-mono break-all">{redirectBase}/v1/auth/callback</code>
						{$t('settingsGoogle.step5Part3')}<span class="font-medium">{$t('settingsGoogle.step5Create')}</span>{$t('settingsGoogle.step5Part4')}
						{#if !isLocal}
							<p class="mt-1.5 text-xs text-muted-foreground">
								{$t('settingsGoogle.step5LocalHint', { uri: 'http://localhost:3000/…' })}
							</p>
						{/if}
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">6</span>
					<div>{$t('settingsGoogle.step6')}</div>
				</li>
			</ol>
		</div>
		{/if}

		<div class="rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-start justify-between gap-2">
				<div>
					<h2 class="text-sm font-semibold">{$t('settingsGoogle.title')}</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">{$t('settingsGoogle.description')}</p>
				</div>
				{#if googleSettings !== null}
					<span class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {googleSettings.configured ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">
						<span class="h-1.5 w-1.5 rounded-full {googleSettings.configured ? 'bg-green-500' : 'bg-amber-400'}"></span>
						{googleSettings.configured ? $t('settingsGoogle.configured') : $t('settingsGoogle.notConfigured')}
					</span>
				{/if}
			</div>

			<div class="space-y-3">
				<div class="space-y-1.5">
					<Label for="g-client-id">{$t('settingsGoogle.clientId')}</Label>
					<Input id="g-client-id" type="text" placeholder="123456789-abc.apps.googleusercontent.com" bind:value={clientID} />
				</div>
				<div class="space-y-1.5">
					<Label for="g-client-secret">{$t('settingsGoogle.clientSecret')}</Label>
					<Input id="g-client-secret" type="password"
						placeholder={googleSettings?.client_secret_set ? $t('settingsEmail.placeholderStored') : $t('settingsGoogle.enterClientSecret')}
						bind:value={clientSecret} />
					{#if googleSettings?.client_secret_set && !clientSecret}
						<p class="text-xs text-muted-foreground">{$t('settingsGoogle.storedKeep')}</p>
					{/if}
				</div>
			</div>

			{#if googleSettings?.configured}
				<div class="mt-5 border-t pt-4">
					<p class="text-xs font-medium text-muted-foreground">{$t('settingsGoogle.redirectUrisTitle')}</p>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{$t('settingsGoogle.redirectUrisHint')}
					</p>
					<code class="mt-2 block rounded bg-muted px-2 py-1 text-xs font-mono break-all">{redirectBase}/v1/calendar/callback</code>
					<code class="mt-1 block rounded bg-muted px-2 py-1 text-xs font-mono break-all">{redirectBase}/v1/auth/callback</code>
					{#if !isLocal}
						<p class="mt-1.5 text-xs text-muted-foreground">
							{$t('settingsGoogle.localVariantsHint', { uri: 'http://localhost:3000/…' })}
						</p>
					{/if}
				</div>
			{/if}

			<div class="mt-5">
				<Button onclick={save} disabled={savingFlag.active}>
					{savingFlag.active ? $t('common.saving') : $t('common.save')}
				</Button>
			</div>
		</div>
	</div>
{/if}

{/if}
