import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
function run(file, input, validated) {
  const $input = { first: () => ({ json: input }) };
  const $ = name => { assert.equal(name, 'Validate input'); return { first: () => ({ json: validated }) }; };
  return new Function('$input', '$', read(file))($input, $)[0].json;
}
const request = { request_id: 'intent-001', event_type_slug: 'consultation', start_at: '2026-11-02T09:00:00+05:00', name: 'Alex', contact_phone: '+7 (701) 123-45-67', procedure: 'Consultation', notes: 'First visit' };
const validate = body => run('validate-input.js', { body, headers: {} });
const questionResponse = { statusCode: 200, body: { items: [{ id: 'notes-id', type: 'text', required: false }, { id: 'procedure-id', type: 'text', required: true }] } };

test('phone-only input preserves the time instant and does not select a host', () => {
  const result = validate(request);
  assert.equal(result.proceed, true);
  assert.equal(result.booking.start_at, '2026-11-02T04:00:00.000Z');
  assert.equal(result.booking.contact_phone, '+77011234567');
  assert.equal(result.booking.contact_method, 'phone');
  assert.equal(result.booking.timezone, 'Asia/Qyzylorda');
  assert.equal(result.booking.email, undefined);
  assert.equal(result.booking.phone, undefined); // Legacy meeting-location field must not be sent.
  assert.equal(result.booking.host_id, undefined);
  assert.equal(validate(request).idempotency_key, result.idempotency_key);
});

test('bad input is rejected before HTTP requests', () => {
  for (const overrides of [{ request_id: '' }, { procedure: '' }, { contact_phone: '87011234567' }, { start_at: '2026-11-02T09:00:00' }, { start_at: '2026-02-30T09:00:00Z' }, { timezone: 'wrong/timezone' }, { host_id: 'someone' }]) {
    const result = validate({ ...request, ...overrides });
    assert.equal(result.proceed, false, JSON.stringify(overrides));
    assert.equal(result.http_status, 400);
  }
});

test('question IDs are discovered regardless of order or wording', () => {
  const result = run('map-questions.js', questionResponse, validate(request));
  assert.deepEqual(result.booking.answers, [{ question_id: 'procedure-id', value: 'Consultation' }, { question_id: 'notes-id', value: 'First visit' }]);
  const withoutNotes = run('map-questions.js', questionResponse, validate({ ...request, notes: undefined }));
  assert.equal(withoutNotes.booking.answers.length, 1);
  assert.equal(run('map-questions.js', { statusCode: 200, body: { items: [] } }, validate(request)).proceed, false);
});

test('dropdown procedure must match an option; transport failures do not book', () => {
  const questions = structuredClone(questionResponse);
  questions.body.items[1] = { id: 'procedure-id', type: 'select', required: true, options: ['Treatment'] };
  assert.equal(run('map-questions.js', questions, validate(request)).http_status, 400);
  assert.equal(run('map-questions.js', { error: 'network problem' }, validate(request)).http_status, 502);
});

test('confirmed results preserve the specialist assigned by Calnode', () => {
  const result = run('format-result.js', { statusCode: 201, body: { id: 'booking-1', status: 'confirmed', host_id: 'calnode-selected-host', hosts: [{ id: 'calnode-selected-host', name: 'Specialist' }], manage_url: 'https://calnode.example/manage/private' } });
  assert.equal(result.http_status, 201);
  assert.equal(result.response.booking.host_id, 'calnode-selected-host');
  assert.equal(result.response.booking.manage_url, 'https://calnode.example/manage/private');
});

test('payment, conflicts, and uncertain outcomes are not reported as confirmed', () => {
  const paid = run('format-result.js', { statusCode: 200, body: { payment_required: true, booking_id: 'held', checkout_url: 'https://checkout.example/pay' } });
  assert.equal(paid.http_status, 202);
  assert.equal(paid.response.status, 'payment_required');
  const conflict = run('format-result.js', { statusCode: 409, body: { error: 'slot no longer available' } });
  assert.equal(conflict.http_status, 409);
  assert.equal(conflict.response.success, false);
  const uncertain = run('format-result.js', { error: 'timeout' });
  assert.equal(uncertain.response.success, false);
  assert.match(uncertain.response.error.message, /same request_id/);
});

test('export contains authentication, both error branches, and current Code node sources', () => {
  const workflow = JSON.parse(read('../create_booking.workflow.json'));
  assert.equal(workflow.nodes[0].parameters.authentication, 'headerAuth');
  assert.equal(workflow.active, false);
  for (const name of ['Input valid?', 'Ready to book?']) assert.equal(workflow.connections[name].main[1][0].node, 'Respond');
  for (const [name, file] of [['Validate input', 'validate-input.js'], ['Map booking questions', 'map-questions.js'], ['Format booking result', 'format-result.js']]) assert.equal(workflow.nodes.find(n => n.name === name).parameters.jsCode, read(file));
});
