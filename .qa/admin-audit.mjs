import { chromium } from 'playwright';
const BASE = 'http://localhost:4178';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASS) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.');
const WIDTHS = (process.env.WIDTHS || '320,360,375,390,412,480,768,820,1024,1280,1440,1920').split(',').map(Number);
const browser = await chromium.launch();
const findings = [];

for (const w of WIDTHS) {
  const m = w <= 820;
  const ctx = await browser.newContext({viewport:{width:w,height:m?844:900},isMobile:m,hasTouch:m,deviceScaleFactor:1,
    userAgent:m?'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36':undefined});
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', e => { if (e.type()==='error') errs.push(e.text().slice(0,110)); });
  page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,110)));

  // login
  await page.goto(BASE+'/admin', { waitUntil:'networkidle', timeout:45000 });
  await page.waitForTimeout(500);
  const needsLogin = await page.locator('input[type="password"]').count();
  if (needsLogin) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1200);
  }
  const loggedIn = !(await page.locator('input[type="password"]').count());

  const ROUTES = ['/admin','/admin/properties','/admin/properties/new','/admin/enquiries','/admin/analytics','/admin/settings'];
  for (const route of ROUTES) {
    await page.goto(BASE+route, { waitUntil:'networkidle', timeout:45000 });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const prev = de.style.overflowX;
      de.style.setProperty('overflow-x','visible','important');
      void de.offsetWidth;
      const vw = de.clientWidth;
      const trueOverflow = de.scrollWidth - vw;
      const inScroller = (el) => { for (let p=el.parentElement;p;p=p.parentElement){const o=getComputedStyle(p).overflowX; if(o==='auto'||o==='scroll'||o==='hidden')return true;} return false; };
      const bad=[];
      for (const el of document.querySelectorAll('body *')) {
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')continue;
        if(el.classList.contains('sr-only'))continue;
        const q=el.getBoundingClientRect();
        if(q.width===0&&q.height===0)continue;
        if(q.right>vw+1.5 && !inScroller(el)) bad.push({tag:el.tagName.toLowerCase(),cls:String(el.className||'').slice(0,55),over:Math.round(q.right-vw),pos:cs.position});
      }
      de.style.overflowX = prev;
      const seen=new Set();
      return { trueOverflow, bad: bad.filter(b=>{const k=b.tag+b.cls;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>b.over-a.over).slice(0,5) };
    });
    if (r.trueOverflow>1 || r.bad.length || errs.length) findings.push({w,route,...r,errs:[...errs],loggedIn});
    errs.length=0;
  }
  await ctx.close();
}
await browser.close();
console.log('============ ADMIN RESPONSIVE FINDINGS ============');
if(!findings.length) console.log('CLEAN');
for(const f of findings){
  console.log(`\n${String(f.w).padStart(4)}px ${f.route}  overflow=${f.trueOverflow}px  loggedIn=${f.loggedIn}`);
  for(const b of f.bad) console.log(`      +${String(b.over).padStart(4)}px <${b.tag}> ${b.pos} .${b.cls}`);
  for(const e of f.errs) console.log(`      console: ${e}`);
}
