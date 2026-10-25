// Run against a NEW, disposable local Calnode database, never an existing workspace.
// CALNODE_SMOKE_URL=http://127.0.0.1:33071 node scripts/booking-contact-smoke.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';

const base = process.env.CALNODE_SMOKE_URL;
if (!base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Set CALNODE_SMOKE_URL to a disposable localhost instance');
let key;
async function api(path, data, method = 'POST') {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-API-Key': key } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
  return response.status === 204 ? null : response.json();
}
// Setup must fail on any populated workspace, before this script changes anything.
key = (await api('/v1/setup', { name: 'Contact smoke host', email: 'smoke@example.com', timezone: 'UTC' })).api_key;
for (let day = 0; day < 7; day++) await api('/v1/availability-rules', { day_of_week: day, start_time: '00:00', end_time: '23:59' });

const hostPage = http.createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><meta name="viewport" content="width=device-width"><calnode-booking slug="contact-smoke" lang="en"></calnode-booking><script src="${base}/embed.js"></script>`);
});
await new Promise(resolve => hostPage.listen(0, '127.0.0.1', resolve));
const embedURL = `http://127.0.0.1:${hostPage.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  await api('/v1/event-types', { slug: 'contact-smoke', name: 'Contact smoke', duration_minutes: 30, min_notice_minutes: 0, max_active_bookings: 0, max_future_days: 30, location_type: 'in_person', location_value: 'Office' });
  for (const mobile of [false, true]) {
    for (const embed of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, timezoneId: 'UTC' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(embed ? embedURL : base + '/book/contact-smoke?lang=en');
      const root = embed ? page.locator('calnode-booking') : page.locator('body');
      await root.locator('.cd.available').first().click();
      await root.locator('.slot-btn:not(.taken)').first().click();
      const method = root.locator('select[id$="contact-method"]');
      const phone = root.locator('input[id$="contact-phone"]');
      const email = root.locator('input[type="email"]');
      assert.equal(await method.inputValue(), 'phone');
      assert.equal(await phone.evaluate(element => element.required), true);
      assert.equal(await email.evaluate(element => element.required), false);
      await method.selectOption('email');
      assert.equal(await phone.evaluate(element => element.required), false);
      assert.equal(await email.evaluate(element => element.required), true);
      await method.selectOption('phone');
      await root.locator('input[autocomplete="name"]').fill('Phone-only visitor');
      await phone.fill('+7 (701) 123-45-67');
      assert.equal(await email.inputValue(), '');
      const created = page.waitForResponse(response => response.url() === base + '/v1/bookings' && response.request().method() === 'POST');
      await root.locator('button[type="submit"]:visible').click();
      const response = await created;
      assert.equal(response.status(), 201, await response.text());
      const booking = await response.json();
      assert.equal(booking.contact_method, 'phone');
      assert.equal(booking.location_value, 'Office');
      const manageLink = root.locator('a[href*="/manage/"]');
      await manageLink.waitFor({ state: 'visible' });
      assert.equal(await manageLink.getAttribute('href'), booking.manage_url);
      const managed = await page.goto(booking.manage_url);
      assert.equal(managed.status(), 200);
      assert.equal(managed.headers()['cache-control'], 'no-store');
      assert.equal(managed.headers()['referrer-policy'], 'no-referrer');
      await page.locator('#reschedule-btn').waitFor({ state: 'visible' });
      assert.deepEqual(errors, []);
      await fetch(booking.manage_url + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(response => assert.equal(response.status, 200));
      console.log(`PASS ${mobile ? 'mobile' : 'desktop'} ${embed ? 'cross-origin widget' : 'booking page'} phone-only booking and manage link`);
      await context.close();
    }
  }
  const bookings = await api('/v1/bookings?status=cancelled', undefined, 'GET');
  assert.equal(bookings.items.length, 4);
  for (const booking of bookings.items) {
    assert.equal(booking.attendees[0].email, '');
    assert.equal(booking.attendees[0].phone, '+77011234567');
  }
  console.log('PASS authenticated admin contact representation');
} finally {
  await browser.close();
  await new Promise(resolve => hostPage.close(resolve));
}
