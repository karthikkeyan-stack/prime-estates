// Hero + navbar verification across the required viewport matrix.
// Measures: horizontal overflow, header height, blank space above the H1,
// CTA visibility in the first viewport, tap-target sizes, console errors,
// and true text contrast (backdrop sampled with the text hidden).
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4178';

const VIEWPORTS = [
  { w: 320, h: 720, name: '320x720  small phone' },
  { w: 375, h: 812, name: '375x812  iPhone X' },
  { w: 390, h: 844, name: '390x844  iPhone 13' },
  { w: 430, h: 932, name: '430x932  iPhone Pro Max' },
  { w: 667, h: 375, name: '667x375  landscape phone' },
  { w: 768, h: 432, name: '768x432  landscape tablet' },
  { w: 1366, h: 768, name: '1366x768 laptop' },
  { w: 1440, h: 900, name: '1440x900 desktop' },
  { w: 1920, h: 1080, name: '1920x1080 wide' },
];

const srgb = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const lum = (r, g, b) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

const browser = await chromium.launch();
let pass = 0;
let fail = 0;
const failures = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const m = await page.evaluate(() => {
    // overflow-x:hidden on <html> masks real overflow - force it visible first
    const prevH = document.documentElement.style.overflowX;
    const prevB = document.body.style.overflowX;
    document.documentElement.style.setProperty('overflow-x', 'visible', 'important');
    document.body.style.setProperty('overflow-x', 'visible', 'important');
    const ovf = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
    document.documentElement.style.overflowX = prevH;
    document.body.style.overflowX = prevB;

    const q = (s) => document.querySelector(s);
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
    };
    const header = q('header');
    const h1 = q('h1');
    const hero = q('section');
    const primary = q('.hero-actions a[href$="/properties"], .hero-actions a[href*="properties"]');
    const secondary = q('.hero-actions a[target="_blank"]');
    const trust = q('.hero-trust');

    return {
      ovf,
      header: box(header),
      h1: box(h1),
      hero: box(hero),
      primary: box(primary),
      secondary: box(secondary),
      trust: box(trust),
      h1Text: h1 ? h1.innerText.replace(/\s+/g, ' ').trim() : null,
      h1Size: h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0,
      vh: window.innerHeight,
      navBg: getComputedStyle(q('header > div:nth-child(2)')).backgroundColor,
      hasVideo: !!q('section video'),
    };
  });

  // Contrast: hide hero text, screenshot backdrop, compare brightest pixel.
  await page.evaluate(() => {
    document.querySelectorAll('.hero-title, .hero-lede').forEach((el) => {
      el.style.visibility = 'hidden';
    });
  });
  const shot = await page.screenshot({
    clip: { x: m.h1.left, y: Math.max(0, m.h1.top), width: Math.max(1, m.h1.w), height: Math.max(1, m.h1.h) },
  });
  // Decode the PNG inside Chromium (no extra npm dependency) and return the
  // brightest backdrop pixel behind the headline.
  const brightest = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const s = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * s(d[i] / 255) + 0.7152 * s(d[i + 1] / 255) + 0.0722 * s(d[i + 2] / 255);
      if (l > max) max = l;
    }
    return max;
  }, shot.toString('base64'));
  const contrast = ratio(1.0, brightest); // white text vs brightest backdrop px

  const headerH = m.header.h;
  const gapAboveH1 = m.h1.top - headerH; // blank space between nav and headline
  const ctaInView = m.primary && m.primary.bottom <= m.vh + 1;
  const tapOk = !m.primary || m.primary.h >= 44;

  const checks = [
    ['no horizontal overflow', m.ovf === 0, `ovf=${m.ovf}px`],
    ['headline present', /find a place that feels like yours/i.test(m.h1Text || ''), m.h1Text],
    ['no big blank above H1', gapAboveH1 >= 0 && gapAboveH1 <= (vp.h <= 480 ? 120 : 210), `${Math.round(gapAboveH1)}px`],
    ['primary CTA in first screen', ctaInView, m.primary ? `bottom=${Math.round(m.primary.bottom)} vh=${m.vh}` : 'missing'],
    ['CTA tap target >=44px', tapOk, m.primary ? `${Math.round(m.primary.h)}px` : 'n/a'],
    ['headline not oversized', m.h1Size <= (vp.w < 400 ? 40 : vp.w < 768 ? 48 : 80), `${m.h1Size}px`],
    ['text contrast >= 4.5', contrast >= 4.5, `${contrast.toFixed(2)}:1`],
    ['no console errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none'],
  ];

  console.log(`\n${vp.name}  [nav ${m.navBg}${m.hasVideo ? ', video' : ', image'}]`);
  for (const [label, ok, detail] of checks) {
    console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(30)} ${detail}`);
    if (ok) pass++;
    else {
      fail++;
      failures.push(`${vp.name}: ${label} (${detail})`);
    }
  }

  await ctx.close();
}

await browser.close();
console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
if (failures.length) {
  console.log('FAILURES:');
  failures.forEach((f) => console.log('  - ' + f));
}
process.exit(fail ? 1 : 0);
