// Credentials are selected on the HTTP node, never stored in this code.
const BASE_URL = 'https://emdeu-calnode.usekvi.com';
const DEFAULT_TIMEZONE = 'Asia/Qyzylorda';
function invalid(message) {
  return [{ json: { proceed: false, http_status: 400, response: { success: false, message } } }];
}
const input = $input.first().json.body ?? {};
if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('Передайте JSON-объект с booking_id.');
const allowed = new Set(['booking_id', 'timezone', 'reason']);
for (const key of Object.keys(input)) if (!allowed.has(key)) return invalid(`Неизвестное поле: ${key}`);
if (typeof input.booking_id !== 'string') return invalid('Укажите booking_id из результата get_bookings.');
const bookingID = input.booking_id.trim();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingID)) return invalid('booking_id должен быть UUID записи из get_bookings.');
if (input.timezone != null && typeof input.timezone !== 'string') return invalid('timezone должен быть строкой.');
const timezone = (input.timezone ?? '').trim() || DEFAULT_TIMEZONE;
if (!DateTime.now().setZone(timezone).isValid) return invalid('Некорректный часовой пояс.');
if (input.reason != null && typeof input.reason !== 'string') return invalid('reason должен быть строкой.');
const reason = (input.reason ?? '').trim();
if (reason.length > 1000) return invalid('reason не должен превышать 1000 символов.');
return [{ json: {
  proceed: true,
  booking_id: bookingID,
  timezone,
  url: BASE_URL.replace(/\/$/, '') + '/v1/bookings/' + encodeURIComponent(bookingID) + '/cancel',
  // The existing admin API attributes the cancellation to the credential's user.
  // A custom reason is accepted by that endpoint but does not override attribution.
  body: reason ? { reason } : {}
} }];
