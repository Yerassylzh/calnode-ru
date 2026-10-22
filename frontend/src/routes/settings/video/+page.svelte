<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { createAsyncFlag } from '$lib/async-action.svelte';
	import { t } from '$lib/i18n';

	type LiveKitSettings = {
		url: string;
		api_key: string;
		api_secret_set: boolean;
		configured: boolean;
	};
	type NotetakerSettings = { enabled: boolean; stt_api_key_set: boolean };
	type StorageStatus = { recordings_storage_ready: boolean; recordings_enabled: boolean };

	const loadingFlag = createAsyncFlag(true);
	const savingFlag = createAsyncFlag();

	let settings = $state<LiveKitSettings | null>(null);
	let url = $state('');
	let apiKey = $state('');
	let apiSecret = $state('');
	let webhookUrl = $state('');

	let notetaker = $state<NotetakerSettings | null>(null);
	let notetakerEnabled = $state(false);
	let deepgramKey = $state('');

	let storage = $state<StorageStatus | null>(null);
	// Only worth surfacing once LiveKit itself works — there's nothing to record yet otherwise.
	const recordingNotReady = $derived(
		settings?.configured && storage !== null && (!storage.recordings_storage_ready || !storage.recordings_enabled)
	);

	onMount(() => loadingFlag.run(async () => {
		webhookUrl = `${window.location.origin}/v1/livekit/webhook`;
		settings = await api.get<LiveKitSettings>('/v1/settings/livekit');
		url = settings.url;
		apiKey = settings.api_key;
		notetaker = await api.get<NotetakerSettings>('/v1/settings/notetaker');
		notetakerEnabled = notetaker.enabled;
		storage = await api.get<StorageStatus>('/v1/settings/storage');
	}, $t('settingsVideo.loadFailed')));

	async function saveNotetaker() {
		await savingFlag.run(async () => {
			const body: Record<string, unknown> = { enabled: notetakerEnabled };
			if (deepgramKey.trim()) body.stt_api_key = deepgramKey.trim();
			notetaker = await api.patch<NotetakerSettings>('/v1/settings/notetaker', body);
			notetakerEnabled = notetaker.enabled;
			deepgramKey = '';
			toast.success($t('settingsVideo.savedNotetaker'));
		}, $t('settingsVideo.saveNotetakerFailed'));
	}

	async function save() {
		await savingFlag.run(async () => {
			const body: Record<string, unknown> = { url: url.trim(), api_key: apiKey.trim() };
			if (apiSecret) body.api_secret = apiSecret;
			settings = await api.patch<LiveKitSettings>('/v1/settings/livekit', body);
			apiSecret = '';
			toast.success($t('settingsVideo.saved'));
		}, $t('settingsVideo.saveFailed'));
	}

	async function copyWebhook() {
		try {
			await navigator.clipboard.writeText(webhookUrl);
			toast.success($t('settingsVideo.webhookCopied'));
		} catch {
			toast.error($t('settingsVideo.copyFailed'));
		}
	}

	async function disconnect() {
		await savingFlag.run(async () => {
			settings = await api.patch<LiveKitSettings>('/v1/settings/livekit', { url: '' });
			url = ''; apiKey = ''; apiSecret = '';
			toast.success($t('settingsVideo.disconnected'));
		}, $t('settingsVideo.disconnectFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if !$currentUser?.is_admin}
	<p class="text-sm text-muted-foreground">{$t('settingsVideo.adminRequired')}</p>
{:else if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-lg space-y-4">
		{#if !settings?.configured}
			<div class="rounded-lg border bg-card p-6">
				<h2 class="mb-4 text-sm font-semibold">{$t('settingsVideo.instructionsTitle')}</h2>
				<ol class="space-y-4 text-sm">
					<li class="flex gap-3">
						<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">1</span>
						<div>
							{$t('settingsVideo.step1Part1')}<a href="https://cloud.livekit.io" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline">cloud.livekit.io</a>
							{$t('settingsVideo.step1Part2')}<a href="https://docs.livekit.io/home/self-hosting/local/" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline">{$t('settingsVideo.step1SelfHosted')}</a>{$t('settingsVideo.step1Part3')}
						</div>
					</li>
					<li class="flex gap-3">
						<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">2</span>
						<div>
							{$t('settingsVideo.step2Part1')}<span class="font-medium">{$t('settingsVideo.step2WsUrl')}</span>{$t('settingsVideo.step2Part2', { example: 'wss://yourproject.livekit.cloud' })}<span class="font-medium">{$t('settingsVideo.step2Key')}</span>{$t('settingsVideo.step2And')}<span class="font-medium">{$t('settingsVideo.step2Secret')}</span>{$t('settingsVideo.step2Part3')}
						</div>
					</li>
					<li class="flex gap-3">
						<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">3</span>
						<div>{$t('settingsVideo.step3')}</div>
					</li>
				</ol>
			</div>
		{/if}

		<div class="rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-start justify-between gap-2">
				<div>
					<h2 class="text-sm font-semibold">{$t('settingsVideo.title')}</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{$t('settingsVideo.description')}
					</p>
				</div>
				{#if settings !== null}
					<span class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {settings.configured ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">
						<span class="h-1.5 w-1.5 rounded-full {settings.configured ? 'bg-green-500' : 'bg-amber-400'}"></span>
						{settings.configured ? $t('settingsVideo.configured') : $t('settingsVideo.notConfigured')}
					</span>
				{/if}
			</div>

			<div class="space-y-3">
				<div class="space-y-1.5">
					<Label for="lk-url">{$t('settingsVideo.serverUrl')}</Label>
					<Input id="lk-url" type="text" placeholder="wss://yourproject.livekit.cloud" bind:value={url} />
				</div>
				<div class="space-y-1.5">
					<Label for="lk-key">{$t('settingsVideo.apiKey')}</Label>
					<Input id="lk-key" type="text" placeholder="APIxxxxxxxx" bind:value={apiKey} />
				</div>
				<div class="space-y-1.5">
					<Label for="lk-secret">{$t('settingsVideo.apiSecret')}</Label>
					<Input id="lk-secret" type="password"
						placeholder={settings?.api_secret_set ? $t('settingsEmail.placeholderStored') : $t('settingsVideo.enterApiSecret')}
						bind:value={apiSecret} />
					{#if settings?.api_secret_set && !apiSecret}
						<p class="text-xs text-muted-foreground">{$t('settingsVideo.storedKeep')}</p>
					{/if}
				</div>
			</div>

			<div class="mt-5 flex items-center gap-3">
				<Button onclick={save} disabled={savingFlag.active}>{savingFlag.active ? $t('common.saving') : $t('common.save')}</Button>
				{#if settings?.configured}
					<Button variant="ghost" onclick={disconnect} disabled={savingFlag.active}>{$t('settingsVideo.disconnect')}</Button>
				{/if}
			</div>
		</div>

		{#if recordingNotReady}
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
				{#if !storage?.recordings_storage_ready}
					<p>{$t('settingsVideo.recordingsNeedStorage')}</p>
				{:else}
					<p>{$t('settingsVideo.recordingsReadyTurnOn')}</p>
				{/if}
				<a href="/admin/settings/storage" class="mt-1 inline-block font-medium text-amber-900 underline underline-offset-2">
					{$t('settingsVideo.goToStorage')}
				</a>
			</div>
		{/if}

		{#if settings?.configured}
			<div class="rounded-lg border bg-card p-6">
				<h2 class="text-sm font-semibold">{$t('settingsVideo.webhookTitle')}</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{$t('settingsVideo.webhookDescription')}
				</p>
				<div class="mt-3 flex items-center gap-2">
					<code class="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{webhookUrl}</code>
					<Button variant="outline" size="sm" onclick={copyWebhook}>{$t('common.copy')}</Button>
				</div>
				<ol class="mt-4 space-y-2 text-xs text-muted-foreground">
					<li>
						{$t('settingsVideo.webhookStep1Part1')}<span class="font-medium">{$t('settingsVideo.webhookStep1Settings')}</span>
						(<a href="https://docs.livekit.io/home/server/webhooks/" target="_blank" rel="noopener noreferrer" class="text-primary underline">{$t('settingsVideo.webhookStep1Docs')}</a>).
					</li>
					<li>{$t('settingsVideo.webhookStep2Part1')}<span class="font-medium">{$t('settingsVideo.webhookStep2Key')}</span>{$t('settingsVideo.webhookStep2Part2')}</li>
					<li>{$t('settingsVideo.webhookStep3')}</li>
				</ol>
			</div>

			<div class="rounded-lg border bg-card p-6">
				<div class="mb-3 flex items-start justify-between gap-3">
					<div>
						<h2 class="text-sm font-semibold">{$t('settingsVideo.notetakerTitle')}</h2>
						<p class="mt-0.5 text-xs text-muted-foreground">
							{$t('settingsVideo.notetakerDescription')}
						</p>
					</div>
					<Switch bind:checked={notetakerEnabled} />
				</div>
				<div class="space-y-1.5">
					<Label for="dg-key">{$t('settingsVideo.deepgramKey')}</Label>
					<Input id="dg-key" type="password"
						placeholder={notetaker?.stt_api_key_set ? $t('settingsEmail.placeholderStored') : $t('settingsVideo.enterDeepgramKey')}
						bind:value={deepgramKey} />
					<p class="text-xs text-muted-foreground">
						{$t('settingsVideo.getDeepgramKey')}<a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" class="text-primary underline">console.deepgram.com</a>.{#if notetaker?.stt_api_key_set} {$t('settingsVideo.storedKeep')}{/if}
					</p>
				</div>
				<div class="mt-5">
					<Button onclick={saveNotetaker} disabled={savingFlag.active}>{savingFlag.active ? $t('common.saving') : $t('common.save')}</Button>
				</div>
			</div>
		{/if}
	</div>
{/if}