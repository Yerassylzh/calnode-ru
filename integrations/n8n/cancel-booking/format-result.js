const config = $('Prepare cancellation').first().json;
const result = $input.first().json;
const status = Number(result.statusCode);
function respond(httpStatus, response) { return [{ json: { http_status: httpStatus, response } }]; }
function fail(httpStatus, message, code) { return respond(httpStatus, { success: false, message, code, booking_id: config.booking_id }); }
if (!Number.isInteger(status) || status < 100 || status > 599) {
  return fail(502, 'Не удалось подтвердить отмену. Проверьте запись или повторите запрос с тем же booking_id.', 'CANCELLATION_UNCONFIRMED');
}
let body = result.body;
if (typeof body === 'string') {
  try { body = JSON.parse(body); }
  catch { return fail(502, 'Calnode вернул некорректный ответ. Проверьте состояние записи перед повторной попыткой.', 'INVALID_API_RESPONSE'); }
}
// Retrying a successfully cancelled booking is a successful final state.
// Do not translate unrelated 409 responses into success.
if (status === 409 && body?.error === 'booking already cancelled') {
  return respond(200, {
    success: true,
    already_cancelled: true,
    message: 'Эта запись уже отменена.',
    booking: { booking_id: config.booking_id, status: 'Отменена' }
  });
}
if (status < 200 || status >= 300) {
  const messages = {
    401: 'Calnode не принял ключ доступа. Проверьте учётные данные в n8n.',
    403: 'Недостаточно прав для отмены этой записи.',
    404: 'Запись не найдена или недоступна для этого пользователя.',
    429: 'Слишком много запросов. Повторите попытку позже.'
  };
  return fail(status >= 400 && status <= 599 ? status : 502,
    messages[status] || (typeof body?.error === 'string' ? body.error : 'Не удалось отменить запись.'),
    typeof body?.code === 'string' ? body.code : 'CANCELLATION_FAILED');
}
if (body?.id !== config.booking_id || body?.status !== 'cancelled') {
  return fail(502, 'Calnode не подтвердил отмену указанной записи. Проверьте её состояние.', 'CANCELLATION_UNCONFIRMED');
}
const booking = { booking_id: body.id, status: 'Отменена' };
if (body.start_at) {
  const start = DateTime.fromISO(body.start_at, { setZone: true }).setZone(config.timezone);
  if (start.isValid) {
    booking.date = start.toFormat('dd.MM.yyyy');
    booking.time = start.toFormat('HH:mm');
    booking.timezone = config.timezone;
  }
}
return respond(200, {
  success: true,
  already_cancelled: false,
  message: 'Запись отменена.',
  booking
});
