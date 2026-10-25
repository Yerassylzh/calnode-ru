const config = $('Prepare request').first().json;
const pages = $input.all();
function reply(status, response) { return [{ json: { http_status: status, response } }]; }
function fail(status, code, message) { return reply(status, { success: false, error: { code, message } }); }
let raw = [], lastLength = 0;
for (const page of pages) {
  const result = page.json;
  const status = Number(result.statusCode);
  if (!Number.isInteger(status)) return fail(502, 'CALNODE_UNAVAILABLE', 'Не удалось получить ответ от Calnode.');
  let body = result.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return fail(502, 'INVALID_API_RESPONSE', 'Calnode вернул некорректный ответ.'); }
  }
  if (status < 200 || status >= 300) {
    return fail(status >= 400 && status <= 599 ? status : 502, body?.code || 'GET_BOOKINGS_FAILED', typeof body?.error === 'string' ? body.error : 'Не удалось получить записи.');
  }
  if (!Array.isArray(body?.items)) return fail(502, 'INVALID_API_RESPONSE', 'В ответе Calnode отсутствует список записей.');
  lastLength = body.items.length;
  raw.push(...body.items);
}
if (!pages.length) return fail(502, 'EMPTY_API_RESPONSE', 'Calnode не вернул ответ.');
const normalizePhone = value => String(value ?? '').replace(/[ ().-]/g, '');
const seen = new Set();
const bookings = [];
for (const booking of raw) {
  if (!booking.id || seen.has(booking.id)) continue;
  seen.add(booking.id);
  const start = DateTime.fromISO(booking.start_at, { setZone: true });
  if (!start.isValid) return fail(502, 'INVALID_API_RESPONSE', 'Calnode вернул некорректное время записи.');
  if (config.local_from_ms != null && start.toMillis() < config.local_from_ms) continue;
  if (config.local_to_ms != null && start.toMillis() >= config.local_to_ms) continue;
  const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
  if (config.filters.phone && !attendees.some(a => normalizePhone(a.phone) === config.filters.phone)) continue;
  if (config.filters.name && !attendees.some(a => String(a.name ?? '').toLocaleLowerCase('ru-RU').includes(config.filters.name.toLocaleLowerCase('ru-RU')))) continue;
  const end = DateTime.fromISO(booking.end_at, { setZone: true });
  if (!end.isValid) return fail(502, 'INVALID_API_RESPONSE', 'Calnode вернул некорректное время записи.');
  bookings.push({
    id: booking.id,
    event_type_slug: booking.event_type_slug ?? null,
    status: booking.status,
    specialist_id: booking.host_id,
    specialist_name: booking.host_name ?? null,
    start_at: booking.start_at,
    end_at: booking.end_at,
    local_date: start.setZone(config.timezone).toISODate(),
    local_time: start.setZone(config.timezone).toFormat('HH:mm'),
    local_end_time: end.setZone(config.timezone).toFormat('HH:mm'),
    timezone: config.timezone,
    location: booking.location_value ?? null,
    attendees: attendees.map(a => ({ name: a.name ?? '', phone: a.phone ?? '', email: a.email ?? '', contact_method: a.contact_method ?? (a.phone ? 'phone' : 'email') }))
  });
}
// A full last page might have another page. Never claim this is a complete search.
const complete = lastLength < config.page_size;
return reply(200, {
  success: true, tool: 'get_bookings', count: bookings.length, complete,
  message: complete ? (bookings.length ? 'Записи найдены.' : 'По указанным фильтрам записей не найдено.') : 'Получена часть записей. Продолжите поиск с next_offset.',
  bookings,
  pagination: { scanned: raw.length, pages: pages.length, offset: config.offset, next_offset: complete ? null : config.offset + pages.length * config.page_size },
  filters: config.filters
});
