const BASE_URL = 'https://emdeu-calnode.usekvi.com';
const DEFAULT_TIMEZONE = 'Asia/Qyzylorda';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message) { return [{ json: { proceed: false, http_status: 400, response: { success: false, message } } }]; }
const input = $input.first().json.body;
if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('Передайте JSON-объект с записью и новым временем.');
const allowed = new Set(['booking_id', 'manage_url', 'date', 'time', 'start_at', 'timezone']);
for (const [key, value] of Object.entries(input)) {
  if (!allowed.has(key)) return invalid(`Неизвестное поле: ${key}`);
  if (value != null && typeof value !== 'string') return invalid(`${key} должен быть строкой.`);
}
const text = value => (value ?? '').trim();
const timezone = text(input.timezone) || DEFAULT_TIMEZONE;
if (!DateTime.now().setZone(timezone).isValid) return invalid('Некорректный часовой пояс.');
const bookingID = text(input.booking_id);
const manageURL = text(input.manage_url);
if (Boolean(bookingID) === Boolean(manageURL)) return invalid('Укажите ровно одно поле: booking_id ИЛИ manage_url.');
const base = BASE_URL.replace(/\/$/, '');
const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const managePattern = new RegExp('^' + escapedBase + '/manage/([a-f0-9]{64})/?$', 'i');
let url;
if (manageURL) {
  const match = managePattern.exec(manageURL);
  if (!match) return invalid('manage_url должна быть исходной личной ссылкой Calnode из результата создания или последнего переноса записи.');
  url = base + '/manage/' + match[1] + '/reschedule';
} else {
  if (!uuid.test(bookingID)) return invalid('booking_id должен быть UUID записи из get_bookings.');
  url = base + '/v1/bookings/' + encodeURIComponent(bookingID) + '/reschedule';
}
const date = text(input.date), time = text(input.time), startAt = text(input.start_at);
if (startAt && (date || time)) return invalid('Передайте date/time ИЛИ start_at, не оба варианта.');
let target;
if (startAt) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(startAt)) return invalid('start_at должен содержать дату, время с секундами и часовой пояс.');
  target = DateTime.fromISO(startAt, { setZone: true });
} else {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3])-[0-5]\d$|^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return invalid('Укажите date в формате YYYY-MM-DD и time в формате HH-MM (24 часа), например 15-30.');
  target = DateTime.fromISO(date + 'T' + time.replace('-', ':'), { zone: timezone });
}
if (!target.isValid) return invalid('Некорректная дата или время.');
if (target.toMillis() <= Date.now()) return invalid('Новое время записи должно быть в будущем.');
return [{ json: {
  proceed: true, use_manage_url: Boolean(manageURL), mode: manageURL ? 'manage' : 'host_api',
  booking_id: bookingID || null, base_url: base, timezone, target_ms: target.toMillis(), url,
  body: { start_at: target.toUTC().toISO({ suppressMilliseconds: true }) }
} }];
