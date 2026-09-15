import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4178';
const WIDTHS = (process.env.WIDTHS || '320,360,375,390,412,430,480,768,820,1024,1280,1440,1920').split(',').map(Number);
const ROUTES = (process.env.ROUTES || '/,/properties,/about,/services,/locations,/gallery,/contact,/enquire,/properties/the-kensington-manor,/nope-404').split(',');
const MOBILE_MAX = 820;
const browser = await chromium.launch();

const ctxFor = (w) => { const m = w <= MOBILE_MAX; return {
  viewport:{width:w,height:m?844:900}, isMobile:m, hasTouch:m, deviceScaleFactor:m?3:1,
  userAgent:m?'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36':undefined }; };

const rows = [];
for (const w of WIDTHS) {
  const ctx = await browser.newContext(ctxFor(w));
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,120)); });
  page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,120)));
  for (const route of ROUTES) {
    await page.goto(BASE+route,{waitUntil:'networkidle',timeout:45000});
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const prev = de.style.overflowX;
      de.style.setProperty('overflow-x','visible','important');  // unmask true overflow
      void de.offsetWidth;
      const vw = de.clientWidth;
      const trueOverflow = de.scrollWidth - vw;
      const bad = [];
      const inScroller = (el) => { // ignore intentional horizontal scrollers
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll') return true;
          if (o === 'hidden') return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0') continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        if (el.classList.contains('sr-only')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width===0 && rect.height===0) continue;
        if (rect.right > vw + 1.5 && !inScroller(el)) {
          bad.push({ tag:el.tagName.toLowerCase(), cls:String(el.className||'').slice(0,60),
                     right:Math.round(rect.right), over:Math.round(rect.right-vw), pos:cs.position });
        }
      }
      de.style.overflowX = prev;
      const seen=new Set();
      const uniq = bad.filter(b=>{const k=b.tag+b.cls;if(seen.has(k))return false;seen.add(k);return true;})
                      .sort((a,b)=>b.over-a.over).slice(0,5);
      return { trueOverflow, uniq };
    });
    if (r.trueOverflow > 1 || r.uniq.length || errs.length) {
      rows.push({ w, route, ...r, errs:[...errs] });
    }
    errs.length = 0;
  }
  await ctx.close();
}
await browser.close();
console.log('=========== TRUE OVERFLOW (guard removed) ===========');
if(!rows.length) console.log('CLEAN — no real overflow, no console errors.');
for (const r of rows) {
  console.log(`\n${String(r.w).padStart(4)}px ${r.route}   overflow=${r.trueOverflow}px`);
  for (const b of r.uniq) console.log(`      +${String(b.over).padStart(4)}px <${b.tag}> ${b.pos} .${b.cls}`);
  for (const e of r.errs) console.log(`      console: ${e}`);
}
