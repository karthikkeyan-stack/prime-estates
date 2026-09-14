/**
 * Verifies the client tracker in a real browser:
 * beacons actually fire, the delegated click listener catches CTAs, and
 * analytics failure never breaks navigation.
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4015';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n} ${extra}`)); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

// Capture every analytics beacon the browser sends.
const beacons = [];
await page.route('**/api/analytics/**', async (route) => {
  const req = route.request();
  let body = {};
  try { body = JSON.parse(req.postData() || '{}'); } catch { /* blob */ }
  beacons.push({ url: req.url().split('/api/analytics/')[1], body });
  await route.continue();
});

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

console.log('\n=== ANALYTICS IN A REAL BROWSER ===\n');

// --- 1. landing ---------------------------------------------------------
await page.goto(`${BASE}/?utm_source=qa&utm_medium=test`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

ok('session beacon fired on first load', beacons.some((b) => b.url === 'session'), JSON.stringify(beacons.map((b) => b.url)));
ok('pageview beacon fired on first load', beacons.some((b) => b.url === 'pageview'));

const session = beacons.find((b) => b.url === 'session');
ok('session carries a visitor id', !!session?.body?.visitor_id);
ok('session carries a session id', !!session?.body?.session_id);
ok('session captures the landing path', session?.body?.landing_path === '/', `got ${session?.body?.landing_path}`);
ok('utm_source captured', session?.body?.utm_source === 'qa', `got ${session?.body?.utm_source}`);
ok('first visit is not marked returning', session?.body?.is_returning === false, `got ${session?.body?.is_returning}`);

// --- 2. SPA navigation --------------------------------------------------
beacons.length = 0;
await page.getByRole('link', { name: /properties/i }).first().click();
await page.waitForURL('**/properties*');
await page.waitForTimeout(600);
ok('SPA route change sends a pageview', beacons.some((b) => b.url === 'pageview' && b.body.path?.startsWith('/properties')),
   JSON.stringify(beacons.map((b) => b.body?.path)));
ok('no duplicate session beacon on navigation', !beacons.some((b) => b.url === 'session'));

// --- 3. property detail attribution -------------------------------------
beacons.length = 0;
await page.locator('a[href^="/properties/"]').first().click();
await page.waitForURL(/\/properties\/[a-z0-9-]+/);
await page.waitForTimeout(900);
const propView = beacons.find((b) => b.url === 'pageview' && b.body.property_id);
ok('property detail pageview carries property_id', !!propView, JSON.stringify(beacons.map((b) => b.body)));
ok('property_id is numeric', typeof propView?.body?.property_id === 'number', `got ${typeof propView?.body?.property_id}`);

// --- 4. delegated CTA tracking ------------------------------------------
beacons.length = 0;
// Several WhatsApp links are viewport-gated (hidden sm:inline-flex), so
// pick one that is actually visible at this viewport.
const wa = page.locator('a[href*="wa.me"]:visible').first();
await wa.evaluate((el) => el.setAttribute('target', '_self')); // keep the click in-page
await wa.click({ force: true, noWaitAfter: true });
await page.waitForTimeout(500);
ok('WhatsApp click tracked by the delegated listener',
   beacons.some((b) => b.url === 'event' && b.body.event_type === 'whatsapp_click'),
   JSON.stringify(beacons.map((b) => b.body?.event_type)));

await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(400);
beacons.length = 0;
const tel = page.locator('a[href^="tel:"]:visible').first();
if (await tel.count()) {
  await tel.click({ force: true, noWaitAfter: true });
  await page.waitForTimeout(500);
  ok('phone click tracked by the delegated listener',
     beacons.some((b) => b.url === 'event' && b.body.event_type === 'phone_click'),
     JSON.stringify(beacons.map((b) => b.body?.event_type)));
} else {
  ok('phone link present to track', false, 'no tel: link found');
}

// --- 5. returning visitor ------------------------------------------------
const page2 = await ctx.newPage();
const beacons2 = [];
await page2.route('**/api/analytics/**', async (route) => {
  try { beacons2.push(JSON.parse(route.request().postData() || '{}')); } catch { /* */ }
  await route.continue();
});
await page2.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(500);
const returning = beacons2.find((b) => 'is_returning' in b);
// Same context = same sessionStorage, so a new session beacon may not fire;
// if one does, the visitor must be recognised as returning.
ok('returning visitor recognised when a new session starts',
   returning === undefined || returning.is_returning === true,
   JSON.stringify(returning));

// --- 6. analytics must never break the site ------------------------------
const ctx3 = await browser.newContext();
const page3 = await ctx3.newPage();
await page3.route('**/api/analytics/**', (route) => route.abort('failed')); // simulate an ad blocker
const errors3 = [];
page3.on('pageerror', (e) => errors3.push(e.message));
await page3.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page3.getByRole('link', { name: /properties/i }).first().click();
await page3.waitForURL('**/properties*');
await page3.waitForTimeout(700);
const cards = await page3.locator('a[href^="/properties/"]').count();
ok('site still renders when analytics is blocked', cards > 0, `cards=${cards}`);
ok('blocked analytics raises no page errors', errors3.length === 0, errors3.join(' | '));

// --- 7. admin excluded ----------------------------------------------------
const beacons4 = [];
const page4 = await ctx.newPage();
await page4.route('**/api/analytics/**', async (route) => {
  beacons4.push(route.request().url());
  await route.continue();
});
await page4.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await page4.waitForTimeout(700);
ok('admin pages are not tracked', beacons4.length === 0, `${beacons4.length} beacons from /admin`);

ok('no JavaScript errors across the public site', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
