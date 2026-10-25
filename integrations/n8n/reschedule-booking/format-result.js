const config = $('Prepare reschedule').first().json;
const result = $input.first().json;
function reply(status, response) { return [{ json: { http_status: status, response } }]; }
function fail(status, message, code) { return reply(status, { success: false, message, code, ...(config.booking_id ? { booking_id: config.booking_id } : {}) }); }
const status = Number(result.statusCode);
if (!Number.isInteger(status) || status < 100 || status > 599) return fail(502, 'Не удалось подтвердить перенос. Проверьте время через get_bookings перед повторной попыткой.', 'RESCHEDULE_UNCONFIRMED');
let body = result.body;
if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch { return fail(502, 'Calnode вернул некорректный ответ. Проверьте время через get_bookings.', 'INVALID_API_RESPONSE'); }
}
if (status < 200 || status >= 300) {
  let message;
  if (status === 401 || status === 403) message = 'Недостаточно прав. Для переноса по booking_id нужен API-ключ администратора или основного специалиста.';
  else if (status === 404) message = config.mode === 'manage'
    ? 'Личная ссылка недействительна или устарела. Используйте ссылку из последнего успешного переноса; если предыдущий запрос прервался, сначала проверьте время через get_bookings.'
    : 'Запись не найдена или ключ принадлежит другому специалисту. Используйте ключ администратора, основного специалиста либо сохранённую manage_url.';
  else if (status === 409) message = body?.error === 'this booking has been cancelled' ? 'Отменённую запись нельзя перенести.' : 'Выбранное время недоступно. Выберите другой слот.';
  else if (status === 429) message = 'Слишком много запросов. Повторите попытку позже.';
  else message = typeof body?.error === 'string' ? body.error : 'Не удалось перенести запись.';
  return fail(status >= 400 && status <= 599 ? status : 502, message, typeof body?.code === 'string' ? body.code : 'RESCHEDULE_FAILED');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (typeof body?.id !== 'string' || !uuid.test(body.id) || (config.booking_id && body.id !== config.booking_id) || !['confirmed', 'rescheduled'].includes(body.status)) return fail(502, 'Calnode не подтвердил перенос нужной записи. Проверьте её состояние.', 'RESCHEDULE_UNCONFIRMED');
const start = DateTime.fromISO(body.start_at ?? '', { setZone: true });
const end = DateTime.fromISO(body.end_at ?? '', { setZone: true });
if (!start.isValid || !end.isValid || start.toMillis() !== config.target_ms || end.toMillis() <= start.toMillis()) return fail(502, 'Calnode не подтвердил новое время записи. Проверьте её через get_bookings.', 'RESCHEDULE_UNCONFIRMED');
const escapedBase = config.base_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validManageURL = typeof body.manage_url === 'string' && new RegExp('^' + escapedBase + '/manage/[a-f0-9]{64}$', 'i').test(body.manage_url);
if (config.mode === 'manage' && !validManageURL) return fail(502, 'Время записи изменено, но Calnode не вернул новую личную ссылку. Сохраните запись и обратитесь к администратору за доступом.', 'MANAGE_LINK_MISSING');
const localStart = start.setZone(config.timezone), localEnd = end.setZone(config.timezone);
return reply(200, {
  success: true, message: 'Запись перенесена.',
  booking: {
    booking_id: body.id, status: 'Подтверждена',
    date: localStart.toFormat('dd.MM.yyyy'), time: localStart.toFormat('HH:mm'), end_time: localEnd.toFormat('HH:mm'),
    ...(localStart.toISODate() !== localEnd.toISODate() ? { end_date: localEnd.toFormat('dd.MM.yyyy') } : {}),
    timezone: config.timezone,
    ...(validManageURL ? { manage_url: body.manage_url } : {})
  },
  ...(config.mode === 'manage' ? { message: 'Запись перенесена. Сохраните новую manage_url — предыдущая ссылка больше не действует.' } : {})
});
