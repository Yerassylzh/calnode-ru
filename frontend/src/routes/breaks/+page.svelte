<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type DoctorBreak, type AvailabilityRule, type TeamMember } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { t, localeTag } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { ConfirmDialog } from '$lib/components/ui/confirm-dialog';
	import * as Select from '$lib/components/ui/select';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import { toast } from 'svelte-sonner';
	import { today, getLocalTimeZone } from '@internationalized/date';
	import { cn } from '$lib/utils';

	// ── State ─────────────────────────────────────────────────────────────────────
	let loading = $state(true);
	let doctors = $state<TeamMember[]>([]);
	let selectedDoctorId = $state('');

	let breaks = $state<DoctorBreak[]>([]);
	let breaksLoading = $state(false);

	let rules = $state<AvailabilityRule[]>([]);
	let rulesLoading = $state(false);

	// Today's ISO date string (YYYY-MM-DD)
	const localTz = getLocalTimeZone();
	const todayIso = today(localTz).toString();

	// Selected date for viewing and adding breaks (defaults to today)
	let selectedDate = $state(todayIso);

	// Form fields
	let applyMode = $state<'date' | 'weekly'>('date');
	let startTime = $state('13:00');
	let endTime = $state('14:00');
	let breakTitle = $state('Обед');
	let saving = $state(false);
	let formError = $state('');

	// Master list toggle
	let showAllBreaks = $state(false);

	// Delete dialog state
	let deleteOpen = $state(false);
	let deleteTargetBreak = $state<DoctorBreak | null>(null);

	// Time options for dropdowns (07:00 to 22:00 in 15-minute increments)
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

	// Date calculations
	function shiftIsoDate(iso: string, deltaDays: number): string {
		if (!iso) return iso;
		const [y, m, d] = iso.split('-').map(Number);
		const dt = new Date(y, m - 1, d);
		dt.setDate(dt.getDate() + deltaDays);
		const Y = dt.getFullYear();
		const M = String(dt.getMonth() + 1).padStart(2, '0');
		const D = String(dt.getDate()).padStart(2, '0');
		return `${Y}-${M}-${D}`;
	}

	function getDayOfWeek(iso: string): number {
		if (!iso) return 1;
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(y, m - 1, d).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
	}

	const selectedDayOfWeek = $derived(getDayOfWeek(selectedDate));

	const dateInfo = $derived.by(() => {
		if (!selectedDate) {
			return { title: '', subtitle: '', isToday: false, isTomorrow: false, isYesterday: false };
		}
		const [y, m, d] = selectedDate.split('-').map(Number);
		const dt = new Date(y, m - 1, d);
		const isToday = selectedDate === todayIso;
		const isTomorrow = selectedDate === shiftIsoDate(todayIso, 1);
		const isYesterday = selectedDate === shiftIsoDate(todayIso, -1);

		const isRu = $localeTag.startsWith('ru');
		const weekday = dt.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { weekday: 'long' });
		const formattedDate = dt.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		let prefix = '';
		if (isToday) prefix = isRu ? 'Сегодня' : 'Today';
		else if (isTomorrow) prefix = isRu ? 'Завтра' : 'Tomorrow';
		else if (isYesterday) prefix = isRu ? 'Вчера' : 'Yesterday';

		return {
			title: prefix ? `${prefix}, ${formattedDate}` : formattedDate,
			subtitle: weekday.charAt(0).toUpperCase() + weekday.slice(1),
			isToday,
			isTomorrow,
			isYesterday
		};
	});

	const formattedShortDate = $derived.by(() => {
		if (!selectedDate) return '';
		const [y, m, d] = selectedDate.split('-').map(Number);
		const dt = new Date(y, m - 1, d);
		return dt.toLocaleDateString($localeTag.startsWith('ru') ? 'ru-RU' : 'en-US', {
			day: 'numeric',
			month: 'short'
		});
	});

	const weekdayName = $derived.by(() => {
		return $t(`doctorBreaks.day.${selectedDayOfWeek}`);
	});

	// Breaks active on the selected date
	const breaksForSelectedDate = $derived.by(() => {
		if (!selectedDate) return [];
		return breaks
			.filter((b) => {
				if (b.kind === 'date' && b.date === selectedDate) return true;
				if (b.kind === 'weekly' && b.day_of_week === selectedDayOfWeek) return true;
				return false;
			})
			.sort((a, b) => a.start_time.localeCompare(b.start_time));
	});

	// Duration calculation string
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

	const currentDuration = $derived(getDurationLabel(startTime, endTime));

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
		} catch {
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
		} catch {
			rules = [];
		} finally {
			rulesLoading = false;
		}
	}

	async function onDoctorChange(docId: string) {
		selectedDoctorId = docId;
		await loadDoctorData(docId);
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

	// ── Save Break ────────────────────────────────────────────────────────────────
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

		saving = true;
		try {
			if (applyMode === 'weekly') {
				await api.post('/v1/doctor-breaks', {
					user_id: selectedDoctorId,
					kind: 'weekly',
					day_of_week: selectedDayOfWeek,
					start_time: startTime,
					end_time: endTime,
					title: breakTitle.trim() || 'Обед'
				});
			} else {
				await api.post('/v1/doctor-breaks', {
					user_id: selectedDoctorId,
					kind: 'date',
					date: selectedDate,
					start_time: startTime,
					end_time: endTime,
					title: breakTitle.trim() || 'Обед'
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

	function confirmDelete(b: DoctorBreak) {
		deleteTargetBreak = b;
		deleteOpen = true;
	}

	async function doDelete() {
		if (!deleteTargetBreak) return;
		try {
			await api.del(`/v1/doctor-breaks/${deleteTargetBreak.id}`);
			toast.success($t('doctorBreaks.deletedSuccess'));
			await loadBreaks(selectedDoctorId);
		} catch (e: any) {
			toast.error(e.message || $t('common.error'));
		} finally {
			deleteTargetBreak = null;
		}
	}
</script>

<svelte:head>
	<title>{$t('doctorBreaks.pageTitle')}</title>
</svelte:head>

<div class="max-w-5xl mx-auto py-6 px-4 space-y-6">
	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-foreground">
				{$t('doctorBreaks.heading')}
			</h1>
			<p class="text-sm text-muted-foreground mt-0.5">
				{$t('doctorBreaks.subtitle')}
			</p>
		</div>

		<!-- Doctor Selection -->
		<div class="flex items-center gap-3">
			{#if doctors.length > 1 && $currentUser?.is_admin}
				<div class="w-72">
					<Select.Root type="single" value={selectedDoctorId} onValueChange={(val) => { if (val) onDoctorChange(val); }}>
						<Select.Trigger class="w-full">
							<span class="truncate">
								{selectedDoctor ? selectedDoctor.name : $t('doctorBreaks.doctorPlaceholder')}
							</span>
						</Select.Trigger>
						<Select.Content>
							{#each doctors as doc}
								<Select.Item value={doc.id} label={doc.name}>
									<div class="flex flex-col text-left py-0.5">
										<span class="font-medium">{doc.name}</span>
										<span class="text-xs text-muted-foreground">{doc.email}</span>
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{:else if selectedDoctor}
				<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/40 text-sm">
					<span class="font-medium text-foreground">{selectedDoctor.name}</span>
					<Badge variant="secondary" class="text-xs">{$t('doctorBreaks.doctorRole')}</Badge>
				</div>
			{/if}
		</div>
	</div>

	<!-- ── Missing working hours helper (quiet) ───────────────────────────────── -->
	{#if !rulesLoading && rules.length === 0}
		<div class="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-sm">
			<span>{$t('doctorBreaks.noHoursSet')}.</span>
			<Button variant="outline" size="sm" onclick={setStandardWorkingHours} class="border-amber-500/40 hover:bg-amber-500/20 text-xs">
				{$t('doctorBreaks.setStandardHours')}
			</Button>
		</div>
	{/if}

	<!-- ── Main 2-Column Clean Interface ────────────────────────────────────── -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
		<!-- ── Left Column: Day Navigator & Breaks for Selected Date (7 cols) ─── -->
		<div class="lg:col-span-7 space-y-4">
			<!-- Date Selector Toolbar -->
			<div class="flex items-center justify-between gap-2 p-2 rounded-xl border bg-card shadow-sm">
				<div class="flex items-center gap-1.5">
					<Button
						variant="outline"
						size="icon"
						class="size-8"
						onclick={() => selectedDate = shiftIsoDate(selectedDate, -1)}
						title={$t('doctorBreaks.prevDay')}
					>
						<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="15 18 9 12 15 6" />
						</svg>
					</Button>

					<Button
						variant={selectedDate === todayIso ? 'default' : 'outline'}
						size="sm"
						class="h-8 text-xs font-medium px-3"
						onclick={() => selectedDate = todayIso}
					>
						{$t('doctorBreaks.today')}
					</Button>

					<Button
						variant="outline"
						size="icon"
						class="size-8"
						onclick={() => selectedDate = shiftIsoDate(selectedDate, 1)}
						title={$t('doctorBreaks.nextDay')}
					>
						<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</Button>
				</div>

				<div class="flex items-center">
					<DatePicker bind:value={selectedDate} placeholder={$t('doctorBreaks.pickDate')} class="h-8 text-xs w-[170px]" />
				</div>
			</div>

			<!-- Breaks on this Day Card -->
			<div class="rounded-xl border bg-card p-5 shadow-sm space-y-4">
				<!-- Date Heading Banner -->
				<div class="flex items-start justify-between border-b pb-3.5">
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-base font-semibold text-foreground">
								{dateInfo.title}
							</h2>
							{#if dateInfo.isToday}
								<Badge variant="default" class="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-semibold h-4 px-1.5">
									{$t('doctorBreaks.today')}
								</Badge>
							{/if}
						</div>
						<p class="text-xs text-muted-foreground mt-0.5 capitalize">
							{dateInfo.subtitle}
						</p>
					</div>

					<Badge variant="secondary" class="font-mono text-xs">
						{breaksForSelectedDate.length} {breaksForSelectedDate.length === 1 ? 'перерыв' : 'перерывов'}
					</Badge>
				</div>

				<!-- Break List -->
				{#if breaksLoading}
					<div class="py-10 text-center text-sm text-muted-foreground">
						{$t('common.loading')}
					</div>
				{:else if breaksForSelectedDate.length === 0}
					<div class="py-12 px-4 text-center rounded-lg border border-dashed flex flex-col items-center justify-center space-y-2">
						<div class="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
							<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10" />
								<polyline points="12 6 12 12 16 14" />
							</svg>
						</div>
						<div class="font-medium text-sm text-foreground">
							{$t('doctorBreaks.noBreaksOnDate')}
						</div>
						<p class="text-xs text-muted-foreground max-w-sm">
							{$t('doctorBreaks.noBreaksOnDateDesc')}
						</p>
					</div>
				{:else}
					<div class="space-y-2.5">
						{#each breaksForSelectedDate as b (b.id)}
							<div class="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
								<div class="flex items-center gap-3">
									<div class="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
										<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M10 2v2"/><path d="M14 2v2"/>
											<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12Z"/>
											<path d="M6 2v2"/>
										</svg>
									</div>

									<div>
										<div class="flex items-center gap-2">
											<span class="font-semibold text-sm font-mono text-foreground">
												{b.start_time} — {b.end_time}
											</span>
											<span class="text-xs text-muted-foreground font-medium">
												({getDurationLabel(b.start_time, b.end_time)})
											</span>
										</div>

										<div class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
											<span class="font-medium text-foreground">{b.title}</span>
											<span>•</span>
											{#if b.kind === 'weekly'}
												<Badge variant="secondary" class="text-[10px] font-normal py-0 px-1.5 h-4">
													{$t('doctorBreaks.badgeWeekly', { day: $t(`doctorBreaks.dayShort.${b.day_of_week}`) })}
												</Badge>
											{:else}
												<Badge variant="outline" class="text-[10px] font-normal py-0 px-1.5 h-4">
													{$t('doctorBreaks.badgeDate', { date: b.date || '' })}
												</Badge>
											{/if}
										</div>
									</div>
								</div>

								<Button
									variant="ghost"
									size="icon"
									class="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
									onclick={() => confirmDelete(b)}
									title="Удалить"
								>
									<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
										<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
									</svg>
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- ── Right Column: Add Break Form (5 cols) ────────────────────────── -->
		<div class="lg:col-span-5">
			<div class="rounded-xl border bg-card p-5 shadow-sm space-y-4">
				<div>
					<h2 class="text-base font-semibold text-foreground">
						{$t('doctorBreaks.addBreak')}
					</h2>
					<p class="text-xs text-muted-foreground mt-0.5">
						{$t('doctorBreaks.addBreakDesc')}
					</p>
				</div>

				<div class="space-y-4 pt-1">
					<!-- Repetition toggle -->
					<div class="space-y-1.5">
						<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{$t('doctorBreaks.applyMode')}
						</span>
						<div class="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-lg">
							<button
								type="button"
								class={cn(
									'py-2 px-2 text-xs font-medium rounded-md transition-all text-center',
									applyMode === 'date'
										? 'bg-background shadow-sm text-foreground font-semibold'
										: 'text-muted-foreground hover:text-foreground'
								)}
								onclick={() => applyMode = 'date'}
							>
								<div>{$t('doctorBreaks.applyThisDate')}</div>
								<div class="text-[10px] text-muted-foreground font-normal truncate mt-0.5">
									{formattedShortDate}
								</div>
							</button>

							<button
								type="button"
								class={cn(
									'py-2 px-2 text-xs font-medium rounded-md transition-all text-center',
									applyMode === 'weekly'
										? 'bg-background shadow-sm text-foreground font-semibold'
										: 'text-muted-foreground hover:text-foreground'
								)}
								onclick={() => applyMode = 'weekly'}
							>
								<div>{$t('doctorBreaks.applyWeekly')}</div>
								<div class="text-[10px] text-muted-foreground font-normal truncate mt-0.5">
									{weekdayName}
								</div>
							</button>
						</div>
					</div>

					<!-- Time inputs: Start and End -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								{$t('doctorBreaks.timeRange')}
							</span>
							{#if currentDuration}
								<span class="text-xs font-medium text-primary">
									{$t('doctorBreaks.duration')}: {currentDuration}
								</span>
							{/if}
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<span class="text-xs text-muted-foreground">{$t('doctorBreaks.timeFrom')}</span>
								<Select.Root type="single" value={startTime} onValueChange={(v) => { if (v) startTime = v; }}>
									<Select.Trigger class="w-full font-mono text-sm">
										{startTime}
									</Select.Trigger>
									<Select.Content class="max-h-56 overflow-y-auto">
										{#each TIME_OPTIONS as t}
											<Select.Item value={t} label={t} class="font-mono text-sm">{t}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>

							<div class="space-y-1">
								<span class="text-xs text-muted-foreground">{$t('doctorBreaks.timeTo')}</span>
								<Select.Root type="single" value={endTime} onValueChange={(v) => { if (v) endTime = v; }}>
									<Select.Trigger class="w-full font-mono text-sm">
										{endTime}
									</Select.Trigger>
									<Select.Content class="max-h-56 overflow-y-auto">
										{#each TIME_OPTIONS as t}
											<Select.Item value={t} label={t} class="font-mono text-sm">{t}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>
					</div>

					<!-- Title / Reason -->
					<div class="space-y-1.5">
						<label for="break-title-input" class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{$t('doctorBreaks.titleLabel')}
						</label>
						<Input
							id="break-title-input"
							type="text"
							bind:value={breakTitle}
							placeholder={$t('doctorBreaks.titlePlaceholder')}
							class="text-sm"
						/>
					</div>

					<!-- Error alert -->
					{#if formError}
						<div class="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
							{formError}
						</div>
					{/if}

					<!-- Submit Button -->
					<Button
						class="w-full font-medium"
						onclick={handleAddBreak}
						disabled={saving}
					>
						{#if saving}
							<svg class="animate-spin -ml-1 mr-2 size-4 text-white" viewBox="0 0 24 24" fill="none">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
							</svg>
							{$t('doctorBreaks.submitting')}
						{:else}
							{$t('doctorBreaks.submit')}
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</div>

	<!-- ── Master Schedule Collapsible Section ──────────────────────────────── -->
	<div class="pt-2">
		<button
			type="button"
			class="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
			onclick={() => showAllBreaks = !showAllBreaks}
		>
			<svg
				class={cn('size-3.5 transition-transform', showAllBreaks ? 'rotate-90' : '')}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="9 18 15 12 9 6" />
			</svg>
			<span>
				{showAllBreaks ? $t('doctorBreaks.hideAllBreaks') : $t('doctorBreaks.showAllBreaks')} ({breaks.length})
			</span>
		</button>

		{#if showAllBreaks}
			<div class="mt-3 p-4 rounded-xl border bg-card shadow-sm space-y-3">
				<div class="font-semibold text-sm text-foreground">
					{$t('doctorBreaks.allBreaksTitle')}
				</div>

				{#if breaks.length === 0}
					<div class="text-xs text-muted-foreground py-2">
						{$t('doctorBreaks.allBreaksEmpty')}
					</div>
				{:else}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
						{#each breaks as b (b.id)}
							<div class="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 text-xs">
								<div class="space-y-0.5">
									<div class="font-mono font-semibold text-foreground">
										{b.start_time} — {b.end_time}
										<span class="font-normal font-sans text-muted-foreground">({b.title})</span>
									</div>
									<div class="text-[11px] text-muted-foreground">
										{#if b.kind === 'weekly'}
											{$t('doctorBreaks.badgeWeekly', { day: $t(`doctorBreaks.day.${b.day_of_week}`) })}
										{:else}
											{$t('doctorBreaks.badgeDate', { date: b.date || '' })}
										{/if}
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									class="size-7 text-muted-foreground hover:text-destructive"
									onclick={() => confirmDelete(b)}
									title="Удалить"
								>
									<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
										<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
									</svg>
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- ── Delete Confirmation Dialog ─────────────────────────────────────────── -->
<ConfirmDialog
	bind:open={deleteOpen}
	title={$t('doctorBreaks.deleteConfirmTitle')}
	description={$t('doctorBreaks.deleteConfirmDesc')}
	confirmText={$t('common.delete')}
	destructive={true}
	onConfirm={doDelete}
/>
