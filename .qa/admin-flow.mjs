/**
 * Drives the admin panel through the real UI with a browser:
 * login → dashboard → create → upload → toggle → enquiries → settings → logout.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const TAG = `UI${Date.now().toString(36).slice(-5)}`;

let pass = 0, fail = 0;
const errs = [];
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; errs.push(n); console.log(`  ✗ ${n} ${d}`); } };

const IGNORE = [/favicon/i, /Download the React DevTools/i, /\[vite\]/i];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => {
  if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.some((r) => r.test(m.text()))) {
    consoleErrors.push(`[${m.type()}] ${m.text().slice(0, 160)}`);
  }
});
page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message.slice(0, 160)}`));

async function overflow() {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

console.log('\n=== LOGIN ===');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
ok('login screen renders', await page.locator('input[type="password"]').isVisible());
ok('no overflow on login', (await overflow()) === 0);

// wrong password first
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', 'definitely-wrong');
await page.click('button[type="submit"]');
await page.waitForTimeout(1200);
const stillLogin = await page.locator('input[type="password"]').isVisible();
ok('wrong password keeps user out', stillLogin);
const errText = await page.locator('body').innerText();
ok('shows an error message', /invalid|incorrect|wrong|could not|failed/i.test(errText));

// correct password
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
// Wait for the actual condition (password field gone) rather than a fixed
// delay: the server adds a deliberate 350ms penalty after a failed attempt,
// which made a fixed wait flaky.
const loggedIn = await page.locator('input[type="password"]')
  .waitFor({ state: 'detached', timeout: 15000 })
  .then(() => true).catch(() => false);
ok('login succeeds', loggedIn);

console.log('\n=== DASHBOARD ===');
await page.waitForTimeout(1200);
let body = await page.locator('body').innerText();
const liveTotal = (await fetch(`${BASE}/api/health`).then((r) => r.json())).properties;
ok('dashboard shows real property count', new RegExp(`\\b${liveTotal}\\b`).test(body), `expected ${liveTotal}`);
ok('dashboard has stat cards', (await page.locator('text=/total properties/i').count()) > 0);
ok('no overflow on dashboard', (await overflow()) === 0);
await page.screenshot({ path: '.qa/shots/admin-dashboard.png', fullPage: true });

console.log('\n=== PROPERTY LIST ===');
await page.goto(`${BASE}/admin/properties`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const rowCount = await page.locator('table tbody tr').count();
ok('property table renders rows', rowCount > 0, `rows=${rowCount}`);
ok('no overflow on list', (await overflow()) === 0);

// search
const searchBox = page.locator('input[type="search"]').first();
await searchBox.fill('Kensington');
await page.waitForTimeout(1400);
body = await page.locator('body').innerText();
ok('list search filters', /Kensington/i.test(body) && !/Aura Horizon/i.test(body));
ok('search reflected in URL', page.url().includes('search=Kensington'));
await searchBox.fill('');
await page.waitForTimeout(1200);
await page.screenshot({ path: '.qa/shots/admin-properties.png', fullPage: true });

console.log('\n=== CREATE PROPERTY ===');
await page.goto(`${BASE}/admin/properties/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
ok('add form renders', (await page.locator('#f-title').count()) === 1);
ok('no overflow on form', (await overflow()) === 0);

// submit empty → validation
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(900);
body = await page.locator('body').innerText();
ok('empty submit blocked by validation', /required|fix the highlighted/i.test(body));
ok('still on the form', page.url().includes('/new'));

// fill it in
await page.fill('#f-title', `${TAG} Garden Villa`);
await page.waitForTimeout(400);
const slugVal = await page.inputValue('#f-slug');
ok('slug auto-fills from title', slugVal === `${TAG.toLowerCase()}-garden-villa`, `got "${slugVal}"`);
await page.selectOption('#f-type', 'villa');
await page.selectOption('#f-listing', 'sale');
await page.fill('#f-price', '14500000');
await page.fill('#f-loc', 'Vadavalli, Coimbatore');
await page.selectOption('#f-locslug', 'coimbatore');
await page.fill('#f-beds', '4');
await page.fill('#f-baths', '4');
await page.fill('#f-short', 'Created by the automated admin UI test.');
await page.waitForTimeout(300);
body = await page.locator('body').innerText();
ok('price preview formats live', /1\.45\s*Cr/i.test(body), 'expected ₹1.45 Cr hint');

// amenity chip
await page.fill('#f-amenity', 'Private Garden');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
ok('amenity chip added', (await page.locator('text=Private Garden').count()) > 0);

await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2600);
ok('property created & redirected to edit', /\/admin\/properties\/\d+$/.test(page.url()), page.url());
body = await page.locator('body').innerText();
ok('success toast shown', /created|saved/i.test(body));

const propId = page.url().split('/').pop();

console.log('\n=== IMAGE UPLOAD ===');
const png = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000a0000000a0806000000' +
  '8d32cfbd0000001849444154789c63fcffff3f0324d4c0a4030c0c0c8a' +
  '8080004c0d0be9c0f35c0000000049454e44ae426082', 'hex');
await page.setInputFiles('#f-images', { name: 'test-photo.png', mimeType: 'image/png', buffer: png });
await page.waitForTimeout(2600);
const imgTiles = await page.locator('li:has(img) >> nth=0').count();
ok('image appears in manager', imgTiles > 0);
body = await page.locator('body').innerText();
ok('first image marked primary', /primary/i.test(body));
await page.screenshot({ path: '.qa/shots/admin-form.png', fullPage: true });

console.log('\n=== PUBLISH TOGGLES ===');
// the checkbox is sr-only (styled switch), so click its label
await page.locator('label[for="t-featured"]').click();
await page.waitForTimeout(400);
ok('featured toggle flips in UI', await page.locator('#t-featured').isChecked());
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2200);
const check = await fetch(`${BASE}/api/properties?search=${TAG}`).then((r) => r.json());
ok('property visible on public API', check.total >= 1, `total=${check.total}`);
ok('featured flag persisted', check.data[0]?.featured === true);

console.log('\n=== PUBLIC SITE REFLECTS ADMIN ===');
const pub = await context.newPage();
await pub.goto(`${BASE}/properties/${check.data[0].slug}`, { waitUntil: 'networkidle' });
await pub.waitForTimeout(900);
const pubBody = await pub.locator('body').innerText();
ok('new property has a live public page', pubBody.includes(`${TAG} Garden Villa`));
ok('amenity shows publicly', /Private Garden/i.test(pubBody));
ok('price renders publicly', /1\.45\s*Cr/i.test(pubBody));
await pub.close();

console.log('\n=== ENQUIRIES ===');
await fetch(`${BASE}/api/enquiries`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: `${TAG} Buyer`, phone: '9876500011', email: 'ui@example.com', message: 'UI flow test enquiry', source: 'qa-ui' }),
});
await page.goto(`${BASE}/admin/enquiries`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
body = await page.locator('body').innerText();
ok('enquiry appears in admin', body.includes(`${TAG} Buyer`));
ok('no overflow on enquiries', (await overflow()) === 0);

await page.locator(`button:has-text("${TAG} Buyer")`).first().click();
await page.waitForTimeout(1000);
body = await page.locator('body').innerText();
ok('enquiry detail opens', /internal notes/i.test(body));
ok('detail shows phone', body.includes('9876500011'));
const waLink = await page.locator('a[href*="wa.me"]').first().getAttribute('href');
ok('WhatsApp reply link present', !!waLink && waLink.includes('wa.me'));
const telLink = await page.locator('a[href^="tel:"]').first().getAttribute('href');
ok('Call link present', !!telLink);

await page.locator('button:has-text("Mark contacted")').first().click();
await page.waitForTimeout(1400);
body = await page.locator('body').innerText();
ok('status change works', /contacted/i.test(body));
await page.screenshot({ path: '.qa/shots/admin-enquiry-detail.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

console.log('\n=== SETTINGS ===');
await page.goto(`${BASE}/admin/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
ok('settings form renders', (await page.locator('#s-business_name').count()) === 1);
ok('phone pre-filled from DB', (await page.inputValue('#s-phone')) === '9486122022');
ok('email intentionally blank', (await page.inputValue('#s-email')) === '');
ok('no overflow on settings', (await overflow()) === 0);

await page.fill('#s-tagline', `Tagline ${TAG}`);
await page.waitForTimeout(300);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2000);
const st = await fetch(`${BASE}/api/settings`).then((r) => r.json());
ok('settings persisted to DB', st.tagline === `Tagline ${TAG}`, st.tagline);
await page.screenshot({ path: '.qa/shots/admin-settings.png', fullPage: true });
// restore
await page.fill('#s-tagline', 'Consultants & Developers • CBE');
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(1800);

console.log('\n=== DELETE + LOGOUT ===');
await page.goto(`${BASE}/admin/properties/${propId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('button:has-text("Delete property")').first().click();
await page.waitForTimeout(700);
body = await page.locator('body').innerText();
ok('confirm dialog appears', /cannot be undone|permanently/i.test(body));
await page.locator('button:has-text("Delete permanently")').first().click();
await page.waitForTimeout(2400);
ok('redirected to list after delete', page.url().endsWith('/admin/properties'));
const after = await fetch(`${BASE}/api/properties?search=${TAG}`).then((r) => r.json());
ok('property gone from public API', after.total === 0, `total=${after.total}`);

console.log('\n=== MOBILE ADMIN ===');
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mob.newPage();
await mp.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await mp.fill('input[type="email"]', EMAIL);
await mp.fill('input[type="password"]', PASSWORD);
await mp.click('button[type="submit"]');
await mp.waitForTimeout(2600);
const mobOverflow = await mp.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
ok('mobile dashboard no overflow', mobOverflow === 0, `${mobOverflow}px`);
await mp.screenshot({ path: '.qa/shots/admin-mobile-dashboard.png', fullPage: true });
for (const [path, label] of [['/admin/properties', 'list'], ['/admin/enquiries', 'enquiries'], ['/admin/properties/new', 'form']]) {
  await mp.goto(BASE + path, { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1100);
  const o = await mp.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  ok(`mobile ${label} no overflow`, o === 0, `${o}px`);
  await mp.screenshot({ path: `.qa/shots/admin-mobile-${label}.png`, fullPage: true });
}
await mob.close();

// logout
await page.locator('button:has-text("Sign out"), button:has-text("Log out"), button:has-text("Logout")').first().click();
await page.waitForTimeout(2000);
ok('logout returns to login screen', await page.locator('input[type="password"]').isVisible());

const realErrors = consoleErrors.filter((e) => !/401/.test(e));
ok('no console errors during admin flow', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

await browser.close();
console.log(`\n${'='.repeat(52)}\n  PASSED: ${pass}   FAILED: ${fail}`);
if (errs.length) console.log('  Failing:\n   - ' + errs.join('\n   - '));
console.log('='.repeat(52) + '\n');
process.exit(fail ? 1 : 0);
