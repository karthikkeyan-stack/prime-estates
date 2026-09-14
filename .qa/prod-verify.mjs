import { chromium, devices } from 'playwright';

const BASE = 'https://prime-estates-lemon.vercel.app';
const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n} ${extra}`)); };

const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: UA_DESKTOP, viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

console.log('\n=== LIVE PRODUCTION VERIFICATION ===\n');

// Homepage
await p.goto(BASE, { waitUntil: 'networkidle' });
const h1 = (await p.locator('h1').first().innerText()).trim();
ok('homepage H1 matches the Stitch design', h1.includes('Worth Calling Your Own'), `got "${h1}"`);
ok('property cards render from the database', (await p.locator('a[href^="/properties/"]').count()) > 0);
ok('no horizontal overflow', (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
const imgOk = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length);
ok('images load', imgOk > 3, `${imgOk} loaded`);
await p.screenshot({ path: '.qa/out/prod-home.png', fullPage: false });

// Catalogue + filtering through the URL
await p.goto(`${BASE}/properties?listing=sale`, { waitUntil: 'networkidle' });
ok('catalogue renders with query filters', (await p.locator('a[href^="/properties/"]').count()) > 0);

// Detail page
await p.locator('a[href^="/properties/"]').first().click();
await p.waitForURL(/\/properties\/[a-z0-9-]+/);
await p.waitForTimeout(1500);
ok('property detail loads', (await p.locator('h1').count()) > 0);
ok('WhatsApp CTA present', (await p.locator('a[href*="wa.me"]').count()) > 0);
ok('Call CTA present', (await p.locator('a[href^="tel:"]').count()) > 0);
await p.screenshot({ path: '.qa/out/prod-detail.png', fullPage: false });

// Analytics fires on the real deployment
const beacons = [];
p.on('request', (r) => { if (r.url().includes('/api/analytics/')) beacons.push(r.url().split('/api/analytics/')[1]); });
await p.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
ok('analytics beacons fire in production', beacons.length > 0, JSON.stringify(beacons));

// Admin login through the real UI
await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'workwithsitecraft@gmail.com');
await p.fill('input[type="password"]', process.env.ADMIN_PASSWORD || '');
await p.click('button[type="submit"]');
await p.waitForTimeout(4000);
const adminBody = await p.locator('body').innerText();
ok('admin dashboard loads after login', /Manage your portfolio|Dashboard/i.test(adminBody), adminBody.slice(0, 80));
await p.screenshot({ path: '.qa/out/prod-admin.png', fullPage: false });

// Analytics screen
await p.goto(`${BASE}/admin/analytics`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
ok('admin analytics page renders', /Analytics/i.test(await p.locator('body').innerText()));
await p.screenshot({ path: '.qa/out/prod-analytics.png', fullPage: true });

// Mobile
const m = await b.newContext({ ...devices['iPhone 13'] });
const mp = await m.newPage();
await mp.goto(BASE, { waitUntil: 'networkidle' });
ok('mobile has no horizontal overflow', (await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
await mp.screenshot({ path: '.qa/out/prod-mobile.png', fullPage: false });

ok('no JavaScript errors anywhere', errs.length === 0, errs.slice(0, 2).join(' | '));

await b.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
