<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type LLMSettings } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Textarea } from '$lib/components/ui/textarea';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { createAsyncFlag } from '$lib/async-action.svelte';
	import { t } from '$lib/i18n';

	const loadingFlag = createAsyncFlag(true);
	const savingFlag = createAsyncFlag();
	const testingFlag = createAsyncFlag();

	let settings = $state<LLMSettings | null>(null);
	let enabled = $state(false);
	let endpoint = $state('');
	let model = $state('');
	let apiKey = $state('');
	let extraInstructions = $state('');

	onMount(() => loadingFlag.run(async () => {
		settings = await api.get<LLMSettings>('/v1/settings/llm');
		enabled = settings.enabled;
		endpoint = settings.endpoint;
		model = settings.model;
		extraInstructions = settings.extra_instructions;
	}, $t('settingsAI.loadFailed')));

	async function save() {
		await savingFlag.run(async () => {
			const body: Record<string, unknown> = {
				enabled, endpoint: endpoint.trim(), model: model.trim(),
				extra_instructions: extraInstructions
			};
			if (apiKey) body.api_key = apiKey;
			settings = await api.patch<LLMSettings>('/v1/settings/llm', body);
			enabled = settings.enabled;
			extraInstructions = settings.extra_instructions;
			apiKey = '';
			toast.success(settings.active ? $t('settingsAI.savedActive') : $t('settingsAI.saved'));
		}, $t('settingsAI.saveFailed'));
	}

	async function testConnection() {
		if (!endpoint.trim() || !model.trim()) {
			toast.error($t('settingsAI.enterEndpointAndModel'));
			return;
		}
		await testingFlag.run(async () => {
			const res = await api.post<{ ok: boolean; latency_ms?: number; error?: string }>(
				'/v1/settings/llm/test',
				{ endpoint: endpoint.trim(), model: model.trim(), api_key: apiKey || undefined }
			);
			if (res.ok) toast.success($t('settingsAI.connectionOk', { latency: res.latency_ms ?? 0 }));
			else toast.error($t('settingsAI.testFailed', { error: res.error ?? '' }));
		}, $t('settingsAI.testRequestFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if !$currentUser?.is_admin}
	<p class="text-sm text-muted-foreground">{$t('settingsAI.adminRequired')}</p>
{:else if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-lg space-y-4">
		<div class="rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-start justify-between gap-2">
				<div>
					<h2 class="text-sm font-semibold">{$t('settingsAI.title')}</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{$t('settingsAI.description')}
					</p>
				</div>
				{#if settings !== null}
					<span class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {settings.active ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">
						<span class="h-1.5 w-1.5 rounded-full {settings.active ? 'bg-green-500' : 'bg-amber-400'}"></span>
						{settings.active ? $t('settingsAI.statusActive') : settings.configured ? $t('settingsAI.statusConfiguredOff') : $t('settingsAI.statusNotConfigured')}
					</span>
				{/if}
			</div>

			<div class="space-y-3">
				<div class="space-y-1.5">
					<Label for="ai-endpoint">{$t('settingsAI.endpoint')}</Label>
					<Input id="ai-endpoint" type="text" placeholder="https://api.openai.com/v1" bind:value={endpoint} />
					<p class="text-xs text-muted-foreground">{$t('settingsAI.endpointHint', { path: '/chat/completions' })}</p>
				</div>
				<div class="space-y-1.5">
					<Label for="ai-model">{$t('settingsAI.model')}</Label>
					<Input id="ai-model" type="text" placeholder="gpt-4o-mini / claude-haiku-4-5 / gemini-flash …" bind:value={model} />
				</div>
				<div class="space-y-1.5">
					<Label for="ai-key">{$t('settingsAI.apiKey')}</Label>
					<Input id="ai-key" type="password"
						placeholder={settings?.api_key_set ? $t('settingsAI.storedKeep') : $t('settingsAI.apiKeyPlaceholder')}
						bind:value={apiKey} />
					{#if settings?.api_key_set && !apiKey}
						<p class="text-xs text-muted-foreground">{$t('settingsAI.storedKeep')}</p>
					{/if}
				</div>

				<div class="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
					<div>
						<Label for="ai-enabled" class="text-sm">{$t('settingsAI.enableFeatures')}</Label>
						<p class="text-xs text-muted-foreground">{$t('settingsAI.enableHint')}</p>
					</div>
					<Switch id="ai-enabled" bind:checked={enabled} />
				</div>
			</div>

			<div class="mt-5 flex gap-2">
				<Button onclick={save} disabled={savingFlag.active}>{savingFlag.active ? $t('common.saving') : $t('common.save')}</Button>
				<Button variant="outline" onclick={testConnection} disabled={testingFlag.active}>
					{testingFlag.active ? $t('settingsAI.testing') : $t('settingsAI.testConnection')}
				</Button>
			</div>
		</div>

		<div class="rounded-lg border bg-card p-6">
			<h2 class="text-sm font-semibold">{$t('settingsAI.instructionsTitle')}</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">
				{$t('settingsAI.instructionsDescription')}
			</p>
			<div class="mt-3 space-y-1.5">
				<Label for="ai-extra">{$t('settingsAI.additionalInstructions')}</Label>
				<Textarea id="ai-extra" rows={4} bind:value={extraInstructions}
					placeholder={$t('settingsAI.additionalInstructionsPlaceholder')} />
				<p class="text-xs text-muted-foreground">
					{$t('settingsAI.additionalInstructionsHint')}
				</p>
			</div>
			{#if settings?.base_prompt}
				<details class="mt-4">
					<summary class="cursor-pointer text-xs font-medium text-muted-foreground">{$t('settingsAI.viewBaseInstructions')}</summary>
					<pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{settings.base_prompt}</pre>
				</details>
			{/if}
			<div class="mt-5">
				<Button onclick={save} disabled={savingFlag.active}>{savingFlag.active ? $t('common.saving') : $t('common.save')}</Button>
			</div>
		</div>

		<p class="text-xs text-muted-foreground">
			{$t('settingsAI.privacyNote')}
		</p>
	</div>
{/if}
