<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { api, type EventType, type EventTypeHost, type TeamMember, type Team, type CalendarStatus, type ZoomStatus } from '$lib/api';
	import { currentUser } from '$lib/stores';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import * as Select from '$lib/components/ui/select';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { toast } from 'svelte-sonner';
	import { saveOnCmdS } from '$lib/save-shortcut';
	import { t } from '$lib/i18n';
	import QuestionsPanel from '$lib/components/event-types/QuestionsPanel.svelte';
	import EmbedPanel from '$lib/components/event-types/EmbedPanel.svelte';

	// Ordered by expected usage. 'custom_video' is retired from the picker but the
	// backend still renders any legacy event types that use it.
	const LOCATION_TYPES = [
		{ value: 'zoom',        labelKey: 'eventTypeDetail.locationZoom' },
		{ value: 'teams',       labelKey: 'eventTypeDetail.locationTeams' },
		{ value: 'google_meet', labelKey: 'eventTypeDetail.locationMeet' },
		{ value: 'livekit',     labelKey: 'eventTypeDetail.locationLivekit' },
		{ value: 'phone',       labelKey: 'eventTypeDetail.locationPhone' },
		{ value: 'link',        labelKey: 'eventTypeDetail.locationLink' },
		{ value: 'in_person',   labelKey: 'eventTypeDetail.locationInPerson' },
	];

	const LOCATION_NEEDS_VALUE: Record<string, string> = {
		link: 'eventTypeDetail.needsValueLink', zoom: 'eventTypeDetail.needsValueZoom', google_meet: 'eventTypeDetail.needsValueMeet',
		teams: 'eventTypeDetail.needsValueTeams', phone: 'eventTypeDetail.needsValuePhone', in_person: 'eventTypeDetail.needsValueInPerson', custom_video: 'eventTypeDetail.needsValueCustomVideo',
	};
	// Placeholder hint per type — in-person is the only optional value.
	const LOCATION_PLACEHOLDER: Record<string, string> = {
		zoom: 'eventTypeDetail.placeholderZoom', link: 'eventTypeDetail.placeholderLink',
		phone: 'eventTypeDetail.placeholderPhone', in_person: 'eventTypeDetail.placeholderInPerson',
	};

	const INVITE_DELIVERY = [
		{ value: 'calendar', labelKey: 'eventTypeDetail.inviteDeliveryCalendar' },
		{ value: 'calnode',  labelKey: 'eventTypeDetail.inviteDeliveryCalnode' },
	];

	// Label for a location type: the translated name, or the raw value when the
	// type is unknown (legacy values are retired from the picker).
	const locationLabel = (value: string | undefined, fallback?: string): string => {
		const lt = LOCATION_TYPES.find((l) => l.value === value);
		if (lt) return $t(lt.labelKey);
		return fallback === undefined ? (value ?? '') : $t(fallback);
	};

	// ── Event type ───────────────────────────────────────────────────────────────
	let et = $state<EventType | null>(null);
	const TABS = [
		{ id: 'general',       labelKey: 'eventTypeDetail.tabGeneral' },
		{ id: 'hosts',         labelKey: 'eventTypeDetail.tabHosts' },
		{ id: 'notifications', labelKey: 'eventTypeDetail.tabNotifications' },
		{ id: 'questions',     labelKey: 'eventTypeDetail.tabQuestions' },
		{ id: 'embed',         labelKey: 'eventTypeDetail.tabEmbed' }
	] as const;
	let activeTab = $state<(typeof TABS)[number]['id']>('general');
	let etLoading = $state(true);
	let etError = $state('');
	let etSaving = $state(false);

	// Connected calendar (the owner's) — drives the meeting-link auto-generation hint.
	let calStatus = $state<CalendarStatus | null>(null);
	// Owner's Zoom connection — drives the Zoom auto-mint hint.
	let zoomStatus = $state<ZoomStatus | null>(null);
	// Which connected provider can natively mint each online platform's link.
	const PLATFORM_PROVIDER: Record<string, string> = { google_meet: 'google', teams: 'microsoft' };
	const isOnlineMeeting = (t: string) => t === 'google_meet' || t === 'teams';

	let form = $state({
		display_order: 0,
		name: '', slug: '', description: '', duration_minutes: 30, slot_interval_minutes: 30,
		is_active: true, is_public: true, show_taken_slots: false,
		invite_delivery: 'calendar' as EventType['invite_delivery'],
		location_type: 'link', location_value: '',
		buffer_before_minutes: 0, buffer_after_minutes: 0,
		min_notice_minutes: 0, max_future_days: 60,
		max_active_bookings: 1,
		price_cents: 0, currency: 'usd',
	});

	// Price is edited in major units (e.g. dollars); stored as integer cents.
	let priceMajor = $state('0');

	// True when the connected calendar will auto-generate the chosen platform's link.
	const meetAutoGen = $derived(
		isOnlineMeeting(form.location_type) &&
			!!calStatus?.connected &&
			calStatus?.provider === PLATFORM_PROVIDER[form.location_type]
	);

	// True when the owner's connected Zoom account will auto-mint a meeting per booking.
	const zoomAutoGen = $derived(form.location_type === 'zoom' && !!zoomStatus?.connected);

	// ── Routing ──────────────────────────────────────────────────────────────────
	// The editor asks two plain questions — "who can host?" and (for a team)
	// "do they rotate or all attend?" — and derives routing_mode + host roles from
	// the answers. The engine and DB are unchanged; this is purely how roles are
	// authored.
	const RR_STRATEGIES = [
		{ value: 'even',     labelKey: 'eventTypeDetail.rrEven' },
		{ value: 'priority', labelKey: 'eventTypeDetail.rrPriority' },
		{ value: 'soonest',  labelKey: 'eventTypeDetail.rrSoonest' },
	];
	type Strategy = 'even' | 'priority' | 'soonest';
	let rrStrategy = $state<Strategy>('even');

	type Host = { user_id: string; name: string; email: string };
	type TogetherHost = Host & { optional: boolean };

	// Q1: just me, or specific people?  Q2 (people only): rotate, or all attend?
	let hostScope = $state<'me' | 'people'>('me');
	let staffing = $state<'rotate' | 'together'>('rotate');
	// Rotation pool (each "rotation"); together = required + optional join-if-free.
	let rotationHosts = $state<Host[]>([]);
	let togetherHosts = $state<TogetherHost[]>([]);
	let hostsLoaded = $state(false);
	let transferOwner = $state('');
	let transferring = $state(false);
	let transferHosts = $state<EventTypeHost[]>([]);
	async function transferEvent() {
		if (!transferOwner || !$currentUser) return;
		transferring = true;
		try {
			await api.post(`/v1/event-types/${slug}/transfer`, { expected_owner_id: $currentUser.id, new_owner_id: transferOwner });
			toast.success($t('eventTypeDetail.toastEventTransferred'));
			await goto(`${base}/event-types`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : $t('eventTypeDetail.toastTransferFailed'));
		} finally {
			transferring = false;
		}
	}

	let members = $state<TeamMember[]>([]);
	let teams = $state<Team[]>([]);

	// routing_mode is derived from the two answers — never set directly.
	const routingMode = $derived(
		hostScope === 'me' ? 'fixed' : staffing === 'rotate' ? 'round_robin' : 'collective'
	);

	async function loadHosts() {
		try {
			const res = await api.get<{ items: EventTypeHost[] }>(`/v1/event-types/${slug}/hosts`);
			const items = res.items ?? [];
			transferHosts = items.filter(h => h.role === 'required' && h.user_id !== $currentUser?.id);
			const toHost = (h: EventTypeHost): Host => ({ user_id: h.user_id, name: h.name, email: h.email });
			rotationHosts = items.filter((h) => h.role === 'rotation').map(toHost);
			togetherHosts = items
				.filter((h) => h.role === 'required' || h.role === 'optional')
				.map((h) => ({ ...toHost(h), optional: h.role === 'optional' }));
			hostsLoaded = true;
		} catch (e: any) {
			toast.error(e.message || $t('eventTypeDetail.errorLoadHosts'));
		}
	}

	async function loadMembers() {
		if (members.length > 0) return;
		try {
			members = await api.get<TeamMember[]>('/v1/users');
		} catch (e: any) {
			toast.error(e.message || $t('eventTypeDetail.errorLoadMembers'));
		}
	}

	async function loadTeams() {
		if (teams.length > 0) return;
		try {
			const res = await api.get<{ items: Team[] }>('/v1/teams');
			teams = res.items ?? [];
		} catch (e: any) {
			toast.error(e.message || $t('eventTypeDetail.errorLoadTeams'));
		}
	}

	function setScope(s: 'me' | 'people') {
		hostScope = s;
		if (s === 'people') {
			if (!hostsLoaded) loadHosts();
			loadMembers();
			loadTeams();
		}
	}

	// Members already chosen in the *active* staffing list, so the pickers don't
	// re-offer them. Scoped to the visible list (rotation vs together): otherwise
	// hosts loaded for the other mode — e.g. a collective event's members still in
	// togetherHosts after switching to Rotate — would wrongly mark everyone
	// unavailable and make addOne skip every team member.
	const assignedIds = $derived(
		new Set((staffing === 'rotate' ? rotationHosts : togetherHosts).map((h) => h.user_id))
	);
	// Any active member not already chosen — including the current user, who can
	// be a host like anyone else.
	const availableMembers = $derived(
		members.filter((m) => !m.archived && !assignedIds.has(m.id))
	);

	type Target = 'rotation' | 'together';
	function addOne(target: Target, h: Host) {
		// Dedup against this target's own list, not the union — a person can sit in
		// only one staffing list, and the other list may hold stale members from a
		// previous mode.
		const list: { user_id: string }[] = target === 'rotation' ? rotationHosts : togetherHosts;
		if (list.some((x) => x.user_id === h.user_id)) return;
		if (target === 'rotation') rotationHosts = [...rotationHosts, h];
		else togetherHosts = [...togetherHosts, { ...h, optional: false }];
	}
	function addMember(target: Target, userId: string | undefined) {
		if (!userId) return;
		const m = members.find((x) => x.id === userId);
		if (m) addOne(target, { user_id: m.id, name: m.name, email: m.email });
	}
	async function addTeam(target: Target, teamId: string | undefined) {
		if (!teamId) return;
		try {
			const team = await api.get<Team>(`/v1/teams/${teamId}`);
			(team.members ?? [])
				.filter((tm) => !tm.archived)
				.forEach((tm) => addOne(target, { user_id: tm.id, name: tm.name, email: tm.email }));
		} catch (e: any) {
			toast.error(e.message || $t('eventTypeDetail.errorLoadTeamMembers'));
		}
	}
	function removePerson(target: Target, userId: string) {
		if (target === 'rotation') rotationHosts = rotationHosts.filter((h) => h.user_id !== userId);
		else togetherHosts = togetherHosts.filter((h) => h.user_id !== userId);
	}
	function setOptional(userId: string, optional: boolean) {
		togetherHosts = togetherHosts.map((h) => (h.user_id === userId ? { ...h, optional } : h));
	}
	// Reorder the rotation pool (priority = list position; index 0 is highest).
	function moveRotation(idx: number, dir: -1 | 1) {
		const list = [...rotationHosts];
		const j = idx + dir;
		if (j < 0 || j >= list.length) return;
		[list[idx], list[j]] = [list[j], list[idx]];
		rotationHosts = list;
	}

	// Notification / messaging state
	const REMINDER_OPTIONS = [
		{ value: 1 }, { value: 2 }, { value: 4 }, { value: 8 }, { value: 12 },
		{ value: 24 }, { value: 48 }, { value: 72 }, { value: 168 },
	];
	// Lead-time label: hours below a day, then days, then a week.
	const reminderLabel = (hours: number): string =>
		hours < 24
			? $t.plural('eventTypeDetail.reminderHoursBefore', hours)
			: hours < 168
				? $t.plural('eventTypeDetail.reminderDaysBefore', Math.floor(hours / 24))
				: $t.plural('eventTypeDetail.reminderWeeksBefore', Math.floor(hours / 168));
	let reminders = $state<number[]>([]);
	let msg_confirmation = $state('');
	let msg_cancellation = $state('');
	let msg_reschedule = $state('');
	let msg_reminder = $state('');
	// Assistant's opening chat line for this event type — blank keeps the built-in
	// (translated) default; set overrides it verbatim, same as the email notes above.
	let msg_greeting = $state('');
	// Optional custom subject lines (empty = built-in default subject).
	let subj_confirmation = $state('');
	let subj_cancellation = $state('');
	let subj_reschedule = $state('');
	let subj_reminder = $state('');
	// Track which message accordions are open
	let msgOpen = $state({ confirmation: false, cancellation: false, reschedule: false, reminder: false });
	// Track preview toggle per accordion
	let previewOpen = $state({ confirmation: false, cancellation: false, reschedule: false, reminder: false });
	// Test email send state per type
	type MsgKey = 'confirmation' | 'cancellation' | 'reschedule' | 'reminder';
	let testSending = $state<Partial<Record<MsgKey, boolean>>>({});
	let testSent    = $state<Partial<Record<MsgKey, boolean>>>({});
	let testError   = $state<Partial<Record<MsgKey, string>>>({});

	let contactPolicy = $state('email_or_phone');
	let defaultContactMethod = $state('phone');
	let allowPhoneCall = $state(false);
	const slug = $page.params.slug;

	async function loadET() {
		etError = '';
		try {
			et = await api.get<EventType>(`/v1/event-types/${slug}`);
			allowPhoneCall = et.allow_phone_call;
			contactPolicy = et.booking_contact_policy;
			defaultContactMethod = et.default_contact_method;
			form = {
				display_order: et.display_order,
				name: et.name,
				slug: et.slug,
				description: et.description ?? '',
				duration_minutes: et.duration_minutes,
				slot_interval_minutes: et.slot_interval_minutes,
				is_active: et.is_active,
				is_public: et.is_public,
				show_taken_slots: et.show_taken_slots ?? false,
				invite_delivery: et.invite_delivery ?? 'calendar',
				location_type: et.location_type,
				location_value: et.location_value ?? '',
				buffer_before_minutes: et.buffer_before_minutes,
				buffer_after_minutes: et.buffer_after_minutes,
				min_notice_minutes: et.min_notice_minutes,
				max_future_days: et.max_future_days,
				max_active_bookings: et.max_active_bookings,
				price_cents: et.price_cents ?? 0,
				currency: et.currency ?? 'usd',
			};
			priceMajor = ((et.price_cents ?? 0) / 100).toFixed(2);
			reminders = et.reminders ?? [];
			if (et.routing_mode === 'round_robin') { hostScope = 'people'; staffing = 'rotate'; }
			else if (et.routing_mode === 'collective') { hostScope = 'people'; staffing = 'together'; }
			else { hostScope = 'me'; }
			rrStrategy = (['even', 'priority', 'soonest'].includes(et.rr_strategy ?? '')
				? et.rr_strategy : 'even') as Strategy;
			msg_confirmation = et.msg_confirmation ?? '';
			msg_cancellation = et.msg_cancellation ?? '';
			msg_reschedule = et.msg_reschedule ?? '';
			msg_reminder = et.msg_reminder ?? '';
			msg_greeting = et.msg_greeting ?? '';
			subj_confirmation = et.subj_confirmation ?? '';
			subj_cancellation = et.subj_cancellation ?? '';
			subj_reschedule = et.subj_reschedule ?? '';
			subj_reminder = et.subj_reminder ?? '';
		} catch (e: any) {
			etError = e.message;
		} finally {
			etLoading = false;
		}
	}

	async function saveET() {
		if (!Number.isSafeInteger(form.display_order)) { toast.error($t('eventTypeDetail.errorDirectoryOrder')); return; }
		if (!form.name.trim()) { toast.error($t('eventTypeDetail.errorNameRequired')); return; }
		if (form.duration_minutes < 5) { toast.error($t('eventTypeDetail.errorDurationMin')); return; }
		// Matches the API, which only requires a positive value. A stricter floor here would
		// make an event type configured below it via the API unsaveable from the editor -
		// including when the person is editing something else entirely.
		if (form.slot_interval_minutes < 1) { toast.error($t('eventTypeDetail.errorSlotIntervalMin')); return; }
		if (form.max_active_bookings < 0) { toast.error($t('eventTypeDetail.errorMaxActiveNegative')); return; }
		if (routingMode === 'round_robin' && rotationHosts.length === 0) {
			toast.error($t('eventTypeDetail.errorRotationEmpty')); return;
		}
		if (routingMode === 'collective' && !togetherHosts.some((h) => !h.optional)) {
			toast.error($t('eventTypeDetail.errorRequiredHost')); return;
		}
		etSaving = true;
		try {
			const updated = await api.patch<EventType>(`/v1/event-types/${slug}`, {
				display_order: form.display_order,
				slug: form.slug.trim(),
				name: form.name.trim(),
				description: form.description.trim() || null,
				duration_minutes: Number(form.duration_minutes),
				slot_interval_minutes: Number(form.slot_interval_minutes),
				is_active: form.is_active,
				is_public: form.is_public,
				show_taken_slots: form.show_taken_slots,
				invite_delivery: form.invite_delivery,
				allow_phone_call: allowPhoneCall,
				booking_contact_policy: contactPolicy,
				default_contact_method: contactPolicy === 'email_or_phone' ? defaultContactMethod : contactPolicy === 'phone_only' ? 'phone' : 'email',
				location_type: form.location_type,
				location_value: form.location_value.trim() || null,
				buffer_before_minutes: Number(form.buffer_before_minutes),
				buffer_after_minutes: Number(form.buffer_after_minutes),
				min_notice_minutes: Number(form.min_notice_minutes),
				max_future_days: Number(form.max_future_days),
				max_active_bookings: Number(form.max_active_bookings),
				price_cents: Math.max(0, Math.round(Number(priceMajor) * 100)) || 0,
				currency: form.currency.trim().toLowerCase() || 'usd',
				routing_mode: routingMode,
				rr_strategy: rrStrategy,
				reminders,
				// Not `|| null`: this form always saves the whole page state, so a blanked
				// field must send '' to actually clear it. The API treats null as "leave
				// unchanged" (for partial-PATCH callers), which would silently keep the old
				// value here — the field would look cleared in the UI but persist server-side.
				msg_confirmation: msg_confirmation.trim(),
				msg_cancellation: msg_cancellation.trim(),
				msg_reschedule: msg_reschedule.trim(),
				msg_reminder: msg_reminder.trim(),
				msg_greeting: msg_greeting.trim(),
				subj_confirmation: subj_confirmation.trim(),
				subj_cancellation: subj_cancellation.trim(),
				subj_reschedule: subj_reschedule.trim(),
				subj_reminder: subj_reminder.trim(),
			});
			// A rename moves the row out from under the name this page was loaded with, so
			// every request after the PATCH has to use the one the server just confirmed.
			const effSlug = updated?.slug || slug;

			if (routingMode === 'round_robin') {
				await api.put(`/v1/event-types/${effSlug}/hosts`, {
					hosts: rotationHosts.map((hh, i) => ({ user_id: hh.user_id, role: 'rotation', priority: i })),
				});
			} else if (routingMode === 'collective') {
				await api.put(`/v1/event-types/${effSlug}/hosts`, {
					hosts: togetherHosts.map((hh, i) => ({
						user_id: hh.user_id, role: hh.optional ? 'optional' : 'required', priority: i,
					})),
				});
			} else {
				await api.put(`/v1/event-types/${effSlug}/hosts`, {
					hosts: [{ user_id: $currentUser?.id, role: 'required', priority: 0 }],
				});
			}
			toast.success($t('eventTypeDetail.toastChangesSaved'));
			// The URL carries the slug, so a rename has to move the page too or a reload
			// lands on a 404. replaceState: the old address no longer resolves, and
			// leaving it in history is a back button that breaks.
			if (effSlug !== slug) {
				await goto(`${base}/event-types/${effSlug}`, { replaceState: true });
				return;
			}
			await loadET();
			await loadHosts();
		} catch (e: any) {
			toast.error(e.message || $t('eventTypeDetail.errorSaveChanges'));
		} finally {
			etSaving = false;
		}
	}

	async function sendTestEmail(type: MsgKey) {
		testSending = { ...testSending, [type]: true };
		testSent    = { ...testSent,    [type]: false };
		testError   = { ...testError,   [type]: '' };
		try {
			await api.post(`/v1/event-types/${slug}/test-email`, { type });
			testSent = { ...testSent, [type]: true };
			setTimeout(() => { testSent = { ...testSent, [type]: false }; }, 4000);
		} catch (e: any) {
			testError = { ...testError, [type]: e.message };
		} finally {
			testSending = { ...testSending, [type]: false };
		}
	}

	function buildPreview(type: MsgKey, note: string): string {
		const name     = et?.name ?? $t('eventTypeDetail.previewMyEvent');
		const loc      = et?.location_value ? `\n${$t('eventTypeDetail.previewLocationLabel', { value: et.location_value })}` : '';
		const dur      = et?.duration_minutes ?? 30;
		const noteBlk  = note.trim() ? `\n---\n${note.trim()}\n` : '';
		const start    = $t('eventTypeDetail.previewStartTime');
		const prev     = $t('eventTypeDetail.previewPrevTime');
		// Compute end time correctly by adding duration to 14:00.
		const endTotalMin = 14 * 60 + dur;
		const endH24      = Math.floor(endTotalMin / 60) % 24;
		const endMin      = endTotalMin % 60;
		const endPeriod   = endH24 < 12 ? 'AM' : 'PM';
		const endH12      = endH24 % 12 || 12;
		const end         = $t('eventTypeDetail.previewEndTime', { time: `${endH12}:${String(endMin).padStart(2, '0')} ${endPeriod}` });

		switch (type) {
			case 'confirmation':
				return `${$t('eventTypeDetail.previewGreeting')}\n\n${$t('eventTypeDetail.previewConfirmedBody')}\n\n${$t('eventTypeDetail.previewEventLabel')}    ${name}\n${$t('eventTypeDetail.previewWithLabel')}     ${et?.name ?? $t('eventTypeDetail.previewHost')}\n${$t('eventTypeDetail.previewStartLabel')}    ${start}\n${$t('eventTypeDetail.previewEndLabel')}      ${end}${loc}\n\n${$t('eventTypeDetail.previewRefLabel')} preview-test\n\n${$t('eventTypeDetail.previewCancelInstructions')}${noteBlk}\n— Calnode`;
			case 'cancellation':
				return `${$t('eventTypeDetail.previewGreeting')}\n\n${$t('eventTypeDetail.previewCancelledBody')}\n\n${$t('eventTypeDetail.previewEventLabel')}    ${name}\n${$t('eventTypeDetail.previewWithLabel')}     ${et?.name ?? $t('eventTypeDetail.previewHost')}\n${$t('eventTypeDetail.previewStartLabel')}    ${start}\n${$t('eventTypeDetail.previewEndLabel')}      ${end}\n\n${$t('eventTypeDetail.previewRebookInstructions')}${noteBlk}\n— Calnode`;
			case 'reschedule':
				return `${$t('eventTypeDetail.previewGreeting')}\n\n${$t('eventTypeDetail.previewRescheduledBody')}\n\n${$t('eventTypeDetail.previewEventLabel')}    ${name}\n${$t('eventTypeDetail.previewWithLabel')}     ${et?.name ?? $t('eventTypeDetail.previewHost')}\n${$t('eventTypeDetail.previewWasLabel')}      ${prev}\n${$t('eventTypeDetail.previewNowLabel')}      ${start}\n${$t('eventTypeDetail.previewEndLabel')}      ${end}${loc}\n\n${$t('eventTypeDetail.previewRefLabel')} preview-test${noteBlk}\n— Calnode`;
			case 'reminder':
				return `${$t('eventTypeDetail.previewGreeting')}\n\n${$t('eventTypeDetail.previewReminderBody')}\n\n${$t('eventTypeDetail.previewEventLabel')}    ${name}\n${$t('eventTypeDetail.previewWithLabel')}     ${et?.name ?? $t('eventTypeDetail.previewHost')}\n${$t('eventTypeDetail.previewStartLabel')}    ${start}\n${$t('eventTypeDetail.previewEndLabel')}      ${end}${loc}\n\n${$t('eventTypeDetail.previewRefLabel')} preview-test${noteBlk}\n— Calnode`;
		}
	}

	onMount(async () => {
		await loadET();
		// Editor-only data (owner-scoped endpoints) — skip for read-only hosts.
		if (et?.owned === false) return;
		// Connected calendar — best-effort; drives the meeting-link hint only.
		api.get<CalendarStatus>('/v1/calendar/status').then((s) => (calStatus = s)).catch(() => {});
	api.get<ZoomStatus>('/v1/zoom/status').then((s) => (zoomStatus = s)).catch(() => {});
		await loadHosts();
		if (hostScope === 'people') {
			loadMembers();
			loadTeams();
		}
	});

</script>

{#snippet hostPickers(target: Target, idPrefix: string)}
	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-1.5">
			<Label for="{idPrefix}-add-member">{$t('eventTypeDetail.labelAddMember')}</Label>
			<Select.Root type="single" value="" onValueChange={(v) => addMember(target, v)}>
				<Select.Trigger id="{idPrefix}-add-member" class="w-full">{$t('eventTypeDetail.selectMemberTrigger')}</Select.Trigger>
				<Select.Content>
					{#if availableMembers.length > 0}
						{#each availableMembers as m}
							<Select.Item value={m.id} label={m.name}>{m.name} · {m.email}</Select.Item>
						{/each}
					{:else}
						<div class="px-2 py-1.5 text-xs text-muted-foreground">{$t('eventTypeDetail.noMembersAvailable')}</div>
					{/if}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="space-y-1.5">
			<Label for="{idPrefix}-add-team">{$t('eventTypeDetail.labelAddTeam')}</Label>
			<Select.Root type="single" value="" onValueChange={(v) => addTeam(target, v)}>
				<Select.Trigger id="{idPrefix}-add-team" class="w-full">{$t('eventTypeDetail.selectTeamTrigger')}</Select.Trigger>
				<Select.Content>
					{#if teams.length > 0}
						{#each teams as t}
							<Select.Item value={t.id} label={t.name}>{t.name} ({t.member_count})</Select.Item>
						{/each}
					{:else}
						<div class="px-2 py-1.5 text-xs text-muted-foreground">{$t('eventTypeDetail.noTeams')}</div>
					{/if}
				</Select.Content>
			</Select.Root>
		</div>
	</div>
{/snippet}

<svelte:head><title>{et?.name ?? slug} — {$t('eventTypeDetail.pageTitleSuffix')}</title></svelte:head>
<svelte:window onkeydown={saveOnCmdS(saveET, () => !etSaving)} />

<div class="mb-8">
	<a href="{base}/event-types" class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
		<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
		{$t('layout.nav.eventTypes')}
	</a>
	<div class="flex items-center gap-3">
		<h1 class="text-2xl font-semibold tracking-tight">{et?.name ?? slug}</h1>
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					class={buttonVariants({ variant: 'ghost', size: 'icon' })}
					onclick={() => window.open(`/book/${slug}`, '_blank')}
				>
					<!-- External link icon (matches the event-types list) -->
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
				</Tooltip.Trigger>
				<Tooltip.Content>{$t('eventTypeDetail.previewBookingPage')}</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
</div>

{#if etLoading}
	<p class="py-8 text-sm text-muted-foreground">{$t('common.loading')}</p>
{:else if etError}
	<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{etError}</p>
{:else if et && et.owned === false}

<!-- Read-only: the user hosts this event type but doesn't own it -->
<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
	{#if et.owner_email}
		<span class="font-medium">{et.owner_name || et.owner_email}</span> {$t('eventTypeDetail.readonlyCreatedTail')}
		<a href="mailto:{et.owner_email}?subject={encodeURIComponent($t('eventTypeDetail.mailtoSubject', { name: et.name }))}" class="font-medium underline">{$t('eventTypeDetail.readonlyMessageLink')}</a>{$t('eventTypeDetail.readonlyToRequestChanges')}
	{:else if et.owner_name}
		<span class="font-medium">{et.owner_name}</span> {$t('eventTypeDetail.readonlyCreatedTail')} {$t('eventTypeDetail.readonlyMessageThemFull')}
	{:else}
		{$t('eventTypeDetail.readonlyManagedByOwner')}
	{/if}
</div>
<div class="rounded-lg border bg-card p-6">
	<dl class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
		<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldName')}</dt><dd class="font-medium">{et.name}</dd>
		{#if et.description}<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldDescription')}</dt><dd class="whitespace-pre-line">{et.description}</dd>{/if}
		<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldDuration')}</dt><dd>{$t('eventTypeDetail.minutesCount', { count: et.duration_minutes })}</dd>
		{#if et.slot_interval_minutes !== et.duration_minutes}
			<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldSlotInterval')}</dt><dd>{$t('eventTypeDetail.minutesCount', { count: et.slot_interval_minutes })}</dd>
		{/if}
		<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldLocation')}</dt><dd>{locationLabel(et?.location_type)}{#if et.location_value} · {et.location_value}{/if}</dd>
		<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldRouting')}</dt><dd class="capitalize">{et.routing_mode.replace('_', ' ')}</dd>
		<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldStatus')}</dt><dd>{et.is_active ? $t('eventTypeDetail.statusActive') : $t('eventTypeDetail.statusInactive')} · {et.is_public ? $t('eventTypeDetail.statusListed') : $t('eventTypeDetail.statusUnlisted')}</dd>
		<dt class="text-muted-foreground">{$t('eventTypeDetail.fieldBookingPage')}</dt><dd><a href="/book/{et.slug}" target="_blank" rel="noopener" class="text-primary underline">/book/{et.slug}</a></dd>
	</dl>
</div>

{:else}

<div class="mb-6 flex gap-1 overflow-x-auto border-b">
	{#each TABS as tab}
		<button
			type="button"
			onclick={() => (activeTab = tab.id)}
			class="-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab === tab.id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			{$t(tab.labelKey)}
		</button>
	{/each}
</div>

{#if activeTab === 'general'}
<!-- General Settings -->
<div class="mb-8">
	<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{$t('eventTypeDetail.tabGeneral')}</h2>
	<div class="rounded-lg border bg-card p-6">
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1.5">
				<Label for="et-name">{$t('eventTypeDetail.fieldName')}</Label>
				<Input id="et-name" bind:value={form.name} />
			</div>
			<div class="space-y-1.5">
				<Label for="et-display-order">{$t('eventTypeDetail.labelDirectoryOrder')}</Label>
				<Input id="et-display-order" type="number" step="1" bind:value={form.display_order} />
				<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.helpDirectoryOrder')}</p>
			</div>
			<div class="space-y-1.5 col-span-2">
				<Label for="et-slug">{$t('eventTypeDetail.labelBookingLink')}</Label>
				<div class="flex items-center gap-1.5">
					<span class="text-sm text-muted-foreground whitespace-nowrap">/book/</span>
					<Input id="et-slug" bind:value={form.slug} />
				</div>
				<p class="text-xs text-muted-foreground">
					{$t('eventTypeDetail.helpBookingLink')} <code>-copy</code>{$t('eventTypeDetail.helpBookingLinkTail')}
				</p>
			</div>
			<div class="space-y-1.5">
				<Label for="et-dur">{$t('eventTypeDetail.labelDuration')}</Label>
				<Input id="et-dur" type="number" min="5" step="5" bind:value={form.duration_minutes} />
				<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.helpDuration')}</p>
			</div>
			<div class="space-y-1.5">
				<Label for="et-slot">{$t('eventTypeDetail.labelSlotInterval')}</Label>
				<Input id="et-slot" type="number" min="1" step="5" bind:value={form.slot_interval_minutes} />
				<p class="text-xs text-muted-foreground">
					{$t('eventTypeDetail.helpSlotInterval')}
				</p>
			</div>
			<div class="col-span-2 space-y-1.5">
				<Label for="et-desc">{$t('eventTypeDetail.labelDescription')}</Label>
				<Textarea id="et-desc" bind:value={form.description} placeholder={$t('eventTypeDetail.placeholderDescription')} rows={3} class="resize-y" />
			</div>
			<div class="space-y-1.5">
				<p class="text-sm font-medium">{$t('eventTypeDetail.labelStatus')}</p>
				<div class="flex items-center gap-2">
					<Checkbox id="is-active" bind:checked={form.is_active} />
					<Label for="is-active" class="cursor-pointer font-normal">{$t('eventTypeDetail.checkboxActive')}</Label>
				</div>
			</div>
			<div class="space-y-1.5">
				<p class="text-sm font-medium">{$t('eventTypeDetail.labelVisibility')}</p>
				<div class="flex items-center gap-2">
					<Checkbox id="is-public" bind:checked={form.is_public} />
					<Label for="is-public" class="cursor-pointer font-normal">{$t('eventTypeDetail.checkboxPublic')}</Label>
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-1.5">
			<div class="flex items-center gap-2">
				<Checkbox id="show-taken" bind:checked={form.show_taken_slots} />
				<Label for="show-taken" class="cursor-pointer font-normal">{$t('eventTypeDetail.checkboxShowTaken')}</Label>
			</div>
			<p class="text-xs text-muted-foreground">
				{$t('eventTypeDetail.helpShowTaken')}
				{#if form.show_taken_slots}
					<span class="text-amber-700 dark:text-amber-500">
						{$t('eventTypeDetail.warnShowTaken')}
					</span>
				{/if}
			</p>
		</div>

		{#if isOnlineMeeting(form.location_type)}
			<label class="flex items-center gap-3 text-sm"><input type="checkbox" bind:checked={allowPhoneCall} />{$t('eventTypeDetail.checkboxPhoneCall')}</label>
		{/if}
        <div class="mt-6 space-y-3 border-t pt-5">
          <Label for="contact-policy">{$t('eventTypeDetail.contactPolicy')}</Label>
          <Select.Root type="single" bind:value={contactPolicy}>
            <Select.Trigger id="contact-policy" class="w-full">{$t('eventTypeDetail.contactPolicy.' + contactPolicy)}</Select.Trigger>
            <Select.Content>
              {#each ['email_or_phone', 'phone_only', 'email_only'] as policy}
                <Select.Item value={policy}>{$t('eventTypeDetail.contactPolicy.' + policy)}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          {#if contactPolicy === 'email_or_phone'}
            <Label for="contact-default">{$t('eventTypeDetail.contactDefault')}</Label>
            <Select.Root type="single" bind:value={defaultContactMethod}>
              <Select.Trigger id="contact-default" class="w-full">{$t('eventTypeDetail.contactDefault.' + defaultContactMethod)}</Select.Trigger>
              <Select.Content>
                <Select.Item value="phone">{$t('eventTypeDetail.contactDefault.phone')}</Select.Item>
                <Select.Item value="email">{$t('eventTypeDetail.contactDefault.email')}</Select.Item>
              </Select.Content>
            </Select.Root>
          {/if}
          <p class="text-xs text-muted-foreground">{$t('eventTypeDetail.contactHelp')}</p>
        </div>
		<!-- Location -->
		<div class="mt-6 border-t pt-5">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{$t('eventTypeDetail.fieldLocation')}</p>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="et-loc">{$t('eventTypeDetail.labelLocType')}</Label>
					<Select.Root type="single" bind:value={form.location_type}>
						<Select.Trigger id="et-loc" class="w-full">
							{locationLabel(form.location_type, 'common.select')}
						</Select.Trigger>
						<Select.Content>
							{#each LOCATION_TYPES as lt}
								<Select.Item value={lt.value} label={$t(lt.labelKey)}>{$t(lt.labelKey)}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-1.5">
					{#if isOnlineMeeting(form.location_type)}
						{@const platform = form.location_type === 'teams' ? $t('eventTypeDetail.locationTeams') : $t('eventTypeDetail.locationMeet')}
						<Label for="et-loc-val">{$t('eventTypeDetail.labelPlatformLink', { platform })}</Label>
						{#if meetAutoGen}
							<p class="rounded-md border border-green-600/20 bg-green-50 px-3 py-2 text-sm text-green-700">
								{$t('eventTypeDetail.meetAutoGenNotice', { platform })}{#if form.location_type === 'teams'} {$t('eventTypeDetail.teamsFallbackNote')}{/if}
							</p>
						{:else}
							<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
								{calStatus?.connected
									? $t('eventTypeDetail.calendarMismatch', { provider: calStatus.provider === 'google' ? 'Google' : 'Microsoft', platform })
									: $t('eventTypeDetail.noCalendarNotice', { platform })}
								{$t('eventTypeDetail.pasteLinkTail')}
							</p>
						{/if}
						<Input id="et-loc-val" bind:value={form.location_value} placeholder={meetAutoGen ? $t('eventTypeDetail.placeholderFallbackLink') : $t('eventTypeDetail.placeholderPlatformLink', { platform })} />
					{:else if form.location_type === 'zoom'}
						<Label for="et-loc-val">{$t('eventTypeDetail.needsValueZoom')}</Label>
						{#if zoomAutoGen}
							<p class="rounded-md border border-green-600/20 bg-green-50 px-3 py-2 text-sm text-green-700">
								{$t('eventTypeDetail.zoomAutoGenNotice')}
							</p>
						{:else}
							<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
								{zoomStatus?.configured
									? $t('eventTypeDetail.zoomConnectHint')
									: $t('eventTypeDetail.zoomNotConfigured')}
								{$t('eventTypeDetail.zoomPasteTail')}
							</p>
						{/if}
						<Input id="et-loc-val" bind:value={form.location_value} placeholder={zoomAutoGen ? $t('eventTypeDetail.placeholderFallbackLink') : 'https://…zoom.us/j/…'} />
					{:else if form.location_type === 'livekit'}
						<Label>{$t('eventTypeDetail.labelVideoRoom')}</Label>
						<p class="rounded-md border border-green-600/20 bg-green-50 px-3 py-2 text-sm text-green-700">
							{$t('eventTypeDetail.livekitNotice')}
						</p>
					{:else}
						<Label for="et-loc-val">{$t(LOCATION_NEEDS_VALUE[form.location_type] ?? 'eventTypeDetail.fallbackDetails')}</Label>
						<Input id="et-loc-val" bind:value={form.location_value} placeholder={$t(LOCATION_PLACEHOLDER[form.location_type] ?? 'eventTypeDetail.placeholderOptional')} />
					{/if}
				</div>
			</div>
		</div>

		<!-- Calendar invites -->
		<div class="mt-6 border-t pt-5">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{$t('eventTypeDetail.sectionInvite')}</p>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="et-invite">{$t('eventTypeDetail.labelInviteSender')}</Label>
					<Select.Root type="single" bind:value={form.invite_delivery}>
						<Select.Trigger id="et-invite" class="w-full">
							{$t(INVITE_DELIVERY.find((o) => o.value === form.invite_delivery)?.labelKey ?? 'common.select')}
						</Select.Trigger>
						<Select.Content>
							{#each INVITE_DELIVERY as o}
								<Select.Item value={o.value} label={$t(o.labelKey)}>{$t(o.labelKey)}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<p class="self-end text-xs text-muted-foreground">
					{#if form.invite_delivery === 'calnode'}
						{$t('eventTypeDetail.inviteCalnodeHelp1')}
						(<a href="{base}/settings/email" class="underline">{$t('eventTypeDetail.settingsEmailLink')}</a>){$t('eventTypeDetail.inviteCalnodeHelp2')}
					{:else}
						{$t('eventTypeDetail.inviteCalendarHelp')}
					{/if}
				</p>
			</div>
			{#if form.invite_delivery === 'calnode' && et?.invite_sender_ready === false}
				<p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
					{$t('eventTypeDetail.inviteNotReady')}
					<a href="{base}/settings/email" class="underline">{$t('eventTypeDetail.settingsEmailLink')}</a>.
				</p>
			{/if}
		</div>

		<!-- Price -->
		<div class="mt-6 border-t pt-5">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{$t('eventTypeDetail.sectionPrice')}</p>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="et-price">{$t('eventTypeDetail.labelAmount')}</Label>
					<Input id="et-price" type="number" min="0" step="0.01" bind:value={priceMajor} placeholder="0.00" />
				</div>
				<div class="space-y-1.5">
					<Label for="et-currency">{$t('eventTypeDetail.labelCurrency')}</Label>
					<Input id="et-currency" type="text" maxlength={3} bind:value={form.currency} placeholder="usd" />
				</div>
			</div>
			<p class="mt-2 text-xs text-muted-foreground">
				{$t('eventTypeDetail.helpPrice1')} <a href="/admin/settings/payments" class="underline">{$t('eventTypeDetail.stripeLink')}</a>{$t('eventTypeDetail.helpPrice2')}
			</p>
		</div>

		<!-- Scheduling -->
		<div class="mt-6 border-t pt-5">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{$t('eventTypeDetail.sectionScheduling')}</p>
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<Label for="et-buf-before">{$t('eventTypeDetail.labelBufferBefore')}</Label>
					<Input id="et-buf-before" type="number" min="0" step="5" bind:value={form.buffer_before_minutes} />
					<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.helpBufferBefore')}</p>
				</div>
				<div class="space-y-1.5">
					<Label for="et-buf-after">{$t('eventTypeDetail.labelBufferAfter')}</Label>
					<Input id="et-buf-after" type="number" min="0" step="5" bind:value={form.buffer_after_minutes} />
					<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.helpBufferAfter')}</p>
				</div>
				<div class="space-y-1.5">
					<Label for="et-notice">{$t('eventTypeDetail.labelMinNotice')}</Label>
					<Input id="et-notice" type="number" min="0" step="30" bind:value={form.min_notice_minutes} />
					<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.helpMinNotice')}</p>
				</div>
				<div class="space-y-1.5">
					<Label for="et-future">{$t('eventTypeDetail.labelBookingWindow')}</Label>
					<Input id="et-future" type="number" min="0" bind:value={form.max_future_days} />
					<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.helpBookingWindow')}</p>
				</div>
				<div class="space-y-1.5">
					<Label for="et-max-active">{$t('eventTypeDetail.labelMaxActive')}</Label>
					<Input id="et-max-active" type="number" min="0" bind:value={form.max_active_bookings} />
					<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.helpMaxActive')}</p>
				</div>
			</div>
		</div>

	</div>
</div>
{/if}

{#if activeTab === 'hosts'}
<div class="mb-8">
	<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{$t('eventTypeDetail.tabHosts')}</h2>
	<div class="rounded-lg border bg-card p-6">
		<div>
			<p class="-mt-1 mb-4 text-sm text-muted-foreground">{$t('eventTypeDetail.hostsIntro')}</p>

			<!-- Q1 — who can host -->
			<div class="space-y-1.5">
				<Label>{$t('eventTypeDetail.labelWhoCanHost')}</Label>
				<div class="inline-flex rounded-lg border bg-muted/40 p-0.5">
					<button type="button" onclick={() => setScope('me')}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {hostScope === 'me' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}">
						{$t('eventTypeDetail.btnJustMe')}
					</button>
					<button type="button" onclick={() => setScope('people')}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {hostScope === 'people' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}">
						{$t('eventTypeDetail.btnSpecificPeople')}
					</button>
				</div>
				<p class="text-xs text-muted-foreground">
					{#if hostScope === 'me'}
						{$t('eventTypeDetail.scopeMeHelp')}
					{:else}
						{$t('eventTypeDetail.scopePeopleHelp')}
					{/if}
				</p>
			</div>

			{#if hostScope === 'people'}
				<!-- Q2 — how the meeting is staffed -->
				<div class="mt-4 space-y-1.5">
					<Label>{$t('eventTypeDetail.labelStaffing')}</Label>
					<div class="inline-flex rounded-lg border bg-muted/40 p-0.5">
						<button type="button" onclick={() => (staffing = 'rotate')}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {staffing === 'rotate' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}">
							{$t('eventTypeDetail.btnRotate')}
						</button>
						<button type="button" onclick={() => (staffing = 'together')}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {staffing === 'together' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}">
							{$t('eventTypeDetail.btnTogether')}
						</button>
					</div>
					<p class="text-xs text-muted-foreground">
						{#if staffing === 'rotate'}
							{$t('eventTypeDetail.rotateHelp')}
						{:else}
							{$t('eventTypeDetail.togetherHelp')}
						{/if}
					</p>
				</div>

				{#if staffing === 'rotate'}
					<div class="mt-4 space-y-3">
						<div class="space-y-1.5">
							<Label for="rr-strategy">{$t('eventTypeDetail.labelWhoGetsPicked')}</Label>
							<Select.Root type="single" value={rrStrategy} onValueChange={(v) => { if (v) rrStrategy = v as Strategy; }}>
								<Select.Trigger id="rr-strategy" class="w-full">
									{$t(RR_STRATEGIES.find((s) => s.value === rrStrategy)?.labelKey ?? 'common.select')}
								</Select.Trigger>
								<Select.Content>
									{#each RR_STRATEGIES as s}
										<Select.Item value={s.value} label={$t(s.labelKey)}>{$t(s.labelKey)}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<p class="text-xs text-muted-foreground">
								{#if rrStrategy === 'priority'}
									{$t('eventTypeDetail.rrPriorityHelp')}
								{:else if rrStrategy === 'soonest'}
									{$t('eventTypeDetail.rrSoonestHelp')}
								{:else}
									{$t('eventTypeDetail.rrEvenHelp')}
								{/if}
							</p>
						</div>

						<p class="text-sm font-medium">{$t('eventTypeDetail.labelRotationPeople')}</p>
						{#if rotationHosts.length > 0}
							<div class="space-y-2">
								{#each rotationHosts as h, i (h.user_id)}
									<div class="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
										<div class="flex min-w-0 items-center gap-2">
											{#if rrStrategy === 'priority'}
												<span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{i + 1}</span>
											{/if}
											<div class="min-w-0">
												<div class="truncate text-sm font-medium">{h.name}</div>
												<div class="truncate text-xs text-muted-foreground">{h.email}</div>
											</div>
										</div>
										<div class="flex shrink-0 items-center gap-1">
											{#if rrStrategy === 'priority'}
												<Button type="button" variant="ghost" size="icon" disabled={i === 0} aria-label={$t('eventTypeDetail.ariaMoveUp')} onclick={() => moveRotation(i, -1)}>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
												</Button>
												<Button type="button" variant="ghost" size="icon" disabled={i === rotationHosts.length - 1} aria-label={$t('eventTypeDetail.ariaMoveDown')} onclick={() => moveRotation(i, 1)}>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
												</Button>
											{/if}
											<Button type="button" variant="ghost" size="sm" onclick={() => removePerson('rotation', h.user_id)}>{$t('common.remove')}</Button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.rotationEmpty')}</p>
						{/if}
						{@render hostPickers('rotation', 'rr')}
					</div>
				{:else}
					<div class="mt-4 space-y-3">
						<p class="text-sm font-medium">{$t('eventTypeDetail.labelWhoAttends')}</p>
						{#if togetherHosts.length > 0}
							<div class="space-y-2">
								{#each togetherHosts as h (h.user_id)}
									<div class="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
										<div class="min-w-0">
											<div class="truncate text-sm font-medium">{h.name}</div>
											<div class="truncate text-xs text-muted-foreground">{h.email}</div>
										</div>
										<div class="flex shrink-0 items-center gap-2">
											<div class="inline-flex rounded-md border p-0.5">
												<button type="button" onclick={() => setOptional(h.user_id, false)}
													class="rounded px-2 py-0.5 text-xs font-medium transition-colors {!h.optional ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}">
													{$t('eventTypeDetail.btnRequired')}
												</button>
												<button type="button" onclick={() => setOptional(h.user_id, true)}
													class="rounded px-2 py-0.5 text-xs font-medium transition-colors {h.optional ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}">
													{$t('eventTypeDetail.btnOptional')}
												</button>
											</div>
											<Button type="button" variant="ghost" size="sm" onclick={() => removePerson('together', h.user_id)}>{$t('common.remove')}</Button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-muted-foreground">{$t('eventTypeDetail.togetherEmpty')}</p>
						{/if}
						<p class="text-xs text-muted-foreground">
							<span class="font-medium text-foreground">{$t('eventTypeDetail.hintReqWord')}</span>{$t('eventTypeDetail.hintReqRest')}
							<span class="font-medium text-foreground">{$t('eventTypeDetail.hintOptWord')}</span>{$t('eventTypeDetail.hintOptRest')}
						</p>
						{@render hostPickers('together', 'grp')}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
{/if}

{#if activeTab === 'notifications'}
<!-- Notifications -->
<div class="mb-8">
	<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{$t('eventTypeDetail.tabNotifications')}</h2>
	<div class="rounded-lg border bg-card p-6 space-y-6">

		<!-- Reminders -->
		<div>
			<p class="mb-1 text-sm font-medium">{$t('eventTypeDetail.labelReminders')}</p>
			<p class="mb-3 text-xs text-muted-foreground">{$t('eventTypeDetail.helpReminders')}</p>
			<div class="space-y-2">
				{#each reminders as hb, i}
					<div class="flex items-center gap-2">
						<Select.Root
							type="single"
							value={String(hb)}
							onValueChange={(v) => {
								if (!v) return;
								const n = Number(v);
								reminders = reminders.map((r, idx) => idx === i ? n : r);
							}}
						>
							<Select.Trigger class="w-full">
								{REMINDER_OPTIONS.some((o) => o.value === hb) ? reminderLabel(hb) : $t('common.select')}
							</Select.Trigger>
							<Select.Content>
								{#each REMINDER_OPTIONS as opt}
									<Select.Item value={String(opt.value)} label={reminderLabel(opt.value)}>{reminderLabel(opt.value)}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onclick={() => { reminders = reminders.filter((_, idx) => idx !== i); }}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</Button>
					</div>
				{/each}
				{#if reminders.length < 5}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => {
							const used = new Set(reminders);
							const next = REMINDER_OPTIONS.find(o => !used.has(o.value));
							if (next) reminders = [...reminders, next.value];
						}}
					>
						{$t('eventTypeDetail.btnAddReminder')}
					</Button>
				{/if}
			</div>
		</div>

		<!-- Custom messages -->
		<div class="border-t pt-5">
			<p class="mb-1 text-sm font-medium">{$t('eventTypeDetail.labelCustomMessages')}</p>
			<p class="mb-3 text-xs text-muted-foreground">{$t('eventTypeDetail.helpCustomMessages')}</p>
			<div class="space-y-2">
				{#each [
					{ key: 'confirmation' as const, labelKey: 'eventTypeDetail.msgTypeConfirmation' },
					{ key: 'cancellation' as const, labelKey: 'eventTypeDetail.msgTypeCancellation' },
					{ key: 'reschedule' as const, labelKey: 'eventTypeDetail.msgTypeReschedule' },
					{ key: 'reminder' as const, labelKey: 'eventTypeDetail.msgTypeReminder' },
				] as item}
					<div class="rounded-md border">
						<button
							type="button"
							class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
							onclick={() => { msgOpen[item.key] = !msgOpen[item.key]; }}
						>
							<span>{$t(item.labelKey)}</span>
							<svg
								xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
								fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
								class="transition-transform {msgOpen[item.key] ? 'rotate-180' : ''}"
							><polyline points="6 9 12 15 18 9"/></svg>
						</button>
						{#if msgOpen[item.key]}
							{@const note = item.key === 'confirmation' ? msg_confirmation
								: item.key === 'cancellation' ? msg_cancellation
								: item.key === 'reschedule'   ? msg_reschedule
								: msg_reminder}
							<div class="border-t px-4 pb-4 pt-3 space-y-3">
								<div class="space-y-1.5">
									<Label class="text-xs text-muted-foreground">{$t('eventTypeDetail.labelSubjectLine')} <span class="font-normal">{$t('eventTypeDetail.subjectOptional')}</span></Label>
									{#if item.key === 'confirmation'}
										<Input bind:value={subj_confirmation} placeholder={$t('eventTypeDetail.placeholderSubjectConfirmed', { name: form.name })} />
									{:else if item.key === 'cancellation'}
										<Input bind:value={subj_cancellation} placeholder={$t('eventTypeDetail.placeholderSubjectCancelled', { name: form.name })} />
									{:else if item.key === 'reschedule'}
										<Input bind:value={subj_reschedule} placeholder={$t('eventTypeDetail.placeholderSubjectRescheduled', { name: form.name })} />
									{:else if item.key === 'reminder'}
										<Input bind:value={subj_reminder} placeholder={$t('eventTypeDetail.placeholderSubjectReminder', { name: form.name })} />
									{/if}
								</div>
								{#if item.key === 'confirmation'}
									<Textarea bind:value={msg_confirmation} rows={3} placeholder={$t('eventTypeDetail.placeholderCustomNote')} />
								{:else if item.key === 'cancellation'}
									<Textarea bind:value={msg_cancellation} rows={3} placeholder={$t('eventTypeDetail.placeholderCustomNote')} />
								{:else if item.key === 'reschedule'}
									<Textarea bind:value={msg_reschedule} rows={3} placeholder={$t('eventTypeDetail.placeholderCustomNote')} />
								{:else if item.key === 'reminder'}
									<Textarea bind:value={msg_reminder} rows={3} placeholder={$t('eventTypeDetail.placeholderCustomNote')} />
								{/if}

								<!-- Preview toggle -->
								<button
									type="button"
									class="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
									onclick={() => { previewOpen[item.key] = !previewOpen[item.key]; }}
								>{$t(previewOpen[item.key] ? 'eventTypeDetail.btnHidePreview' : 'eventTypeDetail.btnShowPreview')}</button>

								{#if previewOpen[item.key]}
									<pre class="rounded-md border bg-muted/30 px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground overflow-auto max-h-64">{buildPreview(item.key, note)}</pre>
								{/if}

								<!-- Send test button -->
								<div class="flex items-center gap-3">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={testSending[item.key]}
										onclick={() => sendTestEmail(item.key)}
									>
										{$t(testSending[item.key] ? 'eventTypeDetail.sending' : 'eventTypeDetail.btnSendTestEmail')}
									</Button>
									{#if testSent[item.key]}
										<span class="text-xs text-green-600">{$t('eventTypeDetail.testEmailSent')}</span>
									{/if}
									{#if testError[item.key]}
										<span class="text-xs text-destructive">
											{#if testError[item.key] === 'Email is not configured on this server — add SMTP settings to enable sending'}
												{$t('eventTypeDetail.smtpNotConfigured')} <a href="{base}/settings/email" class="underline">{$t('eventTypeDetail.smtpConfigureLink')}</a>.
											{:else}
												{testError[item.key]}
											{/if}
										</span>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Assistant greeting -->
		<div class="border-t pt-5">
			<p class="mb-1 text-sm font-medium">{$t('eventTypeDetail.labelAssistantGreeting')}</p>
			<p class="mb-3 text-xs text-muted-foreground">
				{$t('eventTypeDetail.helpGreeting')}
			</p>
			<Textarea bind:value={msg_greeting} rows={2} placeholder={$t('eventTypeDetail.placeholderGreeting')} />
		</div>

	</div>
</div>
{/if}

{#if activeTab === 'hosts' && $currentUser?.is_admin}
	<div class="mt-6 space-y-3 border-t pt-5">
		<Label for="transfer-owner">{$t('eventTypeDetail.labelTransferOwnership')}</Label>
		<p class="text-sm text-muted-foreground">{$t('eventTypeDetail.helpTransfer')}</p>
		<select id="transfer-owner" bind:value={transferOwner} class="h-9 w-full rounded-md border bg-background px-3 text-sm">
			<option value="">{$t('eventTypeDetail.optionSelectNewOwner')}</option>
			{#each transferHosts as host}<option value={host.user_id}>{host.name || host.email}</option>{/each}
		</select>
		<Button variant="outline" disabled={!transferOwner || transferring} onclick={transferEvent}>{$t(transferring ? 'eventTypeDetail.transferring' : 'eventTypeDetail.labelTransferOwnership')}</Button>
	</div>
{/if}

{#if activeTab === 'questions'}
	<QuestionsPanel slug={slug ?? ''} />
{/if}

{#if activeTab === 'embed'}
	<EmbedPanel slug={et?.slug ?? ''} />
{/if}

{#if activeTab === 'general' || activeTab === 'hosts' || activeTab === 'notifications'}
	<div class="sticky bottom-0 mt-4 flex justify-end border-t bg-background/90 py-3 backdrop-blur">
		<Button onclick={saveET} disabled={etSaving}>
			{$t(etSaving ? 'common.saving' : 'eventTypeDetail.btnSaveChanges')}
		</Button>
	</div>
{/if}

{/if}
