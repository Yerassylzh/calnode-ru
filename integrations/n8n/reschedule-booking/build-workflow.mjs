import { readFileSync, writeFileSync } from 'node:fs';
const source = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const node = (id, name, type, version, position, parameters, extra = {}) => ({ id, name, type: `n8n-nodes-base.${type}`, typeVersion: version, position, parameters, ...extra });
const main = (...names) => ({ main: names.map(name => [{ node: name, type: 'main', index: 0 }]) });
const gate = (id, name, field, position) => node(id, name, 'if', 2.2, position, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: id + '-condition', leftValue: `={{ $json.${field} }}`, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} });
const request = method => ({ method, url: '={{ $json.url }}', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}', options: { timeout: 20000, redirect: { redirect: { followRedirects: false } }, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } } });
const workflow = {
  name: 'Calnode — reschedule_booking (webhook)',
  nodes: [
    // Deliberately omit path and webhookId: no preassigned webhook URL/ID.
    node('reschedule-webhook', 'reschedule_booking', 'webhook', 2, [0, 0], { httpMethod: 'POST', authentication: 'none', responseMode: 'responseNode', options: {} }),
    node('prepare-reschedule', 'Prepare reschedule', 'code', 2, [240, 0], { mode: 'runOnceForAllItems', jsCode: source('prepare-request.js') }),
    gate('valid-reschedule', 'Input valid?', 'proceed', [480, 0]),
    gate('reschedule-mode', 'Use manage URL?', 'use_manage_url', [720, -100]),
    node('reschedule-manage', 'Reschedule using manage link', 'httpRequest', 4.2, [960, -220], { ...request('POST'), authentication: 'none' }, { onError: 'continueRegularOutput' }),
    node('reschedule-host', 'Reschedule as primary host', 'httpRequest', 4.2, [960, 20], { ...request('PATCH'), authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth' }, { onError: 'continueRegularOutput' }),
    node('format-reschedule', 'Format reschedule response', 'code', 2, [1200, -100], { mode: 'runOnceForAllItems', jsCode: source('format-result.js') }),
    node('respond-reschedule', 'Respond', 'respondToWebhook', 1.4, [1440, 200], { respondWith: 'json', responseBody: '={{ $json.response }}', options: { responseCode: '={{ $json.http_status }}', responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } }),
    node('reschedule-help', 'Setup instructions', 'stickyNote', 1, [0, -480], { width: 1160, height: 340, content: '## reschedule_booking\nWebhook Authentication = None. No fixed path or webhookId is exported. Use the URL n8n generates; if your import leaves Path blank, replace only the trigger with a fresh Webhook and reconnect it to Prepare reschedule (POST, Respond using Respond to Webhook node).\n\nStandard request: POST {"booking_id":"UUID from get_bookings","date":"2026-11-03","time":"15-30"}. Time is HH-MM in 24-hour format, interpreted in Asia/Qyzylorda automatically. Select your ADMIN Bearer credential on Reschedule as primary host. Deploy the updated backend first.\n\nAlternative: POST {"booking_id":"UUID from get_bookings","date":"2026-11-03","time":"15:00"}. Select an ADMIN Bearer credential on Reschedule as primary host to reschedule bookings across all specialists. Regular member credentials can reschedule only their own bookings. Deploy the updated Calnode backend first.\n\nExactly one of manage_url / booking_id. Supply date + time OR start_at with offset. timezone defaults to Asia/Qyzylorda. Existing specialist, answers and contacts are preserved. No appointments are cancelled/recreated.\n\nThe webhook is unauthenticated as requested. No credentials or private booking tokens are bundled. See reschedule-booking/README.md.' })
  ],
  connections: {
    reschedule_booking: main('Prepare reschedule'),
    'Prepare reschedule': main('Input valid?'),
    'Input valid?': main('Use manage URL?', 'Respond'),
    'Use manage URL?': main('Reschedule using manage link', 'Reschedule as primary host'),
    'Reschedule using manage link': main('Format reschedule response'),
    'Reschedule as primary host': main('Format reschedule response'),
    'Format reschedule response': main('Respond')
  },
  active: false,
  settings: { executionOrder: 'v1', saveDataErrorExecution: 'none', saveDataSuccessExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false, executionTimeout: 60 },
  pinData: {}, tags: []
};
writeFileSync(new URL('../reschedule_booking.workflow.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('Generated reschedule_booking.workflow.json');
