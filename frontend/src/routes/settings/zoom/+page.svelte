<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type ZoomSettings } from '$lib/api';
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

	let settings = $state<ZoomSettings | null>(null);
	let clientID = $state('');
	let clientSecret = $state('');

	const redirectURI = $derived(settings?.redirect_uri || '');

	onMount(() => loadingFlag.run(async () => {
		settings = await api.get<ZoomSettings>('/v1/settings/zoom');
		clientID = settings.client_id;
	}, $t('settingsZoom.loadFailed')));

	async function save() {
		await savingFlag.run(async () => {
			const body: Record<string, unknown> = { client_id: clientID };
			if (clientSecret) body.client_secret = clientSecret;
			settings = await api.patch<ZoomSettings>('/v1/settings/zoom', body);
			clientSecret = '';
			toast.success($t('settingsZoom.saved'));
		}, $t('settingsZoom.saveFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if !$currentUser?.is_admin}
	<p class="text-sm text-muted-foreground">{$t('settingsZoom.adminRequired')}</p>
{:else}

{#if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-lg space-y-4">

		{#if !settings?.configured}
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-4 text-sm font-semibold">{$t('settingsZoom.instructionsTitle')}</h2>
			<ol class="space-y-4 text-sm">
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">1</span>
					<div>
						{$t('settingsZoom.step1Part1')}<a href="https://marketplace.zoom.us" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline">{$t('settingsZoom.step1Link')}</a>{$t('settingsZoom.step1Part2')}<span class="font-medium">{$t('settingsZoom.step1Develop')}</span>{$t('settingsZoom.step1Part3')}
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">2</span>
					<div>
						{$t('settingsZoom.step2Part1')}<span class="font-medium">{$t('settingsZoom.step2GeneralApp')}</span>{$t('settingsZoom.step2Part2')}<span class="font-medium">{$t('settingsZoom.step2AccountOwner')}</span>{$t('settingsZoom.step2Part3')}<a href="https://github.com/Calnode/calnode/blob/main/docs/VIDEO.md" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline">docs/VIDEO.md</a>.
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">3</span>
					<div>
						{$t('settingsZoom.step3Part1')}<span class="font-medium">{$t('settingsZoom.step3OAuth')}</span>{$t('settingsZoom.step3Part2')}<span class="font-medium">{$t('settingsZoom.step3RedirectUrl')}</span>{$t('settingsZoom.step3Part3')}
						<code class="mt-1 block rounded bg-muted px-2 py-1 text-xs font-mono break-all">{redirectURI}</code>
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">4</span>
					<div>
						{$t('settingsZoom.step4Part1')}<span class="font-medium">{$t('settingsZoom.step4Scopes')}</span>{$t('settingsZoom.step4Part2')}<code class="rounded bg-muted px-1">meeting:write</code>{$t('settingsZoom.step4Part3')}
					</div>
				</li>
				<li class="flex gap-3">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">5</span>
					<div>
						{$t('settingsZoom.step5Part1')}<span class="font-medium">{$t('settingsZoom.step5ClientId')}</span>{$t('settingsZoom.step5And')}<span class="font-medium">{$t('settingsZoom.step5ClientSecret')}</span>{$t('settingsZoom.step5Part2')}
					</div>
				</li>
			</ol>
		</div>
		{/if}

		<div class="rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-start justify-between gap-2">
				<div>
					<h2 class="text-sm font-semibold">{$t('settingsZoom.title')}</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{$t('settingsZoom.description')}
					</p>
				</div>
				{#if settings !== null}
					<span class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {settings.configured ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">
						<span class="h-1.5 w-1.5 rounded-full {settings.configured ? 'bg-green-500' : 'bg-amber-400'}"></span>
						{settings.configured ? $t('settingsZoom.configured') : $t('settingsZoom.notConfigured')}
					</span>
				{/if}
			</div>

			<div class="space-y-3">
				<div class="space-y-1.5">
					<Label for="z-client-id">{$t('settingsZoom.clientId')}</Label>
					<Input id="z-client-id" type="text" placeholder="abcdEFGhij-KLmnOPqrS" bind:value={clientID} />
				</div>
				<div class="space-y-1.5">
					<Label for="z-client-secret">{$t('settingsZoom.clientSecret')}</Label>
					<Input id="z-client-secret" type="password"
						placeholder={settings?.client_secret_set ? $t('settingsEmail.placeholderStored') : $t('settingsZoom.enterClientSecret')}
						bind:value={clientSecret} />
					{#if settings?.client_secret_set && !clientSecret}
						<p class="text-xs text-muted-foreground">{$t('settingsZoom.storedKeep')}</p>
					{/if}
				</div>
			</div>

			{#if settings?.configured}
				<div class="mt-5 border-t pt-4">
					<p class="text-xs font-medium text-muted-foreground">{$t('settingsZoom.redirectUrlTitle')}</p>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{$t('settingsZoom.redirectUrlHint')}
					</p>
					<code class="mt-2 block rounded bg-muted px-2 py-1 text-xs font-mono break-all">{redirectURI}</code>
				</div>
				<div class="mt-4 rounded-md bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
					<span class="font-medium">{$t('settingsZoom.limitWarningBold')}</span>{$t('settingsZoom.limitWarningText')}
					<a href="https://github.com/Calnode/calnode/blob/main/docs/ZOOM.md" target="_blank" rel="noopener noreferrer" class="font-medium underline">docs/ZOOM.md</a>{$t('settingsZoom.limitWarningBuiltin')}
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