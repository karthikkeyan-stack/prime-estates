/**
 * End-to-end API test suite for Prime Estates.
 * Run against a live dev server:  node .qa/api-test.mjs
 */
const BASE = process.env.BASE || 'http://localhost:3000';
let cookie = '';
let pass = 0, fail = 0;
const TAG = `QA${Date.now().toString(36).slice(-5)}`;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name} ${detail}`); }
}

async function req(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...init.headers },
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body, text, headers: res.headers };
}

const PNG_1x1 = 'data:image/png;base64,' + Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005fb02fe3a0f8a6e0000000049454e44ae426082',
  'hex',
).toString('base64');

console.log('\n=== PUBLIC API ===');
{
  const health = await req('/api/health');
  ok('health endpoint returns ok', health.status === 200 && health.body.ok === true);

  const list = await req('/api/properties?limit=5');
  ok('property list paginates', list.status === 200 && list.body.data.length === 5 && list.body.total >= 18);
  ok('list does not leak full description', !('description' in (list.body.data[0] || {})));

  const villa = await req('/api/properties?type=villa&listing=sale');
  ok('filter type+listing works', villa.body.data.every((p) => p.property_type === 'villa' && p.listing_type === 'sale'));

  const ooty = await req('/api/properties?location=ooty');
  ok('filter by location works', ooty.body.total > 0 && ooty.body.data.every((p) => p.location_slug === 'ooty'));

  const priced = await req('/api/properties?min_price=10000000&max_price=50000000');
  ok('price range filter works', priced.body.data.every((p) => +p.price >= 1e7 && +p.price <= 5e7));

  const beds = await req('/api/properties?bedrooms=4');
  ok('bedroom filter works', beds.body.data.every((p) => p.bedrooms >= 4));

  const asc = await req('/api/properties?sort=price_asc&limit=10');
  const prices = asc.body.data.map((p) => +p.price);
  ok('sort price ascending', prices.every((v, i) => i === 0 || prices[i - 1] <= v));

  const desc = await req('/api/properties?sort=price_desc&limit=10');
  const dprices = desc.body.data.map((p) => +p.price);
  ok('sort price descending', dprices.every((v, i) => i === 0 || dprices[i - 1] >= v));

  const search = await req('/api/properties?search=coimbatore');
  ok('text search works', search.body.total > 0);

  const combo = await req('/api/properties?type=plot,farmhouse&listing=sale&sort=newest');
  ok('multi-type filter works', combo.body.data.every((p) => ['plot', 'farmhouse'].includes(p.property_type)));

  const p2 = await req('/api/properties?limit=5&page=2');
  ok('pagination page 2 differs', p2.body.page === 2 && p2.body.data[0]?.id !== list.body.data[0]?.id);

  const facets = await req('/api/properties/facets');
  ok('facets return counts', facets.body.byType.length > 0 && facets.body.byListing.length > 0);

  const detail = await req('/api/properties/the-kensington-manor');
  ok('property detail by slug', detail.status === 200 && detail.body.title === 'The Kensington Manor');
  ok('detail includes images array', Array.isArray(detail.body.images) && detail.body.images.length > 0);
  ok('detail includes related', Array.isArray(detail.body.related));
  ok('detail includes amenities', Array.isArray(detail.body.amenities) && detail.body.amenities.length > 0);

  const missing = await req('/api/properties/this-does-not-exist');
  ok('unknown slug returns 404', missing.status === 404);

  const settings = await req('/api/settings');
  ok('settings endpoint works', settings.body.business_name === 'Prime Estates');
  ok('email intentionally blank (not invented)', settings.body.email === '');
  ok('address intentionally blank (not invented)', settings.body.address === '');

  const cats = await req('/api/categories');
  ok('categories carry live counts', cats.body.length > 0 && typeof cats.body[0].property_count === 'number');

  const locs = await req('/api/locations');
  ok('locations carry live counts', locs.body.length === 6);

  const svc = await req('/api/services');
  ok('services endpoint works', svc.body.length >= 7);

  const gal = await req('/api/gallery');
  ok('gallery endpoint works', gal.body.length >= 10);

  const sitemap = await req('/api/seo/sitemap.xml');
  ok('sitemap generates XML', sitemap.status === 200 && sitemap.text.includes('<urlset') && sitemap.text.includes('/properties/'));

  const robots = await req('/robots.txt');
  ok('robots.txt served', robots.status === 200 && robots.text.includes('Disallow: /admin'));
}

console.log('\n=== ENQUIRY (public write) ===');
{
  const bad = await req('/api/enquiries', { method: 'POST', body: JSON.stringify({ name: 'x', phone: '1' }) });
  ok('enquiry validation rejects bad input', bad.status === 400 && bad.body.errors.name && bad.body.errors.phone);

  const good = await req('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({ name: 'QA Tester', phone: '9876543210', email: 'qa@example.com', message: 'Automated test enquiry', property_id: 1, source: 'qa' }),
  });
  ok('enquiry created', good.status === 201 && good.body.ok === true);

  const badEmail = await req('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({ name: 'QA Tester', phone: '9876543210', email: 'not-an-email' }),
  });
  ok('invalid email rejected', badEmail.status === 400 && !!badEmail.body.errors.email);
}

console.log('\n=== SECURITY: unauthenticated admin ===');
{
  for (const ep of ['/api/admin/stats', '/api/admin/properties', '/api/admin/enquiries']) {
    const r = await req(ep);
    ok(`GET ${ep} blocked`, r.status === 401);
  }
  const post = await req('/api/admin/properties', { method: 'POST', body: JSON.stringify({ title: 'hack' }) });
  ok('POST property blocked', post.status === 401);
  const put = await req('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ phone: '000' }) });
  ok('PUT settings blocked', put.status === 401);
  const del = await req('/api/admin/properties/1', { method: 'DELETE' });
  ok('DELETE property blocked', del.status === 401);
  const badLogin = await req('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: 'admin@primeestates.in', password: 'wrong' }) });
  ok('wrong password rejected', badLogin.status === 401);
  const noUser = await req('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@x.com', password: 'whatever' }) });
  ok('unknown user rejected', noUser.status === 401);
}

console.log('\n=== ADMIN: authenticated ===');
let pid = null;
{
  const login = await req('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  ok('login succeeds', login.status === 200 && login.body.user.email);
  ok('session cookie is HttpOnly', /HttpOnly/i.test(login.headers.get('set-cookie') || ''));
  ok('session cookie is SameSite=Lax', /SameSite=Lax/i.test(login.headers.get('set-cookie') || ''));

  const me = await req('/api/admin/me');
  ok('session recognised', me.status === 200 && me.body.user.role === 'admin');

  const stats = await req('/api/admin/stats');
  ok('dashboard stats from DB', stats.status === 200 && stats.body.stats.total_properties >= 18);
  ok('stats include enquiry counts', stats.body.stats.enquiries >= 1);
  ok('recent enquiries present', stats.body.recentEnquiries.length >= 1);
  ok('recent properties present', stats.body.recentProperties.length > 0);

  const invalid = await req('/api/admin/properties', { method: 'POST', body: JSON.stringify({ title: '', price: 'abc' }) });
  ok('create validation returns field errors', invalid.status === 400 && !!invalid.body.errors.title && !!invalid.body.errors.price);

  const created = await req('/api/admin/properties', {
    method: 'POST',
    body: JSON.stringify({
      title: `QA Test Villa ${TAG}`, property_type: 'villa', listing_type: 'sale', status: 'available',
      price: 9900000, location: 'Vadavalli, Coimbatore', location_slug: 'coimbatore',
      bedrooms: 3, bathrooms: 3, property_area: 2400, property_area_unit: 'sqft',
      short_description: 'QA created listing.', amenities: ['Lift', 'Borewell'], published: true,
    }),
  });
  pid = created.body.id;
  ok('property created', created.status === 201 && !!pid);
  ok('slug auto-generated', created.body.slug === `qa-test-villa-${TAG.toLowerCase()}`);
  ok('price auto-formatted', created.body.price_display === '₹99 Lakh');
  ok('amenities stored as array', Array.isArray(created.body.amenities) && created.body.amenities.length === 2);

  const dupe = await req('/api/admin/properties', {
    method: 'POST',
    body: JSON.stringify({ title: `QA Test Villa ${TAG}`, property_type: 'villa', listing_type: 'sale', status: 'available', price: 9900000, location: 'Vadavalli, Coimbatore' }),
  });
  ok('duplicate slug de-duplicated', dupe.body.slug === `qa-test-villa-${TAG.toLowerCase()}-2`);

  const img = await req(`/api/admin/properties/${pid}/images`, { method: 'POST', body: JSON.stringify({ data: PNG_1x1, alt: 'QA image' }) });
  ok('image uploaded', img.status === 201 && img.body.url.startsWith('/uploads/'));
  ok('first image becomes primary', img.body.is_primary === true);

  const badImg = await req(`/api/admin/properties/${pid}/images`, { method: 'POST', body: JSON.stringify({ data: 'data:application/x-sh;base64,ZWNobyBoYWNrZWQ=' }) });
  ok('non-image upload rejected', badImg.status === 400);

  const img2 = await req(`/api/admin/properties/${pid}/images`, { method: 'POST', body: JSON.stringify({ data: PNG_1x1, alt: 'QA image 2' }) });
  ok('second image uploaded', img2.status === 201 && img2.body.is_primary === false);

  const setPrimary = await req(`/api/admin/images/${img2.body.id}`, { method: 'PATCH', body: JSON.stringify({ is_primary: true }) });
  ok('primary image switched', setPrimary.body.is_primary === true);

  const afterPrimary = await req(`/api/admin/properties/${pid}`);
  ok('main_image follows primary', afterPrimary.body.main_image === img2.body.url);

  const delImg = await req(`/api/admin/images/${img.body.id}`, { method: 'DELETE' });
  ok('image deleted', delImg.status === 200);

  const edited = await req(`/api/admin/properties/${pid}`, {
    method: 'PUT',
    body: JSON.stringify({ ...afterPrimary.body, title: `QA Test Villa ${TAG} Edited`, price: 10500000, bedrooms: 4 }),
  });
  ok('property updated', edited.status === 200 && edited.body.bedrooms === 4);
  ok('price label recalculated on update', edited.body.price_display === '₹1.05 Cr', `got ${edited.body.price_display}`);
  ok('location_slug matched to a real region', created.body.location_slug === 'coimbatore', `got ${created.body.location_slug}`);

  const feat = await req(`/api/admin/properties/${pid}`, { method: 'PATCH', body: JSON.stringify({ featured: true }) });
  ok('featured toggled on', feat.body.featured === true);

  const unpub = await req(`/api/admin/properties/${pid}`, { method: 'PATCH', body: JSON.stringify({ published: false }) });
  ok('unpublish toggled', unpub.body.published === false);

  const hidden = await req(`/api/properties/${unpub.body.slug}`);
  ok('unpublished hidden from public API', hidden.status === 404);

  await req(`/api/admin/properties/${pid}`, { method: 'PATCH', body: JSON.stringify({ published: true }) });
  const visible = await req(`/api/properties/${unpub.body.slug}`);
  ok('republished visible on public API', visible.status === 200);

  const adminSearch = await req(`/api/admin/properties?search=${TAG}`);
  ok('admin search works', adminSearch.body.total >= 2);

  const adminFilter = await req('/api/admin/properties?featured=true');
  ok('admin featured filter works', adminFilter.body.data.every((p) => p.featured));

  const archived = await req(`/api/admin/properties/${pid}?mode=archive`, { method: 'DELETE' });
  ok('archive works', archived.body.archived === true);
  const archCheck = await req(`/api/admin/properties/${pid}`);
  ok('archived property unpublished', archCheck.body.status === 'archived' && archCheck.body.published === false);

  const enq = await req('/api/admin/enquiries');
  ok('admin enquiry list works', enq.status === 200 && enq.body.total >= 1);
  const eid = enq.body.data[0].id;
  const contacted = await req(`/api/admin/enquiries/${eid}`, { method: 'PATCH', body: JSON.stringify({ status: 'contacted', admin_notes: 'Called back' }) });
  ok('enquiry status updated', contacted.body.status === 'contacted' && contacted.body.admin_notes === 'Called back');
  const archEnq = await req(`/api/admin/enquiries/${eid}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
  ok('enquiry archived', archEnq.body.archived === true);
  const archList = await req('/api/admin/enquiries?archived=true');
  ok('archive filter works', archList.body.data.some((e) => e.id === eid));
  const enqSearch = await req('/api/admin/enquiries?search=QA%20Tester&archived=true');
  ok('enquiry search works', enqSearch.body.total >= 1);

  const settingsSave = await req('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ tagline: 'QA Tagline Test' }) });
  ok('settings saved', settingsSave.body.tagline === 'QA Tagline Test');
  const publicSettings = await req('/api/settings');
  ok('settings reflected publicly', publicSettings.body.tagline === 'QA Tagline Test');
  await req('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ tagline: 'Consultants & Developers • CBE' }) });

  // cleanup
  await req(`/api/admin/properties/${pid}`, { method: 'DELETE' });
  await req(`/api/admin/properties/${dupe.body.id}`, { method: 'DELETE' });
  await req(`/api/admin/enquiries/${eid}`, { method: 'DELETE' });
  const gone = await req(`/api/admin/properties/${pid}`);
  ok('property deleted (cleanup)', gone.status === 404);

  const logout = await req('/api/admin/logout', { method: 'POST' });
  ok('logout succeeds', logout.status === 200);
  cookie = '';
  const afterLogout = await req('/api/admin/stats');
  ok('session invalidated after logout', afterLogout.status === 401);
}

console.log(`\n${'='.repeat(46)}`);
console.log(`  PASSED: ${pass}   FAILED: ${fail}`);
if (failures.length) console.log('  Failing:\n   - ' + failures.join('\n   - '));
console.log('='.repeat(46) + '\n');
process.exit(fail ? 1 : 0);
