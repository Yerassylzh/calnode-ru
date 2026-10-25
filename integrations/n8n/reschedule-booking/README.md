# reschedule_booking

Import `../reschedule_booking.workflow.json`. All Code node sources are embedded. No Calnode application changes are made. This workflow moves an existing appointment, keeping its assigned specialists, contacts, questions, and answers. It does not cancel and recreate appointments or rerun round-robin selection.

## Webhook setup

For the standard admin API workflow, send only these three fields:

```json
{
  "booking_id": "39a5edae-ced8-4b8d-ad20-93eaf62ace75",
  "date": "2026-11-03",
  "time": "15-30"
}
```

`date` is YYYY-MM-DD; `time` is HH-MM in 24-hour local time. The workflow uses Asia/Qyzylorda automatically (15-30 means 15:30 there) and converts to the API timestamp. No timezone or manage link is required. Select your Calnode admin Bearer credential on **Reschedule as primary host** and deploy the updated backend before use. Existing colon-separated times and manage-link requests remain supported.

The trigger has **Authentication: None** and no exported `path` or `webhookId`, as requested. Use the URL your n8n editor generates. If your n8n version leaves Path blank on import, replace only the trigger with a fresh Webhook node so n8n generates its unique path; reconnect it to **Prepare reschedule**, select POST, and choose **Using Respond to Webhook Node**. Do not use a shared empty webhook path. Then publish/activate and use n8n's displayed Production URL.

The only configured remote base is the **Calnode API host**, currently `https://emdeu-calnode.usekvi.com`, in **Prepare reschedule**. Change it there if necessary. The caller cannot choose a different remote server. HTTP redirects are disabled. There are no API credentials or private manage tokens in the export.

## Recommended: saved manage link, across all specialists

```json
{
  "manage_url": "https://YOUR-CALNODE-HOST/manage/REPLACE_WITH_SAVED_TOKEN",
  "date": "2026-11-03",
  "time": "15:00"
}
```

Use the exact `manage_url` returned by create_booking or the last successful reschedule; replace the documentation placeholder before use. This mode calls `POST /manage/{token}/reschedule`, with no Bearer credential. The private link itself identifies and authorizes the booking. It must match the configured Calnode base and contain its actual 64-character hex token, without query strings or fragments.

Supply exactly one identifier: manage_url OR booking_id. In link mode, do not additionally send a booking ID that could disagree with the authoritative link. After success, replace the old link in your sales platform with `booking.manage_url` from the response. Calnode rotates the token and invalidates the previous link atomically with the reschedule. A booking ID from get_bookings cannot recover a lost manage token.

## Booking ID and an admin API key

```json
{
  "booking_id": "00000000-0000-4000-8000-000000000001",
  "date": "2026-11-03",
  "time": "15:00"
}
```

Select an **admin** Bearer credential on **Reschedule as primary host** to reschedule any specialist's booking. This mode calls `PATCH /v1/bookings/{id}/reschedule`. Deploy the updated Calnode backend first. Regular member keys can reschedule only bookings they primarily host.

The host API currently does not return the replacement manage token, though the underlying reschedule rotates it. Do not keep using a previously saved link after a host-API reschedule. Prefer link mode if retaining visitor self-service access is required. Neither this workflow nor a public booking lookup can reconstruct the new private token.

## New time

Send **date + time** (`YYYY-MM-DD`, `HH:mm` or `HH:mm:ss`) interpreted in `timezone`, which defaults to Asia/Qyzylorda. Or send **start_at** as RFC3339 with seconds and an explicit offset/Z, for example `2026-11-03T15:00:00+05:00`. Do not combine the two forms. The new time must be in the future. Duration is computed by Calnode from the event type, not supplied by the caller.

Calnode validates booking availability and preserves existing assigned hosts. A slot available for another round-robin specialist is not necessarily available for this appointment's hosts. A 409 means the slot cannot be used (or the booking is cancelled); do not switch hosts, cancel/recreate, or substitute another time automatically.

## Response and retries

Successful output uses Russian copy and local dates/times, with only the booking ID retained as an internal identifier:

```json
{
  "success": true,
  "message": "Запись перенесена. Сохраните новую manage_url — предыдущая ссылка больше не действует.",
  "booking": {
    "booking_id": "00000000-0000-4000-8000-000000000001",
    "status": "Подтверждена",
    "date": "03.11.2026",
    "time": "15:00",
    "end_time": "16:00",
    "timezone": "Asia/Qyzylorda",
    "manage_url": "https://YOUR-CALNODE-HOST/manage/NEW_PRIVATE_TOKEN"
  }
}
```

The formatter checks returned identity (in ID mode), confirmed/rescheduled status, exact requested time, valid duration, and replacement link (in manage mode) before reporting success. Input errors return 400, upstream 4xx/5xx statuses are preserved, transport/unconfirmed responses return 502. A stale manage link returns 404 and is never treated as proof that the appointment was not moved.

No automatic HTTP retries or fake idempotency headers are configured: reschedule endpoints do not support the booking-creation Idempotency-Key contract. If a timeout/lost response occurs, first use get_bookings to inspect the current appointment time. A successful token reschedule may already have invalidated the old link, even when n8n did not receive the replacement. Authorized host assistance may then be needed to recover management access.

Success confirms stored time, not completion of background calendar/email/reminder side effects. No SMS is sent. Response caching and saved execution data are disabled. The webhook has no authentication as explicitly requested; outgoing host-API credentials, when used, are a separate configuration.

## Local checks

```text
node integrations/n8n/reschedule-booking/build-workflow.mjs
node --test integrations/n8n/reschedule-booking/workflow.test.mjs
```

Checks use mocks only. No real appointment is moved while generating the workflow. Actual import, generated trigger path, credential assignment, and connectivity must be checked in your n8n instance.
