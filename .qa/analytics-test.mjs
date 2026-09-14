/**
 * End-to-end verification of the analytics subsystem.
 * Exercises ingest -> storage -> aggregation -> admin reporting.
 */
const BASE = process.env.BASE || 'http://127.0.0.1:4015';
const EMAIL = process.env.ADMIN_EMAIL || 'ops@primeestates.test';
const PASS = process.env.ADMIN_PASSWORD || 'LocalProdTest#2026';

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n} ${extra}`)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const UA_BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const post = (path, body, ua = UA_DESKTOP, headers = {}) =>
  fetch(`${BASE}/api/analytics/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ua, ...headers },
    body: JSON.stringify(body),
  });

console.log('\n=== ANALYTICS END-TO-END ===\n');

// --- 1. ingest ---------------------------------------------------------
const sidA = `test-a-${Date.now()}`;
const sidB = `test-b-${Date.now()}`;
const vidA = `vis-a-${Date.now()}`;
const vidB = `vis-b-${Date.now()}`;

let r = await post('session', {
  session_id: sidA, visitor_id: vidA, landing_path: '/',
  referrer_host: 'www.google.com', is_returning: false, utm_source: 'gmb',
}, UA_MOBILE, { 'x-vercel-ip-country': 'IN', 'x-vercel-ip-city': 'Coimbatore' });
ok('POST /analytics/session returns 204 (never blocks the page)', r.status === 204, `got ${r.status}`);

await post('session', {
  session_id: sidB, visitor_id: vidB, landing_path: '/properties',
  referrer_host: 'www.facebook.com', is_returning: true,
}, UA_DESKTOP, { 'x-vercel-ip-country': 'IN' });

r = await post('pageview', { session_id: sidA, visitor_id: vidA, path: '/', title: 'Home' }, UA_MOBILE);
ok('POST /analytics/pageview returns 204', r.status === 204, `got ${r.status}`);

await post('pageview', { session_id: sidA, visitor_id: vidA, path: '/properties', title: 'Catalogue', dwell_ms: 4200 }, UA_MOBILE);
await post('pageview', { session_id: sidB, visitor_id: vidB, path: '/properties', title: 'Catalogue' }, UA_DESKTOP);

r = await post('event', { session_id: sidA, visitor_id: vidA, event_type: 'whatsapp_click', label: 'header' }, UA_MOBILE);
ok('POST /analytics/event returns 204', r.status === 204, `got ${r.status}`);
await post('event', { session_id: sidA, visitor_id: vidA, event_type: 'phone_click', label: 'footer' }, UA_MOBILE);
await post('event', { session_id: sidB, visitor_id: vidB, event_type: 'search', label: 'villa' }, UA_DESKTOP);

// --- 2. validation / abuse resistance ----------------------------------
r = await post('event', { session_id: sidA, visitor_id: vidA, event_type: 'not_a_real_event' }, UA_DESKTOP);
ok('unknown event_type is accepted but discarded', r.status === 204, `got ${r.status}`);

r = await post('pageview', { path: '/no-session' }, UA_DESKTOP);
ok('pageview without session id is discarded, not an error', r.status === 204, `got ${r.status}`);

const botSid = `bot-${Date.now()}`;
await post('session', { session_id: botSid, visitor_id: `botvis-${Date.now()}`, landing_path: '/' }, UA_BOT);
await post('pageview', { session_id: botSid, visitor_id: `botvis-${Date.now()}`, path: '/' }, UA_BOT);

// --- 3. property view attribution --------------------------------------
const list = await (await fetch(`${BASE}/api/properties?limit=1`)).json();
const prop = list.data[0];
await post('pageview', {
  session_id: sidA, visitor_id: vidA, path: `/properties/${prop.slug}`,
  title: prop.title, property_id: prop.id,
}, UA_MOBILE);

await sleep(900); // ingest is intentionally asynchronous

// --- 4. admin reporting -------------------------------------------------
const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
ok('admin login succeeds', login.status === 200 && cookie.includes('pe_session'), `status ${login.status}`);

const auth = { headers: { Cookie: cookie } };

r = await fetch(`${BASE}/api/admin/analytics?range=30d`, auth);
const a = await r.json();
ok('GET /admin/analytics returns 200', r.status === 200, `got ${r.status}`);
ok('summary counts our sessions', a.summary.sessions >= 2, `sessions=${a.summary?.sessions}`);
ok('summary counts unique visitors', a.summary.unique_visitors >= 2, `uv=${a.summary?.unique_visitors}`);
ok('summary counts page views', a.summary.page_views >= 4, `pv=${a.summary?.page_views}`);
ok('whatsapp clicks tracked', a.summary.whatsapp_clicks >= 1, `wa=${a.summary?.whatsapp_clicks}`);
ok('phone clicks tracked', a.summary.phone_clicks >= 1, `ph=${a.summary?.phone_clicks}`);
ok('searches tracked', a.summary.searches >= 1, `s=${a.summary?.searches}`);
ok('conversion rate is a number', typeof a.summary.conversion_rate === 'number');
ok('bot traffic excluded from sessions', !a.sources.some((x) => x.host === 'bot'), 'bot leaked');

ok('trend series is one point per day', Array.isArray(a.trend) && a.trend.length >= 28, `len=${a.trend?.length}`);
ok('trend points carry sessions/visitors/views', a.trend.every((d) => 'sessions' in d && 'visitors' in d && 'views' in d));

ok('top pages populated', a.topPages.some((p) => p.path === '/properties'), JSON.stringify(a.topPages?.slice(0, 3)));
ok('top properties attributed by id', a.topProperties.some((p) => p.property_id === prop.id), JSON.stringify(a.topProperties?.slice(0, 2)));
ok('referrer classified as search', a.sources.some((x) => x.source === 'search' && x.host === 'www.google.com'), JSON.stringify(a.sources?.slice(0, 3)));
ok('referrer classified as social', a.sources.some((x) => x.source === 'social'), JSON.stringify(a.sources?.slice(0, 3)));
ok('mobile device detected from UA', a.devices.some((d) => d.device === 'mobile' && d.sessions >= 1), JSON.stringify(a.devices));
ok('desktop device detected from UA', a.devices.some((d) => d.device === 'desktop' && d.sessions >= 1), JSON.stringify(a.devices));
ok('geo captured from edge headers', a.geo.some((g) => g.country === 'IN'), JSON.stringify(a.geo?.slice(0, 3)));
ok('recent activity feed populated', a.recent.length >= 3, `len=${a.recent?.length}`);

// --- 5. date ranges -----------------------------------------------------
for (const range of ['today', '7d', '30d', '90d']) {
  const rr = await fetch(`${BASE}/api/admin/analytics?range=${range}`, auth);
  const jj = await rr.json();
  ok(`range=${range} responds with a matching label`, rr.status === 200 && jj.range.label === range, `got ${jj.range?.label}`);
}
const today = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
r = await fetch(`${BASE}/api/admin/analytics?from=${weekAgo}&to=${today}`, auth);
const custom = await r.json();
ok('custom from/to range works', r.status === 200 && custom.range.label === 'custom', `got ${custom.range?.label}`);
ok('custom range still returns data', custom.summary.sessions >= 2, `sessions=${custom.summary?.sessions}`);

// --- 6. authorisation ---------------------------------------------------
r = await fetch(`${BASE}/api/admin/analytics?range=7d`);
ok('analytics requires auth (401 when anonymous)', r.status === 401, `got ${r.status}`);

// --- 7. dashboard stats -------------------------------------------------
r = await fetch(`${BASE}/api/admin/stats`, auth);
const st = (await r.json()).stats;
for (const k of ['total_visitors', 'visitors_today', 'page_views', 'whatsapp_clicks', 'phone_clicks', 'conversion_rate',
                 'total_properties', 'published', 'drafts', 'featured', 'enquiries', 'new_enquiries',
                 'followup_enquiries', 'qualified_enquiries', 'contact_submissions']) {
  ok(`dashboard stat "${k}" present`, st[k] !== undefined, 'missing');
}
ok('visitors_today counts today\'s visitors', st.visitors_today >= 2, `got ${st.visitors_today}`);

// --- 8. contact submissions --------------------------------------------
r = await fetch(`${BASE}/api/contact`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'QA Tester', phone: '9486122022', email: 'qa@example.com', subject: 'Site question', message: 'Testing the contact route.' }),
});
ok('POST /api/contact accepts a valid submission', r.status === 201, `got ${r.status}`);

r = await fetch(`${BASE}/api/contact`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'X', phone: 'abc' }),
});
ok('POST /api/contact rejects invalid input with 400', r.status === 400, `got ${r.status}`);

r = await fetch(`${BASE}/api/admin/contact-submissions`, auth);
const cs = await r.json();
ok('admin can list contact submissions', r.status === 200 && cs.data.length >= 1, `got ${r.status}`);

// --- 9. enquiry pipeline statuses ---------------------------------------
await fetch(`${BASE}/api/enquiries`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Pipeline Test', phone: '9486122022', message: 'status test' }),
});
const enqs = await (await fetch(`${BASE}/api/admin/enquiries?limit=1`, auth)).json();
const target = enqs.data[0];
for (const status of ['contacted', 'follow_up', 'qualified', 'closed', 'spam', 'new']) {
  const pr = await fetch(`${BASE}/api/admin/enquiries/${target.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status }),
  });
  const body = await pr.json();
  ok(`enquiry status "${status}" accepted`, pr.status === 200 && body.status === status, `got ${pr.status}/${body.status}`);
}

// --- 10. cleanup --------------------------------------------------------
await fetch(`${BASE}/api/admin/enquiries/${target.id}`, { method: 'DELETE', headers: { Cookie: cookie } });

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
