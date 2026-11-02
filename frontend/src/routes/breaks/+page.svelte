<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type DoctorBreak, type AvailabilityRule, type TeamMember } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { prefs } from '$lib/prefs';
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { ConfirmDialog } from '$lib/components/ui/confirm-dialog';
	import * as Select from '$lib/components/ui/select';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import { toast } from 'svelte-sonner';

	// ── State ─────────────────────────────────────────────────────────────────────
	let loading = $state(true);
	let doctors = $state<TeamMember[]>([]);
	let selectedDoctorId = $state('');

	let breaks = $state<DoctorBreak[]>([]);
	let breaksLoading = $state(false);

	let rules = $state<AvailabilityRule[]>([]);
	let rulesLoading = $state(false);

	// Tab mode: 'weekly' or 'date'
	let breakMode = $state<'weekly' | 'date'>('weekly');

	// Form fields
	let selectedDays = $state<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
	let specificDate = $state('');
	let startTime = $state('13:00');
	let endTime = $state('14:00');
	let breakTitle = $state('Обеденный перерыв');
	let saving = $state(false);
	let formError = $state('');

	// Visual timeline selected day (0=Sun .. 6=Sat, default Mon=1)
	let timelineDay = $state(1);

	// Filter for breaks list
	let filterKind = $state<'all' | 'weekly' | 'date'>('all');

	// Delete dialog state
	let deleteOpen = $state(false);
	let deleteId = $state('');

	// Time options for dropdowns (every 15 mins)
	const TIME_OPTIONS: string[] = [];
	for (let h = 7; h <= 22; h++) {
		for (const m of [0, 15, 30, 45]) {
			if (h === 22 && m > 0) break;
			TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
		}
	}

	const selectedDoctor = $derived(
		doctors.find((d) => d.id === selectedDoctorId) ?? null
	);

	// Working hours for the selected doctor on each day of week (0..6)
	const dayRules = $derived.by(() => {
		const map: Record<number, AvailabilityRule[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
		for (const r of rules) {
			if (map[r.day_of_week]) {
				map[r.day_of_week].push(r);
			}
		}
		for (const d in map) {
			map[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
		}
		return map;
	});

	const filteredBreaks = $derived.by(() => {
		if (filterKind === 'all') return breaks;
		return breaks.filter((b) => b.kind === filterKind);
	});

	// Weekly breaks for current timeline day
	const timelineBreaks = $derived.by(() => {
		return breaks.filter((b) => b.kind === 'weekly' && b.day_of_week === timelineDay);
	});

	// Working windows for current timeline day
	const timelineWindows = $derived(dayRules[timelineDay] ?? []);

	// Calculate duration string in Russian
	function getDurationLabel(start: string, end: string) {
		const [h1, m1] = start.split(':').map(Number);
		const [h2, m2] = end.split(':').map(Number);
		const totalMins = (h2 * 60 + m2) - (h1 * 60 + m1);
		if (totalMins <= 0) return '';
		const h = Math.floor(totalMins / 60);
		const m = totalMins % 60;
		if (h > 0 && m > 0) return `${h} ч ${m} мин`;
		if (h > 0) return `${h} ч`;
		return `${m} мин`;
	}

	function formatTime(t: string) {
		return t;
	}

	// ── Presets ───────────────────────────────────────────────────────────────────
	function applyPreset(preset: { title: string; start: string; end: string }) {
		breakTitle = preset.title;
		startTime = preset.start;
		endTime = preset.end;
		formError = '';
	}

	// ── Loaders ───────────────────────────────────────────────────────────────────
	onMount(async () => {
		await loadDoctors();
	});

	async function loadDoctors() {
		loading = true;
		try {
			if ($currentUser?.is_admin) {
				const users = await api.get<TeamMember[]>('/v1/users');
				doctors = users ?? [];
			} else if ($currentUser) {
				doctors = [{
					id: $currentUser.id,
					name: $currentUser.name,
					email: $currentUser.email,
					timezone: $currentUser.timezone,
					is_admin: $currentUser.is_admin,
					is_owner: $currentUser.is_owner,
					role: $currentUser.role,
					email_login: false,
					created_at: '',
					archived: false,
					teams: []
				}];
			}
			if (doctors.length > 0) {
				selectedDoctorId = doctors[0].id;
				await loadDoctorData(selectedDoctorId);
			}
		} catch (e: any) {
			toast.error(e.message || $t('common.error'));
		} finally {
			loading = false;
		}
	}

	async function loadDoctorData(docId: string) {
		if (!docId) return;
		await Promise.all([loadBreaks(docId), loadRules(docId)]);
	}

	async function loadBreaks(docId: string) {
		breaksLoading = true;
		try {
			const res = await api.get<{ items: DoctorBreak[] }>(`/v1/doctor-breaks?user_id=${docId}`);
			breaks = res.items ?? [];
		} catch (e: any) {
			breaks = [];
		} finally {
			breaksLoading = false;
		}
	}

	async function loadRules(docId: string) {
		rulesLoading = true;
		try {
			const res = await api.get<{ items: AvailabilityRule[] }>(`/v1/availability-rules?user_id=${docId}`);
			rules = res.items ?? [];
		} catch (e: any) {
			rules = [];
		} finally {
			rulesLoading = false;
		}
	}

	async function onDoctorChange(docId: string) {
		selectedDoctorId = docId;
		await loadDoctorData(docId);
	}

	// Toggle a day chip
	function toggleDay(d: number) {
		if (selectedDays.includes(d)) {
			if (selectedDays.length > 1) {
				selectedDays = selectedDays.filter((x) => x !== d);
			}
		} else {
			selectedDays = [...selectedDays, d].sort();
		}
	}

	function selectWeekdays() {
		selectedDays = [1, 2, 3, 4, 5];
	}

	function selectAllDays() {
		selectedDays = [0, 1, 2, 3, 4, 5, 6];
	}

	// ── Set standard hours for doctor if empty ─────────────────────────────────────
	async function setStandardWorkingHours() {
		if (!selectedDoctorId) return;
		try {
			// Mon-Fri 09:00 - 18:00
			for (let dow = 1; dow <= 5; dow++) {
				await api.post('/v1/availability-rules', {
					user_id: selectedDoctorId,
					day_of_week: dow,
					start_time: '09:00',
					end_time: '18:00'
				});
			}
			await loadRules(selectedDoctorId);
			toast.success($t('doctorBreaks.hoursUpdated'));
		} catch (e: any) {
			toast.error(e.message || $t('common.error'));
		}
	}

	// ── Create Break ──────────────────────────────────────────────────────────────
	async function handleAddBreak() {
		formError = '';
		if (!selectedDoctorId) {
			formError = $t('doctorBreaks.error.doctorRequired');
			return;
		}
		if (startTime >= endTime) {
			formError = $t('doctorBreaks.error.timeInvalid');
			return;
		}

		if (breakMode === 'weekly') {
			if (selectedDays.length === 0) {
				formError = $t('doctorBreaks.error.dayRequired');
				return;
			}
		} else {
			if (!specificDate) {
				formError = $t('doctorBreaks.error.dateRequired');
				return;
			}
		}

		saving = true;
		try {
			if (breakMode === 'weekly') {
				for (const dow of selectedDays) {
					await api.post('/v1/doctor-breaks', {
						user_id: selectedDoctorId,
						kind: 'weekly',
						day_of_week: dow,
						start_time: startTime,
						end_time: endTime,
						title: breakTitle.trim() || 'Перерыв'
					});
				}
			} else {
				await api.post('/v1/doctor-breaks', {
					user_id: selectedDoctorId,
					kind: 'date',
					date: specificDate,
					start_time: startTime,
					end_time: endTime,
					title: breakTitle.trim() || 'Перерыв'
				});
			}

			toast.success($t('doctorBreaks.addedSuccess'));
			await loadBreaks(selectedDoctorId);
		} catch (e: any) {
			formError = e.message || $t('common.error');
		} finally {
			saving = false;
		}
	}

	function confirmDelete(id: string) {
		deleteId = id;
		deleteOpen = true;
	}

	async function doDelete() {
		if (!deleteId) return;
		try {
			await api.del(`/v1/doctor-breaks/${deleteId}`);
			toast.success($t('doctorBreaks.deletedSuccess'));
			await loadBreaks(selectedDoctorId);
		} catch (e: any) {
			toast.error(e.message || $t('common.error'));
		}
	}
</script>

<svelte:head>
	<title>{$t('doctorBreaks.pageTitle')}</title>
</svelte:head>

<div class="space-y-6 max-w-6xl mx-auto px-4 py-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
				<span class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
				</span>
				{$t('doctorBreaks.heading')}
			</h1>
			<p class="text-sm text-muted-foreground mt-1">
				{$t('doctorBreaks.subtitle')}
			</p>
		</div>
	</div>

	<!-- Doctor Selector & Quick Profile Card -->
	<div class="rounded-xl border bg-card p-5 shadow-xs">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div class="space-y-1.5 min-w-[280px]">
				<label for="doctor-select" class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{$t('doctorBreaks.selectDoctor')}
				</label>
				{#if doctors.length > 0}
					<Select.Root type="single" value={selectedDoctorId} onValueChange={(v) => { if (v) onDoctorChange(v); }}>
						<Select.Trigger id="doctor-select" class="w-full md:w-[320px] font-medium bg-background">
							{selectedDoctor ? `${selectedDoctor.name} (${selectedDoctor.email})` : $t('doctorBreaks.doctorPlaceholder')}
						</Select.Trigger>
						<Select.Content>
							{#each doctors as doc}
								<Select.Item value={doc.id} label={`${doc.name} (${doc.email})`}>
									<div class="flex items-center gap-2">
										<div class="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
											{doc.name.slice(0, 1).toUpperCase()}
										</div>
										<span>{doc.name}</span>
										<span class="text-xs text-muted-foreground">({doc.email})</span>
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{:else if loading}
					<div class="text-sm text-muted-foreground">{$t('common.loading')}</div>
				{/if}
			</div>

			<!-- Doctor Stats Summary -->
			{#if selectedDoctor}
				<div class="flex flex-wrap items-center gap-3 bg-muted/40 p-3 rounded-lg border text-sm">
					<div class="flex items-center gap-2">
						<span class="size-2 rounded-full bg-emerald-500"></span>
						<span class="font-medium">{selectedDoctor.name}</span>
						<Badge variant="secondary" class="text-xs">{$t('doctorBreaks.doctorRole')}</Badge>
					</div>
					<div class="text-muted-foreground text-xs border-l pl-3">
						{$t('doctorBreaks.timezone')}: <span class="font-mono text-foreground">{selectedDoctor.timezone || 'Europe/Moscow'}</span>
					</div>
					<div class="text-muted-foreground text-xs border-l pl-3">
						{$t('doctorBreaks.activeBreaks')}: <Badge variant="outline" class="font-semibold ml-1">{breaks.length}</Badge>
					</div>
				</div>
			{/if}
		</div>

		<!-- Working hours note if empty -->
		{#if selectedDoctor && rules.length === 0 && !rulesLoading}
			<div class="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
				<div class="flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-600 dark:text-amber-400 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<span>{$t('doctorBreaks.noHoursSet')}. Чтобы перерывы работали корректно, задайте рабочие часы врача.</span>
				</div>
				<Button size="sm" variant="outline" class="border-amber-500/30 text-amber-900 dark:text-amber-100 hover:bg-amber-500/20 shrink-0" onclick={setStandardWorkingHours}>
					{$t('doctorBreaks.setStandardHours')}
				</Button>
			</div>
		{/if}
	</div>

	<!-- Main Grid: Left = Form to Add Break, Right = Visual Schedule & Configured Breaks -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		<!-- Add Break Form Column (5 cols) -->
		<div class="lg:col-span-5 space-y-5">
			<div class="rounded-xl border bg-card p-5 shadow-xs space-y-4">
				<div class="flex items-center justify-between border-b pb-3">
					<h2 class="font-semibold text-base flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
						{$t('doctorBreaks.addBreak')}
					</h2>
				</div>

				<!-- Break Mode Selector: Weekly vs Date -->
				<div class="grid grid-cols-2 p-1 bg-muted rounded-lg text-sm font-medium">
					<button
						type="button"
						class="py-1.5 px-3 rounded-md transition-all text-center {breakMode === 'weekly' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { breakMode = 'weekly'; }}
					>
						{$t('doctorBreaks.tabWeekly')}
					</button>
					<button
						type="button"
						class="py-1.5 px-3 rounded-md transition-all text-center {breakMode === 'date' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { breakMode = 'date'; }}
					>
						{$t('doctorBreaks.tabDate')}
					</button>
				</div>

				<!-- Quick Presets Pills -->
				<div class="space-y-2">
					<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						{$t('doctorBreaks.quickPresets')}
					</span>
					<div class="flex flex-wrap gap-1.5">
						<button
							type="button"
							class="text-xs px-2.5 py-1 rounded-full border bg-muted/30 hover:bg-muted transition-colors flex items-center gap-1.5 text-foreground"
							onclick={() => applyPreset({ title: 'Обеденный перерыв', start: '13:00', end: '14:00' })}
						>
							<span>🍽️</span> {$t('doctorBreaks.presetLunch13')}
						</button>
						<button
							type="button"
							class="text-xs px-2.5 py-1 rounded-full border bg-muted/30 hover:bg-muted transition-colors flex items-center gap-1.5 text-foreground"
							onclick={() => applyPreset({ title: 'Обед', start: '12:00', end: '13:00' })}
						>
							<span>🍽️</span> {$t('doctorBreaks.presetLunch12')}
						</button>
						<button
							type="button"
							class="text-xs px-2.5 py-1 rounded-full border bg-muted/30 hover:bg-muted transition-colors flex items-center gap-1.5 text-foreground"
							onclick={() => applyPreset({ title: 'Кофе-брейк', start: '11:00', end: '11:15' })}
						>
							<span>☕</span> {$t('doctorBreaks.presetCoffee15')}
						</button>
						<button
							type="button"
							class="text-xs px-2.5 py-1 rounded-full border bg-muted/30 hover:bg-muted transition-colors flex items-center gap-1.5 text-foreground"
							onclick={() => applyPreset({ title: 'Санитарная обработка', start: '15:00', end: '15:30' })}
						>
							<span>🧼</span> {$t('doctorBreaks.presetSanitation30')}
						</button>
						<button
							type="button"
							class="text-xs px-2.5 py-1 rounded-full border bg-muted/30 hover:bg-muted transition-colors flex items-center gap-1.5 text-foreground"
							onclick={() => applyPreset({ title: 'Консилиум / Планёрка', start: '16:00', end: '17:00' })}
						>
							<span>👥</span> {$t('doctorBreaks.presetMeeting60')}
						</button>
					</div>
				</div>

				<!-- Days Selection (for Weekly) -->
				{#if breakMode === 'weekly'}
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">{$t('doctorBreaks.daysOfWeek')}</span>
							<div class="flex gap-2">
								<button
									type="button"
									class="text-xs text-primary hover:underline font-medium"
									onclick={selectWeekdays}
								>
									{$t('doctorBreaks.weekdays')}
								</button>
								<span class="text-xs text-muted-foreground">·</span>
								<button
									type="button"
									class="text-xs text-primary hover:underline font-medium"
									onclick={selectAllDays}
								>
									{$t('doctorBreaks.allDays')}
								</button>
							</div>
						</div>
						<div class="grid grid-cols-7 gap-1">
							{#each [1, 2, 3, 4, 5, 6, 0] as dow}
								<button
									type="button"
									class="h-9 rounded-lg text-xs font-semibold transition-all border {selectedDays.includes(dow) ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'}"
									onclick={() => toggleDay(dow)}
								>
									{$t(`doctorBreaks.dayShort.${dow}`)}
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<!-- Date Picker (for Date-specific) -->
					<div class="space-y-2">
						<label for="break-date" class="text-sm font-medium">{$t('doctorBreaks.date')}</label>
						<div>
							<DatePicker bind:value={specificDate} placeholder={$t('doctorBreaks.pickDate')} minToday={true} class="w-full" />
						</div>
					</div>
				{/if}

				<!-- Time Range Inputs -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium">{$t('doctorBreaks.timeRange')}</span>
						{#if startTime && endTime && startTime < endTime}
							<span class="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
								Длительность: {getDurationLabel(startTime, endTime)}
							</span>
						{/if}
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<span class="text-xs text-muted-foreground">{$t('doctorBreaks.timeFrom')}</span>
							<Select.Root type="single" bind:value={startTime}>
								<Select.Trigger class="w-full font-mono bg-background">{formatTime(startTime)}</Select.Trigger>
								<Select.Content class="max-h-56">
									{#each TIME_OPTIONS as tOpt}
										<Select.Item value={tOpt} label={tOpt}>{tOpt}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-1">
							<span class="text-xs text-muted-foreground">{$t('doctorBreaks.timeTo')}</span>
							<Select.Root type="single" bind:value={endTime}>
								<Select.Trigger class="w-full font-mono bg-background">{formatTime(endTime)}</Select.Trigger>
								<Select.Content class="max-h-56">
									{#each TIME_OPTIONS as tOpt}
										<Select.Item value={tOpt} label={tOpt}>{tOpt}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				</div>

				<!-- Title / Reason Input -->
				<div class="space-y-2">
					<label for="break-title" class="text-sm font-medium">{$t('doctorBreaks.titleLabel')}</label>
					<Input
						id="break-title"
						bind:value={breakTitle}
						placeholder={$t('doctorBreaks.titlePlaceholder')}
						class="bg-background"
					/>
				</div>

				{#if formError}
					<div class="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md font-medium">
						{formError}
					</div>
				{/if}

				<!-- Submit Button -->
				<Button
					class="w-full font-semibold shadow-xs bg-amber-600 hover:bg-amber-700 text-white"
					disabled={saving || !selectedDoctorId}
					onclick={handleAddBreak}
				>
					{#if saving}
						<svg class="animate-spin -ml-1 mr-2 size-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
						{$t('doctorBreaks.submitting')}
					{:else}
						{$t('doctorBreaks.submit')}
					{/if}
				</Button>
			</div>
		</div>

		<!-- Right Column: Visual Schedule Bar & Configured Breaks List (7 cols) -->
		<div class="lg:col-span-7 space-y-6">
			<!-- Visual Schedule Timeline -->
			<div class="rounded-xl border bg-card p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
					<div>
						<h2 class="font-semibold text-base flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
							{$t('doctorBreaks.visualTimeline')}
						</h2>
						<p class="text-xs text-muted-foreground mt-0.5">
							{$t('doctorBreaks.visualTimelineHint')}
						</p>
					</div>

					<!-- Day Switcher for Timeline -->
					<div class="flex gap-1 bg-muted p-1 rounded-lg">
						{#each [1, 2, 3, 4, 5, 6, 0] as d}
							<button
								type="button"
								class="px-2 py-1 text-xs font-semibold rounded-md transition-all {timelineDay === d ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
								onclick={() => { timelineDay = d; }}
							>
								{$t(`doctorBreaks.dayShort.${d}`)}
							</button>
						{/each}
					</div>
				</div>

				<!-- Timeline Bar -->
				<div class="space-y-3 pt-1">
					<div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
						<span>08:00</span>
						<span>10:00</span>
						<span>12:00</span>
						<span>14:00</span>
						<span>16:00</span>
						<span>18:00</span>
						<span>20:00</span>
					</div>

					<!-- 12-hour bar (08:00 to 20:00 = 720 minutes) -->
					<div class="relative h-12 w-full rounded-lg bg-muted/50 border overflow-hidden flex items-center">
						<!-- Base working windows -->
						{#each timelineWindows as w}
							{@const [sh, sm] = w.start_time.split(':').map(Number)}
							{@const [eh, em] = w.end_time.split(':').map(Number)}
							{@const startMin = Math.max(0, (sh * 60 + sm) - 480)}
							{@const endMin = Math.min(720, (eh * 60 + em) - 480)}
							{@const leftPct = (startMin / 720) * 100}
							{@const widthPct = Math.max(0, ((endMin - startMin) / 720) * 100)}
							{#if widthPct > 0}
								<div
									class="absolute top-1 bottom-1 bg-emerald-500/20 border-y border-emerald-500/40 rounded text-emerald-800 dark:text-emerald-200 text-[10px] font-medium flex items-center justify-center overflow-hidden"
									style="left: {leftPct}%; width: {widthPct}%;"
									title="Рабочее время: {w.start_time} - {w.end_time}"
								>
									{w.start_time}–{w.end_time}
								</div>
							{/if}
						{/each}

						<!-- Breaks overlays -->
						{#each timelineBreaks as b}
							{@const [sh, sm] = b.start_time.split(':').map(Number)}
							{@const [eh, em] = b.end_time.split(':').map(Number)}
							{@const startMin = Math.max(0, (sh * 60 + sm) - 480)}
							{@const endMin = Math.min(720, (eh * 60 + em) - 480)}
							{@const leftPct = (startMin / 720) * 100}
							{@const widthPct = Math.max(0, ((endMin - startMin) / 720) * 100)}
							{#if widthPct > 0}
								<div
									class="absolute top-0.5 bottom-0.5 bg-amber-500 border border-amber-600 text-white rounded text-[11px] font-bold shadow-xs flex items-center justify-center px-1 z-10 overflow-hidden"
									style="left: {leftPct}%; width: {widthPct}%;"
									title="{b.title}: {b.start_time} - {b.end_time}"
								>
									<span class="truncate">{b.title} ({b.start_time}–{b.end_time})</span>
								</div>
							{/if}
						{/each}

						{#if timelineWindows.length === 0}
							<div class="w-full text-center text-xs text-muted-foreground italic">
								На этот день у врача не заданы рабочие часы
							</div>
						{/if}
					</div>

					<!-- Legend -->
					<div class="flex flex-wrap items-center gap-4 text-xs pt-1">
						<div class="flex items-center gap-1.5">
							<span class="size-3 rounded-xs bg-emerald-500/30 border border-emerald-500/50"></span>
							<span class="text-muted-foreground">{$t('doctorBreaks.workHoursLegend')}</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="size-3 rounded-xs bg-amber-500 border border-amber-600"></span>
							<span class="text-muted-foreground font-medium text-foreground">{$t('doctorBreaks.breakHoursLegend')}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Configured Breaks List -->
			<div class="rounded-xl border bg-card p-5 shadow-xs space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
					<div class="flex items-center gap-2">
						<h2 class="font-semibold text-base">{$t('doctorBreaks.activeBreaks')}</h2>
						<Badge variant="secondary" class="font-bold">{breaks.length}</Badge>
					</div>

					<!-- Filter Kind Tabs -->
					<div class="flex gap-1 bg-muted p-1 rounded-lg text-xs font-medium">
						<button
							type="button"
							class="px-2.5 py-1 rounded-md transition-all {filterKind === 'all' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}"
							onclick={() => { filterKind = 'all'; }}
						>
							{$t('doctorBreaks.filterAll')}
						</button>
						<button
							type="button"
							class="px-2.5 py-1 rounded-md transition-all {filterKind === 'weekly' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}"
							onclick={() => { filterKind = 'weekly'; }}
						>
							{$t('doctorBreaks.filterWeekly')}
						</button>
						<button
							type="button"
							class="px-2.5 py-1 rounded-md transition-all {filterKind === 'date' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}"
							onclick={() => { filterKind = 'date'; }}
						>
							{$t('doctorBreaks.filterDate')}
						</button>
					</div>
				</div>

				{#if breaksLoading}
					<div class="py-8 text-center text-sm text-muted-foreground">{$t('common.loading')}</div>
				{:else if filteredBreaks.length === 0}
					<div class="py-10 text-center space-y-2">
						<div class="size-12 rounded-full bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
						</div>
						<div class="font-medium text-sm text-foreground">{$t('doctorBreaks.noBreaks')}</div>
						<div class="text-xs text-muted-foreground max-w-sm mx-auto">
							{$t('doctorBreaks.noBreaksHint')}
						</div>
					</div>
				{:else}
					<div class="divide-y border rounded-lg overflow-hidden bg-background">
						{#each filteredBreaks as b}
							<div class="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
								<div class="flex items-center gap-3 min-w-0">
									<div class="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
										{#if b.title.toLowerCase().includes('обед')}
											<span>🍽️</span>
										{:else if b.title.toLowerCase().includes('кофе')}
											<span>☕</span>
										{:else if b.title.toLowerCase().includes('сан') || b.title.toLowerCase().includes('обработк')}
											<span>🧼</span>
										{:else}
											<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
										{/if}
									</div>
									<div class="min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-semibold text-sm text-foreground truncate">{b.title}</span>
											<Badge variant="outline" class="text-[11px] font-normal py-0">
												{getDurationLabel(b.start_time, b.end_time)}
											</Badge>
										</div>
										<div class="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
											{#if b.kind === 'weekly' && b.day_of_week !== undefined && b.day_of_week !== null}
												<span class="font-medium text-foreground">{$t(`doctorBreaks.day.${b.day_of_week}`)}</span>
												<span>·</span>
											{:else if b.kind === 'date' && b.date}
												<span class="font-medium text-foreground">{b.date}</span>
												<span>·</span>
											{/if}
											<span class="font-mono font-semibold text-foreground/90">{b.start_time} — {b.end_time}</span>
										</div>
									</div>
								</div>

								<div class="flex items-center gap-2 shrink-0">
									{#if b.kind === 'weekly'}
										<Badge variant="secondary" class="text-[10px] hidden sm:inline-flex">Еженедельный</Badge>
									{:else}
										<Badge variant="outline" class="text-[10px] text-primary border-primary/30 hidden sm:inline-flex">Разовый</Badge>
									{/if}

									<button
										type="button"
										class="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
										title={$t('common.delete')}
										onclick={() => confirmDelete(b.id)}
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Confirm Delete Dialog -->
<ConfirmDialog
	bind:open={deleteOpen}
	title={$t('doctorBreaks.deleteConfirmTitle')}
	description={$t('doctorBreaks.deleteConfirmDesc')}
	confirmText={$t('common.delete')}
	destructive={true}
	onConfirm={doDelete}
/>
