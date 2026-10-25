# 001 — Phone number as booking contact information

Status: implementation plan; no application behavior has changed.
Prepared: 2026-10-25.

## 1. Objective and agreed behavior

Allow a visitor to book with a name and a phone number **without providing email**. Allow email as an alternative primary contact. Make phone the default selection on booking forms, and reflect the choice consistently in REST, the public booking page, embedded widget, admin UI, MCP tools, and booking assistant.

Contact information and meeting location are separate concepts. Providing a contact phone must not turn a Google Meet, Teams, Zoom, LiveKit, or in-person appointment into a telephone appointment.

The first release does not require an SMS provider, OTP service, or new deployment secret. A phone-only booking succeeds, appears in the host's calendar and admin UI, and shows confirmation and a private manage link to its creator. It does not imply that an SMS or email was sent. Phone numbers are unverified contact information, not proof of identity or authorization.

This document specifies deployment gates; it cannot certify deployment before the implementation, build, migration rehearsal, and staging checks pass.

## 2. Current implementation and dependencies

Repository findings that determine the scope:

- `internal/handler/booking_handler.go`: `CreateBooking` requires name and email. Its existing top-level `phone` field means “choose a telephone meeting”; it requires `allow_phone_call` and a Google Meet/Teams event, and stores `tel:<number>` as the booking location. Public `GET /v1/bookings/{id}` exists and must not acquire new private contact fields or manage tokens.
- `internal/booking/booking.go`: `Attendee` has name, email, timezone, and locale, but no phone or primary contact method.
- `internal/booking/service.go`: booking, hosts, attendee, and intake answers are inserted transactionally. Active-booking and hourly abuse limits currently identify invitees by email. `booking_attendees.email` is `TEXT NOT NULL`, but not unique; an empty string can represent no email without rebuilding the table.
- `internal/handler/booking_handler.go`, `manage_handler.go`, `reassign.go`, and `internal/worker/worker.go`: confirmations, cancellation/reschedule notifications, calendar updates, and reminders assume an email-bearing organizer. Initial confirmation currently issues the manage token asynchronously.
- `internal/handler/stripe_booking.go`: paid bookings reserve a slot, redirect to checkout, and defer confirmation effects until payment. `internal/stripe/stripe.go` already omits `customer_email` when empty; this alone does not establish whether the hosted checkout can avoid collecting email.
- `internal/handler/mcp.go` and `booking_assistant.go`: tool schemas, required fields, prompt instructions, and errors currently require email. They use `createBookingForSlug`, while REST has a separate orchestration path.
- `internal/handler/templates/book.html` and `internal/handler/embed.js` contain distinct public forms. The admin app is SvelteKit under `frontend/`; editing it alone will not change public booking forms. The manage page is a third public surface.
- `internal/webhook/webhook.go` enriches attendee details and has selectable payload fields. Tracking fields have a separate allowlist in `internal/handler/tracking_settings.go`.
- `internal/db/db.go`: Goose migrations are embedded and run at startup; SQLite uses WAL and one connection. Readiness checks compare the applied schema to the binary's embedded target.
- `Dockerfile` builds the static frontend before compiling the Go binary that embeds it. The runtime uses `/data/calnode.db` and optional Litestream replication through `entrypoint.sh`.

Use repository-relative paths throughout this plan. At implementation time, repeat a search for `OrganizerEmail`, `attendee_email`, `booking_attendees`, email-based filters, mail recipients, and all booking creation callers to catch additional surfaces.

## 3. Contact model and event configuration

Persist these organizer attendee fields:

| Field | Values and meaning |
| --- | --- |
| `contact_method` | `phone` or `email`; required after resolution |
| `phone` | Canonical international number, or empty string when absent |
| `email` | Normalized email, or empty string when absent; retain existing column |

Add per-event settings, included in authenticated event APIs and the public event configuration:

| Setting | Values | Default |
| --- | --- | --- |
| `booking_contact_policy` | `email_or_phone`, `phone_only`, `email_only` | `email_or_phone` |
| `default_contact_method` | `phone`, `email` | `phone` |

The policy determines allowed primary methods. A restrictive policy forces its one method; reject incompatible settings on save rather than exposing a contradictory form. A supplied secondary contact is optional, but must validate when nonempty. Primary email requires email; primary phone requires phone. Both absent is always invalid.

Default selection applies to the UI and new event configuration, not to historical records or an API request that clearly supplies only email. Existing events receive the new phone-first form default deliberately; existing email-based integrations remain valid under the default `email_or_phone` policy.

Store `contact_method` on the booking attendee as a snapshot. Changing event settings must not alter existing bookings, notification destinations, or the ability to manage them.

## 4. REST contract and compatibility

Use **`contact_phone`** for the new booking contact input. Keep the existing top-level `phone` as the legacy telephone-meeting field. Reinterpreting it silently would break existing integrations and unexpectedly change meeting behavior.

Phone-only request:

```http
POST /v1/bookings
Content-Type: application/json
Idempotency-Key: <unique-client-operation-key>
```

```json
{
  "event_type_slug": "consultation",
  "start_at": "2026-11-02T09:00:00Z",
  "name": "Alex",
  "contact_method": "phone",
  "contact_phone": "+77011234567",
  "timezone": "Asia/Qyzylorda"
}
```

Email alternative:

```json
{
  "event_type_slug": "consultation",
  "start_at": "2026-11-02T09:00:00Z",
  "name": "Alex",
  "contact_method": "email",
  "email": "alex@example.com"
}
```

Resolution rules when `contact_method` is omitted:

1. A nonempty `contact_phone` selects phone, including when email is also supplied.
2. Otherwise a nonempty email selects email, preserving old clients.
3. Otherwise reject. The legacy meeting `phone` alone does not count as a new contact field; historical clients already had to supply email.
4. Validate the resolved method against the event policy. An explicit invalid/missing primary field is an error; never silently switch an explicitly selected method.

Keep the current legacy telephone-location validation and behavior. When contact and meeting phone are both supplied, validate them independently; do not require the numbers to match or copy one over the other. Document that `contact_phone` leaves the location unchanged. Deprecate ambiguous legacy naming in documentation, without removing support in this release.

Return existing statuses and fields compatibly: free creation remains `201`, checkout initiation remains `200` with `payment_required` and `checkout_url`. Add resolved `contact_method` and truthful notification capability information to the creator response. Return `manage_url` only to the creator/authorized holder, never through public lookup or list results. Authenticated booking detail/list attendee objects include `contact_method`, `phone`, and the existing `email` key (empty when absent); update TypeScript models accordingly.

Use `400` for malformed contact input or incompatible policy, existing `409` slot conflicts, `422` active-booking limits, and `429` throttling. Add stable contact error codes alongside human-readable messages without breaking existing error consumers. Keep locale-aware messages for visitor-facing validation.

Update API examples, schemas actually maintained by the repository, and integration documentation together. Do not introduce a new API version merely to add optional fields.

## 5. Validation, identity, and abuse limits

Create one backend contact resolver/validator used by REST, `createBookingForSlug`, MCP, assistant, and booking service entry points. Service-level validation must enforce the invariant even when HTTP is bypassed. Keep calendar/location selection separate.

- Require nonblank name after trimming. Validate nonempty emails using the existing email normalizer.
- Accept phone contacts in international format beginning with `+`, normalize allowed display separators, and persist E.164-shaped values (maximum 15 digits). Use a maintained pure-Go parser if country validity is required; verify its license, version, and CGO-free build before adoption. Do not use the current lenient meeting-phone validator for contact identities.
- Do not infer a phone country from server timezone, locale, or IP. UI may help visitors select a country, but the API must receive a canonical international number. Reject local numbers, extensions, letters, malformed plus signs, and invalid lengths with a useful example.
- Apply reasonable input-length limits before parsing. Match browser hints to backend rules; the backend remains authoritative.
- Derive a namespaced primary identity, `phone:<canonical-number>` or `email:<normalized-address>`. Replace email-specific service errors with contact-neutral errors while retaining compatibility where tests/callers require aliases.
- Enforce hourly and active-booking checks inside the same transaction as insertion. Match canonical phone across phone bookings and normalized email across email bookings; where a valid secondary identifier is supplied, check its corresponding limits as well so switching the primary method does not bypass an already reached limit. Count existing email-only rows and preserve cancellation/window semantics.
- Never query all blank emails as one identity. Never use an `email = ? OR phone = ?` predicate with empty values. Use selective indexes and explicit nonempty predicates; test equivalent phone formatting and concurrent requests.
- Retain the current per-IP throttle, honeypot, slot checks, and idempotency behavior. Neither a phone nor an email supplied by a visitor is verified; do not add account access or contact-based recovery without verification.

## 6. SQLite migration and existing data

Allocate the next unused Goose migration number at implementation time (the inspected tree currently ends at `00070`). Do not modify an already released migration.

Use an additive migration:

- Add `booking_attendees.phone TEXT NOT NULL DEFAULT ''`.
- Add `booking_attendees.contact_method TEXT NOT NULL DEFAULT 'email'` with an allowed-values check. Existing bookings remain email-primary automatically.
- Add event policy/default columns with the defaults and allowed-values checks above.
- Add suitable organizer contact indexes for both normalized email and canonical phone; check query plans on representative data. Avoid unique contact indexes because repeat bookings are valid.

Retain `email TEXT NOT NULL` and explicitly insert `''` for absent email. There is no need to rebuild this foreign-key-linked table solely to make email nullable. No fake email addresses and no phone numbers stored in the email column.

Update every insert/select/scan, shared DTO, fixture, and serialized job payload affected by the new fields. Existing reminders and pending paid bookings must still load after migration. Historical phone-location values remain meeting locations; do not backfill them into contact phone automatically. Historical custom intake answers remain unchanged.

Test migration from both an empty database and a populated pre-change database, rerun startup migration to prove idempotence, and run `PRAGMA foreign_key_check` and `PRAGMA integrity_check`. The service enforces nonempty primary contact; database enum checks provide defense in depth without rejecting valid historical rows during migration.

Down migration is for disposable test databases only once phone-only records exist. Production rollback must preserve the expanded schema and contact data; an old binary is not a safe reader/worker for phone-only bookings.

## 7. Confirmation, manage links, and privacy

Phone-only users need an immediate, usable confirmation without email:

1. Refactor token issuance out of asynchronous confirmation dispatch. Create the initial manage token with the booking transaction, using a transaction-aware helper to avoid deadlocking SQLite's single connection. Store only its hash as today; pass the initial raw token explicitly to response/notification orchestration.
2. Return the manage URL in the successful creator response and show a copy/save action on both booking surfaces. Link to the existing token-protected manage page for the final generated meeting link and future changes; do not make the creation response depend on calendar-provider latency.
3. Dispatch must use that same initial token rather than replacing it after the response. Preserve current reschedule rotation rules deliberately; the reschedule result/page must give its authorized caller the replacement URL, including phone-only flows.
4. Preserve `Idempotency-Key` response replay with the same creator URL. Treat cached response bodies as secrets, retain existing bounded expiry, restrict database access, and redact them from logs. A random idempotency key is retry correlation, not a new public lookup credential.
5. For paid bookings, retain the manage capability across checkout without a booking-ID-only recovery endpoint. Use an opaque, expiring server-side checkout capability bound to the booking/session and stored hashed, with a token-protected return URL. Verify the session's booking association and server-side paid status before confirming. Keep webhook finalization idempotent and independent of the browser return; handle browser return before the webhook and duplicate delivery. Never derive authorization from the `paid=1` flag or booking ID.

Manage and checkout-capability responses use `Cache-Control: no-store`, an appropriate referrer policy, and no token-bearing third-party tracking. Never include raw tokens or full contact details in analytics, application logs, public event configuration, or public booking lookup. Existing admin host/owner visibility rules apply to phone exactly as to email. Preserve public GET behavior while withholding all new private fields; do not expand its existing exposure.

Phone possession is not verified. Missing/lost manage links require authorized host assistance until a separately designed verified recovery flow exists.

## 8. Notifications, calendars, reminders, and payment

Centralize recipient eligibility and use it for creation, reschedule, cancellation, reassignment, and worker reminders:

- A validated nonempty email permits the existing attendee email path, including when phone is primary and email was supplied as an optional secondary channel. Explain that optional email receives confirmations/invitations. Primary contact indicates the preferred contact identity; it does not disable a supplied email channel.
- No email means no attendee email attempt, no email retry, no `ATTENDEE:mailto:` with an empty address, and no email RSVP expectation. Expected skips must not set `confirm_failed`; actual host notification failures still must.
- Continue host notifications and host calendar creation/update/delete. Extend host templates with a properly escaped primary contact label/value; display an absent email gracefully. Do not blindly turn an optional blank email into `Reply-To`.
- Calendar adapters must omit the attendee guest when email is absent, for both calendar-sent and Calnode-sent invite modes. Host event descriptions may include contact details under the existing host visibility model. Meeting links must still be generated and persisted without guests. Exercise Google, Microsoft, CalDAV/ICS, and relevant Zoom/LiveKit paths.
- Protect ICS escaping and rendering: use phone only as contact text where appropriate, never invent a `mailto:` address. Keep event UID/sequence, rescheduling, cancellation, and inbound RSVP matching for real email attendees unchanged.
- Avoid scheduling email-only attendee reminders without an email; already queued jobs must recognize this condition and complete as intentionally skipped, not retry forever. Preserve other legitimate reminder recipients and settings. Reflect the absence of an automated attendee delivery channel in admin/confirmation copy.
- SMS is an independent future transport: no promise of SMS reminders, verification, or automatic calling in this release. A selectable webhook can support an external integration without making delivery part of booking success.

Paid bookings require an explicit release gate. Validate with the actual configured Stripe Checkout flow whether billing email is collected even when `customer_email` is omitted. Do not claim payment is email-free merely because Calnode no longer requires it. Do not silently overwrite booking contacts from Stripe customer details. Test pending expiry, checkout failure, webhook completion, refund, and phone-only return confirmation. If checkout still requires billing email, explain that on paid-event UI/API documentation; if strictly email-free payment is required for release, block that paid path until a supported payment flow is verified. Free phone-only bookings must not depend on Stripe or SMS configuration.

## 9. Frontend and integration changes

### Public booking page and embed widget

Update `book.go`, `templates/book.html`, `embed_handler.go`, `embed.js`, and public configuration DTOs together:

- Show accessible “Phone number / Email” primary-contact choices with phone selected by default under `email_or_phone`; render the event's restrictive policy if set.
- Require only the selected primary field. Keep secondary contact optional, preserve entered values while switching, and submit an explicit `contact_method` plus `contact_phone`/email.
- Use `type="tel"`, `autocomplete="tel"`, suitable input mode, international-format hint, accessible labels, and server error association. Do not apply a numeric input that loses `+` or leading digits.
- Label the existing telephone-meeting option separately and continue submitting its legacy `phone` field only when selected. A visitor may book video with phone as the sole contact.
- Replace unconditional “confirmation email sent” copy with accurate confirmation/delivery information and the copyable manage link. Paid success, cancellation, and rescheduling pages must remain usable without email.
- Keep styles in shared `booking.css`. The standalone widget must not assume `BookingLogic` is loaded. Test cross-origin widget fetches and copy-link fallback behavior.
- Update all public locale JSON catalogs and locale parity tests; update admin English/Russian catalogs. Review desktop, mobile, keyboard navigation, and validation on both form surfaces plus manage pages.

### Admin Svelte app

Update `frontend/src/lib/api.ts`, event-type create/edit routes, and bookings UI. Use existing shadcn-svelte controls. Expose contact policy/default, show primary phone/email with secondary contact if present, and render `tel:`/`mailto:` links safely. Adapt search/filter/display behavior wherever email is currently assumed. Keep booking contact visible to hosts authorized to view that booking and to existing admin roles. Update webhook configuration labels and notification expectations.

### MCP and assistant

Extend MCP inputs with `contact_method` and `attendee_phone` (mapping to the same contact model); keep `attendee_email` backward compatible and conditionally required. Extend the assistant book tool similarly, remove unconditional email requirements from JSON schemas and base prompts, and let it collect phone by default with email as the alternative according to event policy. Do not expose private contacts through newly expanded public tool results. Ensure all creation paths use shared contact validation and transactional limits, not independent prompt-only rules. Keep existing paid-event restrictions for tools unless separately implemented.

### Webhooks and tracking

Add opt-in `attendee_phone` and `contact_method` webhook fields and enrich them for created/rescheduled/cancelled events. Preserve existing subscriptions, signatures, retry behavior, and field selections; old payload configurations must not start receiving phone numbers automatically. Retain the existing email field's type when absent.

Do not automatically add phone to dataLayer, native analytics, tracking allowlists, or third-party analytics. If a later feature needs personal contact tracking, design explicit opt-in separately. Ensure manage URLs and checkout capabilities are excluded from all webhook and tracking payloads.

## 10. Implementation sequence

1. Inventory every contact-dependent creation/read/side-effect path and add regression cases for current email bookings and legacy telephone meetings.
2. Implement shared contact validation, additive migration, attendee snapshots, normalized lookup/indexes, and transactional contact limits.
3. Update REST/event DTOs and all booking service callers. Implement creator manage-token issuance, safe paid-return capability, and idempotent response replay.
4. Make calendar adapters, mail templates, notification orchestration, reminders, manage flows, and paid finalization contact-aware. No phone-only release before these paths are safe.
5. Update public forms/widget, admin settings/bookings, translations, webhook selection, MCP, assistant, and documentation.
6. Complete regression/integration/browser checks, fresh-install and upgrade rehearsals, production-image build, and staged deployment smoke tests. Ship backend and embedded frontend together.

## 11. Verification and acceptance criteria

Use meaningful behavior tests rather than only checking field presence:

- Phone-only creation without email succeeds for free events, stores canonical contact, keeps video/in-person location, appears correctly to its authorized host, and returns a working private manage link.
- Email-only old requests continue to work; existing phone-meeting requests retain their behavior; mixed contact/location numbers are independent. Missing both, invalid/oversized numbers, invalid secondary email, unknown methods, and policy violations fail without creating bookings.
- Phone normalization prevents formatting-based limit bypass. Blank email users are not grouped together. Limits and slot conflicts hold under concurrent requests, across REST/MCP/assistant, and after primary-method switching.
- Idempotent retries preserve booking count and creator capability; public GET, webhook payloads, tracking, and logs never expose the new contact or manage capability unintentionally.
- Calendar test providers observe no empty guest email and still generate meeting links. Host notifications continue; phone-only attendee email is intentionally skipped; email-secondary booking delivery works. Confirm-failure reporting distinguishes skipped delivery from real failure.
- Existing queued reminders and pending payments survive migration. Paid phone-only behavior is documented and tested through webhook, return, retry, expiry, refund, and cancellation.
- Manage links support cancel/reschedule after browser refresh and token rotation. Changing event policy does not invalidate historical contact data or existing manage links.
- Migration preserves booking/attendee/host/answer counts, statuses, contact emails, tokens, foreign keys, and jobs. Repeat startup does not change data.
- Admin UI, public page, and cross-origin embed behave on desktop/mobile with keyboard use; default is phone and switching to email removes phone's required constraint. Localized confirmations do not promise a message that was not sent.

Run the repository checks using its pinned toolchain:

```text
cd frontend
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test:visual
cd ..
gofmt -l <changed Go files>  # expect no output
go vet ./...
go build ./...
go test ./...
node --test internal/handler/assets/booking-logic.test.js
```

Run targeted contact, migration, mail/calendar, worker, API/MCP/assistant, and browser tests during implementation; run the complete checks before release. Inspect the current CI/release workflows for additional gates, and add the new behavior tests there. Build frontend before Go because `frontend/build` is embedded. Run race/concurrency checks on a supported runner for transactional and token paths. Record actual results; do not describe planned checks as passed.

## 12. Deployment, readiness, and rollback

No new mandatory runtime service, secret, port, or volume is needed. Preserve SQLite, `/data`, existing encryption keys, public URL, proxy/TLS configuration, SMTP/Resend, calendar credentials, and optional Litestream configuration.

Release procedure:

1. Create a consistent SQLite backup through the supported online backup/snapshot process or a stopped-writer backup; never copy only the live main database file while WAL writes are active. Verify a restore into an isolated environment. Confirm that encryption keys and configuration needed by the restored application are available.
2. Deploy the exact candidate image to staging against a sanitized pre-change database copy and against an empty database. Rehearse migrations, restart, queued jobs, paid bookings, and `/readyz`; inspect foreign-key/integrity checks and migration duration.
3. Build the production Docker image using the existing Dockerfile and pinned frontend lockfile. Verify the image reports the intended version/commit and contains the newly built forms/admin assets, migrations, and backend. Exercise amd64 and arm64 release builds if both remain published targets. No manual production dependency installation.
4. Use a controlled single-instance cutover for the SQLite application: stop/drain old HTTP traffic and background workers before a new binary migrates and accepts phone-only writes. Do not allow old workers to consume phone-only bookings. Do not run simultaneous writers against a copied or network-shared database as a workaround.
5. Retain the persistent data volume. Start the candidate; existing startup migration must finish successfully. Gate traffic on `/readyz`, not just process liveness. Migration failure must keep traffic closed and must not trigger an automatic destructive reset or restore over the existing database.
6. Smoke-test phone-only and email-only creation, public page/widget, host calendar/notification, admin visibility, private manage-link cancel/reschedule, and checkout when enabled. Use disposable test bookings and clean them up through normal authorized cancellation.
7. Check invalid-contact rates, creation failures, calendar errors, unexpected email retries, `confirm_failed`, job backlog, checkout failures, and readiness/restarts. Use aggregate metrics and booking IDs, not raw contacts/tokens. Verify Litestream replication still runs and rehearse restoring a post-migration backup.

Rollback decisions:

- Before new contact data is written, use the tested rollback procedure against the preserved expanded schema only if the old binary tolerates the newer Goose version; test this rather than assuming it.
- After phone-only bookings exist, do **not** roll straight back to the original email-only binary or drop contact columns. Prefer a forward fix or a prepared compatibility build that still reads phone contacts, safely skips missing-email deliveries, and can temporarily disable new phone-primary creation while retaining management of existing bookings.
- Restoring a pre-change backup loses bookings/payments accepted since that snapshot. It is disaster recovery, requiring an explicit reconciliation decision, not the routine release rollback. Preserve the failed database and reconcile payment-provider state if recovery is necessary.

## 13. Definition of done

The feature is complete when a visitor can choose the default phone contact, omit email, create and manage a booking through the page, widget, or REST API, and hosts can operate it normally; email alternatives and historical integrations still work; tools and documentation share the same rules; and the actual production image has passed migration, readiness, backup/restore, and staging smoke gates above. Any Stripe billing-email limitation must be stated clearly rather than hidden by the contact UI.
