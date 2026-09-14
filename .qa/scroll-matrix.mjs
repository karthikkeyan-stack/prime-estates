import { chromium } from 'playwright';
const BASE='http://localhost:4178';
const WIDTHS=[320,360,375,390,412,430,480,768,820];
const ROUTES=['/','/properties','/about','/services','/locations','/gallery','/contact','/enquire','/properties/the-kensington-manor'];
const browser=await chromium.launch();
async function swipe(page,x,y0,y1,steps=14){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y0}]});
  const dy=(y1-y0)/steps;
  for(let i=1;i<=steps;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.round(y0+dy*i)}]});await new Promise(r=>setTimeout(r,16));}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
let pass=0, fail=0;
for(const w of WIDTHS){
  const ctx=await browser.newContext({viewport:{width:w,height:800},isMobile:true,hasTouch:true,deviceScaleFactor:1,
    userAgent:'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
  const page=await ctx.newPage();
  const line=[];
  for(const r of ROUTES){
    await page.goto(BASE+r,{waitUntil:'networkidle',timeout:45000});
    await page.waitForTimeout(450);
    await page.evaluate(()=>window.scrollTo(0,0));
    await swipe(page,Math.round(w/2),700,180);
    await page.waitForTimeout(650);
    const s=await page.evaluate(()=>({y:window.scrollY,max:document.documentElement.scrollHeight-document.documentElement.clientHeight}));
    const ok = s.max<5 ? true : s.y>0;
    ok?pass++:fail++;
    line.push(`${r.replace('/properties/the-kensington-manor','/detail')}:${ok?'✓':'✗('+s.y+'/'+s.max+')'}`);
  }
  console.log(`${String(w).padStart(4)}px  ${line.join('  ')}`);
  await ctx.close();
}
await browser.close();
console.log(`\nTOUCH SCROLL: ${pass} passed, ${fail} failed`);
