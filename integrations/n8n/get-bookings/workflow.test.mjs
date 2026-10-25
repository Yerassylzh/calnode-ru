import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
// Mock the n8n runtime's Luxon interface. No network or Calnode credentials used.
const DateTime = {
  now: () => ({ setZone: zone => ({ isValid: zone === 'Asia/Qyzylorda' || zone === 'UTC' }) }),
  fromISO: value => {
    const date = new Date(value);
    return {
      isValid: !Number.isNaN(date.getTime()), toMillis: () => date.getTime(),
      setZone: zone => ({
        toISODate: () => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date),
        toFormat: () => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(date)
      })
    };
  }
};
function prepare(body) {
  return new Function('$input', 'DateTime', read('prepare-request.js'))({ first: () => ({ json: { body } }) }, DateTime)[0].json;
}
function format(pages, config = prepare({})) {
  return new Function('$input', '$', 'DateTime', read('format-result.js'))(
    { all: () => pages.map(json => ({ json })) },
    name => { assert.equal(name, 'Prepare request'); return { first: () => ({ json: config }) }; },
    DateTime
  )[0].json;
}
const booking = { id: 'booking-1', host_id: 'specialist', status: 'confirmed', start_at: '2026-11-02T04:00:00Z', end_at: '2026-11-02T05:00:00Z', attendees: [{ name: 'Иван', phone: '+77011234567', email: '', contact_method: 'phone' }] };

test('export is self-contained, inactive, authenticated, and paginates safely', () => {
  const workflow = JSON.parse(read('../get_bookings.workflow.json'));
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes[0].parameters.authentication, 'headerAuth');
  const http = workflow.nodes.find(n => n.type === 'n8n-nodes-base.httpRequest');
  assert.equal(http.parameters.genericAuthType, 'httpBearerAuth');
  assert.equal(http.credentials, undefined);
  assert.equal(http.parameters.options.pagination.pagination.maxRequests, 10);
  assert.match(http.parameters.options.pagination.pagination.completeExpression, /items.length/);
  assert.equal(workflow.connections['Input valid?'].main[1][0].node, 'Respond');
  for (const [name, file] of [['Prepare request', 'prepare-request.js'], ['Format bookings response', 'format-result.js']]) {
    assert.equal(workflow.nodes.find(n => n.name === name).parameters.jsCode, read(file));
    assert.doesNotThrow(() => new Function('$input', '$', 'DateTime', read(file)));
  }
});

test('default query and event/phone filters map without interpolating arbitrary URLs', () => {
  const config = prepare({ event_slug: 'procedure / test', phone: '+7 (701) 123-45-67' });
  assert.equal(config.proceed, true);
  const url = new URL(config.url);
  assert.equal(url.origin, 'https://emdeu-calnode.usekvi.com');
  assert.equal(url.searchParams.get('event_type'), 'procedure / test');
  assert.equal(url.searchParams.get('when'), 'upcoming');
  assert.equal(config.filters.phone, '+77011234567');
  for (const body of [{ phone: '87011234567' }, { limit: 100 }, { when: 'wrong' }, { offset: -1 }, { date: '2026-11-02', from: '2026-11-02' }, { timezone: 'bad/zone' }]) {
    assert.equal(prepare(body).http_status, 400, JSON.stringify(body));
  }
});

test('phone/name filters search every collected page and retain the booking ID', () => {
  const config = prepare({ phone: '+77011234567', name: 'ив' });
  const result = format([
    { statusCode: 200, body: { items: [{ ...booking, id: 'other', attendees: [{ name: 'Другой', phone: '+77011234568' }] }] } },
    { statusCode: 200, body: { items: [booking] } }
  ], config);
  assert.equal(result.response.count, 1);
  assert.equal(result.response.bookings[0].id, booking.id);
  assert.equal(result.response.bookings[0].local_time, '09:00');
  assert.equal(result.response.bookings[0].manage_url, undefined);
});

test('local day bounds are enforced even when the UTC date differs', () => {
  const config = { ...prepare({}), local_from_ms: Date.parse('2026-11-01T19:00:00Z'), local_to_ms: Date.parse('2026-11-02T19:00:00Z') };
  const result = format([{ statusCode: 200, body: { items: [
    { ...booking, id: 'too-early', start_at: '2026-11-01T18:59:00Z' },
    { ...booking, id: 'local-midnight', start_at: '2026-11-01T19:00:00Z' },
    { ...booking, id: 'next-day', start_at: '2026-11-02T19:00:00Z' }
  ] } }], config);
  assert.deepEqual(result.response.bookings.map(b => b.id), ['local-midnight']);
});

test('full last page reports an incomplete search with continuation offset', () => {
  const result = format([{ statusCode: 200, body: { items: Array.from({ length: 200 }, (_, i) => ({ ...booking, id: 'booking-' + i })) } }], prepare({ offset: 400 }));
  assert.equal(result.response.complete, false);
  assert.equal(result.response.pagination.next_offset, 600);
});

test('API failures and missing response bodies are returned as errors, never empty success', () => {
  assert.equal(format([{ statusCode: 403, body: { error: 'forbidden' } }]).http_status, 403);
  assert.equal(format([{ error: 'connection refused' }]).http_status, 502);
  assert.equal(format([{ statusCode: 200, body: {} }]).response.success, false);
  assert.equal(format([{ statusCode: 200, body: { items: [] } }, { statusCode: 500, body: { error: 'failed' } }]).response.success, false);
});
