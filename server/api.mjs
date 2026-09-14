/**
 * Prime Estates REST API.
 *
 * Public endpoints are read-only + enquiry creation.
 * Every mutating admin endpoint sits behind requireAuth (server-side).
 * All filtering/sorting/pagination happens in PostgreSQL — the browser
 * never receives more than one page of rows.
 */
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, rows, one, driverKind } from './db.mjs';
import {
  ensureAdminUser, verifyPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie, readCookie, currentUser, requireAuth,
} from './auth.mjs';
import {
  decodeDataUri, putImage, removeImage, storageKind, storageHealth, assertStorageReady,
} from './storage.mjs';
import {
  recordSession, recordPageView, recordEvent, recordPing,
  resolveRange, analyticsSummary, analyticsBreakdown,
} from './analytics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const api = express.Router();
api.use(express.json({ limit: '25mb' }));

/* ========================= helpers ========================= */

const PROPERTY_TYPES = ['apartment','villa','independent-house','plot','commercial','office','shop','showroom','investment','farmhouse','other'];
const LISTING_TYPES  = ['sale','rent','lease'];
const STATUSES       = ['available','featured','sold','rented','draft','archived'];

const clampInt = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90);
}

/**
 * Known regions, refreshed from the DB on boot. A property's location_slug is
 * only set when the free text actually matches one of these; otherwise it is
 * left blank so it never pollutes the location facet with one-off values.
 */
const LOCATION_SLUGS = new Set();
const LOCATION_NAMES = [];

export async function refreshLocationCache() {
  try {
    const list = await rows('SELECT slug, name FROM locations ORDER BY sort_order, name');
    LOCATION_SLUGS.clear();
    LOCATION_NAMES.length = 0;
    for (const l of list) {
      LOCATION_SLUGS.add(l.slug);
      LOCATION_NAMES.push({ slug: l.slug, needle: String(l.name).toLowerCase() });
    }
  } catch { /* table not ready yet */ }
}

async function ensureLocationCache() {
  if (LOCATION_SLUGS.size === 0) await refreshLocationCache();
}

function matchLocationSlug(...candidates) {
  const hay = candidates.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return '';
  const hit = LOCATION_NAMES.find((l) => hay.includes(l.needle));
  return hit ? hit.slug : '';
}

async function uniqueSlug(base, ignoreId = null) {
  let slug = slugify(base) || `property-${Date.now()}`;
  let n = 1;
  for (;;) {
    const clash = await one(
      ignoreId
        ? 'SELECT id FROM properties WHERE slug = $1 AND id <> $2'
        : 'SELECT id FROM properties WHERE slug = $1',
      ignoreId ? [slug, ignoreId] : [slug],
    );
    if (!clash) return slug;
    slug = `${slugify(base)}-${++n}`;
  }
}

/** Indian-format price label: ₹4.25 Cr / ₹85 Lakh / ₹45,000 */
function formatPrice(value, listing, period) {
  const n = Number(value) || 0;
  let label;
  if (n >= 1e7) label = `₹${(n / 1e7).toFixed(2).replace(/\.00$/, '')} Cr`;
  else if (n >= 1e5) label = `₹${(n / 1e5).toFixed(2).replace(/\.00$/, '')} Lakh`;
  else label = `₹${n.toLocaleString('en-IN')}`;
  if (listing === 'rent' || listing === 'lease') label += period ? `/${period}` : '/month';
  return label;
}

const asArray = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);

/* ========================= settings ========================= */

async function settingsMap() {
  const list = await rows('SELECT key, value FROM site_settings');
  return Object.fromEntries(list.map((r) => [r.key, r.value]));
}

api.get('/settings', async (_req, res, next) => {
  try { res.json(await settingsMap()); } catch (e) { next(e); }
});

api.put('/admin/settings', requireAuth, async (req, res, next) => {
  try {
    const entries = Object.entries(req.body || {});
    for (const [key, value] of entries) {
      await query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1,$2,now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [String(key).slice(0, 80), String(value ?? '')],
      );
    }
    res.json(await settingsMap());
  } catch (e) { next(e); }
});

/* ========================= taxonomies ========================= */

api.get('/categories', async (_req, res, next) => {
  try {
    res.json(await rows(
      `SELECT c.*, (
         SELECT COUNT(*) FROM properties p
          WHERE p.property_type = c.slug AND p.published = TRUE AND p.status NOT IN ('sold','rented','archived','draft')
       )::int AS property_count
       FROM property_categories c WHERE c.active = TRUE ORDER BY c.sort_order, c.name`));
  } catch (e) { next(e); }
});

api.get('/locations', async (_req, res, next) => {
  try {
    res.json(await rows(
      `SELECT l.*, (
         SELECT COUNT(*) FROM properties p
          WHERE p.location_slug = l.slug AND p.published = TRUE AND p.status NOT IN ('sold','rented','archived','draft')
       )::int AS property_count
       FROM locations l WHERE l.active = TRUE ORDER BY l.sort_order, l.name`));
  } catch (e) { next(e); }
});

api.get('/services', async (_req, res, next) => {
  try { res.json(await rows('SELECT * FROM services WHERE active = TRUE ORDER BY sort_order, id')); }
  catch (e) { next(e); }
});

api.get('/gallery', async (_req, res, next) => {
  try { res.json(await rows('SELECT * FROM gallery_items WHERE active = TRUE ORDER BY sort_order, id')); }
  catch (e) { next(e); }
});

/* ========================= property search ========================= */
/**
 * GET /api/properties
 * Server-side filter + sort + paginate. Scales to 2,000+ rows because the
 * DB does the work and we return only `limit` rows plus a total count.
 */
api.get('/properties', async (req, res, next) => {
  try {
    const q = req.query;
    const where = ['p.published = TRUE', "p.status NOT IN ('draft','archived')"];
    const params = [];
    const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };

    if (q.listing && LISTING_TYPES.includes(q.listing)) add('p.listing_type = ?', q.listing);
    if (q.type) {
      const types = String(q.type).split(',').filter((t) => PROPERTY_TYPES.includes(t));
      if (types.length) { params.push(types); where.push(`p.property_type = ANY($${params.length})`); }
    }
    if (q.location) {
      const locs = String(q.location).split(',').filter(Boolean);
      if (locs.length) { params.push(locs); where.push(`p.location_slug = ANY($${params.length})`); }
    }
    if (q.min_price) add('p.price >= ?', Number(q.min_price) || 0);
    if (q.max_price) add('p.price <= ?', Number(q.max_price) || 0);
    if (q.bedrooms)  add('p.bedrooms >= ?', clampInt(q.bedrooms, 0, 20, 0));
    if (q.min_area)  add('p.property_area >= ?', Number(q.min_area) || 0);
    if (q.status && STATUSES.includes(q.status)) add('p.status = ?', q.status);
    if (q.featured === 'true') where.push('p.featured = TRUE');
    if (q.verified === 'true') where.push('p.verified_title = TRUE');
    if (q.search) {
      params.push(`%${String(q.search).trim()}%`);
      const i = params.length;
      where.push(`(p.title ILIKE $${i} OR p.location ILIKE $${i} OR p.area_locality ILIKE $${i}
                   OR p.city ILIKE $${i} OR p.short_description ILIKE $${i})`);
    }

    const sortMap = {
      newest: 'p.created_at DESC',
      oldest: 'p.created_at ASC',
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
      featured: 'p.featured DESC, p.created_at DESC',
      area_desc: 'p.property_area DESC NULLS LAST',
    };
    const orderBy = sortMap[q.sort] || sortMap.featured;

    const page = clampInt(q.page, 1, 100000, 1);
    const limit = clampInt(q.limit, 1, 48, 9);
    const offset = (page - 1) * limit;
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalRow = await one(`SELECT COUNT(*)::int AS total FROM properties p ${whereSql}`, params);
    const total = totalRow?.total ?? 0;

    params.push(limit, offset);
    const list = await rows(
      `SELECT p.id, p.title, p.slug, p.property_type, p.listing_type, p.status, p.price,
              p.price_display, p.price_period, p.location, p.location_slug, p.area_locality, p.city,
              p.property_area, p.property_area_unit, p.built_up_area, p.bedrooms, p.bathrooms,
              p.parking, p.facing, p.featured, p.verified_title, p.main_image,
              p.short_description, p.created_at
         FROM properties p ${whereSql}
        ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ data: list, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

/** Facet counts so the filter UI can show live numbers without extra roundtrips. */
api.get('/properties/facets', async (_req, res, next) => {
  try {
    const base = "WHERE published = TRUE AND status NOT IN ('draft','archived')";
    const [byType, byListing, byLocation, priceRange] = await Promise.all([
      rows(`SELECT property_type AS key, COUNT(*)::int AS count FROM properties ${base} GROUP BY 1`),
      rows(`SELECT listing_type AS key, COUNT(*)::int AS count FROM properties ${base} GROUP BY 1`),
      rows(`SELECT location_slug AS key, COUNT(*)::int AS count FROM properties ${base} GROUP BY 1`),
      one(`SELECT COALESCE(MIN(price),0)::float AS min, COALESCE(MAX(price),0)::float AS max FROM properties ${base}`),
    ]);
    res.json({ byType, byListing, byLocation, priceRange });
  } catch (e) { next(e); }
});

/** Single property by slug, with images + related listings. */
api.get('/properties/:slug', async (req, res, next) => {
  try {
    const property = await one(
      `SELECT * FROM properties WHERE slug = $1 AND published = TRUE AND status NOT IN ('draft','archived')`,
      [req.params.slug],
    );
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const images = await rows(
      'SELECT id, url, alt, is_primary, sort_order FROM property_images WHERE property_id = $1 ORDER BY is_primary DESC, sort_order, id',
      [property.id],
    );
    const related = await rows(
      `SELECT id, title, slug, property_type, listing_type, price, price_display, price_period, location,
              bedrooms, bathrooms, property_area, property_area_unit, main_image, featured, verified_title, status
         FROM properties
        WHERE published = TRUE AND status NOT IN ('draft','archived') AND id <> $1
          AND (location_slug = $2 OR property_type = $3)
        ORDER BY (location_slug = $2) DESC, featured DESC, created_at DESC
        LIMIT 3`,
      [property.id, property.location_slug, property.property_type],
    );

    query('UPDATE properties SET views = views + 1 WHERE id = $1', [property.id]).catch(() => {});
    res.json({ ...property, images, related });
  } catch (e) { next(e); }
});

/* ========================= enquiries (public) ========================= */

api.post('/enquiries', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const phone = String(b.phone || '').trim();
    const email = String(b.email || '').trim();
    const errors = {};

    if (name.length < 2) errors.name = 'Please enter your name';
    if (!/^[\d+\-\s()]{8,18}$/.test(phone)) errors.phone = 'Enter a valid phone number';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

    let propertyId = null;
    let propertyTitle = String(b.property_title || '').slice(0, 200);
    if (b.property_id) {
      const p = await one('SELECT id, title FROM properties WHERE id = $1', [parseInt(b.property_id, 10)]);
      if (p) { propertyId = p.id; propertyTitle = p.title; }
    }

    const row = await one(
      `INSERT INTO enquiries (name, phone, email, message, property_id, property_title, interest, budget, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
      [
        name.slice(0, 120), phone.slice(0, 20), email.slice(0, 160),
        String(b.message || '').slice(0, 2000), propertyId, propertyTitle,
        String(b.interest || '').slice(0, 120), String(b.budget || '').slice(0, 80),
        String(b.source || 'website').slice(0, 40),
      ],
    );
    res.status(201).json({ ok: true, id: row.id });
  } catch (e) { next(e); }
});

/* ========================= admin: auth ========================= */

api.post('/admin/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await one('SELECT * FROM admin_users WHERE email = $1', [email]);
    // Constant-ish response regardless of which half failed.
    if (!user || !verifyPassword(password, user.password_hash)) {
      await new Promise((r) => setTimeout(r, 350));
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { token, expires } = await createSession(user.id);
    await query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [user.id]);
    setSessionCookie(res, token, expires);
    res.json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (e) { next(e); }
});

api.post('/admin/logout', async (req, res, next) => {
  try { await destroySession(readCookie(req)); clearSessionCookie(res); res.json({ ok: true }); }
  catch (e) { next(e); }
});

/**
 * Session probe. Returns 200 with `user: null` when signed out — this is a
 * "who am I?" check, not a protected resource, so a 401 here would only add
 * console noise on the login screen. Actual protection lives in requireAuth.
 */
api.get('/admin/me', async (req, res, next) => {
  try {
    const user = await currentUser(req);
    res.json({ user: user || null });
  } catch (e) { next(e); }
});

/* ========================= admin: dashboard ========================= */

/* ===================== analytics ingest (public) ===================== */
/*
 * These three endpoints answer 204 immediately and do the database work
 * afterwards. Analytics must never add latency to the site, and a failed
 * write must never surface to a visitor — so every handler is
 * fire-and-forget with a swallowed error.
 */
function ingest(handler) {
  return (req, res) => {
    res.status(204).end();
    Promise.resolve()
      .then(() => handler(req, req.body || {}))
      .catch((e) => console.warn('[analytics]', e && (e.stack || e.message)));
  };
}

api.post('/analytics/session', ingest(recordSession));
api.post('/analytics/pageview', ingest(recordPageView));
api.post('/analytics/event', ingest(recordEvent));
api.post('/analytics/ping', ingest(recordPing));

/* ================== contact submissions (public) ==================== */

api.post('/contact', async (req, res, next) => {
  try {
    const b = req.body || {};
    const errors = {};
    const name = String(b.name || '').trim();
    const phone = String(b.phone || '').trim();
    const email = String(b.email || '').trim();
    if (name.length < 2) errors.name = 'Please enter your name.';
    if (!/^[\d+\-\s()]{8,18}$/.test(phone)) errors.phone = 'Please enter a valid phone number.';
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Please enter a valid email.';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

    const row = await one(
      `INSERT INTO contact_submissions (name, phone, email, subject, message, source_path)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [name, phone, email || null,
       String(b.subject || '').slice(0, 200) || null,
       String(b.message || '').slice(0, 4000) || null,
       String(b.source_path || '').slice(0, 300) || null],
    );
    res.status(201).json({ ok: true, id: row.id });
  } catch (e) { next(e); }
});

/* ===================== analytics reporting (admin) =================== */

api.get('/admin/analytics', requireAuth, async (req, res, next) => {
  try {
    const range = resolveRange(req.query);
    const [summary, breakdown] = await Promise.all([
      analyticsSummary(range),
      analyticsBreakdown(range),
    ]);
    res.json({ range, summary, ...breakdown });
  } catch (e) { next(e); }
});

api.get('/admin/contact-submissions', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const where = []; const params = [];
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR message ILIKE $${params.length})`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (await one(`SELECT COUNT(*)::int AS total FROM contact_submissions ${w}`, params)).total;
    params.push(limit, (page - 1) * limit);
    const data = await rows(
      `SELECT * FROM contact_submissions ${w} ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ data, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

api.get('/admin/stats', requireAuth, async (_req, res, next) => {
  try {
    const stats = await one(`
      SELECT
        (SELECT COUNT(*) FROM properties)::int                                        AS total_properties,
        (SELECT COUNT(*) FROM properties WHERE published = TRUE)::int                 AS published,
        (SELECT COUNT(*) FROM properties WHERE published = FALSE OR status='draft')::int AS drafts,
        (SELECT COUNT(*) FROM properties WHERE featured = TRUE)::int                  AS featured,
        (SELECT COUNT(*) FROM properties WHERE status = 'available')::int             AS available,
        (SELECT COUNT(*) FROM properties WHERE status IN ('sold','rented'))::int      AS closed,
        (SELECT COUNT(*) FROM properties WHERE status = 'archived')::int              AS archived,
        (SELECT COUNT(*) FROM enquiries WHERE archived = FALSE)::int                  AS enquiries,
        (SELECT COUNT(*) FROM enquiries WHERE status='new' AND archived = FALSE)::int AS new_enquiries,
        (SELECT COUNT(*) FROM enquiries WHERE status='contacted' AND archived=FALSE)::int AS contacted_enquiries,
        (SELECT COUNT(*) FROM enquiries WHERE status='closed' AND archived=FALSE)::int    AS closed_enquiries,
        (SELECT COUNT(*) FROM enquiries WHERE status='follow_up' AND archived=FALSE)::int AS followup_enquiries,
        (SELECT COUNT(*) FROM enquiries WHERE status='qualified' AND archived=FALSE)::int AS qualified_enquiries,
        (SELECT COUNT(*) FROM enquiries WHERE status='spam')::int                     AS spam_enquiries,
        (SELECT COUNT(*) FROM contact_submissions WHERE archived = FALSE)::int        AS contact_submissions,
        (SELECT COUNT(*) FROM property_images)::int                                   AS images,
        (SELECT COALESCE(SUM(views),0) FROM properties)::int                          AS total_views,
        -- Visitor analytics for the dashboard headline numbers.
        (SELECT COUNT(DISTINCT visitor_id) FROM visitor_sessions)::int                AS total_visitors,
        (SELECT COUNT(DISTINCT visitor_id) FROM visitor_sessions
          WHERE created_at >= date_trunc('day', now()))::int                          AS visitors_today,
        (SELECT COUNT(*) FROM page_views)::int                                        AS page_views,
        (SELECT COUNT(*) FROM page_views WHERE created_at >= date_trunc('day', now()))::int AS page_views_today,
        (SELECT COUNT(*) FROM visitor_events WHERE event_type='whatsapp_click')::int  AS whatsapp_clicks,
        (SELECT COUNT(*) FROM visitor_events WHERE event_type IN ('phone_click','call_click'))::int AS phone_clicks
    `);
    const [recentEnquiries, recentProperties, byType] = await Promise.all([
      rows(`SELECT id, name, phone, email, property_title, status, created_at
              FROM enquiries WHERE archived = FALSE ORDER BY created_at DESC LIMIT 6`),
      rows(`SELECT id, title, slug, price, price_display, status, published, featured, main_image, created_at
              FROM properties ORDER BY created_at DESC LIMIT 6`),
      rows(`SELECT property_type AS key, COUNT(*)::int AS count FROM properties GROUP BY 1 ORDER BY 2 DESC`),
    ]);
    // Conversion = enquiries per session, expressed as a percentage.
    const sessions = (await one(`SELECT COUNT(*)::int AS n FROM visitor_sessions`)).n;
    stats.sessions = sessions;
    stats.conversion_rate = sessions
      ? +(((stats.enquiries || 0) / sessions) * 100).toFixed(2)
      : 0;
    res.json({ stats, recentEnquiries, recentProperties, byType });
  } catch (e) { next(e); }
});

/* ========================= admin: properties ========================= */

api.get('/admin/properties', requireAuth, async (req, res, next) => {
  try {
    const q = req.query;
    const where = ['1=1'];
    const params = [];
    if (q.search) {
      params.push(`%${String(q.search).trim()}%`);
      where.push(`(title ILIKE $${params.length} OR location ILIKE $${params.length} OR slug ILIKE $${params.length})`);
    }
    if (q.status && STATUSES.includes(q.status)) { params.push(q.status); where.push(`status = $${params.length}`); }
    if (q.type && PROPERTY_TYPES.includes(q.type)) { params.push(q.type); where.push(`property_type = $${params.length}`); }
    if (q.listing && LISTING_TYPES.includes(q.listing)) { params.push(q.listing); where.push(`listing_type = $${params.length}`); }
    if (q.published === 'true') where.push('published = TRUE');
    if (q.published === 'false') where.push('published = FALSE');
    if (q.featured === 'true') where.push('featured = TRUE');

    const sortMap = { newest: 'created_at DESC', oldest: 'created_at ASC', price_desc: 'price DESC', price_asc: 'price ASC', title: 'title ASC', updated: 'updated_at DESC' };
    const orderBy = sortMap[q.sort] || sortMap.newest;
    const page = clampInt(q.page, 1, 100000, 1);
    const limit = clampInt(q.limit, 1, 100, 12);
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const total = (await one(`SELECT COUNT(*)::int AS total FROM properties ${whereSql}`, params))?.total ?? 0;
    params.push(limit, (page - 1) * limit);
    const list = await rows(
      `SELECT id, title, slug, property_type, listing_type, status, price, price_display, location,
              bedrooms, bathrooms, property_area, property_area_unit, featured, published, main_image,
              views, created_at, updated_at
         FROM properties ${whereSql} ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: list, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

api.get('/admin/properties/:id', requireAuth, async (req, res, next) => {
  try {
    const property = await one('SELECT * FROM properties WHERE id = $1', [parseInt(req.params.id, 10)]);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    property.images = await rows(
      'SELECT id, url, alt, is_primary, sort_order FROM property_images WHERE property_id = $1 ORDER BY is_primary DESC, sort_order, id',
      [property.id],
    );
    res.json(property);
  } catch (e) { next(e); }
});

function validateProperty(b) {
  const errors = {};
  if (!String(b.title || '').trim()) errors.title = 'Title is required';
  if (!PROPERTY_TYPES.includes(b.property_type)) errors.property_type = 'Select a property type';
  if (!LISTING_TYPES.includes(b.listing_type)) errors.listing_type = 'Select a listing type';
  if (!STATUSES.includes(b.status)) errors.status = 'Select a status';
  if (b.price === '' || b.price == null || Number(b.price) < 0 || Number.isNaN(Number(b.price)))
    errors.price = 'Enter a valid price';
  if (!String(b.location || '').trim()) errors.location = 'Location is required';
  return errors;
}

function propertyValues(b, slug, previous = null) {
  const listing = b.listing_type;

  // Auto-format the price label unless the admin typed a genuinely custom one.
  // On update the client echoes back the stored label, so a label that merely
  // matches the OLD auto-format must be regenerated from the NEW price.
  const submittedLabel = String(b.price_display || '').trim();
  const autoLabel = formatPrice(b.price, listing, b.price_period);
  const wasAuto = previous
    ? !previous.price_display
      || previous.price_display === formatPrice(previous.price, previous.listing_type, previous.price_period)
    : true;
  const priceDisplay = (!submittedLabel || (wasAuto && submittedLabel === previous?.price_display))
    ? autoLabel
    : submittedLabel;

  // Only derive a region slug when it matches a real location record;
  // a free-text location must not invent a slug like "vadavalli-coimbatore".
  const submittedLocSlug = String(b.location_slug || '').trim();
  const locationSlug = submittedLocSlug && LOCATION_SLUGS.has(submittedLocSlug)
    ? submittedLocSlug
    : matchLocationSlug(b.location, b.city, b.district);

  return [
    String(b.title).trim(), slug, b.property_type, listing, b.status,
    Number(b.price) || 0,
    priceDisplay,
    String(b.price_period || ''),
    String(b.location || '').trim(), locationSlug,
    String(b.area_locality || ''), String(b.city || ''), String(b.district || ''),
    String(b.state || 'Tamil Nadu'), String(b.address || ''),
    b.latitude === '' || b.latitude == null ? null : Number(b.latitude),
    b.longitude === '' || b.longitude == null ? null : Number(b.longitude),
    b.property_area === '' || b.property_area == null ? null : Number(b.property_area),
    String(b.property_area_unit || 'sqft'),
    b.built_up_area === '' || b.built_up_area == null ? null : Number(b.built_up_area),
    b.bedrooms === '' || b.bedrooms == null ? null : parseInt(b.bedrooms, 10),
    b.bathrooms === '' || b.bathrooms == null ? null : parseInt(b.bathrooms, 10),
    b.parking === '' || b.parking == null ? null : parseInt(b.parking, 10),
    b.floor === '' || b.floor == null ? null : parseInt(b.floor, 10),
    b.total_floors === '' || b.total_floors == null ? null : parseInt(b.total_floors, 10),
    String(b.property_age || ''), String(b.facing || ''), String(b.furnishing || ''),
    String(b.short_description || ''), String(b.description || ''),
    asArray(b.amenities), asArray(b.highlights),
    Boolean(b.featured), b.published !== false,
    Boolean(b.verified_title), String(b.rera_id || ''),
    String(b.main_image || ''),
    String(b.seo_title || '').slice(0, 200), String(b.seo_description || '').slice(0, 400),
  ];
}

api.post('/admin/properties', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const errors = validateProperty(b);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

    await ensureLocationCache();
    const slug = await uniqueSlug(b.slug || b.title);
    const created = await one(
      `INSERT INTO properties (
        title, slug, property_type, listing_type, status, price, price_display, price_period,
        location, location_slug, area_locality, city, district, state, address, latitude, longitude,
        property_area, property_area_unit, built_up_area, bedrooms, bathrooms, parking, floor, total_floors,
        property_age, facing, furnishing, short_description, description, amenities, highlights,
        featured, published, verified_title, rera_id, main_image, seo_title, seo_description
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39
      ) RETURNING *`,
      propertyValues(b, slug),
    );

    for (const [i, img] of asArray(b.images?.map?.((x) => x.url) || []).entries()) {
      await query(
        'INSERT INTO property_images (property_id, url, alt, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [created.id, img, created.title, i === 0, i],
      );
    }
    res.status(201).json(created);
  } catch (e) { next(e); }
});

api.put('/admin/properties/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await one(
      'SELECT id, price, price_display, price_period, listing_type FROM properties WHERE id = $1',
      [id],
    );
    if (!existing) return res.status(404).json({ error: 'Property not found' });

    const b = req.body || {};
    const errors = validateProperty(b);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

    await ensureLocationCache();
    const slug = await uniqueSlug(b.slug || b.title, id);
    const values = propertyValues(b, slug, existing);
    values.push(id);
    const updated = await one(
      `UPDATE properties SET
        title=$1, slug=$2, property_type=$3, listing_type=$4, status=$5, price=$6, price_display=$7,
        price_period=$8, location=$9, location_slug=$10, area_locality=$11, city=$12, district=$13,
        state=$14, address=$15, latitude=$16, longitude=$17, property_area=$18, property_area_unit=$19,
        built_up_area=$20, bedrooms=$21, bathrooms=$22, parking=$23, floor=$24, total_floors=$25,
        property_age=$26, facing=$27, furnishing=$28, short_description=$29, description=$30,
        amenities=$31, highlights=$32, featured=$33, published=$34, verified_title=$35, rera_id=$36,
        main_image=$37, seo_title=$38, seo_description=$39, updated_at=now()
       WHERE id=$40 RETURNING *`,
      values,
    );
    res.json(updated);
  } catch (e) { next(e); }
});

/** Partial update for quick toggles (publish / feature / status). */
api.patch('/admin/properties/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const sets = [];
    const params = [];
    const allow = { published: 'boolean', featured: 'boolean', status: 'status', main_image: 'text' };
    for (const [key, kind] of Object.entries(allow)) {
      if (!(key in b)) continue;
      if (kind === 'status' && !STATUSES.includes(b[key])) continue;
      params.push(kind === 'boolean' ? Boolean(b[key]) : b[key]);
      sets.push(`${key} = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(id);
    const updated = await one(
      `UPDATE properties SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!updated) return res.status(404).json({ error: 'Property not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

api.delete('/admin/properties/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.query.mode === 'archive') {
      const archived = await one(
        "UPDATE properties SET status='archived', published=FALSE, featured=FALSE, updated_at=now() WHERE id=$1 RETURNING id",
        [id],
      );
      if (!archived) return res.status(404).json({ error: 'Property not found' });
      return res.json({ ok: true, archived: true });
    }
    // Collect owned files BEFORE the cascade removes the image rows,
    // otherwise the uploads directory leaks a file on every delete.
    const owned = await rows(
      'SELECT url FROM property_images WHERE property_id = $1',
      [id],
    );

    const del = await one('DELETE FROM properties WHERE id = $1 RETURNING id', [id]);
    if (!del) return res.status(404).json({ error: 'Property not found' });

    for (const img of owned) {
      // Never remove an object another listing still points at.
      const stillUsed = await one('SELECT id FROM property_images WHERE url = $1', [img.url]);
      if (stillUsed) continue;
      await removeImage(img.url);   // local file or Supabase object
    }

    res.json({ ok: true, deleted: true });
  } catch (e) { next(e); }
});

/* ========================= admin: images ========================= */
/**
 * Base64 upload -> validated -> written to /public/uploads (local driver)
 * or Supabase Storage when configured. Extension is derived from the
 * sniffed MIME type, never from user input.
 */

api.post('/admin/properties/:id/images', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const property = await one('SELECT id, title, main_image FROM properties WHERE id = $1', [id]);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const { data, alt } = req.body || {};
    const decoded = decodeDataUri(data);
    if (decoded.error) {
      return res.status(decoded.status || 400).json({ error: decoded.error });
    }

    // Writes to Supabase Storage in production, /public/uploads in dev.
    let url;
    try {
      ({ url } = await putImage({
        propertyId: id, buffer: decoded.buffer, ext: decoded.ext, mime: decoded.mime,
      }));
    } catch (err) {
      console.error('[upload]', err.message);
      return res.status(502).json({ error: 'Image storage is unavailable. Please try again.' });
    }

    const count = (await one('SELECT COUNT(*)::int AS c FROM property_images WHERE property_id = $1', [id]))?.c ?? 0;
    const isPrimary = count === 0;
    const image = await one(
      'INSERT INTO property_images (property_id, url, alt, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, url, String(alt || property.title).slice(0, 200), isPrimary, count],
    );
    if (isPrimary || !property.main_image) {
      await query('UPDATE properties SET main_image = $1, updated_at = now() WHERE id = $2', [url, id]);
    }
    res.status(201).json(image);
  } catch (e) { next(e); }
});

api.patch('/admin/images/:imageId', requireAuth, async (req, res, next) => {
  try {
    const imageId = parseInt(req.params.imageId, 10);
    const image = await one('SELECT * FROM property_images WHERE id = $1', [imageId]);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    if (req.body?.is_primary) {
      await query('UPDATE property_images SET is_primary = FALSE WHERE property_id = $1', [image.property_id]);
      await query('UPDATE property_images SET is_primary = TRUE WHERE id = $1', [imageId]);
      await query('UPDATE properties SET main_image = $1, updated_at = now() WHERE id = $2', [image.url, image.property_id]);
    }
    if (Number.isFinite(parseInt(req.body?.sort_order, 10))) {
      await query('UPDATE property_images SET sort_order = $1 WHERE id = $2', [parseInt(req.body.sort_order, 10), imageId]);
    }
    if (typeof req.body?.alt === 'string') {
      await query('UPDATE property_images SET alt = $1 WHERE id = $2', [req.body.alt.slice(0, 200), imageId]);
    }
    res.json(await one('SELECT * FROM property_images WHERE id = $1', [imageId]));
  } catch (e) { next(e); }
});

api.delete('/admin/images/:imageId', requireAuth, async (req, res, next) => {
  try {
    const imageId = parseInt(req.params.imageId, 10);
    const image = await one('SELECT * FROM property_images WHERE id = $1', [imageId]);
    if (!image) return res.status(404).json({ error: 'Image not found' });
    await query('DELETE FROM property_images WHERE id = $1', [imageId]);

    // Only delete objects we own, and only when unreferenced.
    const stillUsed = await one('SELECT id FROM property_images WHERE url = $1', [image.url]);
    if (!stillUsed) await removeImage(image.url);
    if (image.is_primary) {
      const next_ = await one(
        'SELECT url FROM property_images WHERE property_id = $1 ORDER BY sort_order, id LIMIT 1',
        [image.property_id],
      );
      await query('UPDATE property_images SET is_primary = TRUE WHERE property_id = $1 AND url = $2', [image.property_id, next_?.url ?? '']);
      await query('UPDATE properties SET main_image = $1, updated_at = now() WHERE id = $2', [next_?.url ?? '', image.property_id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ========================= admin: enquiries ========================= */

api.get('/admin/enquiries', requireAuth, async (req, res, next) => {
  try {
    const q = req.query;
    const where = [];
    const params = [];
    where.push(q.archived === 'true' ? 'archived = TRUE' : 'archived = FALSE');
    if (q.status && ['new', 'contacted', 'follow_up', 'qualified', 'closed', 'spam'].includes(q.status)) {
      params.push(q.status); where.push(`status = $${params.length}`);
    }
    if (q.search) {
      params.push(`%${String(q.search).trim()}%`);
      const i = params.length;
      where.push(`(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i} OR property_title ILIKE $${i} OR message ILIKE $${i})`);
    }
    const page = clampInt(q.page, 1, 100000, 1);
    const limit = clampInt(q.limit, 1, 100, 15);
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = (await one(`SELECT COUNT(*)::int AS total FROM enquiries ${whereSql}`, params))?.total ?? 0;
    params.push(limit, (page - 1) * limit);
    const list = await rows(
      `SELECT * FROM enquiries ${whereSql} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: list, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

api.patch('/admin/enquiries/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const sets = [];
    const params = [];
    if (['new', 'contacted', 'follow_up', 'qualified', 'closed', 'spam'].includes(req.body?.status)) {
      params.push(req.body.status); sets.push(`status = $${params.length}`);
    }
    if (typeof req.body?.admin_notes === 'string') {
      params.push(req.body.admin_notes.slice(0, 2000)); sets.push(`admin_notes = $${params.length}`);
    }
    if (typeof req.body?.archived === 'boolean') {
      params.push(req.body.archived); sets.push(`archived = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(id);
    const updated = await one(
      `UPDATE enquiries SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!updated) return res.status(404).json({ error: 'Enquiry not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

api.delete('/admin/enquiries/:id', requireAuth, async (req, res, next) => {
  try {
    const del = await one('DELETE FROM enquiries WHERE id = $1 RETURNING id', [parseInt(req.params.id, 10)]);
    if (!del) return res.status(404).json({ error: 'Enquiry not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ========================= SEO ========================= */

api.get('/seo/sitemap.xml', async (req, res, next) => {
  try {
    const settings = await settingsMap();
    // Prefer the configured canonical domain; otherwise fall back to the host
    // actually being served, so the sitemap is never wrong by default.
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const base = (settings.site_url || requestOrigin).replace(/\/$/, '');
    const props = await rows(
      "SELECT slug, updated_at FROM properties WHERE published = TRUE AND status NOT IN ('draft','archived') ORDER BY updated_at DESC",
    );
    const statics = ['', '/properties', '/about', '/services', '/locations', '/gallery', '/contact', '/enquire'];
    const urls = [
      ...statics.map((p) => `  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq><priority>${p === '' ? '1.0' : '0.8'}</priority></url>`),
      ...props.map((p) => `  <url><loc>${base}/properties/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`),
    ].join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  } catch (e) { next(e); }
});

api.get('/health', async (_req, res) => {
  try {
    const started = Date.now();
    const r = await one('SELECT COUNT(*)::int AS c FROM properties');
    const dbMs = Date.now() - started;
    const storage = await storageHealth();
    res.json({
      ok: true,
      properties: r?.c ?? 0,
      db: { driver: await driverKind(), ms: dbMs },
      storage: { backend: storage.backend, ok: storage.ok, bucket: storage.bucket },
      env: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'development'),
    });
  } catch (e) {
    // Never leak connection strings or stack traces to the client.
    console.error('[health]', e.message);
    res.status(503).json({ ok: false, error: 'Service unavailable' });
  }
});

/* ========================= error handling ========================= */

api.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export async function initApi() {
  const { email, created, generatedPassword } = await ensureAdminUser();
  if (created) {
    console.log(`[auth] admin user created: ${email}`);
    if (generatedPassword) {
      console.log(`[auth] DEV-ONLY generated password: ${generatedPassword}`);
      console.log('[auth] set ADMIN_PASSWORD in .env to choose your own.');
    }
  }
  await refreshLocationCache();
  return { adminEmail: email };
}
