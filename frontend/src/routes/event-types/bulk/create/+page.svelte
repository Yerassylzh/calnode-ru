<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { api, type Question, type TeamMember } from '$lib/api';
	import { t } from '$lib/i18n';
	import { currentUser } from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';

	type Result = { status: 'created' | 'skipped' } | { status: 'failed'; message: string };
	type QuestionDraft = { id: number; label: string; type: Question['type']; options: string; required: boolean };

	let nextId = 1;
	let doctors = $state([{ id: nextId, hostId: '', surname: '', durations: '' }]);
	let members = $state<Pick<TeamMember, 'id' | 'name' | 'email'>[]>([]);
	let loadingMembers = $state(true);
	let membersFailed = $state(false);
	let questions = $state<QuestionDraft[]>([]);
	let results = $state<Record<string, Result>>({});
	let creating = $state(false);

	async function loadMembers() {
		loadingMembers = true;
		membersFailed = false;
		try {
			if ($currentUser?.is_admin) {
				members = (await api.get<TeamMember[]>('/v1/users') ?? []).filter((member) => !member.archived);
			} else if ($currentUser) {
				members = [$currentUser];
				doctors[0].hostId = $currentUser.id;
			}
		} catch {
			membersFailed = true;
		} finally {
			loadingMembers = false;
		}
	}

	onMount(loadMembers);

	const rows = $derived(doctors.map(({ hostId, surname, durations }) => {
		const slug = surname.trim().toLowerCase();
		const tokens = durations.trim().split(/[,\s]+/).filter(Boolean);
		const minutes = tokens.map(Number);
		return {
			slug,
			hostId,
			minutes,
			validSlug: /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug),
			validDurations: tokens.length > 0 && tokens.every((token, i) =>
				/^\d+$/.test(token) && Number.isSafeInteger(minutes[i]) && minutes[i] > 0)
		};
	}));
	const hostConflict = $derived.by(() => {
		const hostsBySurname = new Map<string, string>();
		for (const { slug, hostId, validSlug } of rows) {
			if (!validSlug || !hostId) continue;
			const assignedHost = hostsBySurname.get(slug);
			if (assignedHost && assignedHost !== hostId) return true;
			hostsBySurname.set(slug, hostId);
		}
		return false;
	});
	const questionPayload = $derived(questions.map(({ label, type, options, required }) => ({
		label: label.trim(),
		type,
		options: type === 'select' ? options.split('\n').map((option) => option.trim()).filter(Boolean) : undefined,
		required
	})));
	const valid = $derived(
		!hostConflict && rows.every((row) => row.hostId && row.validSlug && row.validDurations) &&
		questionPayload.every(({ label, type, options }) => label && (type !== 'select' || options?.length))
	);
	const events = $derived.by(() => {
		const bySlug = new Map<string, { slug: string; minutes: number; hostId: string }>();
		for (const row of rows) {
			if (!row.validSlug || !row.validDurations) continue;
			for (const minutes of row.minutes) {
				const slug = `${row.slug}_${minutes}_min`;
				bySlug.set(slug, { slug, minutes, hostId: row.hostId });
			}
		}
		return Array.from(bySlug.values());
	});
	const pending = $derived(events.filter(({ slug }) =>
		results[slug]?.status !== 'created' && results[slug]?.status !== 'skipped'));
	const createdCount = $derived(events.filter(({ slug }) => results[slug]?.status === 'created').length);
	const skippedCount = $derived(events.filter(({ slug }) => results[slug]?.status === 'skipped').length);
	const failedCount = $derived(events.filter(({ slug }) => results[slug]?.status === 'failed').length);

	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (creating || !valid || pending.length === 0) return;
		creating = true;
		try {
			for (const { slug, minutes, hostId } of pending) {
				try {
					await api.post('/v1/event-types', {
						slug,
						name: slug,
						duration_minutes: minutes,
						routing_mode: 'round_robin',
						host_user_id: hostId,
						questions: questionPayload
					});
					results[slug] = { status: 'created' };
				} catch (error) {
					if ((error as { status?: number } | null)?.status === 409) {
						results[slug] = { status: 'skipped' };
					} else {
						results[slug] = {
							status: 'failed',
							message: error instanceof Error ? error.message : $t('eventTypes.errorCreate')
						};
					}
				}
			}
		} finally {
			creating = false;
		}
	}
</script>

<svelte:head><title>{$t('eventTypes.bulk.title')} — Calnode</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<header>
		<Button href={`${base}/event-types`} variant="link" class="mb-2 px-0">
			← {$t('eventTypes.title')}
		</Button>
		<h1 class="text-2xl font-semibold tracking-tight">{$t('eventTypes.bulk.title')}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{$t('eventTypes.bulk.description')}</p>
	</header>

	<form onsubmit={create} class="space-y-6">
		<div class="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
			{#if membersFailed}
				<p role="alert" class="text-sm text-destructive">{$t('eventTypes.bulk.membersFailed')}</p>
				<Button variant="outline" onclick={loadMembers}>{$t('doctorBreaks.retry')}</Button>
			{/if}
			{#each doctors as doctor, i (doctor.id)}
				<div class="grid gap-3 border-b pb-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start">
					<div class="min-w-0 space-y-1.5">
						<Label for={`bulk-host-${doctor.id}`}>{$t('eventTypes.bulk.doctor')}</Label>
						<select id={`bulk-host-${doctor.id}`} bind:value={doctor.hostId}
							disabled={creating || loadingMembers || membersFailed}
							class="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
							<option value="" disabled>
								{loadingMembers ? $t('common.loading') : $t('eventTypes.bulk.selectDoctor')}
							</option>
							{#each members as member (member.id)}
								<option value={member.id}>{member.name ? `${member.name} (${member.email})` : member.email}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1.5">
						<Label for={`bulk-surname-${doctor.id}`}>{$t('eventTypes.bulk.surname')}</Label>
						<Input id={`bulk-surname-${doctor.id}`} bind:value={doctor.surname}
							placeholder="rodionova" disabled={creating}
							aria-invalid={!!doctor.surname && !rows[i].validSlug}
							aria-describedby={`bulk-surname-help-${doctor.id}`} />
						<p id={`bulk-surname-help-${doctor.id}`} class="text-xs text-muted-foreground">
							{$t('eventTypes.bulk.surnameHelp')}
						</p>
					</div>
					<div class="space-y-1.5">
						<Label for={`bulk-durations-${doctor.id}`}>{$t('eventTypes.durationLabel')}</Label>
						<Input id={`bulk-durations-${doctor.id}`} bind:value={doctor.durations}
							placeholder="20, 30, 45" disabled={creating}
							aria-invalid={!!doctor.durations && !rows[i].validDurations}
							aria-describedby={`bulk-duration-help-${doctor.id}`} />
						<p id={`bulk-duration-help-${doctor.id}`} class="text-xs text-muted-foreground">
							{$t('eventTypes.bulk.durationHelp')}
						</p>
					</div>
					{#if doctors.length > 1}
						<Button variant="ghost" class="justify-self-start sm:mt-5" disabled={creating}
							aria-label={$t('eventTypes.bulk.removeDoctorLabel', { count: i + 1 })}
							onclick={() => doctors = doctors.filter(({ id }) => id !== doctor.id)}>
							{$t('eventTypes.bulk.removeDoctor')}
						</Button>
					{/if}
				</div>
			{/each}
			<Button variant="outline" disabled={creating}
				onclick={() => doctors.push({ id: ++nextId, hostId: $currentUser?.is_admin ? '' : ($currentUser?.id ?? ''), surname: '', durations: '' })}>
				{$t('eventTypes.bulk.addDoctor')}
			</Button>
			{#if hostConflict}
				<p role="alert" class="text-sm text-destructive">{$t('eventTypes.bulk.hostConflict')}</p>
			{/if}
		</div>

		<section aria-labelledby="bulk-questions" class="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
			<div>
				<h2 id="bulk-questions" class="text-sm font-semibold">{$t('eventTypes.bulk.questions')}</h2>
				<p class="mt-1 text-sm text-muted-foreground">{$t('eventTypes.bulk.questionsHelp')}</p>
			</div>
			{#each questions as question, i (question.id)}
				<div class="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_auto]">
					<div class="space-y-1.5">
						<Label for={`bulk-question-${question.id}`}>{$t('questionsPanel.label')}</Label>
						<Input id={`bulk-question-${question.id}`} bind:value={question.label} disabled={creating} />
					</div>
					<div class="space-y-1.5">
						<Label for={`bulk-question-type-${question.id}`}>{$t('questionsPanel.type')}</Label>
						<select id={`bulk-question-type-${question.id}`} bind:value={question.type} disabled={creating}
							class="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
							<option value="text">{$t('questionsPanel.typeText')}</option>
							<option value="checkbox">{$t('questionsPanel.typeCheckbox')}</option>
							<option value="select">{$t('questionsPanel.typeSelect')}</option>
						</select>
					</div>
					<Button variant="ghost" class="justify-self-start sm:mt-5" disabled={creating}
						aria-label={$t('eventTypes.bulk.removeQuestionLabel', { count: i + 1 })}
						onclick={() => questions = questions.filter(({ id }) => id !== question.id)}>
						{$t('common.remove')}
					</Button>
					{#if question.type === 'select'}
						<div class="space-y-1.5 sm:col-span-3">
							<Label for={`bulk-question-options-${question.id}`}>{$t('questionsPanel.optionsLabel')}</Label>
							<Textarea id={`bulk-question-options-${question.id}`} bind:value={question.options}
								rows={3} disabled={creating} />
						</div>
					{/if}
					<div class="flex items-center gap-2 sm:col-span-3">
						<Checkbox id={`bulk-question-required-${question.id}`} bind:checked={question.required} disabled={creating} />
						<Label for={`bulk-question-required-${question.id}`}>{$t('questionsPanel.required')}</Label>
					</div>
				</div>
			{/each}
			<Button variant="outline" disabled={creating}
				onclick={() => questions.push({ id: ++nextId, label: '', type: 'text', options: '', required: false })}>
				{$t('questionsPanel.addQuestion')}
			</Button>
		</section>

		{#if events.length}
			<section aria-labelledby="bulk-preview" class="overflow-hidden rounded-lg border bg-card">
				<h2 id="bulk-preview" class="border-b px-4 py-3 text-sm font-semibold">
					{$t('eventTypes.bulk.preview', { count: events.length })}
				</h2>
				<ul class="max-h-96 divide-y overflow-auto text-sm">
					{#each events as { slug, minutes } (slug)}
						{@const result = results[slug]}
						<li class="grid gap-1 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-4">
							{#if result?.status === 'created'}
								<a class="break-all font-mono text-primary underline" href={`${base}/event-types/${slug}`}>{slug}</a>
							{:else}
								<span class="break-all font-mono">{slug}</span>
							{/if}
							<span class="text-muted-foreground">{$t('eventTypes.durationMinutes', { count: minutes })}</span>
							{#if result}
								<span class={result.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
									{$t(`eventTypes.bulk.${result.status}`)}
								</span>
								{#if result.status === 'failed'}
									<p class="break-words text-xs text-destructive sm:col-span-3">{result.message}</p>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="space-y-3">
			<p class="text-sm text-muted-foreground">{$t('eventTypes.bulk.routingHelp')}</p>
			<Button type="submit" disabled={creating || !valid || pending.length === 0}>
				{creating ? $t('eventTypes.creating') : $t('eventTypes.bulk.submit', { count: pending.length })}
			</Button>
			<div role="status" class="text-sm text-muted-foreground">
				{#if createdCount || skippedCount || failedCount}
					{$t('eventTypes.bulk.summary', { created: createdCount, skipped: skippedCount, failed: failedCount })}
				{/if}
			</div>
		</div>
	</form>
</div>
