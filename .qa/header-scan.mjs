import { chromium } from 'playwright';
const browser = await chromium.launch();
console.log('  W  | logoW | actionsW | avail | menuBtn right | onScreen | tagline shown');
console.log('-----+-------+----------+-------+---------------+----------+--------------');
for (const w of [320,360,375,390,412,430,480,640,768,820,1024,1280,1440,1920]) {
  const m = w <= 820;
  const ctx = await browser.newContext({viewport:{width:w,height:860},isMobile:m,hasTouch:m,deviceScaleFactor:m?3:1,
    userAgent:m?'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36':undefined});
  const page = await ctx.newPage();
  await page.goto('http://localhost:4178/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bar = document.querySelector('header .max-w-shell.h-full');
    const logo = bar.querySelector('a[aria-label$="home"]');
    const actions = bar.lastElementChild;
    const btn = document.querySelector('button[aria-label="Open menu"]');
    const tag = logo.querySelector('span.flex.flex-col > span:last-child');
    const lr = logo.getBoundingClientRect(), ar = actions.getBoundingClientRect();
    const br = btn ? btn.getBoundingClientRect() : null;
    return { vw, logoW: Math.round(lr.width), actionsW: Math.round(ar.width),
      btnRight: br ? Math.round(br.right) : null,
      onScreen: br ? br.right <= vw + 0.5 : 'n/a',
      tagVisible: tag ? getComputedStyle(tag).display !== 'none' && tag.getBoundingClientRect().width > 0 : false };
  });
  const avail = r.vw - 32 - r.actionsW - 16;
  const flag = r.onScreen === false ? '  <<< OFF-SCREEN' : '';
  console.log(`${String(w).padStart(4)} | ${String(r.logoW).padStart(5)} | ${String(r.actionsW).padStart(8)} | ${String(avail).padStart(5)} | ${String(r.btnRight).padStart(13)} | ${String(r.onScreen).padStart(8)} | ${r.tagVisible}${flag}`);
  await ctx.close();
}
await browser.close();
