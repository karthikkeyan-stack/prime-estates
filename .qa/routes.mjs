/**
 * Walks every public route at desktop + mobile widths.
 * Reports console errors, page errors, failed requests and horizontal overflow.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000';
const ROUTES = [
  ['/', 'home'],
  ['/properties', 'properties'],
  ['/properties?type=villa&listing=sale', 'properties-filtered'],
  ['/properties?location=coimbatore&sort=price_desc&page=2', 'properties-page2'],
  ['/properties?search=nothingmatchesthis', 'properties-empty'],
  ['/properties/the-kensington-manor', 'detail'],
  ['/properties/perundurai-logistics-warehouse', 'detail-lease'],
  ['/about', 'about'],
  ['/services', 'services'],
  ['/locations', 'locations'],
  ['/gallery', 'gallery'],
  ['/contact', 'contact'],
  ['/this-route-does-not-exist', '404'],
  ['/admin', 'admin-login'],
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

const IGNORE = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[vite\] connect/i,
];

const browser = await chromium.launch();
let problems = 0;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  console.log(`\n${'='.repeat(64)}\n  ${vp.name.toUpperCase()}  ${vp.width}x${vp.height}\n${'='.repeat(64)}`);

  for (const [route, label] of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') {
        const t = m.text();
        if (!IGNORE.some((re) => re.test(t))) errors.push(`[${m.type()}] ${t}`);
      }
    });
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    page.on('requestfailed', (r) => {
      const f = r.failure()?.errorText || '';
      if (!IGNORE.some((re) => re.test(r.url())) && !/ERR_ABORTED/.test(f)) {
        errors.push(`[requestfailed] ${r.url().replace(BASE, '')} — ${f}`);
      }
    });

    let status = 0;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      status = resp?.status() ?? 0;
    } catch (e) {
      errors.push(`[navigation] ${e.message}`);
    }

    // Reveal animations so content is measurable
    await page.evaluate(() => {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    });
    await page.waitForTimeout(350);

    const metrics = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = Math.max(0, de.scrollWidth - de.clientWidth);
      let culprit = null;
      if (overflow > 0) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > de.clientWidth + 1 && r.width > 0) {
            culprit = `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} right=${Math.round(r.right)}`;
            break;
          }
        }
      }
      const h1s = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 60));
      const imgs = [...document.querySelectorAll('img')];
      return {
        overflow,
        culprit,
        title: document.title,
        desc: document.querySelector('meta[name="description"]')?.content?.slice(0, 60) || '',
        canonical: !!document.querySelector('link[rel="canonical"]'),
        og: !!document.querySelector('meta[property="og:title"]'),
        h1Count: h1s.length,
        h1: h1s[0] || '(none)',
        imgCount: imgs.length,
        imgNoAlt: imgs.filter((i) => !i.getAttribute('alt')).length,
        imgBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
        // Only skeletons inside the viewport matter: below-the-fold ones
        // are correct behaviour for lazy-loaded images.
        skeletons: [...document.querySelectorAll('.skeleton')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
        }).length,
        bodyChars: document.body.innerText.length,
      };
    });

    const bad = [];
    if (status >= 400) bad.push(`HTTP ${status}`);
    if (metrics.overflow > 0) bad.push(`OVERFLOW ${metrics.overflow}px (${metrics.culprit})`);
    if (metrics.h1Count !== 1) bad.push(`${metrics.h1Count} <h1>`);
    if (metrics.imgNoAlt > 0) bad.push(`${metrics.imgNoAlt} img without alt`);
    if (metrics.imgBroken > 0) bad.push(`${metrics.imgBroken} broken img`);
    if (metrics.skeletons > 0) bad.push(`${metrics.skeletons} skeleton stuck in viewport`);
    if (metrics.bodyChars < 140) bad.push(`thin content (${metrics.bodyChars} chars)`);
    if (!metrics.canonical) bad.push('no canonical');
    if (!metrics.og) bad.push('no og:title');
    if (errors.length) bad.push(...errors.slice(0, 4));

    if (bad.length) problems++;
    const mark = bad.length ? '✗' : '✓';
    console.log(`${mark} ${route}`);
    console.log(`    h1="${metrics.h1}" imgs=${metrics.imgCount} title="${metrics.title.slice(0, 52)}"`);
    if (bad.length) bad.forEach((b) => console.log(`    → ${b}`));

    if (vp.name === 'desktop' || ['home', 'properties', 'detail', 'contact'].includes(label)) {
      await page.screenshot({ path: `.qa/shots/${vp.name}-${label}.png`, fullPage: vp.name === 'desktop' });
    }
    await page.close();
  }
  await context.close();
}

await browser.close();
console.log(`\n${'='.repeat(64)}`);
console.log(problems === 0 ? '  ALL ROUTES CLEAN' : `  ${problems} route/viewport combos need attention`);
console.log('='.repeat(64) + '\n');
process.exit(problems ? 1 : 0);
