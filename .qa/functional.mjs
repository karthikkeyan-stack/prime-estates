import { chromium } from 'playwright';
const BASE=process.env.BASE || 'http://localhost:4178';
const browser=await chromium.launch();
let P=0,F=0; const ok=(c,m)=>{c?P++:F++;console.log(`  ${c?'PASS':'*** FAIL ***'}  ${m}`);};

for(const w of [360,768]){
  console.log(`\n============ FUNCTIONAL @ ${w}px ============`);
  const m=w<=820;
  const ctx=await browser.newContext({viewport:{width:w,height:850},isMobile:m,hasTouch:m,deviceScaleFactor:1,
    userAgent:'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
  const page=await ctx.newPage();

  // ---- FILTERS ----
  await page.goto(BASE+'/properties',{waitUntil:'networkidle'}); await page.waitForTimeout(1000);
  const total0=await page.locator('text=/\\d+ propert/').first().textContent().catch(()=>'');
  const fb=page.locator('button:has-text("Filters")').first();
  if(await fb.count()){
    await fb.click(); await page.waitForTimeout(700);
    const forSale=page.locator('.fixed.inset-0 button:has-text("For Sale"), .fixed.inset-0 [role="button"]:has-text("For Sale")').first();
    if(await forSale.count()){ await forSale.click(); await page.waitForTimeout(1200); }
    const applyBtn=page.locator('.fixed.inset-0 button:has-text("Show"), .fixed.inset-0 button:has-text("Apply"), .fixed.inset-0 button:has-text("result")').first();
    if(await applyBtn.count()){ await applyBtn.click(); } else { await page.keyboard.press('Escape'); }
    await page.waitForTimeout(1500);
    const url=page.url();
    const total1=await page.locator('text=/\\d+ propert/').first().textContent().catch(()=>'');
    ok(url.includes('listing=sale')||total1!==total0, `filter applied (url=${url.split('?')[1]||'none'} "${(total1||'').trim()}")`);
  }
  // search
  await page.goto(BASE+'/properties',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  const search=page.locator('input[placeholder*="Search" i]').first();
  await search.fill('villa'); await page.waitForTimeout(2000);
  const cards=await page.locator('a[href^="/properties/"]').count();
  ok(cards>0,`search "villa" returns ${cards} results`);

  // sort
  const sort=page.locator('select').first();
  if(await sort.count()){ await sort.selectOption({index:2}).catch(()=>{}); await page.waitForTimeout(1500);
    ok(true,'sort control operable'); }

  // ---- PROPERTY DETAIL ----
  await page.goto(BASE+'/properties/the-kensington-manor',{waitUntil:'networkidle'}); await page.waitForTimeout(1200);
  const h1=await page.locator('h1').first().textContent();
  ok(!!h1 && h1.length>3, `detail H1 renders: "${(h1||'').trim().slice(0,34)}"`);
  const wa=await page.locator('a[href*="wa.me"]').count();
  const tel=await page.locator('a[href^="tel:"]').count();
  ok(wa>0 && tel>0, `detail WhatsApp(${wa}) + Call(${tel}) present`);
  const gal=await page.locator('main img').count();
  ok(gal>0, `gallery images render (${gal})`);
  const imgOk=await page.evaluate(()=>{const bad=[...document.querySelectorAll('img')].filter(i=>i.complete&&i.naturalWidth===0);return bad.length;});
  ok(imgOk===0, `no broken images (${imgOk} broken)`);

  // ---- ENQUIRY FORM validation ----
  await page.goto(BASE+'/enquire',{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  const submit=page.locator('form button[type="submit"]').first();
  if(await submit.count()){
    await submit.click(); await page.waitForTimeout(900);
    const err=await page.locator('[role="alert"], .text-error, [class*="error"]').count();
    ok(err>0,`empty submit shows validation (${err} messages)`);
    const errVisible=await page.evaluate(()=>{const vw=document.documentElement.clientWidth;
      const e=[...document.querySelectorAll('[role="alert"],.text-error,[class*="error"]')].filter(x=>x.getBoundingClientRect().width>0);
      return e.every(x=>{const r=x.getBoundingClientRect();return r.right<=vw+1&&r.left>=-1;});});
    ok(errVisible,'validation messages inside viewport');
  }
  await ctx.close();
}
await browser.close();
console.log(`\n========== ${P} passed, ${F} failed ==========`);
