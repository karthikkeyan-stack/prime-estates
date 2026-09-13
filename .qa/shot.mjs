import { chromium } from 'playwright';
const [,, url, out, w = '1440', h = '1000', full = 'true'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2200);
// force all scroll reveals visible for the screenshot
await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible')));
await page.waitForTimeout(700);
await page.screenshot({ path: out, fullPage: full === 'true' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(JSON.stringify({ overflowPx: overflow, errors }, null, 2));
await browser.close();
