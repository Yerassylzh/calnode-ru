<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type User } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { createAsyncFlag } from '$lib/async-action.svelte';
	import { t } from '$lib/i18n';

	const loadingFlag = createAsyncFlag(true);
	const savingFlag = createAsyncFlag();

	let notify_confirmation = $state(true);
	let notify_cancellation = $state(true);
	let notify_reschedule = $state(true);
	let notify_reminder = $state(true);
	let notify_host_booking = $state(true);
	let notify_host_cancel = $state(true);
	let notify_host_reschedule = $state(true);

	onMount(() => loadingFlag.run(async () => {
		const user = await api.get<User>('/v1/users/me');
		notify_confirmation = user.notify_confirmation ?? true;
		notify_cancellation = user.notify_cancellation ?? true;
		notify_reschedule = user.notify_reschedule ?? true;
		notify_reminder = user.notify_reminder ?? true;
		notify_host_booking = user.notify_host_booking ?? true;
		notify_host_cancel = user.notify_host_cancel ?? true;
		notify_host_reschedule = user.notify_host_reschedule ?? true;
	}, $t('settingsNotifications.loadFailed')));

	async function save() {
		await savingFlag.run(async () => {
			const updated = await api.patch<User>('/v1/users/me', {
				notify_confirmation, notify_cancellation, notify_reschedule, notify_reminder,
				notify_host_booking, notify_host_cancel, notify_host_reschedule,
			});
			currentUser.set(updated);
			toast.success($t('settingsNotifications.saved'));
		}, $t('settingsNotifications.saveFailed'));
	}
</script>

<svelte:window onkeydown={saveOnCmdS(save, () => !savingFlag.active)} />

{#if loadingFlag.active}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else}
	<div class="max-w-lg space-y-4">
		<div class="rounded-lg border bg-card p-6">
			<h2 class="mb-1 text-sm font-semibold">{$t('settingsNotifications.title')}</h2>
			<p class="mb-5 text-xs text-muted-foreground">{$t('settingsNotifications.description')}</p>

			<div class="space-y-5">
				<div>
					<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{$t('settingsNotifications.attendeeSection')}</p>
					<div class="space-y-3">
						<div class="flex items-center justify-between gap-4">
							<Label for="nc" class="cursor-pointer font-normal">{$t('settingsNotifications.bookingConfirmation')}</Label>
							<Switch id="nc" bind:checked={notify_confirmation} />
						</div>
						<div class="flex items-center justify-between gap-4">
							<Label for="nca" class="cursor-pointer font-normal">{$t('settingsNotifications.cancellationNotice')}</Label>
							<Switch id="nca" bind:checked={notify_cancellation} />
						</div>
						<div class="flex items-center justify-between gap-4">
							<Label for="nr" class="cursor-pointer font-normal">{$t('settingsNotifications.rescheduleNotice')}</Label>
							<Switch id="nr" bind:checked={notify_reschedule} />
						</div>
						<div class="flex items-center justify-between gap-4">
							<Label for="nrm" class="cursor-pointer font-normal">{$t('settingsNotifications.reminderEmails')}</Label>
							<Switch id="nrm" bind:checked={notify_reminder} />
						</div>
					</div>
				</div>

				<div class="border-t pt-5">
					<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{$t('settingsNotifications.hostSection')}</p>
					<div class="space-y-3">
						<div class="flex items-center justify-between gap-4">
							<Label for="nhb" class="cursor-pointer font-normal">{$t('settingsNotifications.hostBooking')}</Label>
							<Switch id="nhb" bind:checked={notify_host_booking} />
						</div>
						<div class="flex items-center justify-between gap-4">
							<Label for="nhc" class="cursor-pointer font-normal">{$t('settingsNotifications.hostCancel')}</Label>
							<Switch id="nhc" bind:checked={notify_host_cancel} />
						</div>
						<div class="flex items-center justify-between gap-4">
							<Label for="nhr" class="cursor-pointer font-normal">{$t('settingsNotifications.hostReschedule')}</Label>
							<Switch id="nhr" bind:checked={notify_host_reschedule} />
						</div>
					</div>
				</div>
			</div>
		</div>

		<Button onclick={save} disabled={savingFlag.active}>
			{savingFlag.active ? $t('common.saving') : $t('common.save')}
		</Button>
	</div>
{/if}
