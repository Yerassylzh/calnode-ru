// n8n Code node. Never report a payment hold or uncertain network result as confirmed.
const upstream = $input.first().json;
const status = Number(upstream.statusCode);
const body = upstream.body;
const fail = (http_status, code, message, retryable = false) => [{ json: { http_status, response: { success: false, error: { code, message, retryable } } } }];
if (!Number.isInteger(status) || !body || typeof body !== 'object' || Array.isArray(body)) return fail(502, 'calnode_unreachable', 'Calnode did not return a usable response. The booking outcome may be unknown. Retry the identical request with the same request_id; do not generate a new ID.', true);
if (status === 201 && typeof body.id === 'string' && body.id && body.status === 'confirmed') {
  return [{ json: { http_status: 201, response: { success: true, status: 'confirmed', booking: {
    id: body.id,
    event_type_id: body.event_type_id,
    start_at: body.start_at,
    end_at: body.end_at,
    contact_method: body.contact_method || 'phone',
    host_id: body.host_id,
    hosts: Array.isArray(body.hosts) ? body.hosts : [],
    location_type: body.location_type || '',
    location_value: body.location_value || '',
    manage_url: body.manage_url || '',
  } } } }];
}
if (status === 200 && body.payment_required === true && typeof body.checkout_url === 'string' && body.checkout_url) return [{ json: { http_status: 202, response: { success: true, status: 'payment_required', booking_id: body.booking_id, checkout_url: body.checkout_url } } }];
const codes = { 400: 'invalid_booking', 404: 'event_type_not_found', 409: 'slot_unavailable_or_request_in_progress', 422: 'booking_limit_or_request_conflict', 429: 'rate_limited', 503: 'booking_service_unavailable' };
if (codes[status]) return fail(status, codes[status], typeof body.error === 'string' ? body.error : 'Calnode rejected the booking request.', status === 429 || status === 503);
return fail(502, 'calnode_error', 'Calnode did not confirm the booking. For a transient failure, retry the identical request with the same request_id.', status >= 500);
