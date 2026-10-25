// n8n Code node: Run Once for All Items. Edit these deployment defaults after import.
const CONFIG = {
  base_url: 'https://emdeu-calnode.usekvi.com',
  timezone: 'Asia/Qyzylorda',
  language: 'ru-RU',
};
const fail = message => [{ json: { proceed: false, http_status: 400, response: { success: false, error: { code: 'invalid_input', message } } } }];
const input = $input.first().json;
const body = input.body;
if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Send a JSON object in the request body.');
const fields = ['event_type_slug', 'start_at', 'name', 'contact_phone', 'procedure', 'notes', 'timezone', 'language', 'request_id'];
for (const field of Object.keys(body)) if (!fields.includes(field)) return fail('Unsupported field: ' + field);
const text = {};
for (const field of fields) {
  if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') return fail(field + ' must be a string.');
  text[field] = (body[field] || '').trim();
}
for (const field of ['event_type_slug', 'start_at', 'name', 'contact_phone', 'procedure']) if (!text[field]) return fail(field + ' is required.');
if (text.event_type_slug.length > 200 || /[\s/?#\\]/.test(text.event_type_slug)) return fail('event_type_slug must be an event slug, not a URL.');
if (text.name.length > 200 || text.procedure.length > 2000 || text.notes.length > 8000) return fail('Name, procedure, or notes exceed the supported length.');
if (text.contact_phone.length > 64 || !/^\+[0-9 ().-]+$/.test(text.contact_phone)) return fail('contact_phone must include + and country code, e.g. +77011234567.');
const phone = text.contact_phone.replace(/[ ().-]/g, '');
if (!/^\+[1-9]\d{6,14}$/.test(phone)) return fail('contact_phone must contain + followed by 7–15 digits.');
const date = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/.exec(text.start_at);
if (!date || !Number.isFinite(Date.parse(text.start_at))) return fail('start_at must be RFC3339 with timezone, e.g. 2026-11-02T09:00:00+05:00.');
const [, year, month, day, hour, minute, second, , offsetHour = '0', offsetMinute = '0'] = date;
const maxDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
if (+month < 1 || +month > 12 || +day < 1 || +day > maxDay || +hour > 23 || +minute > 59 || +second > 59 || +offsetHour > 23 || +offsetMinute > 59) return fail('start_at contains an invalid calendar date or time.');
const timezone = text.timezone || CONFIG.timezone;
try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { return fail('timezone must be a supported IANA timezone, e.g. Asia/Qyzylorda.'); }
const requestID = String(input.headers?.['idempotency-key'] || text.request_id).trim();
if (!requestID || requestID.length > 200 || /[\x00-\x1f\x7f]/.test(requestID)) return fail('Send a stable request_id or Idempotency-Key header (1–200 characters), reused for retries of this booking.');
if (text.request_id && input.headers?.['idempotency-key'] && text.request_id !== requestID) return fail('request_id and Idempotency-Key must match when both are supplied.');
return [{ json: {
  proceed: true,
  base_url: CONFIG.base_url.replace(/\/$/, ''),
  idempotency_key: 'n8n:create_booking:' + requestID,
  booking: {
    event_type_slug: text.event_type_slug,
    start_at: new Date(text.start_at).toISOString(),
    name: text.name,
    contact_method: 'phone',
    contact_phone: phone,
    timezone,
    language: text.language || CONFIG.language,
  },
  procedure: text.procedure,
  notes: text.notes,
} }];
