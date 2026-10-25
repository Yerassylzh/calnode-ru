import { readFileSync, writeFileSync } from 'node:fs';
const source = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const node = (id, name, type, version, position, parameters, extra = {}) => ({ id, name, type: `n8n-nodes-base.${type}`, typeVersion: version, position, parameters, ...extra });
const main = (...names) => ({ main: names.map(name => [{ node: name, type: 'main', index: 0 }]) });
const workflow = {
  name: 'Calnode — cancel_booking (webhook)',
  nodes: [
    node('cancel-webhook', 'cancel_booking', 'webhook', 2, [0, 0], { httpMethod: 'POST', path: 'calnode/cancel_booking', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, { webhookId: '4174adab-b827-42d1-89ae-7bead56babdf' }),
    node('prepare-cancellation', 'Prepare cancellation', 'code', 2, [240, 0], { mode: 'runOnceForAllItems', jsCode: source('prepare-request.js') }),
    node('cancel-input-valid', 'Input valid?', 'if', 2.2, [480, 0], { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'cancel-valid-condition', leftValue: '={{ $json.proceed }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} }),
    node('cancel-in-calnode', 'Cancel in Calnode', 'httpRequest', 4.2, [720, -100], {
      method: 'POST', url: '={{ $json.url }}', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
      options: { timeout: 20000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } }
    }, { onError: 'continueRegularOutput' }),
    node('format-cancellation', 'Format cancellation response', 'code', 2, [960, -100], { mode: 'runOnceForAllItems', jsCode: source('format-result.js') }),
    node('respond-cancellation', 'Respond', 'respondToWebhook', 1.4, [1200, 100], { respondWith: 'json', responseBody: '={{ $json.response }}', options: { responseCode: '={{ $json.http_status }}', responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } } }),
    node('cancel-help', 'Setup instructions', 'stickyNote', 1, [0, -420], { width: 1040, height: 280, content: '## cancel_booking\n1. Webhook: select Header Auth credentials, e.g. X-Calnode-Tool-Key.\n2. Cancel in Calnode: select your Calnode Bearer credential. Use an admin/owner key to cancel bookings across specialists.\n3. Check BASE_URL in Prepare cancellation. Publish/activate and use the Production URL.\n\nPOST body: `{"booking_id":"UUID returned by get_bookings"}`\nOptional: timezone (default Asia/Qyzylorda).\n\nThis tool cancels the exact supplied booking ID. It does not search by name/phone or guess which appointment to cancel. A repeat request for an already cancelled booking returns success.\n\nThe existing Calnode admin API records the credential user as the cancellation author; a supplied reason does not override that. Calendar/email side effects run asynchronously in Calnode. No credentials are included in this file.' })
  ],
  connections: {
    cancel_booking: main('Prepare cancellation'),
    'Prepare cancellation': main('Input valid?'),
    'Input valid?': main('Cancel in Calnode', 'Respond'),
    'Cancel in Calnode': main('Format cancellation response'),
    'Format cancellation response': main('Respond')
  },
  active: false,
  settings: { executionOrder: 'v1', saveDataErrorExecution: 'none', saveDataSuccessExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false, executionTimeout: 60 },
  pinData: {}, tags: []
};
writeFileSync(new URL('../cancel_booking.workflow.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('Generated cancel_booking.workflow.json');
