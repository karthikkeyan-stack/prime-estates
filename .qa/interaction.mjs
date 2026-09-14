import { chromium } from 'playwright';
const BASE='http://localhost:4178';
const browser=await chromium.launch();
async function swipe(page,x,y0,y1,steps=12){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y0}]});
  const dy=(y1-y0)/steps;
  for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.round(y0+dy*i)}]});await new Promise(r=>setTimeout(r,16));}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
let P=0,F=0;
const ok=(c,m)=>{ c?P++:F++; console.log(`   ${c?'PASS':'*** FAIL ***'}  ${m}`); };

for(const w of [320,390,768]){
  console.log(`\n=================== ${w}px ===================`);
  const ctx=await browser.newContext({viewport:{width:w,height:800},isMobile:true,hasTouch:true,deviceScaleFactor:1,
    userAgent:'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message.slice(0,90)));

  // ---- MOBILE MENU ----
  await page.goto(BASE+'/',{waitUntil:'networkidle'}); await page.waitForTimeout(500);
  const btn=page.locator('button[aria-label="Open menu"]');
  ok(await btn.isVisible(), 'hamburger visible');
  const bb=await btn.boundingBox();
  ok(bb && bb.right<=w+0.5, `hamburger inside viewport (right=${bb?Math.round(bb.right):'?'})`);
  await btn.click(); await page.waitForTimeout(600);
  ok(await page.locator('nav[aria-label="Mobile navigation"]').isVisible(), 'drawer opens');
  const lockedOv=await page.evaluate(()=>getComputedStyle(document.body).overflow);
  ok(lockedOv==='hidden', `body locked while drawer open (${lockedOv})`);
  // drawer's own list scrolls
  const drawerScrolls=await page.evaluate(()=>{const d=document.querySelector('nav[aria-label="Mobile navigation"] .overflow-y-auto');return !!d;});
  ok(drawerScrolls,'drawer body is scrollable container');
  await page.locator('button[aria-label="Close menu"]').click(); await page.waitForTimeout(600);
  ok(!(await page.locator('nav[aria-label="Mobile navigation"]').count()),'drawer closes');
  const rel=await page.evaluate(()=>({c:getComputedStyle(document.body).overflow,i:document.body.style.overflow||'(none)'}));
  ok(rel.c!=='hidden' && rel.i==='(none)', `scroll lock released (computed:${rel.c} inline:${rel.i})`);
  await page.evaluate(()=>window.scrollTo(0,0)); await swipe(page,Math.round(w/2),700,200); await page.waitForTimeout(650);
  ok(await page.evaluate(()=>window.scrollY)>0,'page scrolls after closing menu');

  // nav link works
  await btn.click(); await page.waitForTimeout(500);
  await page.locator('nav[aria-label="Mobile navigation"] a:has-text("Properties")').first().click();
  await page.waitForTimeout(1200);
  ok(page.url().includes('/properties'),'menu link navigates');
  ok(!(await page.locator('nav[aria-label="Mobile navigation"]').count()),'drawer auto-closes on navigate');
  const after=await page.evaluate(()=>document.body.style.overflow||'(none)');
  ok(after==='(none)','no lingering lock after route change');

  // ---- FILTER DRAWER ----
  await page.goto(BASE+'/properties',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  const fbtn=page.locator('button:has-text("Filters")').first();
  if(await fbtn.count()){
    await fbtn.click(); await page.waitForTimeout(700);
    const dlg=page.locator('.fixed.inset-0').last();
    ok(await dlg.isVisible(),'filter drawer opens');
    const fits=await page.evaluate(()=>{const d=document.querySelector('.lg\\:hidden.fixed.inset-0');if(!d)return true;const p=d.querySelector('div:nth-child(2)');if(!p)return true;const r=p.getBoundingClientRect();return r.right<=document.documentElement.clientWidth+1 && r.left>=-1;});
    ok(fits,'filter panel fits viewport');
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const relF=await page.evaluate(()=>document.body.style.overflow||'(none)');
    ok(relF==='(none)','filter drawer releases lock');
    await page.evaluate(()=>window.scrollTo(0,0)); await swipe(page,Math.round(w/2),700,200); await page.waitForTimeout(650);
    ok(await page.evaluate(()=>window.scrollY)>0,'scrolls after closing filters');
  } else console.log('   (no filter button at this width)');

  // ---- GALLERY LIGHTBOX ----
  await page.goto(BASE+'/gallery',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  const img=page.locator('main button img, main [role="button"] img').first();
  if(await img.count()){
    await img.click(); await page.waitForTimeout(800);
    const lb=await page.locator('[role="dialog"]').count();
    ok(lb>0,'lightbox opens');
    if(lb){
      await page.keyboard.press('Escape'); await page.waitForTimeout(700);
      ok(!(await page.locator('[role="dialog"]').count()),'lightbox closes');
      const relL=await page.evaluate(()=>document.body.style.overflow||'(none)');
      ok(relL==='(none)','lightbox releases lock');
      await page.evaluate(()=>window.scrollTo(0,0)); await swipe(page,Math.round(w/2),700,200); await page.waitForTimeout(650);
      ok(await page.evaluate(()=>window.scrollY)>0,'scrolls after lightbox close');
    }
  } else console.log('   (no gallery thumbs found)');

  // ---- CONTACT FORM ----
  await page.goto(BASE+'/contact',{waitUntil:'networkidle'}); await page.waitForTimeout(700);
  const fieldsFit=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;let bad=0;
    document.querySelectorAll('input,textarea,select,button').forEach(el=>{const r=el.getBoundingClientRect();if(r.width&&(r.right>vw+1.5||r.left<-1.5))bad++;});return bad;});
  ok(fieldsFit===0,`contact form fields fit (${fieldsFit} overflowing)`);
  const tap=await page.evaluate(()=>{let small=0;document.querySelectorAll('main button, main input[type=submit]').forEach(el=>{const r=el.getBoundingClientRect();if(r.height>0&&r.height<40)small++;});return small;});
  ok(tap===0,`submit/buttons >=40px tall (${tap} too small)`);

  // ---- CALL / WHATSAPP ----
  await page.goto(BASE+'/',{waitUntil:'networkidle'}); await page.waitForTimeout(600);
  const tel=await page.locator('a[href^="tel:"]').count();
  const wa=await page.locator('a[href*="wa.me"], a[href*="whatsapp"]').count();
  ok(tel>0,`tel: links present (${tel})`);
  ok(wa>0,`whatsapp links present (${wa})`);
  const telBox=await page.locator('a[href^="tel:"]').first().boundingBox();
  ok(!telBox||telBox.right<=w+1,'call button inside viewport');

  ok(errs.length===0, `no page errors (${errs.length})`);
  await ctx.close();
}
await browser.close();
console.log(`\n================ ${P} passed, ${F} failed ================`);
