# cancel_booking

Import `../cancel_booking.workflow.json` into n8n. It contains all JavaScript and wiring; no supporting files need uploading.

1. Select **Header Auth** credentials on **cancel_booking**. You can reuse the trusted sales platform's `X-Calnode-Tool-Key` credential from the other workflows.
2. Select **Calnode Bearer** credentials on **Cancel in Calnode**. An admin/owner key can cancel bookings across specialists; a non-admin primary host key can cancel only its own bookings.
3. Check `BASE_URL` in **Prepare cancellation**, currently `https://emdeu-calnode.usekvi.com`.
4. Publish/activate and use n8n's displayed Production URL, normally `/webhook/calnode/cancel_booking`. Calling this webhook changes the actual booking; local tests use mocks and never call Calnode.

Example request (replace the UUID with a booking the client has asked to cancel):

```http
POST https://YOUR-N8N-HOST/webhook/calnode/cancel_booking
Content-Type: application/json
X-Calnode-Tool-Key: YOUR_WEBHOOK_SECRET
```

```json
{
  "booking_id": "00000000-0000-4000-8000-000000000001"
}
```

Use `bookings[].booking_id` from your formatted get_bookings result. The original API-shaped get_bookings export instead calls this field `bookings[].id`. This is the booking's UUID, not an event or specialist ID. Resolve ambiguous client requests through get_bookings before calling this tool.

Optional `timezone` controls the response's displayed date/time, defaulting to Asia/Qyzylorda. Optional `reason` is forwarded for API compatibility, but the current Calnode admin cancellation endpoint ignores custom reasons and attributes cancellation to the authenticated user's name. The workflow does not claim that the supplied reason was saved.

The workflow calls `POST /v1/bookings/{booking_id}/cancel`. A successful result is checked for the same booking ID and `status: cancelled` before it is reported as successful. The formatted response contains a Russian message and booking ID/status/local date/time, without internal specialist IDs or UTC timestamps. Keep `booking_id` for subsequent reference.

A repeated cancellation returning Calnode's exact `409 / booking already cancelled` response is normalized to HTTP 200 with `success: true`, `already_cancelled: true`. Other 409 errors stay errors. Missing/unauthorized bookings remain 404; authentication errors remain 401/403. Network failures or malformed/unconfirmed successful responses return 502 and do not claim that the cancellation failed or succeeded. A retry with the same booking ID can establish the final state. Workflow-level timeouts can still use n8n's standard error response.

Calnode performs calendar deletion, notifications, and paid-booking refund handling asynchronously after recording the cancellation. Success here confirms the stored cancellation, not the completion of those side effects. Phone-only attendees do not receive SMS. No changes to Calnode application code are needed or made.

The export contains no keys, is inactive on import, requires authentication, and disables saved execution data. It never accepts arbitrary API URLs or private manage links from callers.

Local validation:

```text
node integrations/n8n/cancel-booking/build-workflow.mjs
node --test integrations/n8n/cancel-booking/workflow.test.mjs
```

Live n8n import and credential connectivity need checking in your instance. No real cancellation was executed while creating this artifact.
