import { chromium } from 'playwright';
const browser=await chromium.launch();
console.log('=== LIVE DESKTOP: layout integrity 1280/1440/1920 ===');
for(const w of [1280,1440,1920]){
  const ctx=await browser.newContext({viewport:{width:w,height:900}});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message.slice(0,80)));
  await page.goto('https://prime-estates-lemon.vercel.app/',{waitUntil:'networkidle'});
  await page.waitForTimeout(900);
  const r=await page.evaluate(()=>{
    const de=document.documentElement;
    const nav=document.querySelector('nav[aria-label="Primary"]');
    const navVisible = nav && getComputedStyle(nav).display!=='none';
    const links = nav?nav.querySelectorAll('a').length:0;
    const burger=document.querySelector('button[aria-label="Open menu"]');
    const burgerHidden = !burger || getComputedStyle(burger).display==='none' || burger.getBoundingClientRect().width===0;
    const logo=document.querySelector('header a[aria-label$="home"]').getBoundingClientRect();
    return { overflow:de.scrollWidth-de.clientWidth, navVisible, links, burgerHidden, logoW:Math.round(logo.width),
             h1:(document.querySelector('h1')||{}).textContent?.trim().slice(0,40) };
  });
  // scroll works on desktop
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.mouse.move(600,400); await page.mouse.wheel(0,900); await page.waitForTimeout(700);
  const y=await page.evaluate(()=>window.scrollY);
  console.log(`  ${w}px: overflow=${r.overflow} | desktop nav ${r.navVisible?'shown':'HIDDEN ✗'} (${r.links} links) | hamburger ${r.burgerHidden?'hidden ✓':'VISIBLE ✗'} | logo=${r.logoW}px | wheel scroll=${y>0?'✓':'✗'} | errors=${errs.length}`);
  console.log(`         H1: "${r.h1}"`);
  await ctx.close();
}
await browser.close();
