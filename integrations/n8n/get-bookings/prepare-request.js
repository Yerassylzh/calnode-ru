// Change only these defaults if needed. Never put an API key in this code.
const BASE_URL = 'https://emdeu-calnode.usekvi.com';
const DEFAULT_TIMEZONE = 'Asia/Qyzylorda';
const PAGE_SIZE = 200;

function invalid(message) {
  return [{ json: { proceed: false, http_status: 400, response: { success: false, error: { code: 'INVALID_INPUT', message } } } }];
}
const input = $input.first().json.body ?? {};
if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('Send a JSON object.');
const allowed = new Set(['date', 'from', 'to', 'when', 'status', 'timezone', 'event_slug', 'event_type_slug', 'phone', 'contact_phone', 'name', 'specialist_id', 'host_id', 'offset']);
for (const key of Object.keys(input)) if (!allowed.has(key)) return invalid(`Unsupported filter: ${key}`);
for (const [key, value] of Object.entries(input)) {
  if (key !== 'offset' && value != null && typeof value !== 'string') return invalid(`${key} must be a string.`);
}
const text = value => String(value ?? '').trim();
const timezone = text(input.timezone) || DEFAULT_TIMEZONE;
if (!DateTime.now().setZone(timezone).isValid) return invalid('Invalid timezone.');
const event = text(input.event_type_slug) || text(input.event_slug);
const host = text(input.specialist_id) || text(input.host_id);
if (text(input.event_type_slug) && text(input.event_slug) && input.event_type_slug !== input.event_slug) return invalid('Event slug aliases disagree.');
if (text(input.specialist_id) && text(input.host_id) && input.specialist_id !== input.host_id) return invalid('Specialist ID aliases disagree.');
let phone = text(input.contact_phone) || text(input.phone);
if (phone) {
  if (phone.length > 64 || !/^\+[0-9 ().-]+$/.test(phone)) return invalid('Phone must be international, e.g. +77011234567.');
  phone = phone.replace(/[ ().-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return invalid('Phone must contain + and 7–15 digits.');
}
const name = text(input.name);
const offset = input.offset == null ? 0 : Number(input.offset);
if (!Number.isSafeInteger(offset) || offset < 0) return invalid('offset must be a non-negative integer.');
if (input.offset != null && !['string', 'number'].includes(typeof input.offset)) return invalid('offset must be a number.');
const date = text(input.date);
if (date && (text(input.from) || text(input.to))) return invalid('Use date OR from/to, not both.');
const from = date || text(input.from);
const to = date || text(input.to);
let lower = null, upper = null;
for (const [key, value] of [['from', from], ['to', to]]) {
  if (!value) continue;
  const parsed = DateTime.fromISO(value, { zone: timezone });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !parsed.isValid) return invalid(`${key} must be a valid YYYY-MM-DD date.`);
  if (key === 'from') lower = parsed.startOf('day');
  else upper = parsed.plus({ days: 1 }).startOf('day');
}
if (lower && upper && lower.toMillis() >= upper.toMillis()) return invalid('from must not be later than to.');
const when = text(input.when) || (from || to ? 'all' : 'upcoming');
if (!['upcoming', 'past', 'all'].includes(when)) return invalid('when must be upcoming, past, or all.');
const status = text(input.status);
if (status && !['confirmed', 'cancelled', 'rescheduled'].includes(status)) return invalid('status must be confirmed, cancelled, or rescheduled.');
const query = { scope: 'all', limit: PAGE_SIZE, offset, order: 'asc' };
if (event) query.event_type = event;
if (host) query.host = host;
if (status) query.status = status;
if (when !== 'all') query.when = when;
// Calnode uses UTC calendar dates for from/to. Fetch a covering interval,
// then enforce the precise local-day bounds after collecting API pages.
if (lower) query.from = lower.toUTC().toISODate();
if (upper) query.to = upper.toUTC().toISODate();
const queryString = Object.entries(query).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
return [{ json: {
  proceed: true,
  url: BASE_URL.replace(/\/$/, '') + '/v1/bookings?' + queryString,
  timezone, page_size: PAGE_SIZE, offset,
  local_from_ms: lower?.toMillis() ?? null,
  local_to_ms: upper?.toMillis() ?? null,
  filters: { event_type_slug: event || null, specialist_id: host || null, phone: phone || null, name: name || null, when, status: status || null, from: from || null, to: to || null }
} }];
