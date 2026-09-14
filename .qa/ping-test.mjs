import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4015';
const b=await chromium.launch(); const c=await b.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }); const p=await c.newPage();
let pings=0;
p.on('request', r=>{ if (r.url().includes('/api/analytics/ping')) pings++; });
await p.goto(`${BASE}/`,{waitUntil:'networkidle'});
const sid = await p.evaluate(()=>sessionStorage.getItem('pe_sid'));
await p.waitForTimeout(2600);                  // dwell on a single page
// headless Chromium does not reliably emit pagehide on programmatic
// navigation, so dispatch it the way a real tab close would.
await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
await p.waitForTimeout(1200);
console.log('ping beacons sent:', pings);
await b.close();

const pg = (await import('pg')).default;
const { Client } = pg;
const cl = new Client({ connectionString:'postgresql://postgres@127.0.0.1:5433/prime_prod' });
await cl.connect();
const r = await cl.query('SELECT page_count, duration_ms FROM visitor_sessions WHERE id=$1',[sid]);
console.log('session row:', r.rows[0]);
console.log(Number(r.rows[0]?.duration_ms) >= 2000 ? 'PASS single-page session now has a real duration' : 'FAIL duration still ~0');
await cl.end();
