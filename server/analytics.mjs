/**
 * First-party visitor analytics.
 *
 * Principles this module is built on:
 *
 *  1. Analytics must never break or slow the website. Every ingest
 *     handler responds 204 immediately and does the database work after
 *     the response is sent. A failed insert is swallowed and logged, not
 *     surfaced to the visitor.
 *  2. No personal data. We store no IP address and no full referrer URL
 *     (host only). visitor_id is a random client-generated string, which
 *     is pseudonymous — it identifies a browser, not a person.
 *  3. Bounded writes. Payloads are validated and clamped so a hostile
 *     client cannot use the ingest endpoint to write junk at scale.
 */
import { query, rows, one } from './db.mjs';

const EVENT_TYPES = new Set([
  'whatsapp_click', 'phone_click', 'enquiry_submit', 'search',
  'filter', 'gallery_open', 'share', 'map_load', 'call_click',
]);

const str = (v, max) => (v === null || v === undefined ? null : String(v).slice(0, max));

/** Classify a referrer host without keeping the full URL. */
function classifyReferrer(host) {
  if (!host) return { host: null, kind: 'direct' };
  const h = host.toLowerCase();
  if (/(google|bing|yahoo|duckduckgo|ecosia|baidu|yandex)\./.test(h)) return { host: h, kind: 'search' };
  if (/(facebook|instagram|twitter|x\.com|linkedin|youtube|pinterest|whatsapp|t\.co)/.test(h)) return { host: h, kind: 'social' };
  return { host: h, kind: 'referral' };
}

/**
 * Coarse device/browser classification from the User-Agent.
 * Deliberately low-resolution: we want "mobile / Chrome", not a
 * fingerprint.
 */
function classifyUa(ua = '') {
  const s = String(ua);
  const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s);
  const isMobile = !isTablet && /Mobi|Android|iPhone|iPod|Windows Phone/i.test(s);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browser = 'Other';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/SamsungBrowser/i.test(s)) browser = 'Samsung Internet';

  let os = 'Other';
  if (/Windows NT/i.test(s)) os = 'Windows';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod|iOS/i.test(s)) os = 'iOS';
  else if (/Mac OS X/i.test(s)) os = 'macOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  return { device, browser, os };
}

/** Vercel/Cloudflare put approximate geo on the request. Never an IP. */
function geoFrom(req) {
  const h = req.headers || {};
  return {
    country: str(h['x-vercel-ip-country'] || h['cf-ipcountry'] || null, 2),
    city: str(h['x-vercel-ip-city'] ? decodeURIComponent(String(h['x-vercel-ip-city'])) : null, 80),
  };
}

/** Obvious bot filter — keeps dashboards honest without being clever. */
function isBot(ua = '') {
  return /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|headless|lighthouse|pingdom|gtmetrix/i.test(String(ua));
}

/* ------------------------------ ingest ------------------------------ */

export async function recordSession(req, body) {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) return;
  const id = str(body.session_id, 64);
  const visitor = str(body.visitor_id, 64);
  if (!id || !visitor) return;

  const { device, browser, os } = classifyUa(ua);
  const { host, kind } = classifyReferrer(str(body.referrer_host, 120));
  const { country, city } = geoFrom(req);

  await query(
    `INSERT INTO visitor_sessions
       (id, visitor_id, landing_path, referrer_host, referrer_kind,
        utm_source, utm_medium, utm_campaign,
        device_type, browser, os, country, city, is_returning)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO NOTHING`,
    [id, visitor, str(body.landing_path, 300), host, kind,
     str(body.utm_source, 80), str(body.utm_medium, 80), str(body.utm_campaign, 80),
     device, browser, os, country, city, !!body.is_returning],
  );
}

export async function recordPageView(req, body) {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) return;
  const session = str(body.session_id, 64);
  const visitor = str(body.visitor_id, 64);
  const path = str(body.path, 300);
  if (!session || !visitor || !path) return;

  const propertyId = Number.isFinite(+body.property_id) && +body.property_id > 0
    ? Math.trunc(+body.property_id) : null;
  const dwell = Number.isFinite(+body.dwell_ms)
    ? Math.min(Math.max(Math.trunc(+body.dwell_ms), 0), 3_600_000) : null;

  /*
   * Server-side de-duplication.
   *
   * A property page reports twice by design: once from the router (which
   * does not yet know the property id) and once after the property loads
   * (which does). Counting both would double every property view. If the
   * same session hit the same path moments ago, upgrade that row with the
   * property id instead of inserting a second one.
   *
   * This also protects the numbers from a client that retries or a
   * component that remounts — the database stays correct regardless of
   * what the browser does.
   */
  const recent = await one(
    `SELECT id, property_id FROM page_views
      WHERE session_id = $1 AND path = $2 AND created_at > now() - interval '3 seconds'
      ORDER BY created_at DESC LIMIT 1`,
    [session, path],
  );

  if (recent) {
    if (propertyId && !recent.property_id) {
      await query(`UPDATE page_views SET property_id = $2, title = COALESCE($3, title) WHERE id = $1`,
        [recent.id, propertyId, str(body.title, 200)]);
    }
    if (dwell) {
      await query(`UPDATE page_views SET dwell_ms = GREATEST(COALESCE(dwell_ms,0), $2) WHERE id = $1`,
        [recent.id, dwell]);
    }
    return;
  }

  await query(
    `INSERT INTO page_views (session_id, visitor_id, path, title, property_id, dwell_ms)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [session, visitor, path, str(body.title, 200), propertyId, dwell],
  );

  await query(
    `UPDATE visitor_sessions
        SET page_count = page_count + 1,
            last_seen  = now(),
            exit_path  = $2,
            duration_ms = GREATEST(0, EXTRACT(EPOCH FROM (now() - first_seen)) * 1000)::bigint
      WHERE id = $1`,
    [session, path],
  );
}

export async function recordEvent(req, body) {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) return;
  const session = str(body.session_id, 64);
  const visitor = str(body.visitor_id, 64);
  const type = str(body.event_type, 40);
  if (!session || !visitor || !type || !EVENT_TYPES.has(type)) return;

  const propertyId = Number.isFinite(+body.property_id) && +body.property_id > 0
    ? Math.trunc(+body.property_id) : null;

  let meta = null;
  if (body.meta && typeof body.meta === 'object') {
    // Clamp: never let a client write an unbounded JSON blob.
    const trimmed = {};
    for (const [k, v] of Object.entries(body.meta).slice(0, 10)) {
      trimmed[String(k).slice(0, 40)] = typeof v === 'string' ? v.slice(0, 200) : v;
    }
    meta = trimmed;
  }

  await query(
    `INSERT INTO visitor_events (session_id, visitor_id, event_type, path, property_id, label, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [session, visitor, type, str(body.path, 300), propertyId, str(body.label, 200), meta],
  );

  await query(
    `UPDATE visitor_sessions SET event_count = event_count + 1, last_seen = now() WHERE id = $1`,
    [session],
  );
}

/**
 * Session-end ping.
 *
 * duration_ms is otherwise only refreshed when a NEW page view arrives,
 * so the final page of every visit contributes nothing and single-page
 * sessions always record ~0. The client sends this on pagehide, which
 * closes that gap and makes "average session" a real number.
 */
export async function recordPing(req, body) {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) return;
  const session = str(body.session_id, 64);
  if (!session) return;

  await query(
    `UPDATE visitor_sessions
        SET last_seen = now(),
            exit_path = COALESCE($2, exit_path),
            duration_ms = GREATEST(duration_ms,
              LEAST(EXTRACT(EPOCH FROM (now() - first_seen)) * 1000, 7200000)::bigint)
      WHERE id = $1`,
    [session, str(body.path, 300)],
  );
}

/* ---------------------------- reporting ----------------------------- */

/** Resolve a range key (or explicit from/to) into SQL bounds. */
export function resolveRange(q = {}) {
  const presets = { today: 1, '7d': 7, '30d': 30, '90d': 90 };
  if (q.from && q.to) {
    const from = new Date(q.from), to = new Date(q.to);
    if (!Number.isNaN(+from) && !Number.isNaN(+to)) {
      return { from: from.toISOString(), to: new Date(+to + 86_400_000 - 1).toISOString(), label: 'custom' };
    }
  }
  const key = presets[q.range] ? q.range : '30d';
  const days = presets[key];
  const to = new Date();
  const from = key === 'today'
    ? new Date(to.getFullYear(), to.getMonth(), to.getDate())
    : new Date(+to - (days - 1) * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString(), label: key };
}

export async function analyticsSummary(range) {
  const p = [range.from, range.to];

  const [totals, evt, enq] = await Promise.all([
    one(
      `SELECT
         COUNT(DISTINCT s.visitor_id)::int AS unique_visitors,
         COUNT(*)::int                     AS sessions,
         COALESCE(SUM(s.page_count),0)::int AS page_views,
         COALESCE(AVG(NULLIF(s.duration_ms,0)),0)::int AS avg_duration_ms,
         COUNT(*) FILTER (WHERE s.is_returning)::int AS returning_sessions,
         COUNT(*) FILTER (WHERE s.page_count <= 1)::int AS bounced
       FROM visitor_sessions s
       WHERE s.created_at BETWEEN $1 AND $2`, p),
    one(
      `SELECT
         COUNT(*) FILTER (WHERE event_type='whatsapp_click')::int AS whatsapp_clicks,
         COUNT(*) FILTER (WHERE event_type IN ('phone_click','call_click'))::int AS phone_clicks,
         COUNT(*) FILTER (WHERE event_type='search')::int AS searches,
         COUNT(*) FILTER (WHERE event_type='enquiry_submit')::int AS enquiry_events
       FROM visitor_events WHERE created_at BETWEEN $1 AND $2`, p),
    one(`SELECT COUNT(*)::int AS enquiries FROM enquiries WHERE created_at BETWEEN $1 AND $2`, p),
  ]);

  const sessions = totals?.sessions || 0;
  const enquiries = enq?.enquiries || 0;
  return {
    ...totals, ...evt, enquiries,
    conversion_rate: sessions ? +((enquiries / sessions) * 100).toFixed(2) : 0,
    bounce_rate: sessions ? +(((totals?.bounced || 0) / sessions) * 100).toFixed(1) : 0,
  };
}

export async function analyticsBreakdown(range) {
  const p = [range.from, range.to];
  const [trend, topPages, topProperties, sources, devices, geo, recent] = await Promise.all([
    rows(
      `SELECT to_char(d.day,'YYYY-MM-DD') AS day,
              COALESCE(x.sessions,0)::int AS sessions,
              COALESCE(x.visitors,0)::int AS visitors,
              COALESCE(x.views,0)::int    AS views
         FROM generate_series($1::timestamptz, $2::timestamptz, interval '1 day') AS d(day)
         LEFT JOIN (
           SELECT date_trunc('day', created_at) AS day,
                  COUNT(*) AS sessions,
                  COUNT(DISTINCT visitor_id) AS visitors,
                  SUM(page_count) AS views
             FROM visitor_sessions WHERE created_at BETWEEN $1 AND $2
            GROUP BY 1
         ) x ON x.day = date_trunc('day', d.day)
        ORDER BY 1`, p),
    rows(
      `SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS visitors
         FROM page_views WHERE created_at BETWEEN $1 AND $2
        GROUP BY 1 ORDER BY views DESC LIMIT 10`, p),
    rows(
      // property_id is BIGINT; node-postgres returns BIGINT as a *string*
      // to avoid precision loss. Cast to int so the JSON matches the
      // number type the client expects.
      `SELECT pv.property_id::int AS property_id, p.title, p.slug, COUNT(*)::int AS views
         FROM page_views pv JOIN properties p ON p.id = pv.property_id
        WHERE pv.created_at BETWEEN $1 AND $2 AND pv.property_id IS NOT NULL
        GROUP BY 1,2,3 ORDER BY views DESC LIMIT 10`, p),
    rows(
      `SELECT COALESCE(referrer_kind,'direct') AS source,
              COALESCE(referrer_host,'(direct)') AS host,
              COUNT(*)::int AS sessions
         FROM visitor_sessions WHERE created_at BETWEEN $1 AND $2
        GROUP BY 1,2 ORDER BY sessions DESC LIMIT 10`, p),
    rows(
      `SELECT COALESCE(device_type,'unknown') AS device, COUNT(*)::int AS sessions
         FROM visitor_sessions WHERE created_at BETWEEN $1 AND $2
        GROUP BY 1 ORDER BY sessions DESC`, p),
    rows(
      `SELECT COALESCE(country,'—') AS country, COALESCE(city,'—') AS city, COUNT(*)::int AS sessions
         FROM visitor_sessions WHERE created_at BETWEEN $1 AND $2
        GROUP BY 1,2 ORDER BY sessions DESC LIMIT 10`, p),
    rows(
      `SELECT event_type, path, label, created_at
         FROM visitor_events WHERE created_at BETWEEN $1 AND $2
        ORDER BY created_at DESC LIMIT 15`, p),
  ]);
  return { trend, topPages, topProperties, sources, devices, geo, recent };
}
