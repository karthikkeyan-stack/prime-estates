import { chromium } from 'playwright';
const BASE=process.env.BASE || 'http://localhost:4178';
const EMAIL=process.env.ADMIN_EMAIL, PASS=process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASS) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.');
const browser = await chromium.launch();

async function swipe(page,x,y0,y1,steps=14){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y0}]});
  const dy=(y1-y0)/steps;
  for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.round(y0+dy*i)}]});await new Promise(r=>setTimeout(r,16));}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}

for (const w of [320,390,768]) {
  console.log(`\n########## ADMIN @ ${w}px ##########`);
  const m = w<=820;
  const ctx=await browser.newContext({viewport:{width:w,height:844},isMobile:m,hasTouch:m,deviceScaleFactor:1,
    userAgent:'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
  const page=await ctx.newPage();
  await page.goto(BASE+'/admin',{waitUntil:'networkidle'});
  await page.waitForTimeout(500);

  // login form usable?
  const emailBox = await page.locator('input[type="email"]').boundingBox();
  const submitBox = await page.locator('button[type="submit"]').boundingBox();
  console.log(`  login email input: ${emailBox?Math.round(emailBox.width)+'x'+Math.round(emailBox.height):'?'}  submit: ${submitBox?Math.round(submitBox.width)+'x'+Math.round(submitBox.height):'?'}`);
  await page.fill('input[type="email"]',EMAIL);
  await page.fill('input[type="password"]',PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1800);
  const loggedIn = !(await page.locator('input[type="password"]').count());
  console.log(`  login -> ${loggedIn?'SUCCESS ✓':'*** FAILED ***'}`);
  if(!loggedIn){ await ctx.close(); continue; }

  // sidebar toggle on mobile
  if (m) {
    const toggle = page.locator('button[aria-label*="menu" i], button[aria-label*="sidebar" i], button[aria-label*="nav" i]').first();
    const has = await toggle.count();
    console.log(`  sidebar toggle present: ${has>0}`);
    if (has) {
      await toggle.click(); await page.waitForTimeout(600);
      const drawerVisible = await page.evaluate(()=>{
        const d=document.querySelector('.lg\\:hidden.fixed.inset-0');
        return !!d && getComputedStyle(d).display!=='none';
      });
      const bodyLocked = await page.evaluate(()=>getComputedStyle(document.body).overflow);
      console.log(`  sidebar opens: ${drawerVisible}  body overflow while open: ${bodyLocked}`);
      // close
      await page.keyboard.press('Escape'); await page.waitForTimeout(600);
      const afterClose = await page.evaluate(()=>({ ov:getComputedStyle(document.body).overflow, inline:document.body.style.overflow||'(none)' }));
      console.log(`  after close -> body overflow:${afterClose.ov} inline:${afterClose.inline}`);
      await page.evaluate(()=>window.scrollTo(0,0));
      await swipe(page,Math.round(w/2),700,200);
      await page.waitForTimeout(700);
      const y=await page.evaluate(()=>window.scrollY);
      console.log(`  scroll AFTER closing drawer: scrollY=${y} ${y>0?'✓':'(page may be short)'}`);
    }
  }

  // properties table
  await page.goto(BASE+'/admin/properties',{waitUntil:'networkidle'});
  await page.waitForTimeout(1000);
  const tbl = await page.evaluate(()=>{
    const t=document.querySelector('table');
    if(!t) return {table:false};
    const wrap=t.parentElement;
    const cs=getComputedStyle(wrap);
    return { table:true, tableW:Math.round(t.getBoundingClientRect().width),
      wrapW:Math.round(wrap.getBoundingClientRect().width), wrapOverflowX:cs.overflowX,
      scrollable: wrap.scrollWidth>wrap.clientWidth+2 };
  });
  console.log(`  properties table: ${JSON.stringify(tbl)}`);

  // vertical scroll on a long admin page
  await page.evaluate(()=>window.scrollTo(0,0));
  await swipe(page,Math.round(w/2),700,200);
  await page.waitForTimeout(700);
  const sy = await page.evaluate(()=>({y:window.scrollY, max:document.documentElement.scrollHeight-document.documentElement.clientHeight}));
  console.log(`  /admin/properties touch scroll: y=${sy.y} (max ${sy.max}) ${sy.max>0?(sy.y>0?'✓':'*** BLOCKED ***'):'(fits screen)'}`);

  // add-property form inputs fit
  await page.goto(BASE+'/admin/properties/new',{waitUntil:'networkidle'});
  await page.waitForTimeout(1000);
  const form = await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const over=[];
    document.querySelectorAll('input,select,textarea,button').forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width===0&&r.height===0) return;
      if(r.right>vw+1.5||r.left<-1.5) over.push(el.tagName.toLowerCase()+'.'+String(el.className||'').slice(0,30));
      });
    return { count:document.querySelectorAll('input,select,textarea').length, over:over.slice(0,5) };
  });
  console.log(`  add-property: ${form.count} fields, overflowing: ${form.over.length?form.over.join(', '):'none ✓'}`);
  await ctx.close();
}
await browser.close();
