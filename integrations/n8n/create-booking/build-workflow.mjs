import { readFileSync, writeFileSync } from 'node:fs';
const source = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const node = (id, name, type, typeVersion, position, parameters, extra = {}) => ({ id, name, type: 'n8n-nodes-base.' + type, typeVersion, position, parameters, ...extra });
const code = (id, name, x, file) => node(id, name, 'code', 2, [x, 0], { mode: 'runOnceForAllItems', jsCode: source(file) });
const gate = (id, name, x) => node(id, name, 'if', 2.2, [x, 0], { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: id + '-condition', leftValue: '={{ $json.proceed }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} });
const httpOptions = { timeout: 20000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } };
const nodes = [
  node('create-webhook', 'create_booking', 'webhook', 2, [0, 0], { httpMethod: 'POST', path: 'calnode/create_booking', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, { webhookId: 'f25f2747-b7e0-4c44-9897-719d75b0082a' }),
  code('validate-input', 'Validate input', 240, 'validate-input.js'),
  gate('valid-input', 'Input valid?', 480),
  node('load-questions', 'Get event questions', 'httpRequest', 4.2, [720, -100], { method: 'GET', url: '={{ $json.base_url + "/v1/event-types/" + encodeURIComponent($json.booking.event_type_slug) + "/questions" }}', options: httpOptions }, { onError: 'continueRegularOutput' }),
  code('map-questions', 'Map booking questions', 960, 'map-questions.js'),
  gate('ready-to-book', 'Ready to book?', 1200),
  node('create-booking', 'Create in Calnode', 'httpRequest', 4.2, [1440, -100], { method: 'POST', url: '={{ $json.base_url + "/v1/bookings" }}', sendHeaders: true, headerParameters: { parameters: [{ name: 'Idempotency-Key', value: '={{ $json.idempotency_key }}' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.booking) }}', options: httpOptions }, { onError: 'continueRegularOutput' }),
  code('format-result', 'Format booking result', 1680, 'format-result.js'),
  node('respond', 'Respond', 'respondToWebhook', 1.4, [1920, 200], { respondWith: 'json', responseBody: '={{ $json.response }}', options: { responseCode: '={{ $json.http_status }}', responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } }),
];
const main = (...names) => ({ main: names.map(name => [{ node: name, type: 'main', index: 0 }]) });
const workflow = {
  name: 'Calnode — create_booking (webhook)',
  nodes,
  connections: {
    create_booking: main('Validate input'),
    'Validate input': main('Input valid?'),
    'Input valid?': main('Get event questions', 'Respond'),
    'Get event questions': main('Map booking questions'),
    'Map booking questions': main('Ready to book?'),
    'Ready to book?': main('Create in Calnode', 'Respond'),
    'Create in Calnode': main('Format booking result'),
    'Format booking result': main('Respond'),
  },
  active: false,
  settings: { executionOrder: 'v1', saveDataErrorExecution: 'none', saveDataSuccessExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false, executionTimeout: 60 },
  pinData: {},
  tags: [],
};
writeFileSync(new URL('../create_booking.workflow.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('Generated create_booking.workflow.json');
