import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const id = '00000000-0000-4000-8000-000000000001';
const DateTime = { now: () => ({ setZone: zone => ({ isValid: zone === 'Asia/Qyzylorda' || zone === 'UTC' }) }) };
function prepare(body) {
  return new Function('$input', 'DateTime', read('prepare-request.js'))({ first: () => ({ json: { body } }) }, DateTime)[0].json;
}
function format(input) {
  return new Function('$input', '$', 'DateTime', read('format-result.js'))(
    { first: () => ({ json: input }) },
    name => { assert.equal(name, 'Prepare cancellation'); return { first: () => ({ json: prepare({ booking_id: id }) }) }; }, DateTime
  )[0].json;
}
test('valid request targets only its exact booking', () => {
  const result = prepare({ booking_id: id });
  assert.equal(result.proceed, true);
  assert.equal(result.url, `https://emdeu-calnode.usekvi.com/v1/bookings/${id}/cancel`);
  assert.deepEqual(result.body, {});
  assert.equal(prepare({ booking_id: id, reason: 'Client request' }).body.reason, 'Client request');
});
test('missing, ambiguous, malformed, and arbitrary URL input is rejected', () => {
  for (const body of [{}, { phone: '+77011234567' }, { booking_id: '../other' }, { booking_id: id, url: 'https://other.example' }, { booking_id: id, timezone: 'bad/zone' }, { booking_id: id, reason: {} }]) {
    assert.equal(prepare(body).http_status, 400);
  }
});
test('only a verified matching cancellation is successful', () => {
  const result = format({ statusCode: 200, body: { id, status: 'cancelled' } });
  assert.equal(result.response.success, true);
  assert.equal(result.response.booking.booking_id, id);
  assert.equal(result.response.booking.status, 'Отменена');
  for (const body of [{ id, status: 'confirmed' }, { id: 'other', status: 'cancelled' }, {}]) assert.equal(format({ statusCode: 200, body }).response.success, false);
});
test('safe retry recognizes only the specific already-cancelled response', () => {
  const result = format({ statusCode: 409, body: { error: 'booking already cancelled' } });
  assert.equal(result.http_status, 200);
  assert.equal(result.response.already_cancelled, true);
  assert.equal(format({ statusCode: 409, body: { error: 'another conflict' } }).response.success, false);
});
test('API errors are preserved and uncertain transport results never claim success', () => {
  for (const status of [401, 403, 404, 429, 500]) assert.equal(format({ statusCode: status, body: {} }).http_status, status);
  assert.equal(format({ error: 'timeout' }).http_status, 502);
  assert.equal(format({ statusCode: 200, body: '<html>proxy error</html>' }).response.success, false);
});
test('export embeds current code, requires credentials and returns validation errors', () => {
  const workflow = JSON.parse(read('../cancel_booking.workflow.json'));
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes[0].parameters.authentication, 'headerAuth');
  const http = workflow.nodes.find(n => n.type === 'n8n-nodes-base.httpRequest');
  assert.equal(http.parameters.method, 'POST');
  assert.equal(http.parameters.genericAuthType, 'httpBearerAuth');
  assert.equal(http.credentials, undefined);
  assert.equal(workflow.connections['Input valid?'].main[1][0].node, 'Respond');
  for (const [name, file] of [['Prepare cancellation', 'prepare-request.js'], ['Format cancellation response', 'format-result.js']]) assert.equal(workflow.nodes.find(n => n.name === name).parameters.jsCode, read(file));
});
