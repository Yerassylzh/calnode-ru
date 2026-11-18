# 002 — Admin UX overhaul: leaner navigation, enterprise-grade calendar interactions, live bookings

Status: Phases 0-7 implemented (2026-11-18, see sections 10-17); open items are listed at the end of section 17.
Prepared: 2026-11-18.

## 1. Objective and ground rules

Make the admin app (`frontend/`, SvelteKit) feel like a focused, enterprise-grade scheduling tool for a front-desk / clinic workflow, in three moves:

1. **Cut navigation and Settings down** to what this deployment actually uses.
2. **Rebuild the calendar's interaction layer** (popups, date/time/duration pickers, rescheduling, notes) around fast, anchored, keyboard-friendly components.
3. **Make bookings live**: new/changed/cancelled bookings appear without a page refresh.

Ground rules:

- **No backend logic changes** unless a section explicitly says "needs approval". Every phase below except §6.3 is frontend-only. Public booking templates, `embed.js` and the LiveKit room are out of scope (CLAUDE.md: they are intentionally framework-free).
- Build from shadcn-svelte (`Button`, `Dialog`, `Popover`, `Tooltip`, `ConfirmDialog`, `Select`, `Switch`, `Calendar`). Where shadcn has no component we need (`Sheet`/`Drawer`, `Command`, `Toggle Group`, `Skeleton`, `Kbd`), add the **official shadcn-svelte one** via the CLI rather than hand-rolling. Anything that genuinely does not fit is flagged in the PR before deviating.
- Every new string goes into **both** `en` and `ru` catalogs in `frontend/src/lib/i18n/catalogs/` (the admin is Russian-first in practice).
- After touching `frontend/src/lib/components/ui/**` or `app.css`: `pnpm test:visual`. After frontend changes: `pnpm build` **and** rebuild the Go binary (assets are `go:embed`-ed).

## 2. Audit — what is in the product today

### 2.1 Inventory

Admin routes (`frontend/src/routes/`) and their size:

| Route | Nav label (RU) | Lines | Notes |
| --- | --- | --- | --- |
| `/` and `/schedule` | Календарь | 305 + form 406 + picker 89 | The real calendar. Same page registered twice (`isSchedule` in `+layout.svelte:30`). |
| `/availability` | Доступность | 560 | Weekly hours + date exceptions. |
| `/bookings` | Бронирования | 607 | Table, filters, inline reschedule, answers expand. |
| `/calendar` | **Интеграции** | 516 | Not a calendar — external calendar connections (Google/Microsoft/CalDAV) + Zoom. |
| `/members` | Участники | 577 | Staff management. |
| `/teams` | Команды | 297 | Team (round-robin/collective) management. |
| `/recordings` | — | 417 | Already hidden unless LiveKit is configured (`recordingsConfigured`). |
| `/api-keys` | API-ключи | 168 | Needed: bookings arrive via API. |
| `/connections` | Подключённые приложения | 171 | OAuth/MCP connected apps. |
| `/webhooks` | Вебхуки | 343 | |
| `/settings/*` (11 pages) | Настройки | ~2,100 total | profile, notifications, branding, email, google, zoom, video, storage, payments, ai, tracking. |

Observations that make the "too much product" feeling objective:

- **Naming collision.** The page called *Календарь* is `schedule`; the page called *Интеграции* is `routes/calendar`. The nav key for the latter is `schedule.calendarConnections` (`+layout.svelte:77`). Anyone reading the code, URLs, or Go redirects (`internal/handler/calendar.go:107`, `zoom_connect.go:54` → `/admin/calendar`) gets this wrong.
- **Dead weight is already half-removed.** `internal/server/server.go:526-528` redirects `/admin/breaks` and `/admin/event-types*` to `/admin/schedule`: the event-type UI is gone, but its siblings (teams, connected apps, webhooks, ten settings pages) remain.
- Settings is an 11-entry sub-nav for a user whose actual needs are language, timezone, time format and avatar.
- Navigation is built from raw SVG strings injected with `{@html}` (`+layout.svelte:55-136`) while the rest of the app uses `@lucide/svelte`. Section headers, active-state logic and the demo-mode filter are all string-compared (`item.label === 'Calendar'`).

### 2.2 Defects observed in the supplied screenshots

1. **Raw i18n key shown to users** (Доступность → "Тип"): `availability.reason.day_off`. Cause: `availability/+page.svelte:523` and `:526` look up `` `availability.reason.${r}` `` with the enum value `day_off`, but the catalog key is `availability.reason.dayOff` (`catalogs/availability.ts:27,72`). `out_of_office` / `custom_hours` have the same mismatch. Trivial fix, embarrassing in a demo.
2. **"Выходной" on every day of an empty week** (calendar, first screenshot). A staff member with *no weekly hours configured* renders identically to a deliberate day off (`schedule/+page.svelte:262-271`), so the manager cannot tell "nothing is set up" from "closed". The Availability screenshot confirms why: every weekday reads "Часы не заданы".
3. **Inconsistent time/date formatting across pages.** Calendar: 24 h (`09:30`). Bookings: `19/11/2026, 09:30 AM` (12 h, DMY, from `lib/prefs.ts`). The calendar ignores `prefs.time_format`, `prefs.week_start` and `prefs.date_format` entirely — it hardcodes Monday-first and `hourCycle: 'h23'`.
4. **Visual density.** The calendar's green "Свободно" blocks have the same visual weight as real appointments and cover most of the grid in a busy week (third screenshot); the eye cannot find bookings.
5. **Truncated names, no status** in calendar blocks ("Дюсембаева Айгерим …", "Чичоян Сирануш Арап…"); phone number (the primary contact per plan 001) is not visible anywhere on the calendar.

### 2.3 Calendar page (`routes/schedule`) — deep findings

Layout & rendering (`+page.svelte`):

- **Hour range changes per week.** `firstHour`/`lastHour` come from the blocks present (`:57-59`, default 8–18), so scrolling to a different week rescales the whole grid and shifts every row. Rows are `100 / hours.length %` of the viewport height, so slot height also depends on screen size and data. Predictable, fixed pixel density (e.g. 64 px/hour) with a scrollable body is the standard.
- **No overlap handling.** Two bookings in the same time range are absolutely positioned on top of each other (`inset-x-1`, `:275`). No column packing.
- **No "now" indicator**, no "Today" button, no jump-to-date (the week label is plain text), no day/month view, no persisted week/staff (not in the URL, so a refresh resets to the current week and self).
- **Any reload blanks the grid.** `load()` sets `loading = true` and the template replaces the entire grid with a "loading" line (`:125`, `:235-236`). Harmless for a one-off load, unusable for live updates.
- **Fetch strategy.** Every load pages through `/v1/bookings` 100 at a time, then separately fetches breaks and availability (`:117-155`). Three requests, no caching, no abort of the superseded request (only an ignore-if-stale counter).
- **Weak affordance.** A free block has no hover preview of the slot that a click will create; the 5-minute rounding from click-Y (`:175-184`) is invisible to the user. No drag-to-create, no drag-to-move/resize.
- **Mobile.** Fixed `min-w-[760px]` with horizontal scroll; no day-view fallback. The sidebar toggle is a bare outline button labelled with the `doctorBreaks.menu` string.
- **Accessibility.** Blocks are `<button>`s (good) but there is no roving focus across the grid and no keyboard shortcuts (`T`, `←/→`, `N`).

### 2.4 The popup (`schedule-form.svelte`) — why it feels amateur

One 406-line component serves **six different jobs** through a `kind` prop: new booking, edit/reschedule booking, add break, remove break, add day off, remove day off. It is rendered in a single 640 px centred modal (`+page.svelte:295-305`).

- **Modal for everything.** Clicking a 20-minute slot to book someone throws a full-screen overlay over the calendar the person was just looking at. Deleting a break or a day off also opens the full form shell with a title, description and footer — a destructive confirmation dressed as a form. Cancelling a booking is an in-form two-step (`confirmingCancel`) instead of `ConfirmDialog` + undo.
- **Time entry is the weakest part.** `time-picker.svelte` is a free-text `HH:MM` box *plus* a popover with a 24-button hour grid and a 12-button minute grid. Choosing 14:35 takes two clicks in two grids; there is no way to see *which times are free* at a glance (unavailable hours are just 25 %-opacity buttons). Free windows are already computed (`allowedStarts`, `schedule-form.svelte:63-78`) but only used to disable buttons, and by brute-forcing all 1,440 minutes through `toZoned` on every change.
- **Duration is a bare number input** for new bookings, but **an end-time picker** when editing — two different mental models for the same field. The "carry the end with the start" `$effect` (`:138-149`) silently rewrites the end time.
- **Reschedule has three UIs.** The calendar popup (date picker + two time pickers), the Bookings page inline row with native `<Input type="date|time">` (`bookings/+page.svelte:560-568`), and the public manage page. The first two disagree on validation: the Bookings page does not check availability at all.
- **Contact entry.** Method `Select` (default **email**, `schedule-form.svelte:38`) + a regex-validated text box (`\+[1-9][0-9]{6,14}`) with a placeholder. Plan 001 makes phone the default contact method and the real-world data (screenshot 2) is phone-only; the default is backwards, and there is no formatting, no country prefix, no paste-cleaning (`+7 (701) 123-45-67` fails the pattern).
- **Notes** are a plain 3-row textarea inside the same save-everything form; fixing a typo in a note requires opening the form, clicking Save, and waiting for a refetch of the whole week.
- **Feedback.** One generic toast ("saved") for every action; no undo; errors appear as a red paragraph at the bottom of a scrolling modal, often below the fold at 90 dvh.
- **Dismissal.** No unsaved-changes guard, and `Dialog` closes on overlay click, so a half-typed booking is one misclick from being lost.

### 2.5 "No real-time" — what is actually there

- Nothing in `frontend/src` polls, listens to `visibilitychange`/`focus`, or opens a stream (grep confirmed). The Bookings page has a manual **Обновить** button (`bookings/+page.svelte:174`), which is the admission of the gap.
- Backend has no push channel for the admin. The only SSE code is the assistant's response stream (`internal/handler/booking_assistant.go`). `GET /v1/bookings` supports filters and paging but not "changed since".
- The booking list response already carries `updated_at` (`booking_handler.go:672`), which is enough to diff on the client.

## 3. Part 1 — Information architecture: cut the product down

### 3.1 Proposed navigation

| Section | Item (RU) | Route | Action |
| --- | --- | --- | --- |
| — | **Календарь** | `/` | Keep. This is the home page. Drop the duplicate `/schedule` route in favour of a redirect. |
| — | **Бронирования** | `/bookings` | Keep (list/search/export view of the same data). |
| — | **График работы** | `/availability` | Keep, rename from "Доступность"; fix the raw-key bug; it is the *weekly hours + exceptions* page. |
| Команда | **Участники** | `/members` | Keep (admin only). |
| Разработчик | **API-ключи** | `/api-keys` | Keep (bookings arrive via API). |
| Bottom | **Настройки** | `/settings` | Keep as **one page** (see 3.3), not a sub-nav. |
| — | ~~Интеграции~~ | `/calendar` | **Remove** from nav; see 3.2. |
| — | ~~Команды~~ | `/teams` | **Remove.** |
| — | ~~Подключённые приложения~~ | `/connections` | **Remove.** |
| — | ~~Вебхуки~~ | `/webhooks` | **Remove.** |
| — | Recordings | `/recordings` | Already conditional; remove with LiveKit settings if video is not used. |

Result: 5 nav items + Settings instead of 11, one section header instead of three. The "Developer" section collapses to a single API-keys link, so it becomes a plain item.

### 3.2 Removal mechanics — frontend only, no dead ends

- Delete the route files and their `catalogs/*.ts` entries. **Backend endpoints stay**; this is a UI removal and fully reversible from git.
- **Keep `/calendar` as a thin redirect to `/`.** The Go OAuth callbacks hardcode `/admin/calendar?connected=true` and `/admin/calendar?zoom=connected` (`calendar.go:107`, `zoom_connect.go:54`); changing those is a backend change, so the SPA absorbs them (`redirect(307, base + '/')`, optionally with a toast from the query string). Same for `/schedule` → `/`.
- **Verify the Go SPA fallback** serves `index.html` for removed paths so stale bookmarks hit the SPA redirect instead of a 404.
- **Config reachability check (Phase 0 gate).** For each page being removed, record whether the setting is also reachable via environment variables / DB defaults so an operator is not locked out. Specifically: SMTP/Resend (`internal/handler` `BuildMailer`), Google OAuth, Zoom, LiveKit, S3 storage, Stripe, LLM. If any has *no* non-UI path, either keep that one page behind `Settings → Advanced` (admin-only, collapsed) or document the env var in `docs/`. This is the main risk of the whole phase, and why the removal is gated rather than done on sight.
- Remove now-orphaned cross-links (`/admin/settings/google`, `/admin/settings/video`, `/admin/settings/storage`, `/admin/settings/ai` from other pages) and the `demo_mode` special-casing that existed only to hide the Calendar item.

### 3.3 Settings → one page

Single scrollable page with anchored sections, replacing the 11-entry sub-nav (`settings/+layout.svelte`):

1. **Профиль** — name, avatar (keep the existing cropper), password.
2. **Предпочтения** — language, timezone, time format (12/24 h), date format, **week start** — and wire these into the calendar (fix 2.2 #3).
3. **Уведомления** — current `settings/notifications` content if still relevant.

Everything else (branding, email, Google OAuth, Zoom, video, storage, payments, AI, tracking) leaves the UI per 3.2. Per-page decision table lives in the Phase 0 deliverable.

### 3.4 Navigation shell cleanup

- Replace `{@html item.icon}` strings with `@lucide/svelte` icons; drive nav from a typed array (`{ id, href, icon, labelKey, adminOnly }`) instead of English-label string comparison.
- Active state from route id, not `startsWith` on pathname.
- Collapsible sidebar (icon-only rail) so the calendar can take the full width; the mobile menu button gets a proper icon + `Sheet`.
- Footer: language select (the one remaining native `<select>`, `locale-switcher.svelte`) → shadcn `Select`; "Report issue" moves into the user menu; user card becomes a dropdown (Profile, Language, Sign out) instead of a link plus three stacked footer rows.
- Rename strings: "Календарь" stays for the schedule; "Доступность" → "График работы".

## 4. Part 2 — Calendar page redesign

### 4.1 Grid and visual system

- **Fixed density**: ~64 px per hour (compact toggle: 48 px), body scrolls vertically, header and time gutter are sticky. Default scroll position = start of working hours or the "now" line.
- **Working-hours shading instead of green blocks.** Free time is the *default* background; outside working hours is hatched/muted; **bookings are the only filled blocks**. Free-window blocks stop being buttons — the whole empty area is the click target, with a ghost preview (`09:30–10:00 · Новая запись`) following the pointer and snapping to the event step.
- **Now line** (red, with a dot in the gutter), updated every minute; "Today" button; clicking the week label opens a date popover to jump anywhere; `←/→` change week, `T` today.
- **Overlap layout**: standard column-packing for overlapping bookings (pure function, unit-tested).
- **Block content by height**: name + time always; phone and a status dot when ≥ 40 px; colour by status (confirmed / rescheduled / cancelled-struck-through) and kind (booking / break / day off). Keep one accessible colour palette defined as tokens in `app.css` (dark mode included).
- **Distinct empty states**: *no hours set* (CTA → График работы), *day off* (labelled, with reason), *closed outside hours*.
- **Views**: Week (default), Day (mobile default), and an agenda list below `sm`. Replaces the 760 px horizontal scroll.
- **Header**: staff `Select` becomes a searchable combobox with avatars (admins); view toggle; `Today`/`‹ ›`; primary `+ Новая запись` (`N`). "Добавить перерыв" and "Выходной" move into a single `+` dropdown or into the slot popover, since they are rare actions.
- **State in the URL** (`?week=2026-11-16&staff=…&view=week`) so refresh, back and shared links work.
- **Honour user prefs**: `week_start`, `time_format`, `date_format` via one shared `lib/datetime.ts` used by Calendar, Bookings and Availability (fixes 2.2 #3).

### 4.2 Interaction model — popovers, not a modal for everything

| Trigger | New surface | Contents |
| --- | --- | --- |
| Click/drag on empty slot | **Anchored `Popover`** ("quick create") | Name, contact (phone-first), start (pre-filled from slot), duration chips. `Enter` saves, `Esc` closes, "More options" expands to the full panel. |
| Click a booking | **Anchored `Popover` card** (read-only first) | Name, phone/email (click-to-call/copy), date·time·duration, host, location, status, notes preview; actions: **Перенести**, **Заметка**, **Отменить**. |
| Reschedule / edit | Same card switches to **edit mode in place** (§4.3) | No second modal. |
| Cancel booking | `ConfirmDialog` (destructive) → toast **with Undo** window where the API allows it, else clear wording | Replaces the in-form `confirmingCancel`. |
| Break / day off create | Slot popover tabs: **Запись · Перерыв · Выходной** | Same anchored surface, same fields subset. |
| Break / day off delete | Click block → small popover card with **Удалить** (`ConfirmDialog`) | Replaces the full-form "remove" kinds. |
| Narrow screens | Same content in a bottom **`Sheet`** | One component, two containers. |

Implementation shape: split `schedule-form.svelte` into small single-purpose components under `routes/schedule/` — `BookingCard`, `QuickCreate`, `RescheduleEditor`, `BreakEditor`, `DayOffEditor`, `SlotPicker`, `DurationChips`, `PhoneField`, `NotesField` — plus a thin `EventSurface` that renders either `Popover` or `Sheet`. Business payloads (`/v1/schedule/bookings`, `/reschedule`, `/doctor-breaks`, `/availability-overrides`) are unchanged.

### 4.3 Date, time, duration, reschedule

- **`SlotPicker` replaces `TimePicker` for booking and rescheduling.** Shows the *actually bookable start times* for the chosen date and duration as chips, grouped Утро / День / Вечер, step from the working interval (5/10/15/20/30), the current time highlighted. Unavailable times are not shown instead of being greyed. A "Другое время" field (free text, same validation) remains for manual override within hours.
- **Pure, tested slot maths.** Extract the "which start minutes fit in free windows" logic from `schedule-form.svelte:63-78` into `lib/schedule/slots.ts`, replacing the 1,440-iteration `toZoned` brute force with interval arithmetic (convert each window once to minutes-of-day in the staff timezone, handle DST gaps explicitly). Vitest unit tests cover DST transitions, windows crossing midnight, and exclusion of the booking being moved.
- **Duration** = chips (10 · 15 · 20 · 30 · 45 · 60) + "Другое". Editing uses the same control; the end time is *displayed* (`09:30 → 10:10`) and derived, never typed. Drops the silent end-carrying effect.
- **Date control**: existing shadcn `DatePicker`, extended with `‹ ›` day steppers, "Сегодня / Завтра" shortcuts, days without availability dimmed (one availability request per visible month, cached), and `week_start` from prefs.
- **One reschedule component** used by the calendar card **and** the Bookings page (removing `Input type="date|time"` at `bookings/+page.svelte:560-568`), so both validate against free windows and show the same conflict messages. Optional: drag a booking to a new slot / resize its bottom edge, with a confirm popover showing `Было → Станет` and Undo.
- **Conflicts** (HTTP 409 from the existing endpoints): keep the current slot list visible, refresh availability, and show an inline "Это время только что заняли — выберите другое" instead of a bottom-of-modal red paragraph.

### 4.4 Contact and notes

- **Phone-first**, matching plan 001: segmented toggle `Телефон | Email` (default phone), `PhoneField` with country selector (default from locale/KZ +7), live formatting, tolerant paste (`+7 (701) 123-45-67` → `+77011234567`), validation message in the field. Submits the same `contact_method` / `contact_phone` / `email` payload.
- **Existing-client autocomplete** from already-loaded bookings (name + phone) to speed repeat bookings; purely client-side.
- **Notes**: inline editable block on the booking card — click to edit, autosave on blur or `Ctrl+Enter`, "Сохранено ✓" indicator, `Esc` reverts. Uses the existing `PATCH /v1/bookings/{id}` `{ notes }`; no reschedule involved.
- **Unsaved-changes guard** on any popover/sheet with edits (confirm before dismiss on outside click).

### 4.5 Feedback and polish

- Specific toasts ("Запись создана · Иванова · Чт 19, 10:00" with *Открыть*), and error toasts with retry.
- Optimistic block insertion with a pending state, rolled back on failure.
- Skeleton shimmer for first load only; never blank the grid on refresh.
- Keyboard map: `N` new, `T` today, `←/→` week, `D/W` day/week, `/` search staff, `Esc` close; a `?` cheat-sheet dialog.
- Bookings page gets the same card/reschedule component, consistent date format, and the manual refresh button is demoted once live updates land.

## 5. Part 3 — Real-time bookings (frontend-only first)

### 5.1 Design

Introduce `lib/live/live-query.svelte.ts`, a small stale-while-revalidate primitive used by Calendar and Bookings:

- **Silent refresh**: keeps previous data on screen, shows a subtle "Обновлено 12:04:31 · ⟳" indicator, never toggles the grid into a loading state.
- **Polling cadence**: every 15 s while the tab is visible and online; paused on `visibilitychange: hidden`; immediate refetch on `visibilitychange: visible`, window `focus`, and `online`; exponential backoff (up to 2 min) on errors with a quiet "Нет связи — повторяем" chip.
- **Cheap polling**: poll only the visible range — bookings for the week (single call, `limit` sized to the range) and availability — not breaks (breaks only change by the user's own actions; refetch them on mutation and on focus). Abort the in-flight request when a new one starts (`AbortController`).
- **Diff, don't replace**: compare `(id, updated_at, status, start_at, end_at)` with the previous snapshot. Unchanged → no state write → no re-render. Changed → patch only those blocks.
- **Make arrivals visible**: new/changed blocks pulse once; if the booking came from someone else (not an action initiated in this tab), show a toast "Новая запись: Иванова · Чт 19, 10:00 · **Показать**" and, for off-screen changes, a small "N новых" chip that navigates to the right week. Cancelled-by-others shows the same way.
- **Open-surface safety**: if the booking currently open in a popover is changed or cancelled remotely, show an inline banner ("Запись изменена — обновить / продолжить") rather than silently editing stale data; if the chosen slot is taken remotely, the `SlotPicker` removes it and explains.
- **Multi-tab hygiene**: `BroadcastChannel('calnode-live')` so one tab polls and the others receive the diff, avoiding N× polling by the same user.

### 5.2 Cost / risk

SQLite with a single connection (CLAUDE.md, email section) means polling load is real: 15 s × a handful of admins × 2 requests is negligible, but the plan keeps requests cheap, paused when hidden, and shared across tabs. If a deployment has dozens of simultaneously open admin tabs, move to §6.3.

### 5.3 Optional backend upgrade — needs explicit approval

Not part of the default scope. If polling proves insufficient:

1. `GET /v1/events` (SSE, authenticated) emitting `booking.created|updated|cancelled` with `{id, host_id, start_at, end_at, updated_at}`, fed from the existing booking mutation paths (REST, MCP, assistant, schedule form, worker). Verify there is no server `WriteTimeout` that would cut the stream (`internal/server/server.go`) and that the `statusRecorder` in `internal/server/middleware.go` forwards `Flusher` (it does today).
2. Or the minimal alternative: an `updated_since=<ts>` filter on `GET /v1/bookings` so a poll returns only deltas.

Front-end design in §5.1 is transport-agnostic (`LiveQuery` swaps polling for an `EventSource` source with polling as fallback), so approving this later changes one file.

## 6. Phased delivery

Each phase is a separate PR, independently shippable, in this order (value ÷ risk):

| Phase | Scope | Backend | Exit criteria |
| --- | --- | --- | --- |
| **0. Triage & gates** | Fix `availability.reason.*` raw keys; record per-page config reachability for 3.2; decide delete-vs-Advanced for each Settings page; shared `lib/datetime.ts` honouring user prefs | none | Raw keys gone; decision table checked into this folder |
| **1. Navigation cut** | New nav (3.1), `/calendar` & `/schedule` redirects, remove teams/connections/webhooks/integrations UI, single Settings page, lucide icons, shadcn locale select | none | Sidebar has 5 items + Settings; OAuth return URLs land on `/`; `pnpm check`, `pnpm test:visual`, Go build + manual walk of `/admin/*` |
| **2. Live bookings** | `LiveQuery`, silent refresh, diff + arrival toasts, visibility/focus/online handling, URL-persisted week/staff, drop "loading blanks the grid" | none | Create a booking via `curl` / second browser: it appears on an open calendar ≤ 15 s, no flicker, no refresh |
| **3. Calendar grid v2** | Fixed density, now line, today/jump-to-date, overlap packing, shading instead of green blocks, status colours, day/agenda view for mobile, empty-state distinction | none | Visual review desktop + mobile; layout-function unit tests |
| **4. Interaction layer** | `EventSurface` (Popover/Sheet), `BookingCard`, `QuickCreate`, break/day-off surfaces, `ConfirmDialog` cancel flow, specific toasts, unsaved-changes guard | none | No modal for create/view/edit; every action works by keyboard |
| **5. Pickers & reschedule** | `SlotPicker`, `DurationChips`, `PhoneField`, date steppers, shared reschedule component also used by Bookings, extracted tested `slots.ts`, inline notes | none | Booking in ≤ 3 interactions from an empty slot; Bookings page reschedule validated against availability |
| **6. Polish** | Keyboard shortcuts + cheat-sheet, drag-to-move/resize (optional), skeletons, a11y pass (focus order, `aria-live` for arrivals), Russian copy review | none | Axe-clean on calendar; Lighthouse a11y ≥ 95 |
| **7. (Optional) Push** | SSE or `updated_since` | **yes — approval required** | Latency < 2 s; polling retained as fallback |

## 7. Verification

- **Unit (Vitest)**: slot interval maths (DST, midnight crossing, excluded booking), overlap column-packing, live-diff reducer, phone normalisation, date/time formatting honouring prefs.
- **Visual smoke**: extend `src/visual-smoke.test.ts` for any new `ui/*` component (Sheet, Toggle Group, Skeleton) and for the `data-state` custom variants noted in CLAUDE.md.
- **Manual against the real app** (CLAUDE.md: builds can compile and still render wrong): rebuild frontend + Go binary; walk Calendar, Bookings, Availability, Members, Settings at 1440 px and 390 px, light and dark, RU and EN. Specific scripts: (1) create booking by `curl` while calendar is open; (2) cancel it from a second browser while its card is open; (3) take a slot in tab B while tab A's slot picker shows it; (4) kill the network and restore it; (5) hit the old `/admin/calendar?connected=true` URL.
- `pnpm check`, `pnpm test:visual`, `go test ./...` (should be unaffected, but confirms no accidental coupling).

## 8. Risks and open decisions

1. **Settings removal locks out operators** who configure email, Google, storage, etc. through the UI today. Mitigated by the Phase 0 gate. **Decided (2026-11-18):** delete the UI for Branding, Tracking, Payments, AI, Zoom and Google OAuth; keep **Email**, **Storage** and **Video** under `Settings → Advanced` (admin-only, collapsed) until a non-UI configuration path is confirmed for each, then delete them too.
2. **Is Recordings/LiveKit in use?** If not, remove `/recordings` and `settings/video` outright; if yes, keep both.
3. **Remove `/teams` outright?** Event-type/round-robin UI is already gone, so teams have no consumer in the admin; confirm no booking-filter dependency (`bookings/+page.svelte` loads a `teams` filter list).
4. **Drag-to-move/resize** adds meaningful complexity and test surface; ship Phases 0–5 first and decide on it with the team afterwards.
5. **Polling vs. SSE** — default is polling; whether to authorise the small backend change in §5.3 is the user's call.
6. **`Sheet`/`Drawer`, `Toggle Group`, `Skeleton`, `Command`/`Combobox` additions** come from the official shadcn-svelte registry (`components.json` is already configured) — flagging because they enlarge `ui/**` and trigger `pnpm test:visual`.
7. **i18n** — every user-facing string in `en` + `ru`; the existing LLM-drafted-translation caveat in CLAUDE.md applies to any new Russian copy until reviewed by a native speaker.

## 9. Files most affected

- Shell: `frontend/src/routes/+layout.svelte`, `routes/settings/+layout.svelte`, `routes/settings/*`, `lib/components/locale-switcher.svelte`.
- Removed: `routes/teams`, `routes/connections`, `routes/webhooks`, `routes/calendar` (→ redirect), most of `routes/settings/*`, matching `lib/i18n/catalogs/*`.
- Calendar: `routes/schedule/+page.svelte`, `schedule-form.svelte` (split), `time-picker.svelte` (replaced), new `lib/schedule/*`, `lib/live/*`, `lib/datetime.ts`, `lib/components/ui/{sheet,toggle-group,skeleton}`.
- Pages sharing the new components: `routes/bookings/+page.svelte`, `routes/availability/+page.svelte` (key fix + exception form on the same date/duration controls).
- Styles/tests: `frontend/src/app.css` (status/shading tokens), `frontend/src/visual-smoke.test.ts`.

## 10. Phase 0-1 implementation record (2026-11-18)

### 10.1 Config reachability (Phase 0 gate)

Checked against `.env.example`, `internal/config/config.go` and the settings handlers.

| Removed/kept page | Non-UI configuration path | Outcome |
| --- | --- | --- |
| Google OAuth | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env | UI removed; env path exists |
| Zoom | `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` env | UI removed; env path exists |
| Email | `EMAIL_SMTP_*` env for SMTP; **Resend key has no env var** (UI only) | **Kept** under Settings → Advanced |
| Storage | Litestream bucket is env-only; the recordings on/off toggle is UI-only | **Kept** under Advanced |
| Video (LiveKit, notetaker) | UI/DB only | **Kept** under Advanced |
| Branding (logo, banner, business name) | UI/DB only | UI removed per decision; **no way to change it now** without the API |
| Payments (Stripe), Tracking, AI/LLM | UI/DB only | UI removed per decision; **no way to change them now** without the API |

Consequences the team should know about: (a) with the Integrations page gone there is no UI to connect a new external calendar or Zoom account; existing connections keep working. (b) The recordings "no LLM configured" hint no longer links anywhere because Settings → AI is gone. (c) The bookings **team filter** was removed with the Teams UI. The backend endpoints for all of these are untouched, so restoring any page is a `git revert` of its deletion.

### 10.2 What shipped

- Raw key fix: `availability.reason.*` lookups now map the API enum to the camelCase catalog keys (`routes/availability/+page.svelte`).
- `lib/datetime.ts` (+ tests): `startOfWeek`, `clockLabel`, `hourLabel`. The calendar now honours the user's week-start and 12/24 h preferences. Form inputs inside the booking dialog are still 24 h (Phase 5).
- Navigation rebuilt from a typed list with `@lucide/svelte` icons, no section headers, dividers between groups: Calendar, Bookings, Working hours, Members*, Recordings* (feature-gated), API keys, Settings. (*admin only.) "Доступность" is renamed "График работы" in the nav, page title and heading.
- The calendar page moved from `routes/schedule/+page.svelte` to `routes/+page.svelte` (the duplicate wrapper is gone). `/schedule` and `/calendar` are redirect stubs to `/`, so the Go OAuth callbacks and `/admin/breaks`, `/admin/event-types` redirects still land correctly. The `?connected=true` toast is not preserved.
- Deleted routes: teams, connections, webhooks, settings/{branding,google,zoom,payments,ai,tracking}; and their ten i18n catalog modules. Unused keys left over in other catalogs were removed.
- Locale switcher is now the shadcn `Select`.
- `i18n.test.ts` used keys from deleted catalogs; it now uses `bookings.filters.upcoming` and `availability.spanDuration`.

### 10.3 Deviations from the plan

- **Settings is not one scrolling page.** Profile and Notifications each own a form with a window-level `Ctrl+S` save handler; stacking them would make one keystroke save both. Settings keeps a small side nav instead: *Your account* (Profile, Notifications) and *Advanced* (Email, Video, Storage; admin only). Merging into one page is deferred.
- **Not done yet from section 3.4:** collapsible sidebar rail, user dropdown menu (needs the shadcn `dropdown-menu` component), mobile `Sheet` menu. These move to Phase 6.

### 10.4 Verification

`pnpm check` 0 errors; `pnpm test:visual` 17/17 passing; `pnpm build` succeeds. Go is not installed on this machine, so the binary was **not** rebuilt and the real app was not run. The built frontend was exercised in the in-app browser against a mock API: sidebar items, `/calendar?connected=true` and `/schedule` redirects, `/teams` now 404s inside the app, Settings nav, Russian labels, and the day-off option rendering as "Выходной".

## 11. Phase 2 implementation record (2026-11-18) - live bookings

### 11.1 What shipped (frontend only, no backend change)

- `lib/live/poller.ts`: visibility-aware polling. Runs every 15 s while the tab is visible and online; pauses when hidden; refetches immediately on `visibilitychange`, `focus` and `online`; never overlaps runs; exponential backoff (cap 2 min) after failures.
- `lib/live/diff.ts`: pure snapshot diff (added / time-changed / details-changed / cancelled / removed). Diffs on the fields the API already returns, so no `updated_at` is needed.
- **Calendar** (`routes/+page.svelte`): `load()` now has a `silent` mode that never shows the loading state, keeps the old data on failure, and skips state writes when nothing changed (no re-render). Each tick fetches bookings + availability; breaks every fourth tick.
- **Arrivals are visible**: changed or new blocks flash (`.live-flash`, reduced-motion safe) and a toast names the booking ("Новая запись: … · ср, 18, 12:00"); more than three changes collapse to one toast.
- **Own edits are not echoed back**: `saved()` refreshes silently with `notify: false`.
- **Open booking form is protected**: if the booking being edited is changed elsewhere, an amber banner appears with "Загрузить актуальное"; if it is cancelled elsewhere the form flips to read-only with a banner.
- **Header indicator**: "Обновлено 21:41" plus a manual refresh button; "Нет связи - повторяем" while polls fail, clearing on recovery.
- **URL state**: `?week=YYYY-MM-DD` and `?staff=<id>` (admins only) are written with `replaceState` and read on load; defaults (current week, yourself) stay out of the URL. Deep links to any day normalise to that week.
- **Bookings page**: quiet background refresh with the same poller, skipped while reloading or while an inline reschedule is open; a transient failure never shows the error banner; toast when the upcoming count grows.
- Fixed a latent bug while here: a superseded load could leave the calendar stuck in "loading".

### 11.2 Deliberately not done

- **BroadcastChannel multi-tab sharing** (section 5.1): each tab polls on its own. At 15 s and two small requests this is cheap; revisit with section 5.3 if many admin tabs are open.
- **"N new" chip for changes outside the visible week**: only the visible week is fetched, so off-screen arrivals are not detected. Needs the backend `updated_since`/SSE option in section 5.3.
- **Request abort**: `api.get` has no `AbortSignal`; superseded responses are discarded by a version counter instead.
- Time-of-day correctness of toasts uses the staff member's timezone, matching the grid.

### 11.3 Verification

`pnpm check` 0 errors; `pnpm test:visual` 25/25 (8 new tests for the diff, backoff and poller); build succeeds. Against a mock API in the in-app browser: a booking added remotely appeared on an open calendar with a flash and toast without a reload; moving it while its form was open showed the banner and "Load latest" applied the new time; cancelling it flipped the form to read-only; simulated 500s showed the offline chip, kept the grid, and cleared on recovery; `?week=` survived a reload; the bookings page picked up a new booking and toasted. As before, the real Go binary was not run (Go is not installed here), and the 15 s timer itself was exercised through `focus` events and unit tests rather than a real 15 s wait.

## 12. Phase 3 implementation record (2026-11-18) - calendar grid v2 (verified)

Shipped (frontend only): new `routes/schedule/calendar-grid.svelte` with fixed 64 px/hour density over a scrollable 24 h body (opens near the earliest activity), sticky day header and hour gutter, hatched "closed" time instead of green free blocks (free time is the plain background and the click target), hover ghost preview snapped to 5 min, red now-line, overlap column packing, status colours, phone shown on tall blocks. Page: Today button, jump-to-date popover, Week/Day views (Day is the default under 640 px), `view`/`day` URL params, keyboard shortcuts (arrows, T, N, D, W), a "no working hours set" banner instead of seven "day off" labels, and the grid stays mounted (dimmed) while a week loads. Pure helpers with 13 unit tests in `lib/schedule/layout.ts`.

Verification: `pnpm check` 0 errors, `pnpm test:visual` 38/38, build OK. In the browser against the mock API I saw the grid render with hatching, hour/half-hour rules, today highlight, overlapping bookings side by side and a 10-minute booking. **Verified afterwards in the browser against the mock API:** hover ghost and click (13:10 slot gave a 13:10 start), now-line, Day/Week switching, arrows/T/N/D/W shortcuts with URL updates, jump-to-date popover, the no-hours banner, and a 375 px mobile layout (opens in Day view). Bug found and fixed: the key handler called `closest` on a non-element target. Known rough edge: on phones the header wraps to about 330 px tall; it is a candidate for the Phase 4/6 header cleanup.


## 13. Phase 4 implementation record (2026-11-18) - popovers instead of the modal

Shipped (frontend only):
- `routes/schedule/event-surface.svelte`: an anchored `Popover` (virtual anchor = the clicked block, or a rect snapshot at the clicked slot, opens to the side with collision flipping) on desktop; on phones or when there is no anchor (header button, `N` key) the same content renders as a bottom-sheet-style `Dialog`. Every dismiss path (Escape, outside click, X, Close button) goes through one `requestClose`.
- **Unsaved-changes guard**: the form reports `dirty` (new booking with a name/contact/notes, edited time or notes, break title, day-off reason); dismissing then shows a "Discard changes?" `ConfirmDialog` with Keep editing / Discard.
- **Cancel booking** now uses a destructive `ConfirmDialog` instead of the in-form two-step; **removing a break or a day off** is a one-click `ConfirmDialog` on the block (no form shell). The `removeBreak`/`removeDayOff` form modes were deleted.
- **Specific toasts** with names and times: created / moved / updated / cancelled / break added+removed / day off added+removed.
- Form re-laid out for 420 px (date full width, time and duration side by side), sticky footer, and the contact method now defaults to **Phone** (matches plan 001; the phone field component itself is Phase 5).
- Fixed along the way: an anchored popover opened from a click was dismissed by that same click (ignored for 300 ms after opening), and clicks inside a confirmation were treated as outside the popover (surface is `locked` while a confirmation is open).

Verification: `pnpm check` 0 errors, `pnpm test:visual` 38/38, build OK. Against the mock API in the in-app browser: clicking a booking opened a popover beside it with no overlay; a real click on a free slot opened the quick-create popover at the right time with Phone preselected; clean Escape closed it; with a typed name Escape showed the discard confirm, Keep editing preserved the input, Discard closed it; Cancel booking showed its confirm and then the toast "Booking cancelled: ... 10:00". Caveats: the pane was throttled in places (exit animations did not complete, and real keyboard Escape/clicks were unreliable), so several steps were driven with dispatched events; the break/day-off removal confirms and the phone bottom-sheet layout were not exercised by hand.

Not done from section 4.2: separate `BookingCard` read-only-first view and a reduced "quick create" with a "More options" expander (the existing form is used in both roles), drag-to-create, and an undo window after cancelling (the API gives none).

## 14. Phase 5 implementation record (2026-11-18) - pickers and one reschedule form

Shipped (frontend only):
- `lib/schedule/slots.ts`: `createStartChecker` replaces the 1,440-iteration brute force; returns `fits(minute)` and `starts(step)` (multiples of the step plus each free window's own start, so odd-minute gaps such as 11:10 are offered). DST-gap minutes are never offered.
- `lib/phone.ts`: `normalizePhone` (accepts `+7 (701) 123-45-67`, `8 701 123 45 67`, `7011234567`, `0044...`) and `isValidPhone` (E.164).
- `slot-picker.svelte`: bookable start times as chips grouped Morning/Afternoon/Evening, honouring the 12/24 h preference, with an "Other time" field; shows loading and "no free times" states. `duration-chips.svelte`: 10/15/20/30/45/60 plus a custom value; the end time is now shown ("Ends at 11:30") and derived, never typed (the old end-time picker and its silent end-carrying effect are gone). `phone-field.svelte`: normalises on blur and validates after leaving the field. The break form keeps the old `TimePicker` (breaks are not availability-bound).
- Date control: previous/next-day buttons and Today/Tomorrow shortcuts next to the date picker.
- **Bookings page now uses the same form** (`schedule-form.svelte`, kind `details`) in a dialog for rescheduling and cancelling, instead of an inline row with native date/time inputs and no availability check. `Booking` gained the `host_id` field the API already returns.
- Fixed a latent bug: the details initialisation effect read `date`, so changing the date in an open booking silently reverted it.

Verification: `pnpm check` 0 errors, `pnpm test:visual` 49/49 (11 new for slots and phone). Against the mock API in the in-app browser: the booking popover listed 09:00-16:00 chips for a 60 min booking with the current time selected and "Ends at 11:00"; choosing 11:00 then 30 min gave "Ends at 11:30"; next-day/Today/Tomorrow moved the date; a new booking via the header button normalised `8 (701) 123-45-67` to `+77011234567`, rejected `12345` with a message, and produced the toast "Booking created: Иванова Анна · 18 Wed, 09:00"; the Bookings page reschedule button opened the shared form with 49 slot chips and no legacy inline inputs. Go not run; availability in the mock ignores other bookings, so conflict (409) handling was not exercised.

Not done from section 4.3/4.4: dimming days without availability in the date picker, existing-client autocomplete, a country selector for the phone field (default country is +7), inline click-to-edit notes with autosave, and drag-to-reschedule.

## 15. Phase 6 implementation record (2026-11-18) - polish (partial)

Shipped (frontend only): a keyboard-shortcuts dialog (`?` or the keyboard button in the calendar header, listing arrows, T, N, W, D, Esc); a skeleton for the calendar's first load (new shadcn-style `ui/skeleton`) with a screen-reader "Loading" status; the collapsible icon rail from section 3.4 (desktop only, remembered in `localStorage`, labels become tooltips/screen-reader text, phone menu unchanged); Russian copy fix for the discard confirmation ("Закрыть без сохранения" / "Продолжить редактирование" instead of the ambiguous "Отменить изменения").

Verification: `pnpm check` 0 errors, `pnpm test:visual` 49/49, build OK. In the browser against the mock API: the rail collapsed to 56 px, persisted across a reload, and the toggle state flipped back; `?` opened the dialog with all seven shortcuts. Width/fade animations did not finish in the throttled pane, so final widths after toggling back were not observed.

**Not done:** an automated accessibility audit (injecting axe-core from a CDN was blocked, so none was run; run it locally before release), drag-to-move/resize, the user dropdown menu (needs the shadcn `dropdown-menu`), the mobile sheet menu, merging Settings into one page, compacting the calendar header on phones (still wraps to about 330 px), and a full Russian copy review of the older catalogs.

## 16. Phase 7 implementation record (2026-11-18) - push channel (backend change, approved)

This is the one backend change in the plan, requested explicitly. It adds an endpoint and a notification hook; no booking logic, validation, schema or existing response changed.

- **`internal/booking/change.go` + hooks in `service.go`:** `Service.SetOnChange(func(Change))`, called after commit by `Create`, `Cancel`, `CancelByID`, `CancelByToken`, `UpdateNotes`, `Reschedule` and `ReassignHost` (so REST, MCP, the assistant, the admin UI and manage links all notify). `Change` carries only a host id (empty = unknown/several), never booking data. Failed mutations do not notify.
- **`internal/handler/events.go`:** `GET /v1/events` (`RequireAuth`, so cookie or API key), a Server-Sent Events stream. Admins are notified for every host, members only for their own; an unknown host reaches everyone. Notifications coalesce into one `event: bookings` frame; a `: ping` heartbeat every 25 s; each stream ends after 10 min (the browser reconnects itself) and all streams end when the worker context is cancelled so graceful shutdown is not held up. The server's 30 s `WriteTimeout` is lifted per stream via `http.ResponseController`; `responseWriter` in `internal/server/middleware.go` gained `Unwrap()` so that works through the logging wrapper. Because the payload is only "refetch", the endpoint cannot disclose anything the list endpoints would not.
- **Frontend:** `lib/live/events.ts` (`connectLiveEvents`, debounced, reports connected/disconnected) and `poller.setInterval`. Calendar and Bookings refetch the moment an event arrives; while the stream is connected polling slows from 15 s to 60 s as a safety net, and it returns to 15 s if the stream drops or is unavailable (old server, proxy, 401). The tab's own edits echo back over the stream, so the calendar suppresses "remote change" toasts for 4 s after it starts a mutation.

Verification: Go tests run in the `golang:1.27.2-alpine` image already on this machine (modules fetched per `go.sum`): new `TestEventHub*`, `TestStreamEvents*` (auth, delivery, shutdown close) and `TestOnChange*` (every mutation notifies the right host, failures do not, hook removable) pass; `go build ./...` and `go vet` are clean; `internal/booking` and `internal/handler` suites pass. Frontend: `pnpm check` 0 errors, `pnpm test:visual` 51/51 (poller interval and event-source tests added). **End to end against the real binary** (`go run` in a container, owner claimed, session cookie): `GET /v1/events` without a session returned 401; with a session a created booking, a notes edit and a cancel each produced one `bookings` event within the same second; a separate stream stayed open for 40 s with a `: ping` at 25 s, i.e. past the 30 s write timeout.

Not verified: the browser UI against the real server (the email login is disabled on a fresh instance and the session cookie is HttpOnly, so the pane could not be signed in), multi-instance deployments (the hub is in-process; fine for the single-binary SQLite design in CLAUDE.md), and behaviour behind a buffering reverse proxy (the response sets `X-Accel-Buffering: no`).

Pre-existing, unrelated, left alone: `internal/server` `TestRateLimit_returns429AfterLimit` and `TestRateLimit_retryAfterHeader` fail because request rate limiting was removed in commit `f254f42` without updating those tests, and `gofmt` flags `internal/handler/reschedule_handler.go`.

## 17. Phase 6 completion record (2026-11-18)

- **Drag to move:** a confirmed booking can be dragged (mouse) to another time or day in the grid. A 6 px threshold separates a drag from a click, the target snaps to 5 min and keeps the duration, a ghost shows the new slot and Esc cancels. Releasing opens a "Move X from A to B?" confirmation; confirming sends the existing `PATCH /v1/bookings/{id}/reschedule` (the server still validates, so conflicts come back as an error toast), and the booking form remains the keyboard route. The click that ends a drag no longer opens the booking.
- **Phone header:** the calendar header went from about 330 px to 86 px: two single-line rows that scroll sideways, and the page title is hidden under 640 px.
- Verified against the mock API in the in-app browser: below-threshold movement did not start a drag; dragging Wed 10:00 to Thu 11:00 showed the ghost "11:00-12:00", the confirmation text, no stray popover, and sent `PATCH .../reschedule {"start_at":"2026-11-19T06:00:00.000Z","end_at":"2026-11-19T07:00:00.000Z"}` (Thu 11:00 Asia/Almaty); at 375 px the header measured 86 px with no horizontal page overflow. `pnpm check` 0 errors, `pnpm test:visual` 51/51, build OK.

**Decided not to build** (the existing UI covers them): a user dropdown menu and a mobile slide-over sheet (the sidebar already has the same actions as a collapsible rail and a phone overlay), and merging Settings into one page (Profile and Notifications each own a form with its own `Ctrl+S`).

**Still open:** an automated accessibility audit. Adding `axe-core` (a dev dependency) to run it inside the existing Vitest browser setup was not done because it means installing a new package; run axe or Lighthouse before release. Also drag-to-resize (changing duration by dragging a block's bottom edge) and a full Russian copy review of the older catalogs.
