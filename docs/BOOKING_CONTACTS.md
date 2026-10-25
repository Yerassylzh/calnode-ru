# Booking contacts

Bookings accept a phone number or email as their primary contact. Public forms select phone by default. Phone contact is independent of meeting location: a phone-only visitor can still book a video or in-person appointment.

## Configure an event

In the event editor, set **Booking contact** to Phone or email, Phone required, or Email required. For Phone or email, choose which method is selected by default. New and upgraded events default to Phone or email with phone selected. Historical bookings remain email-primary.

The equivalent event create/update fields are:

```json
{
  "booking_contact_policy": "email_or_phone",
  "default_contact_method": "phone"
}
```

Restrictive policies use `phone_only`/`phone` or `email_only`/`email`. An explicitly contradictory policy/default pair is rejected.

## Create through REST

Send `POST /v1/bookings` with `Content-Type: application/json`. Use an available future slot returned by the slots API; the time below is an example.

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

Email is optional for a phone-primary booking. For an email-primary booking, send `contact_method: "email"` and `email: "alex@example.com"`. Optional secondary email receives invitations and notifications; optional secondary phone is stored for the host. Both supplied contacts must be valid.

If `contact_method` is omitted, `contact_phone` takes precedence, then email. Old email-only API requests continue working. At least one valid contact is required, and the resolved primary method must comply with the event policy. Names are required. Phone contacts must include `+` and a country code, with 7–15 digits and a nonzero first digit. Spaces, parentheses, dots, and dashes are normalized; local numbers and extensions are rejected. This validates international number shape, not ownership or carrier reachability.

The existing top-level **`phone`** field retains its original meaning: choosing a telephone meeting instead of Google Meet/Teams when `allow_phone_call` is enabled. It is distinct from **`contact_phone`**. Do not use the legacy field to set contact information.

A free booking returns `201` and the usual booking data, plus `contact_method` and a private `manage_url`. Store that URL securely and show it to the booking's creator. Public GET and list responses never return this bearer capability. Authenticated lists include attendee `phone` and `contact_method`; the existing `email` field is an empty string if absent.

Use an unpredictable `Idempotency-Key` for retries. The same request/key replays the original creation result, including its manage link. Do not log the response or key. This is a retry mechanism, not contact-based recovery.

MCP `create_booking` accepts `attendee_phone`, `contact_method`, and optional `attendee_email`. The booking assistant collects phone or email according to event policy and provides a private manage link in its UI.

## Delivery and privacy

No SMS provider is required and no SMS is sent. Phone-only visitors must save their private manage link to see final meeting details, cancel, or reschedule. The host can see their phone number in the admin UI and host notification. Phone/email values are unverified and cannot authorize recovery or account access.

Hosts still receive their normal notifications and calendar events. Without an email, no attendee email, email reminder, email RSVP, or calendar guest invitation is attempted. Expected skips are not delivery failures. If an optional email is supplied, the usual email delivery applies even when phone is primary.

Webhooks can explicitly select `attendee_phone` and `contact_method`; existing field selections and default payloads do not acquire these fields automatically. Phone is not added to analytics. Manage pages exclude third-party tracking because their URLs contain bearer capabilities.

Paid bookings retain the checkout flow. Calnode does not require email for a phone-primary booking, but hosted Stripe Checkout may collect a separate billing email. Calnode does not copy Stripe billing contacts into the booking. The browser returns through a private manage capability; the server verifies the checkout session's booking association and paid status. A `paid=1` URL flag alone does not authorize payment confirmation or access.

## Deployment

Migration `00071_booking_contact.sql` runs automatically during startup. It adds columns and indexes; it preserves existing attendee emails, bookings, jobs, and tokens. No new mandatory environment variables or infrastructure are needed. Build the frontend before Go, or use the existing Dockerfile, which embeds the matching frontend and migrations in one image.

Before deployment, take a consistent SQLite backup including active WAL state using an online snapshot/backup or a stopped-writer backup, and verify restoration. Drain the old instance and its workers before the new instance accepts phone-only writes. Retain `/data` and encryption/recovery configuration. Gate traffic on `/readyz` after startup migration.

After upgrade, verify phone-only and email booking, host notifications/calendar, admin contact visibility, manage-link reschedule/cancel, widget behavior, and checkout if enabled. Restart once to verify repeated migration/readiness. Check backup replication and error/job queues.

Once phone-only bookings exist, do not roll back to an email-only binary or run a destructive down migration. Use a forward fix or a compatibility build that understands phone contacts. A pre-upgrade backup restore loses later bookings and requires reconciliation with payment records.
