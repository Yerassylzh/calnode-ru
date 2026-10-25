// n8n Code node. Required procedure and optional notes are resolved per event.
const input = $('Validate input').first().json;
const upstream = $input.first().json;
const fail = (http_status, code, message) => [{ json: { proceed: false, http_status, response: { success: false, error: { code, message } } } }];
const status = Number(upstream.statusCode);
if (status === 404) return fail(404, 'event_type_not_found', 'The event type is missing, inactive, or private.');
if (status !== 200 || !Array.isArray(upstream.body?.items)) return fail(502, 'questions_unavailable', 'Could not load booking questions from Calnode. Retry the same request with the same request_id.');
const questions = upstream.body.items;
const required = questions.filter(q => q.required === true);
const optional = questions.filter(q => q.required === false);
if (questions.length !== 2 || required.length !== 1 || optional.length !== 1 || !['text', 'select'].includes(required[0].type) || optional[0].type !== 'text' || typeof required[0].id !== 'string' || typeof optional[0].id !== 'string' || !required[0].id || !optional[0].id || required[0].id === optional[0].id) {
  return fail(422, 'question_configuration_error', 'Expected exactly two event questions: one required procedure (text/dropdown) and one optional notes (text). Check this event configuration in Calnode.');
}
const procedure = required[0];
if (procedure.type === 'select' && (!Array.isArray(procedure.options) || !procedure.options.includes(input.procedure))) return fail(400, 'invalid_procedure', 'procedure must exactly match a configured dropdown option.');
const answers = [{ question_id: procedure.id, value: input.procedure }];
if (input.notes) answers.push({ question_id: optional[0].id, value: input.notes });
return [{ json: { proceed: true, base_url: input.base_url, idempotency_key: input.idempotency_key, booking: { ...input.booking, answers } } }];
