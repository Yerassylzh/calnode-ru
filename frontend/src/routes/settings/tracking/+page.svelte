<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { createAsyncFlag } from '$lib/async-action.svelte';
	import { t } from '$lib/i18n';

	type Tracking = {
		head_html: string;
		csp_allow: string;
		datalayer_enabled: boolean;
		datalayer_fields: string[];
		available_fields: string[];
		gtm_container_id: string;
		ga4_measurement_id: string;
	};

	const trackingFieldLabelKeys: Record<string, string> = {
		booking_id: 'settingsTracking.fields.booking_id',
		event_type_slug: 'settingsTracking.fields.event_type_slug',
		event_type_name: 'settingsTracking.fields.event_type_name',
		start_at: 'settingsTracking.fields.start_at',
		end_at: 'settingsTracking.fields.end_at',
		status: 'settingsTracking.fields.status',
		location: 'settingsTracking.fields.location',
		host_name: 'settingsTracking.fields.host_name',
		attendee_name: 'settingsTracking.fields.attendee_name',
		attendee_email: 'settingsTracking.fields.attendee_email',
		attendee_timezone: 'settingsTracking.fields.attendee_timezone',
		answers: 'settingsTracking.fields.answers',
		value: 'settingsTracking.fields.value',
		currency: 'settingsTracking.fields.currency',
		is_paid: 'settingsTracking.fields.is_paid',
		transaction_id: 'settingsTracking.fields.transaction_id'
	};

	const piiFields = new Set(['attendee_name', 'attendee_email', 'attendee_timezone', 'answers']);

	const loadingFlag = createAsyncFlag(true);
	const savingFlag = createAsyncFlag();
	let headHtml = $state('');
	let cspAllow = $state('');
	let dlEnabled = $state(false);
	let dlFields = $state<string[]>([]);
	let availableFields = $state<string[]>([]);
	let gtmId = $state('');
	let ga4Id = $state('');

	onMount(() => loadingFlag.run(async () => {
		const tr = await api.get<Tracking>('/v1/settings/tracking');
		headHtml = tr.head_html ?? '';
		cspAllow = tr.csp_allow ?? '';
		dlEnabled = tr.datalayer_enabled;
		dlFields = tr.datalayer_fields ?? [];
		availableFields = tr.available_fields ?? [];
		gtmId = tr.gtm_container_id ?? '';
		ga4Id = tr.ga4_measurement_id ?? '';
	}, $t('settingsTracking.loadFailed')));

	function toggleField(key: string) {
		dlFields = dlFields.includes(key) ? dlFields.filter((f) => f !== key) : [...dlFields, key];
	}

	async function save() {
		await savingFlag.run(async () => {
			const tr = await api.patch<Tracking>('/v1/settings/tracking', {
				head_html: headHtml,
				csp_allow: cspAllow,
				datalayer_enabled: dlEnabled,
				datalayer_fields: dlFields,
				gtm_container_id: gtmId.trim(),
				ga4_measurement_id: ga4Id.trim()
			});
			dlFields = tr.datalayer_fields ?? [];
			gtmId = tr.gtm_container_id ?? '';
			ga4Id = tr.ga4_measurement_id ?? '';
			toast.success($t('settingsTracking.saved'));
		}, $t('settingsTracking.saveFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if !$currentUser?.is_admin}
	<p class="text-sm text-muted-foreground">{$t('settingsTracking.adminRequired')}</p>
{:else if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-2xl space-y-6">
		<!-- Native GA4 / GTM -->
		<div class="rounded-lg border bg-card p-6">
			<h2 class="text-sm font-semibold">{$t('settingsTracking.googleTitle')}</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">
				{$t('settingsTracking.googleDescription')}
			</p>
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<div class="space-y-1.5">
					<Label for="gtm-id">{$t('settingsTracking.gtmLabel')}</Label>
					<Input id="gtm-id" bind:value={gtmId} placeholder="GTM-XXXXXXX" class="font-mono" />
					<p class="text-xs text-muted-foreground">
						{$t('settingsTracking.gtmHint', { event: 'calnode_booking_confirmed' })}
					</p>
				</div>
				<div class="space-y-1.5">
					<Label for="ga4-id">{$t('settingsTracking.ga4Label')}</Label>
					<Input id="ga4-id" bind:value={ga4Id} placeholder="G-XXXXXXXXXX" class="font-mono" />
					<p class="text-xs text-muted-foreground">
						{$t('settingsTracking.ga4Hint', { purchase: 'purchase', lead: 'generate_lead' })}
					</p>
				</div>
			</div>
		</div>

		<!-- Code injection -->
		<div class="rounded-lg border bg-card p-6">
			<h2 class="text-sm font-semibold">{$t('settingsTracking.injectionTitle')}</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">
				{$t('settingsTracking.injectionDescription')}
			</p>
			<div class="mt-4 space-y-1.5">
				<Label for="head-html">{$t('settingsTracking.headLabel')}</Label>
				<Textarea id="head-html" bind:value={headHtml} rows={8} class="font-mono text-xs"
					placeholder={$t('settingsTracking.headPlaceholder')} />
			</div>
			<div class="mt-4 space-y-1.5">
				<Label for="csp-allow">{$t('settingsTracking.allowedOrigins')} <span class="font-normal text-muted-foreground">{$t('common.optional')}</span></Label>
				<Input id="csp-allow" bind:value={cspAllow}
					placeholder="https://www.googletagmanager.com https://*.google-analytics.com" />
				<p class="text-xs text-muted-foreground">
					{$t('settingsTracking.allowedOriginsHint')}
				</p>
			</div>
		</div>

		<!-- dataLayer events -->
		<div class="rounded-lg border bg-card p-6">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 class="text-sm font-semibold">{$t('settingsTracking.dataLayerTitle')}</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{$t('settingsTracking.dataLayerDescription', { events: 'calnode_booking_confirmed / _cancelled / _rescheduled' })}
					</p>
				</div>
				<Switch bind:checked={dlEnabled} />
			</div>
			{#if dlEnabled}
				<div class="mt-4 space-y-2">
					<p class="text-xs font-medium text-muted-foreground">
						{$t('settingsTracking.fieldsHint')}
					</p>
					<div class="grid grid-cols-2 gap-x-4 gap-y-1">
						{#each availableFields as key}
							<label class="flex cursor-pointer items-center gap-2 font-mono text-sm">
								<Checkbox checked={dlFields.includes(key)} onCheckedChange={() => toggleField(key)} />
								<span>{trackingFieldLabelKeys[key] ? $t(trackingFieldLabelKeys[key]) : key}{#if piiFields.has(key)}<span class="ml-1 text-[10px] font-medium uppercase text-amber-600">PII</span>{/if}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<Button onclick={save} disabled={savingFlag.active}>{savingFlag.active ? $t('common.saving') : $t('common.save')}</Button>
	</div>
{/if}