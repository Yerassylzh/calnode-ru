# get_bookings workflow

Import `../get_bookings.workflow.json` into n8n. The JSON contains the complete workflow and embedded JavaScript; no source files need to be uploaded. This workflow reads the existing API and does not change Calnode.

## Configure after import

1. **get_bookings** webhook: select/create Header Auth credentials. For example, header name `X-Calnode-Tool-Key`, value a private random secret supplied by your sales platform. Do not make this personal-data endpoint public.
2. **Get bookings from Calnode**: select your existing **Calnode Bearer** credential. Use an admin/owner API key to query all specialists. A member key only sees bookings that member hosts. Credential IDs and secrets are deliberately absent from the export.
3. **Prepare request**: check `BASE_URL` (currently `https://emdeu-calnode.usekvi.com`) and `DEFAULT_TIMEZONE` (`Asia/Qyzylorda`). The caller cannot override the API host.
4. Listen for a test event and call the displayed Test URL. Then publish/activate and use the displayed Production URL, normally `/webhook/calnode/get_bookings`.

## Call from the sales platform

```http
POST https://YOUR-N8N-HOST/webhook/calnode/get_bookings
Content-Type: application/json
X-Calnode-Tool-Key: YOUR_WEBHOOK_SECRET
```

```json
{
  "phone": "+77011234567",
  "event_slug": "rodionova_60_min",
  "date": "2026-11-02"
}
```

All filters are optional. `{}` lists upcoming non-cancelled bookings visible to the configured Calnode credential.

| Field | Meaning |
| --- | --- |
| `phone` or `contact_phone` | Exact canonical phone match; display separators are normalized. Filtering occurs in n8n after fetching API pages, because Calnode does not have a phone filter. |
| `name` | Case-insensitive substring in an attendee's name; applied in n8n. |
| `event_slug` or `event_type_slug` | Filter by event slug; mapped to Calnode's `event_type` parameter. |
| `specialist_id` or `host_id` | Specialist user ID, mapped to `host`. |
| `date` | Single local calendar day in `timezone`; cannot be combined with `from`/`to`. |
| `from`, `to` | Inclusive local calendar dates, `YYYY-MM-DD`. Either bound may be omitted. |
| `timezone` | IANA timezone; defaults to Asia/Qyzylorda. |
| `when` | `upcoming`, `past`, or `all`. Defaults to `all` with a date filter, otherwise `upcoming`. |
| `status` | `confirmed`, `cancelled`, or `rescheduled`. Omit to exclude cancelled bookings. `when: all` does not override this rule. |
| `offset` | Continuation position; initially 0. Only needed if a response has `complete: false`. |

Do not send unknown fields: they are rejected rather than ignored, to avoid accidentally running an unfiltered client search. Phone numbers are unverified identifiers, not authorization. The caller must be your trusted sales platform, not an unauthenticated client-facing endpoint.

## Result

HTTP 200 returns `success`, `tool`, `count`, `complete`, `bookings`, `pagination`, and resolved `filters`. Each booking includes its ID, event slug, primary specialist, UTC/offset timestamps, local date/time, status, location, and attendee contacts. Save `bookings[].id` for later management. This endpoint cannot recover the private manage URL; retain the one returned during creation.

The workflow fetches up to 10 API pages of 200 records per call. It stops on a short page or an API error. If the last page is full, it conservatively reports `complete: false`; repeat with identical filters and `pagination.next_offset` as `offset`. Never interpret an incomplete empty result as proof that no booking exists. Narrowing event/date filters can reduce scans. Phone/name filters are applied only after API pagination.

Local dates are converted into a covering UTC date range for Calnode, then trimmed to the exact local day boundaries in n8n. This correctly includes, for example, 00:30 local on a date even though the UTC date is the previous day. Displayed times use the requested timezone. API `total` is deliberately not used as the match count: Calnode's counts span both past and upcoming, and phone/name filters are local.

Procedure and notes answers are not included. They require a separate authenticated `GET /v1/bookings/{id}/answers` request. No booking is created, modified, cancelled, or rescheduled by this tool.

Input errors return HTTP 400. Calnode errors preserve the upstream 4xx/5xx status with `success: false`; invalid responses and network errors return 502. A workflow-level timeout may still use n8n's standard error response. The workflow disables saved execution data and adds `Cache-Control: no-store` to responses.

## Regenerate / verify locally

```text
node integrations/n8n/get-bookings/build-workflow.mjs
node --test integrations/n8n/get-bookings/workflow.test.mjs
```

Tests use mocked responses only. Live n8n import, credential selection, and connectivity must be checked in your n8n instance. Node parameters follow the official HTTP Request v4.2, Code v2, Webhook v2, IF v2.2, and Respond to Webhook v1.4 definitions.
