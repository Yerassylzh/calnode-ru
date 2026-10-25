import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const id = '00000000-0000-4000-8000-000000000001';
const base = 'https://emdeu-calnode.usekvi.com';
const oldURL = base + '/manage/' + 'a'.repeat(64);
const newURL = base + '/manage/' + 'b'.repeat(64);
const input = { manage_url: oldURL, date: '2099-11-03', time: '15:00' };
// Model only n8n's runtime-provided Luxon interface for pure/mock checks.
function dt(milliseconds, zone = 'UTC') {
  const date = new Date(milliseconds);
  return {
    isValid: Number.isFinite(milliseconds), toMillis: () => milliseconds,
    setZone: value => dt(milliseconds, value), toUTC: () => dt(milliseconds),
    toISO: () => date.toISOString().replace('.000Z', 'Z'),
    toISODate: () => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date),
    toFormat: format => format === 'HH:mm'
      ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(date)
      : new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date).replaceAll('/', '.')
  };
}
const DateTime = {
  now: () => ({ setZone: zone => ({ isValid: ['Asia/Qyzylorda', 'UTC'].includes(zone) }) }),
  fromISO: (value, options) => dt(Date.parse(value + (options?.zone === 'Asia/Qyzylorda' ? '+05:00' : options?.zone === 'UTC' ? 'Z' : '')))
};
function prepare(body) {
  return new Function('$input', 'DateTime', read('prepare-request.js'))({ first: () => ({ json: { body } }) }, DateTime)[0].json;
}
function format(result, config = prepare(input)) {
  return new Function('$input', '$', 'DateTime', read('format-result.js'))(
    { first: () => ({ json: result }) },
    name => { assert.equal(name, 'Prepare reschedule'); return { first: () => ({ json: config }) }; }, DateTime
  )[0].json;
}
const success = { statusCode: 200, body: { id, status: 'confirmed', start_at: '2099-11-03T10:00:00Z', end_at: '2099-11-03T11:00:00Z', manage_url: newURL } };

test('manage link mode targets the configured origin and formats clinic local time', () => {
  const config = prepare(input);
  assert.equal(config.proceed, true);
  assert.equal(config.use_manage_url, true);
  assert.equal(config.url, oldURL + '/reschedule');
  assert.equal(config.body.start_at, '2099-11-03T10:00:00Z');
  const result = format(success, config);
  assert.equal(result.response.success, true);
  assert.equal(result.response.booking.date, '03.11.2099');
  assert.equal(result.response.booking.time, '15:00');
  assert.equal(result.response.booking.end_time, '16:00');
  assert.equal(result.response.booking.manage_url, newURL);
  assert.equal(result.response.booking.start_at, undefined);
});
test('booking ID, date and HH-MM local time are sufficient', () => {
  const config = prepare({ booking_id: id, date: '2099-11-03', time: '15-00' });
  assert.equal(config.proceed, true);
  assert.equal(config.timezone, 'Asia/Qyzylorda');
  assert.equal(config.use_manage_url, false);
  assert.equal(config.url, base + '/v1/bookings/' + id + '/reschedule');
  assert.equal(config.body.start_at, '2099-11-03T10:00:00Z');
  assert.equal(format({ ...success, body: { ...success.body, manage_url: undefined } }, config).response.success, true);
  for (const time of ['24-00', '15-60', '3-00', '15-0', '15-00-00']) {
    assert.equal(prepare({ booking_id: id, date: '2099-11-03', time }).http_status, 400);
  }
});
test('ID mode uses only the supplied booking ID and accepts an explicit-offset timestamp', () => {
  const config = prepare({ booking_id: id, start_at: '2099-11-03T15:00:00+05:00' });
  assert.equal(config.proceed, true);
  assert.equal(config.use_manage_url, false);
  assert.equal(config.url, base + '/v1/bookings/' + id + '/reschedule');
  assert.equal(format({ ...success, body: { ...success.body, manage_url: undefined } }, config).response.success, true);
  assert.equal(format({ ...success, body: { ...success.body, id: '00000000-0000-4000-8000-000000000002' } }, config).http_status, 502);
});
test('ambiguous identities, arbitrary hosts, and bad time requests fail before mutations', () => {
  for (const body of [
    {}, { ...input, booking_id: id }, { ...input, manage_url: 'https://other.example/manage/' + 'a'.repeat(64) },
    { ...input, manage_url: oldURL + '?redirect=1' }, { ...input, manage_url: base.replace('.com', 'Xcom') + '/manage/' + 'a'.repeat(64) },
    { ...input, start_at: '2099-11-03T10:00:00Z' }, { booking_id: id, start_at: '2099-11-03T15:00:00' },
    { ...input, time: '24:00' }, { ...input, timezone: 'bad/zone' }, { ...input, specialist_id: 'other' },
    { ...input, date: '2020-01-01' }
  ]) assert.equal(prepare(body).http_status, 400, JSON.stringify(body));
});
test('missing replacement link or a different returned time never reports clean success', () => {
  for (const body of [
    { ...success.body, manage_url: undefined },
    { ...success.body, manage_url: 'https://other.example/manage/' + 'b'.repeat(64) },
    { ...success.body, start_at: '2099-11-03T11:00:00Z' },
    { ...success.body, status: 'cancelled' }
  ]) assert.equal(format({ statusCode: 200, body }).response.success, false);
});
test('conflicts, expired capabilities and transport failures preserve uncertainty', () => {
  assert.equal(format({ statusCode: 409, body: { error: 'that time slot is no longer available' } }).http_status, 409);
  assert.equal(format({ statusCode: 404, body: { error: 'manage link not found or expired' } }).response.success, false);
  assert.equal(format({ error: 'timeout' }).http_status, 502);
  assert.equal(format({ statusCode: 200, body: 'not json' }).http_status, 502);
});
test('export has no preset webhook URL/ID or auth, and separates both backend methods', () => {
  const workflow = JSON.parse(read('../reschedule_booking.workflow.json'));
  const webhook = workflow.nodes[0];
  assert.equal(webhook.parameters.authentication, 'none');
  assert.equal(webhook.parameters.path, undefined);
  assert.equal(webhook.webhookId, undefined);
  assert.equal(webhook.credentials, undefined);
  assert.equal(workflow.active, false);
  const requests = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
  assert.deepEqual(requests.map(n => n.parameters.method), ['POST', 'PATCH']);
  assert.equal(requests[0].parameters.authentication, 'none');
  assert.equal(requests[1].parameters.genericAuthType, 'httpBearerAuth');
  for (const request of requests) {
    assert.equal(request.retryOnFail, undefined);
    assert.equal(request.parameters.options.redirect.redirect.followRedirects, false);
  }
  assert.equal(workflow.connections['Input valid?'].main[1][0].node, 'Respond');
  for (const [name, file] of [['Prepare reschedule', 'prepare-request.js'], ['Format reschedule response', 'format-result.js']]) assert.equal(workflow.nodes.find(n => n.name === name).parameters.jsCode, read(file));
});
