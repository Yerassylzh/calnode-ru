<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type User, type EmailSettings } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { createAsyncFlag } from '$lib/async-action.svelte';
	import { t } from '$lib/i18n';

	const loadingFlag = createAsyncFlag(true);
	const savingFlag = createAsyncFlag();
	const testingFlag = createAsyncFlag();

	let emailSettings = $state<EmailSettings | null>(null);
	let smtpHost = $state('');
	let smtpPort = $state('587');
	let smtpUser = $state('');
	let smtpPass = $state('');
	let smtpTLS = $state(false);
	let smtpStartTLS = $state(true);
	let emailFrom = $state('');
	let emailFromName = $state('Calnode');
	let resendApiKey = $state('');
	// Distinct from "the field is blank": blank means keep the stored key, this means
	// deliberately remove it and go back to SMTP.
	let clearResendKey = $state(false);
	// RSVP tracking (Resend inbound) for invites Calnode sends itself.
	let rsvpAddress = $state('');
	let webhookSecret = $state('');
	let clearWebhookSecret = $state(false);
	// Automatic webhook setup in Resend; its error, when it fails, opens the manual steps.
	let settingUpWebhook = $state(false);
	let webhookSetupError = $state('');
	let showManualWebhook = $state(false);

	let userEmail = $state('');

	// The server decides the transport; mirror its answer rather than re-deriving it here,
	// so the page can never claim one path while another is delivering.
	// clearResendKey has to win over the server's answer: once the admin has chosen to
	// remove the key, the SMTP fields are about to become live again and must stop being
	// dimmed, even though the server still reports transport === 'resend_api'.
	const usingResend = $derived(
		!clearResendKey && (emailSettings?.transport === 'resend_api' || !!resendApiKey),
	);

	onMount(() => loadingFlag.run(async () => {
		const [me, email] = await Promise.all([
			api.get<User>('/v1/users/me'),
			api.get<EmailSettings>('/v1/settings/email'),
		]);
		userEmail = me.email;
		emailSettings = email;
		smtpHost = email.smtp_host;
		smtpPort = email.smtp_port || '587';
		smtpUser = email.smtp_user;
		smtpTLS = email.smtp_tls;
		smtpStartTLS = email.smtp_starttls;
		emailFrom = email.email_from;
		emailFromName = email.email_from_name || 'Calnode';
		rsvpAddress = email.rsvp_address ?? '';
	}, $t('settingsEmail.loadFailed')));

	async function save() {
		// A save that removes the secret is the admin turning RSVP tracking off; it must not
		// immediately set the webhook back up below.
		const removingSecret = clearWebhookSecret;
		await savingFlag.run(async () => {
			const body: Record<string, unknown> = {
				smtp_host: smtpHost, smtp_port: smtpPort, smtp_user: smtpUser,
				smtp_tls: smtpTLS, smtp_starttls: smtpStartTLS,
				email_from: emailFrom, email_from_name: emailFromName,
			};
			if (smtpPass) body.smtp_pass = smtpPass;
			// Omit the key entirely to keep the stored one; send "" only to clear it.
			if (resendApiKey) body.resend_api_key = resendApiKey;
			else if (clearResendKey) body.resend_api_key = '';
			body.rsvp_address = rsvpAddress.trim();
			// Like the API key: omit to keep the stored secret.
			if (webhookSecret) body.resend_webhook_secret = webhookSecret.trim();
			else if (clearWebhookSecret) body.resend_webhook_secret = '';
			emailSettings = await api.patch<EmailSettings>('/v1/settings/email', body);
			smtpPass = '';
			resendApiKey = '';
			webhookSecret = '';
			clearResendKey = false;
			clearWebhookSecret = false;
			if (emailSettings.resend_webhook_secret_set) {
				webhookSetupError = '';
				showManualWebhook = false;
			}
			toast.success($t('settingsEmail.saved'));
		}, $t('settingsEmail.saveFailed'));
		// First time RSVP tracking has everything but the webhook: try to set that up too,
		// so the admin only falls back to the manual steps when Resend says no.
		const s = emailSettings;
		if (!removingSecret && s?.rsvp_address && s.resend_api_key_set && !s.resend_webhook_secret_set) {
			await setupWebhook();
		}
	}

	async function setupWebhook() {
		settingUpWebhook = true;
		webhookSetupError = '';
		try {
			const res = await api.post<{ created: boolean }>('/v1/settings/email/rsvp-webhook');
			emailSettings = await api.get<EmailSettings>('/v1/settings/email');
			showManualWebhook = false;
			toast.success(res.created ? $t('settingsEmail.webhookCreated') : $t('settingsEmail.webhookExisting'));
		} catch (e: any) {
			webhookSetupError = e.message || $t('settingsEmail.webhookSetupFailed');
			showManualWebhook = true;
		} finally {
			settingUpWebhook = false;
		}
	}

	async function test() {
		await testingFlag.run(async () => {
			try {
				await api.post('/v1/settings/email/test');
			} catch (e: any) {
				if (e.message?.startsWith('Email is not configured')) {
					throw new Error($t('settingsEmail.saveFirstError'));
				}
				throw e;
			}
			toast.success($t('settingsEmail.testSent', { email: userEmail }));
		}, $t('settingsEmail.testFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if !$currentUser?.is_admin}
	<p class="text-sm text-muted-foreground">{$t('settingsEmail.adminRequired')}</p>
{:else}

{#if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-lg">
		<div class="rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-start justify-between gap-2">
				<div>
					<h2 class="text-sm font-semibold">{$t('settingsEmail.emailTitle')}</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">{$t('settingsEmail.emailDescription')}</p>
				</div>
				{#if emailSettings !== null}
					<span class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {emailSettings.enabled ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">
						<span class="h-1.5 w-1.5 rounded-full {emailSettings.enabled ? 'bg-green-500' : 'bg-amber-400'}"></span>
						{emailSettings.transport === 'resend_api'
							? $t('settingsEmail.sendingViaResend')
							: emailSettings.transport === 'smtp'
								? $t('settingsEmail.sendingViaSmtp')
								: $t('settingsEmail.notConfigured')}
					</span>
				{/if}
			</div>

			<div class="space-y-4">
				<div class="space-y-2 rounded-md border p-3">
					<div class="flex items-center justify-between gap-4">
						<div>
							<p class="text-xs font-medium">{$t('settingsEmail.resendKeyLabel')}</p>
							<p class="text-xs text-muted-foreground">
								{$t('settingsEmail.resendKeyHint')}
							</p>
						</div>
					</div>
					<Input id="resend-key" type="password"
						placeholder={emailSettings?.resend_api_key_set ? $t('settingsEmail.placeholderStored') : 're_...'}
						bind:value={resendApiKey}
						disabled={clearResendKey} />
					{#if emailSettings?.resend_api_key_set && !resendApiKey && !clearResendKey}
						<div class="flex items-center justify-between gap-2">
							<p class="text-xs text-muted-foreground">{$t('settingsEmail.storedKeep')}</p>
							<Button variant="ghost" size="sm" class="h-6 px-2 text-xs"
								onclick={() => (clearResendKey = true)}>{$t('settingsEmail.removeKey')}</Button>
						</div>
					{:else if clearResendKey}
						<div class="flex items-center justify-between gap-2">
							<p class="text-xs text-amber-700">{$t('settingsEmail.willRemoveKey')}</p>
							<Button variant="ghost" size="sm" class="h-6 px-2 text-xs"
								onclick={() => (clearResendKey = false)}>{$t('settingsEmail.undo')}</Button>
						</div>
					{/if}
					<p class="text-xs text-muted-foreground">
						{$t('settingsEmail.smtpBlockedHint')}
					</p>
				</div>

				<div class="space-y-4" class:opacity-60={usingResend}>
					{#if usingResend}
						<p class="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
							{$t('settingsEmail.smtpDisabledNote')}
						</p>
					{/if}
				<div class="grid grid-cols-3 gap-3">
					<div class="col-span-2 space-y-1.5">
						<Label for="smtp-host">{$t('settingsEmail.smtpHost')}</Label>
						<Input id="smtp-host" type="text" placeholder="smtp.gmail.com" bind:value={smtpHost} />
					</div>
					<div class="space-y-1.5">
						<Label for="smtp-port">{$t('settingsEmail.port')}</Label>
						<Input id="smtp-port" type="text" placeholder="587" bind:value={smtpPort} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="smtp-user">{$t('settingsEmail.username')}</Label>
						<Input id="smtp-user" type="text" placeholder="you@example.com" bind:value={smtpUser} />
					</div>
					<div class="space-y-1.5">
						<Label for="smtp-pass">{$t('settingsEmail.password')}</Label>
						<Input id="smtp-pass" type="password"
							placeholder={emailSettings?.smtp_pass_set ? $t('settingsEmail.placeholderStored') : $t('settingsEmail.enterPassword')}
							bind:value={smtpPass} />
						{#if emailSettings?.smtp_pass_set && !smtpPass}
							<p class="text-xs text-muted-foreground">{$t('settingsEmail.storedKeep')}</p>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="email-from">{$t('settingsEmail.fromAddress')}</Label>
						<Input id="email-from" type="email" placeholder="bookings@example.com" bind:value={emailFrom} />
					</div>
					<div class="space-y-1.5">
						<Label for="email-from-name">{$t('settingsEmail.fromName')}</Label>
						<Input id="email-from-name" type="text" placeholder="Calnode" bind:value={emailFromName} />
					</div>
				</div>

				<div class="space-y-2 rounded-md border p-3">
					<p class="text-xs font-medium text-muted-foreground">{$t('settingsEmail.tlsEncryption')}</p>
					<div class="flex items-center justify-between gap-4">
						<div>
							<Label for="smtp-starttls" class="cursor-pointer font-normal">STARTTLS</Label>
							<p class="text-xs text-muted-foreground">{$t('settingsEmail.starttlsHint')}</p>
						</div>
						<Switch id="smtp-starttls" bind:checked={smtpStartTLS} />
					</div>
					<div class="flex items-center justify-between gap-4">
						<div>
							<Label for="smtp-tls" class="cursor-pointer font-normal">{$t('settingsEmail.implicitTls')}</Label>
							<p class="text-xs text-muted-foreground">{$t('settingsEmail.implicitTlsHint')}</p>
						</div>
						<Switch id="smtp-tls" bind:checked={smtpTLS} />
					</div>
				</div>
				</div>
			</div>

			<div class="mt-5 flex flex-wrap items-center gap-3">
				<Button onclick={save} disabled={savingFlag.active}>
					{savingFlag.active ? $t('common.saving') : $t('common.save')}
				</Button>
				<Button variant="outline" onclick={test} disabled={testingFlag.active || !emailSettings?.enabled}>
					{testingFlag.active ? $t('settingsEmail.sending') : $t('settingsEmail.sendTestEmail')}
				</Button>
			</div>
		</div>

		<div class="mt-4 rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-start justify-between gap-2">
				<div>
					<h2 class="text-sm font-semibold">{$t('settingsEmail.rsvpTitle')}</h2>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{$t('settingsEmail.rsvpDescription')}
					</p>
				</div>
				{#if emailSettings !== null}
					<span class="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {emailSettings.rsvp_tracking ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}">
						<span class="h-1.5 w-1.5 rounded-full {emailSettings.rsvp_tracking ? 'bg-green-500' : 'bg-muted-foreground/50'}"></span>
						{emailSettings.rsvp_tracking ? $t('settingsEmail.on') : $t('settingsEmail.off')}
					</span>
				{/if}
			</div>

			<p class="mb-4 rounded-md px-3 py-2 text-xs {emailSettings?.resend_api_key_set ? 'bg-muted text-muted-foreground' : 'border border-amber-200 bg-amber-50 text-amber-800'}">
				{$t('settingsEmail.rsvpKeyPart1')}<strong>{$t('settingsEmail.rsvpKeyFullAccess')}</strong>{$t('settingsEmail.rsvpKeyPart2')}
			</p>

			<div class="space-y-4">
				<div class="space-y-1.5">
					<Label for="rsvp-address">{$t('settingsEmail.rsvpAddressLabel')}</Label>
					<Input id="rsvp-address" type="email" placeholder="rsvp@reply.example.com" bind:value={rsvpAddress} />
					<p class="text-xs text-muted-foreground">
						{$t('settingsEmail.rsvpAddressHint')}
					</p>
				</div>

				<div class="space-y-2 rounded-md border p-3">
					<p class="text-xs font-medium">{$t('settingsEmail.webhookTitle')}</p>
					{#if emailSettings?.resend_webhook_secret_set && !clearWebhookSecret}
						<p class="text-xs text-muted-foreground">
							{$t('settingsEmail.webhookConnected1')}<code>{emailSettings.rsvp_webhook_url}</code>{$t('settingsEmail.webhookConnected2')}
						</p>
						<div class="flex flex-wrap items-center gap-2">
							<Button variant="outline" size="sm" class="h-7 text-xs" onclick={setupWebhook}
								disabled={settingUpWebhook || !emailSettings?.resend_api_key_set}>
								{settingUpWebhook ? $t('settingsEmail.checking') : $t('settingsEmail.rerunSetup')}
							</Button>
							<Button variant="ghost" size="sm" class="h-7 px-2 text-xs"
								onclick={() => (clearWebhookSecret = true)}>{$t('settingsEmail.removeSecret')}</Button>
						</div>
					{:else}
						{#if clearWebhookSecret}
							<div class="flex items-center justify-between gap-2">
								<p class="text-xs text-amber-700">{$t('settingsEmail.willRemoveSecret')}</p>
								<Button variant="ghost" size="sm" class="h-6 px-2 text-xs"
									onclick={() => (clearWebhookSecret = false)}>{$t('settingsEmail.undo')}</Button>
							</div>
						{:else}
							<p class="text-xs text-muted-foreground">
								{$t('settingsEmail.webhookAutoHint')}
							</p>
							<div class="flex flex-wrap items-center gap-2">
								<Button size="sm" class="h-7 text-xs" onclick={setupWebhook}
									disabled={settingUpWebhook || !emailSettings?.resend_api_key_set}>
									{settingUpWebhook ? $t('settingsEmail.settingUp') : $t('settingsEmail.setupWebhook')}
								</Button>
								<Button variant="ghost" size="sm" class="h-7 px-2 text-xs"
									onclick={() => (showManualWebhook = !showManualWebhook)}>
									{showManualWebhook ? $t('settingsEmail.hideManualSteps') : $t('settingsEmail.manualSetup')}
								</Button>
							</div>
						{/if}
					{/if}

					{#if webhookSetupError}
						<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
							{webhookSetupError}
						</p>
					{/if}

					{#if showManualWebhook && !clearWebhookSecret}
						<ol class="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
							<li>{$t('settingsEmail.step1a')}<strong>{$t('settingsEmail.step1b')}</strong>{$t('settingsEmail.step1c')}<strong>{$t('settingsEmail.step1d')}</strong>.</li>
							<li class="space-y-1">
								<span>{$t('settingsEmail.stepEndpoint')}</span>
								<Input id="rsvp-webhook-url" readonly value={emailSettings?.rsvp_webhook_url ?? ''} />
							</li>
							<li>{$t('settingsEmail.stepEvent')} <code>email.received</code>.</li>
							<li class="space-y-1">
								<span>{$t('settingsEmail.stepSecret')}</span>
								<Input id="rsvp-webhook-secret" type="password"
									placeholder={emailSettings?.resend_webhook_secret_set ? $t('settingsEmail.placeholderStored') : 'whsec_...'}
									bind:value={webhookSecret} />
							</li>
						</ol>
					{/if}
				</div>
			</div>

			<div class="mt-5">
				<Button onclick={save} disabled={savingFlag.active}>
					{savingFlag.active ? $t('common.saving') : $t('common.save')}
				</Button>
			</div>
		</div>
	</div>
{/if}

{/if}
