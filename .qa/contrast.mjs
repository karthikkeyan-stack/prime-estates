// Per-element contrast against the real rendered backdrop.
// Method: hide the element's text, screenshot the region behind it, take the
// BRIGHTEST pixel, and compare against the element's own foreground colour.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4178';
const VPS = [
  [390, 844, 'mobile 390'],
  [667, 375, 'landscape 667'],
  [1366, 768, 'laptop 1366'],
  [1440, 900, 'desktop 1440'],
];

const TARGETS = [
  ['.hero-title', 'H1'],
  ['.hero-lede', 'lede'],
  ['.hero-trust li:last-child span:last-child', 'trust text'],
  ['header nav a', 'nav link'],
  ['.hero-actions a:first-child', 'primary CTA'],
  ['.hero-actions a[target="_blank"]', 'secondary CTA'],
];

const s = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const L = (r, g, b) => 0.2126 * s(r / 255) + 0.7152 * s(g / 255) + 0.0722 * s(b / 255);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const b = await chromium.launch();
let worst = 99;
let worstLabel = '';
let fails = 0;

for (const [w, h, vname] of VPS) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  console.log(`\n${vname}`);

  for (const [sel, label] of TARGETS) {
    const info = await p.evaluate((q) => {
      const el = document.querySelector(q);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.top > window.innerHeight) return null;
      const cs = getComputedStyle(el);
      // If the element paints its OWN fully-opaque background (e.g. a solid
      // button), the text sits on that background, not on the photo behind
      // it. Sampling the photo would be meaningless, so report the opaque
      // colour and let the caller compare against it directly.
      const bg = cs.backgroundColor;
      const mm = bg.match(/\d+(\.\d+)?/g);
      const opaque = mm && (mm.length < 4 || Number(mm[3]) >= 0.99);
      return {
        x: r.left, y: Math.max(0, r.top), w: r.width, h: Math.min(r.height, window.innerHeight - r.top),
        color: cs.color, bg, opaque: !!opaque,
      };
    }, sel);
    if (!info) { console.log(`   --   ${label.padEnd(14)} not visible`); continue; }

    if (info.opaque) {
      const fg = info.color.match(/\d+(\.\d+)?/g).map(Number);
      const bgc = info.bg.match(/\d+(\.\d+)?/g).map(Number);
      const cr = ratio(L(fg[0], fg[1], fg[2]), L(bgc[0], bgc[1], bgc[2]));
      const ok = cr >= 4.5;
      if (!ok) fails++;
      if (cr < worst) { worst = cr; worstLabel = `${vname} / ${label}`; }
      console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label.padEnd(14)} ${cr.toFixed(2)}:1  (solid bg)`);
      continue;
    }

    // hide only the text of this element
    await p.evaluate((q) => {
      const el = document.querySelector(q);
      el.dataset.prevVis = el.style.visibility;
      el.style.visibility = 'hidden';
    }, sel);

    const shot = await p.screenshot({
      clip: { x: info.x, y: info.y, width: Math.max(1, info.w), height: Math.max(1, info.h) },
    });
    const maxL = await p.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      const sr = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      let m = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.2126 * sr(d[i] / 255) + 0.7152 * sr(d[i + 1] / 255) + 0.0722 * sr(d[i + 2] / 255);
        if (l > m) m = l;
      }
      return m;
    }, shot.toString('base64'));

    await p.evaluate((q) => {
      const el = document.querySelector(q);
      el.style.visibility = el.dataset.prevVis || '';
    }, sel);

    const m = info.color.match(/\d+(\.\d+)?/g).map(Number);
    const fgL = L(m[0], m[1], m[2]);
    const cr = ratio(fgL, maxL);
    const ok = cr >= 4.5;
    if (!ok) fails++;
    if (cr < worst) { worst = cr; worstLabel = `${vname} / ${label}`; }
    console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label.padEnd(14)} ${cr.toFixed(2)}:1`);
  }
  await c.close();
}
await b.close();
console.log(`\nworst = ${worst.toFixed(2)}:1  (${worstLabel})   failures=${fails}`);
process.exit(fails ? 1 : 0);
