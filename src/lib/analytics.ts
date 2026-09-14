/**
 * First-party visitor analytics — client side.
 *
 * Constraints this is written against:
 *
 *  - It must never block rendering. Every call is fire-and-forget and
 *    wrapped so a rejected promise can never surface as an unhandled
 *    error or a console error.
 *  - It must never break the site if the endpoint is down, blocked by an
 *    ad blocker, or returns an error. All failures are swallowed.
 *  - It must be small. This is ~2 KB of logic, not an analytics SDK.
 *  - It stores no personal data. The visitor id is a random string that
 *    identifies a browser, not a person. No IP, no full referrer.
 *
 * Delivery uses navigator.sendBeacon where available, which survives page
 * unload and does not contend with the page's own requests.
 */

const VISITOR_KEY = 'pe_vid';
const SESSION_KEY = 'pe_sid';
const SESSION_TS = 'pe_sid_ts';
const SESSION_TTL_MS = 30 * 60 * 1000; // a session ends after 30 min idle

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** localStorage can throw (Safari private mode, disabled storage). */
function safeGet(store: Storage, k: string): string | null {
  try { return store.getItem(k); } catch { return null; }
}
function safeSet(store: Storage, k: string, v: string): void {
  try { store.setItem(k, v); } catch { /* ignore */ }
}

let memoryVisitor: string | null = null;
let memorySession: string | null = null;

function getVisitorId(): { id: string; returning: boolean } {
  const existing = safeGet(localStorage, VISITOR_KEY) ?? memoryVisitor;
  if (existing) return { id: existing, returning: true };
  const id = uuid();
  safeSet(localStorage, VISITOR_KEY, id);
  memoryVisitor = id;
  return { id, returning: false };
}

/** Returns the session id, and whether this call started a new session. */
function getSessionId(): { id: string; fresh: boolean } {
  const now = Date.now();
  const id = safeGet(sessionStorage, SESSION_KEY) ?? memorySession;
  const tsRaw = safeGet(sessionStorage, SESSION_TS);
  const ts = tsRaw ? Number(tsRaw) : 0;

  if (id && ts && now - ts < SESSION_TTL_MS) {
    safeSet(sessionStorage, SESSION_TS, String(now));
    return { id, fresh: false };
  }
  const next = uuid();
  safeSet(sessionStorage, SESSION_KEY, next);
  safeSet(sessionStorage, SESSION_TS, String(now));
  memorySession = next;
  return { id: next, fresh: true };
}

/** Host only — we deliberately never send the full referring URL. */
function referrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const u = new URL(document.referrer);
    if (u.host === location.host) return null; // internal navigation
    return u.host;
  } catch { return null; }
}

function send(path: string, payload: Record<string, unknown>): void {
  try {
    const body = JSON.stringify(payload);
    const url = `/api/analytics/${path}`;
    // sendBeacon survives unload and never competes with page requests.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* analytics must never surface an error */ });
  } catch { /* never throw from analytics */ }
}

let started = false;
let lastPath: string | null = null;
let pageEnteredAt = Date.now();

/*
 * Guard against double-counting the same page view.
 *
 * React StrictMode intentionally mounts, unmounts and remounts effects in
 * development, and a route component can legitimately remount in
 * production too (Suspense resolution, a key change, back/forward
 * restore). Without this guard each of those sends a second beacon and
 * inflates page views.
 *
 * We suppress a repeat of the *same* path inside a short window. A genuine
 * revisit — navigating away and back — is further apart than this and is
 * still counted.
 */
const DEDUPE_MS = 1200;
let lastSentPath: string | null = null;
let lastSentAt = 0;

/** Starts the session. Safe to call more than once. */
export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const visitor = getVisitorId();
  const session = getSessionId();
  if (!session.fresh) return;

  let utm: Record<string, string | null> = { utm_source: null, utm_medium: null, utm_campaign: null };
  try {
    const q = new URLSearchParams(location.search);
    utm = {
      utm_source: q.get('utm_source'),
      utm_medium: q.get('utm_medium'),
      utm_campaign: q.get('utm_campaign'),
    };
  } catch { /* ignore */ }

  send('session', {
    session_id: session.id,
    visitor_id: visitor.id,
    landing_path: location.pathname,
    referrer_host: referrerHost(),
    is_returning: visitor.returning,
    ...utm,
  });
}

/** Records a page view. `propertyId` is set on property detail pages. */
export function trackPageView(path: string, title?: string, propertyId?: number | null): void {
  if (typeof window === 'undefined') return;
  initAnalytics();

  const now = Date.now();
  // A property-detail call carries an id the generic route call cannot
  // know, so it is allowed through to attribute the view; everything else
  // that repeats the same path immediately is a remount, not a visit.
  if (propertyId == null && lastSentPath === path && now - lastSentAt < DEDUPE_MS) return;
  lastSentPath = path;
  lastSentAt = now;

  // Report dwell time on the page we are leaving, not the one we enter.
  const dwell = lastPath && lastPath !== path ? Date.now() - pageEnteredAt : null;
  lastPath = path;
  pageEnteredAt = Date.now();

  const visitor = getVisitorId();
  const session = getSessionId();
  send('pageview', {
    session_id: session.id,
    visitor_id: visitor.id,
    path,
    title: title ?? (typeof document !== 'undefined' ? document.title : undefined),
    property_id: propertyId ?? null,
    dwell_ms: dwell,
  });
}

/**
 * Closes the session when the visitor leaves so the final page counts
 * toward session duration.
 *
 * Uses `pagehide` plus `visibilitychange`, not `unload`: `unload` is
 * unreliable on mobile Safari and prevents the page entering the
 * back/forward cache. sendBeacon is specifically designed to survive
 * this moment.
 *
 * Returns a cleanup function.
 */
export function installSessionPing(): () => void {
  if (typeof window === 'undefined') return () => {};

  const ping = () => {
    try {
      if (location.pathname.startsWith('/admin')) return;
      const session = getSessionId();
      send('ping', { session_id: session.id, path: location.pathname });
    } catch { /* never throw */ }
  };

  const onHide = () => { if (document.visibilityState === 'hidden') ping(); };
  window.addEventListener('pagehide', ping);
  document.addEventListener('visibilitychange', onHide);
  return () => {
    window.removeEventListener('pagehide', ping);
    document.removeEventListener('visibilitychange', onHide);
  };
}

export type AnalyticsEvent =
  | 'whatsapp_click' | 'phone_click' | 'enquiry_submit' | 'search'
  | 'filter' | 'gallery_open' | 'share' | 'map_load';

/** Records a conversion or interaction event. Never throws. */
export function trackEvent(
  eventType: AnalyticsEvent,
  opts: { label?: string; propertyId?: number | null; meta?: Record<string, unknown> } = {},
): void {
  if (typeof window === 'undefined') return;
  initAnalytics();
  const visitor = getVisitorId();
  const session = getSessionId();
  send('event', {
    session_id: session.id,
    visitor_id: visitor.id,
    event_type: eventType,
    path: location.pathname,
    label: opts.label ?? null,
    property_id: opts.propertyId ?? null,
    meta: opts.meta ?? null,
  });
}

/**
 * Sitewide click tracking for WhatsApp and phone links.
 *
 * WhatsApp/Call CTAs appear in the header, mobile menu, footer, floating
 * button, property detail sidebar, the sticky mobile action bar, contact
 * page and admin enquiry screens. Instrumenting each call site would mean
 * touching a dozen components and would silently miss any new one.
 *
 * Instead this attaches ONE capture-phase listener on document and
 * inspects the closest anchor. Any current or future wa.me / tel: link is
 * tracked automatically, and the handler never calls preventDefault, so
 * navigation is completely unaffected.
 *
 * Returns a cleanup function.
 */
export function installLinkTracking(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onClick = (ev: MouseEvent) => {
    try {
      const el = (ev.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute('href') || '';

      // Never track from inside the admin console: that is staff activity.
      if (location.pathname.startsWith('/admin')) return;

      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)/i.test(href)) {
        trackEvent('whatsapp_click', {
          label: el.dataset.analyticsLabel || el.textContent?.trim().slice(0, 80) || 'whatsapp',
          propertyId: el.dataset.propertyId ? Number(el.dataset.propertyId) : null,
        });
      } else if (/^tel:/i.test(href)) {
        trackEvent('phone_click', {
          label: el.dataset.analyticsLabel || el.textContent?.trim().slice(0, 80) || 'call',
          propertyId: el.dataset.propertyId ? Number(el.dataset.propertyId) : null,
        });
      }
    } catch { /* analytics must never interfere with navigation */ }
  };

  document.addEventListener('click', onClick, { capture: true });
  return () => document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
}
