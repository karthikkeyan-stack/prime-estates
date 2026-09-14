import { chromium } from 'playwright';
const BASE='http://localhost:4010';
const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const list=[];
p.on('response',async r=>{ let s=0; try{s=(await r.body()).length}catch{}; list.push([s,r.request().resourceType(),r.url().replace(BASE,'')]) });
await p.goto(BASE+process.argv[2],{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(2000);
console.log('\n'+process.argv[2]);
list.sort((a,b)=>b[0]-a[0]).slice(0,14).forEach(([s,t,u])=>console.log(`  ${(s/1024).toFixed(0).padStart(5)} KB ${t.padEnd(10)} ${u.slice(0,70)}`));
const imgs=list.filter(x=>x[1]==='image');
console.log(`  images: ${imgs.length} files, ${(imgs.reduce((a,b)=>a+b[0],0)/1024).toFixed(0)} KB`);
// CLS attribution
const shifts=await p.evaluate(()=>new Promise(res=>{
  const out=[];
  new PerformanceObserver(l=>{for(const e of l.getEntries()){ if(e.hadRecentInput)continue;
    for(const s of (e.sources||[])) out.push({v:+e.value.toFixed(4), node:(s.node&&s.node.nodeName)||'?', cls:(s.node&&s.node.className||'').toString().slice(0,60)});
  }}).observe({type:'layout-shift',buffered:true});
  setTimeout(()=>res(out),500);
}));
if(shifts.length){console.log('  --- layout shifts ---'); shifts.sort((a,b)=>b.v-a.v).slice(0,6).forEach(s=>console.log(`    ${s.v}  <${s.node}> ${s.cls}`));}
await b.close();
