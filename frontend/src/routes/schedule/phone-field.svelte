<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { isValidPhone, normalizePhone } from '$lib/phone';
	import { t } from '$lib/i18n';

	let { value = $bindable(''), id }: { value?: string; id: string } = $props();

	// Show the problem only after the person has left the field, never while they are typing.
	let touched = $state(false);
	const invalid = $derived(touched && value !== '' && !isValidPhone(value));

	function onblur() {
		value = normalizePhone(value);
		touched = true;
	}
</script>

<div class="space-y-1">
	<Input {id} class="h-11 bg-muted/15 shadow-xs" type="tel" inputmode="tel" autocomplete="tel" bind:value {onblur}
		placeholder="+7 701 123 45 67" aria-invalid={invalid} aria-describedby={invalid ? id + '-error' : undefined} />
	{#if invalid}<p id={id + '-error'} class="text-xs text-destructive">{$t('schedule.phoneInvalid')}</p>{/if}
</div>
