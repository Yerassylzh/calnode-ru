import { readFileSync, writeFileSync } from 'node:fs';
const source = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const node = (id, name, type, version, position, parameters, extra = {}) => ({ id, name, type: `n8n-nodes-base.${type}`, typeVersion: version, position, parameters, ...extra });
const main = (...names) => ({ main: names.map(name => [{ node: name, type: 'main', index: 0 }]) });
const workflow = {
  name: 'Calnode — get_bookings (webhook)',
  nodes: [
    node('get-bookings-webhook', 'get_bookings', 'webhook', 2, [0, 0], { httpMethod: 'POST', path: 'calnode/get_bookings', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, { webhookId: '87a70670-2e63-4bb6-b65c-bd41e2fbf853' }),
    node('prepare-request', 'Prepare request', 'code', 2, [240, 0], { mode: 'runOnceForAllItems', jsCode: source('prepare-request.js') }),
    node('input-valid', 'Input valid?', 'if', 2.2, [480, 0], { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'get-input-valid', leftValue: '={{ $json.proceed }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }),
    node('get-calnode-bookings', 'Get bookings from Calnode', 'httpRequest', 4.2, [720, -100], {
      method: 'GET', url: '={{ $json.url }}', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth',
      options: {
        timeout: 20000,
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } },
        pagination: { pagination: {
          paginationMode: 'updateAParameterInEachRequest',
          parameters: { parameters: [{ type: 'qs', name: 'offset', value: '={{ $("Prepare request").first().json.offset + $pageCount * $("Prepare request").first().json.page_size }}' }] },
          paginationCompleteWhen: 'other',
          completeExpression: '={{ $response.statusCode !== 200 || !Array.isArray($response.body.items) || $response.body.items.length < $("Prepare request").first().json.page_size }}',
          limitPagesFetched: true, maxRequests: 10, requestInterval: 100
        } }
      }
    }, { onError: 'continueRegularOutput' }),
    node('format-get-bookings', 'Format bookings response', 'code', 2, [960, -100], { mode: 'runOnceForAllItems', jsCode: source('format-result.js') }),
    node('respond-get-bookings', 'Respond', 'respondToWebhook', 1.4, [1200, 100], { respondWith: 'json', responseBody: '={{ $json.response }}', options: { responseCode: '={{ $json.http_status }}', responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } }),
    node('get-bookings-help', 'Setup instructions', 'stickyNote', 1, [0, -470], { width: 1040, height: 330, content: '## get_bookings — setup\n1. Select a Header Auth credential on the Webhook (for example X-Calnode-Tool-Key).\n2. Select your Calnode Bearer credential on Get bookings from Calnode. Use an admin/owner key for all specialists.\n3. Check BASE_URL and timezone in Prepare request. No secrets are included in this export.\n4. Publish/activate and call the Production URL shown by n8n.\n\nExample POST body:\n`{"phone":"+77011234567","event_slug":"rodionova_60_min","date":"2026-11-02"}`\n\nAll filters optional. Empty body lists upcoming, non-cancelled bookings. Dates use Asia/Qyzylorda unless timezone is supplied. status=cancelled lists cancellations. when=all includes past/upcoming, not cancellations unless explicitly selected.\n\nFetches up to 10 pages of 200 bookings. If complete=false, repeat with the same filters and pagination.next_offset as offset. No procedure answers or private manage URLs are returned. See get-bookings/README.md.' })
  ],
  connections: {
    get_bookings: main('Prepare request'),
    'Prepare request': main('Input valid?'),
    'Input valid?': main('Get bookings from Calnode', 'Respond'),
    'Get bookings from Calnode': main('Format bookings response'),
    'Format bookings response': main('Respond')
  },
  active: false,
  settings: { executionOrder: 'v1', saveDataErrorExecution: 'none', saveDataSuccessExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false, executionTimeout: 60 },
  pinData: {}, tags: []
};
writeFileSync(new URL('../get_bookings.workflow.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('Generated get_bookings.workflow.json');
