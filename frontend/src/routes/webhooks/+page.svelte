<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Webhook, type WebhookDelivery } from '$lib/api';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { ConfirmDialog } from '$lib/components/ui/confirm-dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { t, localeTag } from '$lib/i18n';

	let items: Webhook[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let showCreate = $state(false);

	const allEvents = [
		'booking.created',
		'booking.cancelled',
		'booking.rescheduled',
		'booking.rsvp',
		'recording.completed',
		'transcript.ready',
		'notes.ready'
	];

	// Payload field catalog (keys must match the backend's webhook field keys).
	// `pii` flags personal data so the operator chooses consciously what leaves the system.
	// `labelKey` is the display label's i18n key; field keys and group names below stay
	// untranslated identifiers.
	type FieldDef = { key: string; labelKey: string; pii?: boolean };
	const fieldGroups: { group: string; pii?: boolean; fields: FieldDef[] }[] = [
		{ group: 'Booking', fields: [
			{ key: 'id', labelKey: 'webhooks.fields.bookingRef' },
			{ key: 'status', labelKey: 'webhooks.fields.status' },
			{ key: 'start_at', labelKey: 'webhooks.fields.startAt' },
			{ key: 'end_at', labelKey: 'webhooks.fields.endAt' },
			{ key: 'created_at', labelKey: 'webhooks.fields.createdAt' },
			{ key: 'location_value', labelKey: 'webhooks.fields.location' },
			{ key: 'cancellation_reason', labelKey: 'webhooks.fields.cancellationReason' },
			{ key: 'previous_start_at', labelKey: 'webhooks.fields.previousStart' },
			{ key: 'previous_end_at', labelKey: 'webhooks.fields.previousEnd' },
			{ key: 'rsvp_status', labelKey: 'webhooks.fields.rsvpStatus' },
		] },
		{ group: 'Payment', fields: [
			{ key: 'payment_status', labelKey: 'webhooks.fields.paymentStatus' },
			{ key: 'amount_paid_cents', labelKey: 'webhooks.fields.amountPaidCents' },
			{ key: 'amount_paid_currency', labelKey: 'webhooks.fields.amountPaidCurrency' },
		] },
		{ group: 'Event type', fields: [
			{ key: 'event_type_slug', labelKey: 'webhooks.fields.eventTypeSlug' },
			{ key: 'event_type_name', labelKey: 'webhooks.fields.eventTypeName' },
		] },
		{ group: 'Host', fields: [
			{ key: 'host_id', labelKey: 'webhooks.fields.hostId' },
			{ key: 'host_name', labelKey: 'webhooks.fields.hostName' },
			{ key: 'host_email', labelKey: 'webhooks.fields.hostEmail', pii: true },
		] },
		{ group: 'Attendee', pii: true, fields: [
			{ key: 'attendee_name', labelKey: 'webhooks.fields.attendeeName', pii: true },
			{ key: 'attendee_email', labelKey: 'webhooks.fields.attendeeEmail', pii: true },
			{ key: 'attendee_timezone', labelKey: 'webhooks.fields.attendeeTimezone', pii: true },
		] },
		{ group: 'Intake', pii: true, fields: [
			{ key: 'answers', labelKey: 'webhooks.fields.intakeAnswers', pii: true },
		] },
	];
	// Display names for the field groups (the `group` values themselves are not
	// compared against anything, but stay English identifiers in the data above).
	const groupLabelKeys: Record<string, string> = {
		Booking: 'webhooks.groups.booking',
		Payment: 'webhooks.groups.payment',
		'Event type': 'webhooks.groups.eventType',
		Host: 'webhooks.groups.host',
		Attendee: 'webhooks.groups.attendee',
		Intake: 'webhooks.groups.intake'
	};
	const allFieldKeys = fieldGroups.flatMap((g) => g.fields.map((f) => f.key));

	let form = $state<{ url: string; events: string[]; fields: string[] }>({
		url: '', events: ['booking.created', 'booking.cancelled'], fields: [...allFieldKeys]
	});

	// Delivery log (lazy-loaded per webhook).
	let openDeliveries = $state<string | null>(null);
	let deliveries = $state<WebhookDelivery[]>([]);
	let deliveriesLoading = $state(false);
	let creating = $state(false);
	let createError = $state('');
	let deleteOpen = $state(false);
	let deleteId = $state('');

	async function load() {
		try {
			const res = await api.get<{ items: Webhook[] }>('/v1/webhooks');
			items = res.items;
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function create() {
		createError = '';
		if (!form.url) { createError = $t('webhooks.errors.urlRequired'); return; }
		if (!form.url.startsWith('https://')) { createError = $t('webhooks.errors.urlHttps'); return; }
		if (form.events.length === 0) { createError = $t('webhooks.errors.noEvents'); return; }
		creating = true;
		try {
			await api.post('/v1/webhooks', { url: form.url, events: form.events, fields: form.fields });
			form = { url: '', events: ['booking.created', 'booking.cancelled'], fields: [...allFieldKeys] };
			showCreate = false;
			await load();
		} catch (e: any) {
			createError = e.message;
		} finally {
			creating = false;
		}
	}

	function del(id: string) {
		deleteId = id;
		deleteOpen = true;
	}

	async function doDelete() {
		try {
			await api.del(`/v1/webhooks/${deleteId}`);
			await load();
		} catch (e: any) {
			error = e.message;
		}
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString($localeTag, { dateStyle: 'medium' });
	}

	function toggleEvent(ev: string) {
		if (form.events.includes(ev)) {
			form.events = form.events.filter((e) => e !== ev);
		} else {
			form.events = [...form.events, ev];
		}
	}

	function toggleField(key: string) {
		form.fields = form.fields.includes(key)
			? form.fields.filter((f) => f !== key)
			: [...form.fields, key];
	}

	async function toggleDeliveries(id: string) {
		if (openDeliveries === id) { openDeliveries = null; return; }
		openDeliveries = id;
		deliveries = [];
		deliveriesLoading = true;
		try {
			const res = await api.get<{ items: WebhookDelivery[] }>(`/v1/webhooks/${id}/deliveries`);
			deliveries = res.items ?? [];
		} catch (e: any) {
			error = e.message;
		} finally {
			deliveriesLoading = false;
		}
	}
</script>

<ConfirmDialog
	bind:open={deleteOpen}
	title={$t('webhooks.dialog.title')}
	description={$t('webhooks.dialog.description')}
	confirmText={$t('common.delete')}
	destructive
	onConfirm={doDelete}
/>

<svelte:head><title>{$t('webhooks.pageTitle')}</title></svelte:head>

<div class="mb-8 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{$t('webhooks.heading')}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{$t('webhooks.subtitle')}</p>
	</div>
	<Button onclick={() => { showCreate = !showCreate; createError = ''; }}>
		{showCreate ? $t('common.cancel') : $t('webhooks.newWebhook')}
	</Button>
</div>

{#if showCreate}
	<div class="mb-6 rounded-lg border bg-card p-6">
		<h2 class="mb-4 text-sm font-semibold">{$t('webhooks.newWebhook')}</h2>
		{#if createError}<p class="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{createError}</p>{/if}

		<div class="mb-4 space-y-1.5">
			<Label for="wh-url">{$t('webhooks.form.urlLabel')}</Label>
			<Input
				id="wh-url"
				type="url"
				bind:value={form.url}
				placeholder="https://your-server.com/hooks/calnode"
			/>
		</div>

		<div class="mb-4 space-y-2">
			<p class="text-sm font-medium">{$t('webhooks.form.eventsHeading')}</p>
			{#each allEvents as ev}
				<label class="flex cursor-pointer items-center gap-2 font-mono text-sm">
					<Checkbox
						checked={form.events.includes(ev)}
						onCheckedChange={() => toggleEvent(ev)}
					/>
					<span>{ev}</span>
				</label>
			{/each}
		</div>

		<div class="mb-4 space-y-3">
			<p class="text-sm font-medium">{$t('webhooks.form.dataHeading')} <span class="font-normal text-muted-foreground">{$t('webhooks.form.dataHint')}</span></p>
			{#each fieldGroups as grp}
				<div class="space-y-1.5">
					<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{$t(groupLabelKeys[grp.group] ?? grp.group)}{#if grp.pii}<span class="ml-1.5 font-normal normal-case text-amber-600">{$t('webhooks.form.piiTag')}</span>{/if}
					</p>
					<div class="grid grid-cols-2 gap-x-4 gap-y-1">
						{#each grp.fields as f}
							<label class="flex cursor-pointer items-center gap-2 font-mono text-sm">
								<Checkbox checked={form.fields.includes(f.key)} onCheckedChange={() => toggleField(f.key)} />
								<span>{$t(f.labelKey)}{#if f.pii}<span class="ml-1 text-[10px] font-medium uppercase text-amber-600">PII</span>{/if}</span>
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<Button onclick={create} disabled={creating}>
			{creating ? $t('webhooks.form.creating') : $t('webhooks.form.create')}
		</Button>
	</div>
{/if}

{#if error}<p class="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>{/if}

{#if loading}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else if items.length === 0}
	<div class="rounded-lg border border-dashed bg-card p-12 text-center">
		<p class="text-sm font-medium">{$t('webhooks.empty.title')}</p>
		<p class="mt-1 text-sm text-muted-foreground">{$t('webhooks.empty.description')}</p>
	</div>
{:else}
	<div class="rounded-lg border bg-card overflow-hidden">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b">
					<th class="px-4 pb-3 pt-3 text-left text-xs font-medium text-muted-foreground">{$t('webhooks.table.url')}</th>
					<th class="px-4 pb-3 pt-3 text-left text-xs font-medium text-muted-foreground">{$t('webhooks.table.events')}</th>
					<th class="px-4 pb-3 pt-3 text-left text-xs font-medium text-muted-foreground">{$t('webhooks.table.fields')}</th>
					<th class="px-4 pb-3 pt-3 text-left text-xs font-medium text-muted-foreground">{$t('webhooks.table.status')}</th>
					<th class="px-4 pb-3 pt-3 text-left text-xs font-medium text-muted-foreground">{$t('webhooks.table.created')}</th>
					<th class="px-4 pb-3 pt-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y">
				<Tooltip.Provider>
					{#each items as wh}
						<tr class="transition-colors hover:bg-muted/30">
							<td class="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3 font-mono text-xs">{wh.url}</td>
							<td class="px-4 py-3 text-xs text-muted-foreground">{(wh.events ?? []).join(', ')}</td>
							<td class="px-4 py-3 text-xs text-muted-foreground">{$t.plural('webhooks.table.fieldsCount', (wh.fields ?? []).length)}</td>
							<td class="px-4 py-3">
								{#if wh.is_active}
									<Badge class="bg-green-50 text-green-700 border-green-200">{$t('webhooks.status.active')}</Badge>
								{:else}
									<Badge variant="secondary">{$t('webhooks.status.inactive')}</Badge>
								{/if}
							</td>
							<td class="px-4 py-3 text-muted-foreground">{fmtDate(wh.created_at)}</td>
							<td class="px-4 py-3 text-right whitespace-nowrap">
								<Tooltip.Root>
									<Tooltip.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon' })} onclick={() => toggleDeliveries(wh.id)}>
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
									</Tooltip.Trigger>
									<Tooltip.Content>{openDeliveries === wh.id ? $t('webhooks.deliveries.hide') : $t('webhooks.deliveries.recent')}</Tooltip.Content>
								</Tooltip.Root>
								<Tooltip.Root>
									<Tooltip.Trigger class={buttonVariants({ variant: 'ghost', size: 'icon' })} onclick={() => del(wh.id)}>
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
									</Tooltip.Trigger>
									<Tooltip.Content>{$t('webhooks.deleteAction')}</Tooltip.Content>
								</Tooltip.Root>
							</td>
						</tr>
						{#if openDeliveries === wh.id}
							<tr class="bg-muted/20">
								<td colspan="6" class="px-4 py-3">
									{#if deliveriesLoading}
										<p class="text-xs text-muted-foreground">{$t('webhooks.deliveries.loading')}</p>
									{:else if deliveries.length === 0}
										<p class="text-xs text-muted-foreground">{$t('webhooks.deliveries.none')}</p>
									{:else}
										<table class="w-full text-xs">
											<thead>
												<tr class="text-left text-muted-foreground">
													<th class="py-1 pr-4 font-medium">{$t('webhooks.deliveries.event')}</th>
													<th class="py-1 pr-4 font-medium">{$t('webhooks.deliveries.status')}</th>
													<th class="py-1 pr-4 font-medium">{$t('webhooks.deliveries.http')}</th>
													<th class="py-1 pr-4 font-medium">{$t('webhooks.deliveries.attempts')}</th>
													<th class="py-1 font-medium">{$t('webhooks.deliveries.lastAttempt')}</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-border/50">
												{#each deliveries as d}
													<tr>
														<td class="py-1 pr-4 font-mono">{d.event}</td>
														<td class="py-1 pr-4">
															<span class={d.status === 'delivered' ? 'text-green-700' : d.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>{d.status}</span>
														</td>
														<td class="py-1 pr-4">{d.response_status ?? '—'}</td>
														<td class="py-1 pr-4">{d.attempt_count}</td>
														<td class="py-1 text-muted-foreground">{d.last_attempted_at ? new Date(d.last_attempted_at).toLocaleString($localeTag) : '—'}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</Tooltip.Provider>
			</tbody>
		</table>
	</div>
{/if}
