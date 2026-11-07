# Staff booking API

All endpoints below require an API key.

```http
Authorization: Bearer YOUR_API_KEY
```

Owners and admins can book for any active staff member. Members can book for
themselves and retrieve appointments they host. List staff IDs with GET /v1/users
using an owner or admin key.

## Get a specialist's available windows and days off

GET /v1/schedule/availability?staff_id=STAFF_ID&from=2026-12-07T00:00:00%2B05:00&to=2026-12-08T00:00:00%2B05:00

`from` and `to` are required RFC3339 instants, with an exclusive `to`, spanning
at most 32 days. URL-encode `+` as `%2B` in query parameters. `staff_id` defaults
to the authenticated user. An owner/admin key can query another specialist.
Optional `duration_minutes` (1–1440) filters out windows too short for the booking
and excludes past time. Omit it to inspect the calendar, including past dates.

```json
{
  "staff_id": "STAFF_ID",
  "timezone": "Asia/Qyzylorda",
  "duration_minutes": 0,
  "windows": [],
  "days": [
    {
      "date": "2026-12-07",
      "is_day_off": true,
      "reason": "day_off",
      "notes": "Personal leave",
      "override_id": "OVERRIDE_ID"
    }
  ]
}
```

`windows` contains continuous free intervals, each with `start_at` and `end_at`.
Any appointment start inside a window is allowed when its full duration fits.
Bookings, breaks, and connected-calendar conflicts are excluded.

`days` contains each local date touched by the requested range, in the specialist's
timezone. Working dates have `is_day_off: false`. Explicit days off have reason
`day_off` or `out_of_office`, an `override_id`, and optional `notes`. Dates without
configured working hours have `is_day_off: true` and reason `not_scheduled`.
A fully booked working day still has `is_day_off: false`, even if `windows` is empty.
Notes and day-off metadata are available only through authenticated endpoints.

## Create or remove a day off

POST /v1/availability-overrides

```json
{
  "user_id": "STAFF_ID",
  "date": "2026-12-07",
  "reason": "day_off",
  "notes": "Personal leave"
}
```

`user_id` defaults to the authenticated specialist. Only owners/admins can manage
another specialist. `date` is a local YYYY-MM-DD date. `notes` is optional, trimmed,
and limited to 5000 Unicode characters. Invalid notes return HTTP 400 with
`code: "invalid_notes"` and `field: "notes"`.
Optional `end_date` creates an inclusive date range atomically.

Success returns HTTP 201 with the override's `id`, date, reason, notes (if present),
and `is_available: false`. A date range returns `group_id`, `start`, `end`,
`days` (the date count), `reason`, and `notes`; list overrides to retrieve per-date IDs.
Existing appointments prevent creating a day off: HTTP 409 with
`code: "bookings_conflict"`. Reschedule or cancel those appointments first.
New bookings and rescheduling into a day off are rejected.

PATCH /v1/availability-overrides/OVERRIDE_ID with `{"notes":"Updated reason"}`
updates the optional reason text; an empty string clears it.
GET /v1/availability-overrides?user_id=STAFF_ID lists overrides and their notes.
DELETE /v1/availability-overrides/OVERRIDE_ID returns HTTP 204 and restores the
regular weekly schedule for that date. A day off replaces any date-specific
custom hours; deleting it does not restore those replaced hours.

## Create a booking

POST /v1/bookings

POST /v1/schedule/bookings is an alias with the same behavior.

```http
Content-Type: application/json
Idempotency-Key: unique-request-123
```

```json
{
  "staff_id": "STAFF_ID",
  "start_at": "2026-12-07T15:37:00+05:00",
  "duration_minutes": 20,
  "name": "Alex",
  "contact_method": "phone",
  "contact_phone": "+77011234567",
  "email": "alex@example.com",
  "timezone": "Asia/Qyzylorda",
  "notes": "Follow-up visit.\nBring previous results."
}
```

| Field | Requirement |
| --- | --- |
| staff_id | Optional. Defaults to the API key owner's ID. |
| start_at | Required RFC3339 timestamp with Z or an explicit UTC offset. Must be in the future. |
| duration_minutes | Required integer from 1 to 1440. The full appointment must fit within available working time. |
| name | Required attendee name. |
| email | Required when email is the primary contact. May also accompany a phone contact. |
| contact_phone | Required when phone is the primary contact. Strict international format described below. |
| contact_method | Optional email or phone. Defaults to phone when a phone is supplied, otherwise email. |
| timezone | Optional attendee IANA timezone, default UTC. The offset in start_at determines the booking instant. |
| language | Optional attendee locale, for example ru-RU or en. |
| notes | Optional text, at most 5000 Unicode characters. Surrounding whitespace is trimmed. Internal staff notes are stored on the booking. |

At least one contact channel is required. Every supplied channel is validated,
including a secondary contact.

Use a new idempotency key for each distinct creation request. Retrying the identical
body with the same key replays the original response.

Success returns 201 Created.

```json
{
  "id": "BOOKING_ID",
  "host_id": "STAFF_ID",
  "start_at": "2026-12-07T10:37:00Z",
  "end_at": "2026-12-07T10:57:00Z",
  "status": "confirmed",
  "notes": "Follow-up visit.\nBring previous results.",
  "contact_method": "phone",
  "manage_url": "https://YOUR_HOST/manage/TOKEN"
}
```

Additional metadata may be present. manage_url is returned to the creator.

| Status | Meaning |
| --- | --- |
| 400 | Invalid JSON or fields, invalid_phone, or invalid_notes. |
| 401 | Missing or invalid authentication. |
| 403 | A member attempted to book another staff member. |
| 404 | Staff member does not exist or is archived. |
| 409 | time_unavailable, or an identical idempotency request is still processing. |
| 422 | The idempotency key was already used with a different body. |
| 429 | Request or attendee booking rate limit reached. |
| 503 | Connected-calendar availability could not be checked. |

## Reschedule a booking

PATCH /v1/bookings/BOOKING_ID/reschedule

```json
{
  "start_at": "2026-12-08T16:15:00+05:00"
}
```

Send start_at for the move. The existing duration, notes, attendee, and
staff assignment are preserved. The new interval is checked against working hours,
breaks, other bookings, and connected calendars.

An owner/admin or the primary staff member can reschedule. Success returns 200
with the updated booking, including its notes when present. A conflicting time
returns 409. A cancelled booking also returns 409. An inaccessible or nonexistent
booking returns 404. A calendar-provider failure returns 503.

To retrieve available windows before moving, use GET /v1/schedule/availability
with staff_id, from, to, and exclude_booking_id=BOOKING_ID. from and to are
RFC3339 instants spanning at most 32 days. The current appointment is excluded
from conflicts while the other participants and booking rules are checked.

## Cancel a booking

POST /v1/bookings/BOOKING_ID/cancel

Requires an owner/admin or the booking's primary staff member. Send an empty
JSON object with Content-Type set to application/json.

```json
{}
```

Success returns 200 with the booking and status set to cancelled. Calendar events
are removed, cancellation notifications are sent, and the cancellation webhook is
dispatched in the background. Notes are preserved.

An already-cancelled booking returns 409. An inaccessible or nonexistent booking
returns 404. Missing or invalid authentication returns 401. The backend records
who cancelled the booking. A legacy reason field is accepted but the server uses
the authenticated caller's identity for attribution.

## Find a customer's future bookings

GET /v1/bookings

```http
GET /v1/bookings?scope=all&when=future&email=alex%40example.com
```

```http
GET /v1/bookings?scope=all&when=future&phone=%2B77011234567
```

| Query parameter | Behavior |
| --- | --- |
| email | Exact attendee email match, case-insensitive. |
| phone | Exact international attendee phone match. Encode the plus sign as %2B. |
| when | future means the appointment starts after now. upcoming also includes ongoing appointments. past means it has ended. |
| scope | all requires an owner/admin key. The default lists only bookings hosted by the API key's user. |
| host | Optional staff ID to narrow the customer's bookings to a particular staff member. |
| status | Optional confirmed, cancelled, or rescheduled. Cancelled bookings are excluded by default. |
| from, to | Optional UTC dates in YYYY-MM-DD format. Both named dates are included. |
| limit | Positive integer, default 50, capped at 200. |
| offset | Nonnegative integer, default 0. |
| order | asc by default, or desc for the latest start first. |

If both email and phone are supplied, both must match the same booking organizer.
The contact filters apply inside the authenticated staff visibility rules.

Success returns 200, including an empty items array when nothing matches.

```json
{
  "items": [
    {
      "id": "BOOKING_ID",
      "host_id": "STAFF_ID",
      "host_name": "Rodionova",
      "start_at": "2026-12-07T10:37:00Z",
      "end_at": "2026-12-07T10:57:00Z",
      "status": "confirmed",
      "notes": "Follow-up visit.\nBring previous results.",
      "attendees": [
        {
          "name": "Alex",
          "email": "alex@example.com",
          "phone": "+77011234567",
          "contact_method": "phone"
        }
      ]
    }
  ],
  "total": 1,
  "counts": { "upcoming": 1, "past": 0 },
  "limit": 50,
  "offset": 0
}
```

total counts the matching results before pagination. counts supplies the upcoming
and past counts for the same customer and staff filters, ignoring when.

## Retrieve one booking

GET /v1/bookings/BOOKING_ID

Requires authentication and access as an owner/admin or assigned staff member.
Success returns 200 with booking metadata, staff details, attendees, and notes when
present. Notes are omitted when empty. Inaccessible bookings return 404.
Unauthenticated requests return 401. Management tokens are excluded from this response.

## Phone validation

Create requests use contact_phone. Customer lookup uses the phone query parameter.
Both require this exact format.

```text
^\+[1-9][0-9]{6,14}$
```

The number must begin with +, followed by 7–15 ASCII digits, with a nonzero first
digit. Local numbers, 00 prefixes, spaces, parentheses, dashes, dots, and extensions
are rejected. The number is validated as supplied, including surrounding whitespace.

A malformed creation phone returns 400.

```json
{
  "error": "Phone must contain + followed by 7–15 digits, for example +77011234567.",
  "code": "invalid_phone",
  "field": "contact_phone"
}
```

An invalid lookup phone returns the same response with field set to phone.
This validates number formatting. It does not verify ownership or whether the
number is assigned.
