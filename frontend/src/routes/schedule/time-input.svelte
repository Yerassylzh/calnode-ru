<script lang="ts">
	import { Clock3 } from '@lucide/svelte';
	import { cn } from '$lib/utils.js';

	let { value = $bindable(''), id, label, invalid = false }: {
		/** 'HH:MM', 24 h. */
		value?: string;
		id: string;
		label: string;
		invalid?: boolean;
	} = $props();

	// Typing "930" gives "09:3" -> "09:30": digits only, the colon appears by itself.
	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
		value = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
		event.currentTarget.value = value;
	}

	// On leaving the field: "9" -> "09:00", "930" -> "09:30", "0930" -> "09:30".
	function onblur() {
		const digits = value.replace(/\D/g, '');
		if (!digits) return;
		let hour: string;
		let minute = '00';
		if (digits.length <= 2) hour = digits.padStart(2, '0');
		else if (digits.length === 3) {
			hour = '0' + digits[0];
			minute = digits.slice(1);
		} else {
			hour = digits.slice(0, 2);
			minute = digits.slice(2);
		}
		if (Number(hour) < 24 && Number(minute) < 60) value = hour + ':' + minute.padEnd(2, '0');
	}
</script>

<div class="relative">
	<Clock3 class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
	<input {id} aria-label={label} type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="09:30"
		{value} {oninput} {onblur} aria-invalid={invalid}
		class={cn('h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm tabular-nums outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20',
			invalid ? 'border-destructive focus:ring-destructive/20' : 'border-input')} />
</div>
