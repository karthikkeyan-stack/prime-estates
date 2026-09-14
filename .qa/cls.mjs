import { chromium } from 'playwright';
const BASE='http://localhost:4010';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}});
const p=await ctx.newPage();
const cdp=await ctx.newCDPSession(p);
await cdp.send('Network.emulateNetworkConditions',{offline:false,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8,latency:150});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await p.addInitScript(()=>{
  window.__sh=[];
  new PerformanceObserver(l=>{
    for(const e of l.getEntries()){
      if(e.hadRecentInput) continue;
      for(const s of (e.sources||[])){
        window.__sh.push({
          v:+e.value.toFixed(4),
          node:(s.node&&s.node.nodeName)||'?',
          cls:((s.node&&s.node.className)||'').toString().slice(0,80),
          txt:((s.node&&s.node.textContent)||'').trim().slice(0,60),
          py:s.previousRect&&Math.round(s.previousRect.y), cy:s.currentRect&&Math.round(s.currentRect.y),
          ph:s.previousRect&&Math.round(s.previousRect.height), ch:s.currentRect&&Math.round(s.currentRect.height),
        });
      }
    }
  }).observe({type:'layout-shift',buffered:true});
});
await p.goto(BASE+(process.argv[2]||'/'),{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(3000);
const sh=await p.evaluate(()=>window.__sh);
console.log(`\n${process.argv[2]} — ${sh.length} shift sources`);
sh.sort((a,b)=>b.v-a.v).slice(0,6).forEach(s=>{
  console.log(`  ${s.v}  <${s.node}>  y:${s.py}->${s.cy}  h:${s.ph}->${s.ch}`);
  console.log(`        class=${s.cls}`);
  if(s.txt) console.log(`        text=${s.txt}`);
});
await b.close();
