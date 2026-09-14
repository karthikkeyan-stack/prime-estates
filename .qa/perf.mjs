import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4010';
const url = process.argv[2] || '/';
const throttle = process.argv[3] === 'slow';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, userAgent:'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile' });
const page = await ctx.newPage();
if (throttle) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions',{offline:false,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8,latency:150}); // Slow 4G
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4}); // low-end device
}
const reqs=[]; const errors=[];
page.on('response', async r=>{
  try{ const h=r.headers(); const len=+(h['content-length']||0);
    let size=len; if(!size){ try{ size=(await r.body()).length }catch{} }
    reqs.push({url:r.url(),status:r.status(),type:r.request().resourceType(),size,cache:h['cache-control']||''});
  }catch{}
});
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const t0=Date.now();
await page.goto(BASE+url,{waitUntil:'load',timeout:120000});
const loadMs=Date.now()-t0;
const metrics = await page.evaluate(()=>new Promise(res=>{
  const out={};
  const nav=performance.getEntriesByType('navigation')[0];
  out.ttfb=Math.round(nav.responseStart);
  out.domContentLoaded=Math.round(nav.domContentLoadedEventEnd);
  out.fcp=Math.round((performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||0);
  let lcp=0,cls=0;
  new PerformanceObserver(l=>{for(const e of l.getEntries())lcp=Math.max(lcp,e.startTime)}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)cls+=e.value}).observe({type:'layout-shift',buffered:true});
  setTimeout(()=>{out.lcp=Math.round(lcp);out.cls=+cls.toFixed(4);res(out)},2500);
}));
await page.waitForTimeout(1500);
const by={};let total=0;
for(const r of reqs){by[r.type]=by[r.type]||{n:0,bytes:0};by[r.type].n++;by[r.type].bytes+=r.size;total+=r.size}
console.log(`\n### ${url} ${throttle?'[Slow 4G + 4x CPU]':'[unthrottled]'}`);
console.log(`  load=${loadMs}ms TTFB=${metrics.ttfb}ms FCP=${metrics.fcp}ms LCP=${metrics.lcp}ms CLS=${metrics.cls}`);
console.log(`  requests=${reqs.length} transferred=${(total/1024).toFixed(0)} KB`);
for(const [k,v] of Object.entries(by).sort((a,b)=>b[1].bytes-a[1].bytes)) console.log(`    ${k.padEnd(12)} ${String(v.n).padStart(3)} req  ${(v.bytes/1024).toFixed(0).padStart(6)} KB`);
console.log('  --- heaviest ---');
for(const r of reqs.sort((a,b)=>b.size-a.size).slice(0,8)) console.log(`    ${(r.size/1024).toFixed(0).padStart(6)} KB  ${r.url.replace(BASE,'').slice(0,74)}`);
if(errors.length)console.log('  console errors:',errors.slice(0,3));
await b.close();
