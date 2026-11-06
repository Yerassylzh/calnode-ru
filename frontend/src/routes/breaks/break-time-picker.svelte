<script lang="ts">
	import { ChevronDown, Clock } from '@lucide/svelte';
	import { t } from '$lib/i18n';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';

	let { id, label, value = $bindable(), disabled = false }: {
		id: string;
		label: string;
		value: string;
		disabled?: boolean;
	} = $props();

	const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
	const quickMinutes = ['00', '15', '30', '45'];
	let open = $state(false);
	let hour = $state('');
	let minute = $state('');
	const validMinute = $derived(/^[0-5]?[0-9]$/.test(minute));
	const preview = $derived(validMinute ? `${hour}:${minute.padStart(2, '0')}` : `${hour}:––`);

	function changeOpen(nextOpen: boolean) {
		if (nextOpen) [hour, minute] = value.split(':');
		open = nextOpen;
	}

	function applyTime(event: SubmitEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!validMinute) return;
		value = preview;
		open = false;
	}
</script>

<label for={id} class="block text-sm font-medium">{label}</label>
<Popover.Root {open} onOpenChange={changeOpen}>
	<Popover.Trigger {id} {disabled} aria-labelledby={`${id}-label ${id}-value`}
		class={buttonVariants({ variant: 'outline', class: 'h-11 w-full justify-start gap-2 px-3 font-normal' })}>
		<span id={`${id}-label`} class="sr-only">{label}</span>
		<Clock class="size-4 text-muted-foreground" aria-hidden="true" />
		<span id={`${id}-value`} class="tabular-nums">{value}</span>
		<ChevronDown class="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Content align="start" sideOffset={8} role="dialog" aria-label={label}
		class="max-h-(--bits-popover-content-available-height) w-[min(19rem,calc(100vw-2rem))] overflow-y-auto rounded-xl p-4 shadow-lg">
		<form onsubmit={applyTime} class="space-y-4">
			<div class="flex items-center justify-between gap-2">
				<h3 class="text-sm font-semibold">{label}</h3>
				<span class="rounded-md bg-muted px-2 py-1 text-sm font-semibold tabular-nums">{preview}</span>
			</div>

			<fieldset class="min-w-0">
				<legend class="mb-2 text-xs font-medium text-muted-foreground">{$t('doctorBreaks.hour')}</legend>
				<div class="grid grid-cols-6 gap-1">
					{#each hours as option (option)}
						<Button variant={hour === option ? 'default' : 'outline'} class="h-9 px-0 tabular-nums"
							aria-pressed={hour === option} onclick={() => (hour = option)}>
							{option}
						</Button>
					{/each}
				</div>
			</fieldset>

			<div class="space-y-2">
				<div class="flex items-center justify-between gap-3">
					<div>
						<label for={`${id}-minute`} class="block text-sm font-medium">
							{$t('doctorBreaks.enterMinutes')}
						</label>
						<p id={`${id}-minute-hint`} class="text-xs text-muted-foreground">
							{$t('doctorBreaks.minuteRange')}
						</p>
					</div>
					<Input id={`${id}-minute`} type="text" inputmode="numeric" maxlength={2}
						bind:value={minute} aria-invalid={!validMinute} aria-describedby={`${id}-minute-hint`}
						onfocus={(event) => event.currentTarget.select()}
						class="h-10 w-16 shrink-0 bg-background px-0 text-center tabular-nums" />
				</div>
				<div class="grid grid-cols-4 gap-1">
					{#each quickMinutes as option (option)}
						<Button variant={minute === option ? 'default' : 'outline'} class="h-9 px-0 tabular-nums"
							aria-pressed={minute === option} onclick={() => (minute = option)}>
							:{option}
						</Button>
					{/each}
				</div>
			</div>

			<Button type="submit" disabled={!validMinute} class="h-10 w-full">
				{$t('doctorBreaks.applyTime')}
			</Button>
		</form>
	</Popover.Content>
</Popover.Root>
