# Prime Estates — Performance Report

**Date:** 14 September 2026
**Test conditions:** Slow 4G (1.6 Mbps down, 150 ms RTT) + **4× CPU throttling**, 390×844 viewport
**Database:** real PostgreSQL 17, loaded with **2,218 properties and 1,500 enquiries**

Everything here was measured against the production build running through the real
Vercel serverless handler. Nothing is estimated.

---

## Results

| Route | LCP | CLS | Requests | Transferred |
| --- | --- | --- | --- | --- |
| `/` | **1.32 s** | 0.0007 | 16 | 206 KB |
| `/properties` | **1.95 s** | 0 | 17 | 201 KB |
| `/properties?type=villa&listing=sale` | **1.82 s** | 0 | 15 | 172 KB |
| `/properties/:slug` | **1.82 s** | 0 | 15 | 194 KB |
| `/about` | **1.39 s** | 0 | 12 | 173 KB |
| `/services` | **1.38 s** | 0 | 12 | 164 KB |
| `/locations` | **1.34 s** | 0 | 13 | 175 KB |
| `/gallery` | **1.64 s** | 0 | 16 | 201 KB |
| `/contact` | **1.38 s** | 0 | 10 | 159 KB |

**Homepage: 3.14 s / 672 KB → 1.32 s / 206 KB.**
On a phone-class device and connection, all Core Web Vitals are in the "good" band.

---

## The five things that actually mattered

I measured first and fixed what the numbers pointed at. Four of the five were invisible
on a desktop connection.

### 1. A 3.9 MB icon font — the single worst bug

The site loaded the Material Symbols **variable icon font** from Google Fonts to render
77 small glyphs. On a real Indian 4G connection that is roughly twenty seconds of icons.

It hid from the first measurement because it finishes after the `load` event — only a
font-specific probe caught it.

Those glyphs are now inlined as SVG path data. The generator **scans `src/` for icon
names** rather than reading a hand-maintained list, so it can't drift out of sync.

> **It also found a real bug:** 14 icons (`directions_car`, `calendar_month`, `stairs`,
> `chair`, `explore` and others) were referenced in code but had no glyph. They were
> rendering as blank gaps on the property detail specs. They now render.

### 2. Full-resolution photos on phone-sized cards

A 390 px-wide card was downloading a 1408 px JPEG. `.qa/gen-images.mjs` now produces
AVIF/WebP/JPEG at 400/800/1408 px and `<Img>` emits a `<picture>` with correct `sizes`.

**A card image went from 266 KB to 12 KB — 95% smaller.** The hero was converted from a
CSS `background-image` (which cannot use `srcset`, is discovered late, and can't take
`fetchpriority`) to a real preloaded `<picture>`.

### 3. Google Maps loading on pages nobody asked a map for

The embed pulled **~1.6 MB of third-party JavaScript across 19 requests** on both the
contact and property detail pages. `loading="lazy"` does nothing here because the map
sits inside the first viewport on a phone.

It's now a click-to-load facade: a styled placeholder that mounts the iframe only when
asked. Verified **0 Maps requests before the click, 19 after**. A visitor who just wants
the phone number never pays for it. The plain Google Maps link is always present, so
nothing is lost for keyboard users or crawlers.

- Property detail: **641 KB → 194 KB**
- Contact: **604 KB → 159 KB**

### 4. Layout shift — property detail was CLS 0.83

The loading skeleton used a different wrapper to the loaded page (`.shell` on the outer
element instead of inside it), so when content arrived the entire column changed width
*and* position. My first attempt made it **worse** (0.83 → 0.87) because I guessed at the
skeleton height instead of measuring it. Measuring showed the page grew 3,779 px.

Fixed by mirroring the real structure exactly, then reserving space for asynchronous
content: `settings.description` on `/about` (0 → 208 px), and the gallery filter chips,
which wrap to **three rows on a 390 px phone**, not one.

**Every page is now CLS 0.**

### 5. Fonts

Self-hosted (removes a third-party DNS + TLS handshake and a render-blocking
stylesheet), switched to **variable fonts** instead of six static weights, latin subset
only, and — importantly — **metric-matched fallbacks** using `size-adjust`,
`ascent-override` and `descent-override` derived from the real font tables. Without
those, the swap re-wrapped a button row from two lines to one, which was a 0.145 CLS by
itself.

146 KB across 6 files → **81 KB across 3**. Playfair 700 was dropped entirely: no design
token used it.

---

## Database at scale

Loaded 2,218 properties and 1,500 enquiries, then read the query plans.

| Query | Before | After |
| --- | --- | --- |
| Default catalogue sort | 2.586 ms — **sequential scan + top-N sort of 1,904 rows** | **0.044 ms** index scan (59× faster) |
| Substring search | 1.445 ms — sequential scan | **0.097 ms** trigram index (15× faster) |

The default catalogue query — the most-hit query on the entire site — was scanning the
table and sorting on every request. The existing indexes didn't match its sort order.

The fix is **partial indexes matching the exact predicate** every public query uses
(`published = true AND status NOT IN ('draft','archived')`). Postgres now walks the index
in sort order and stops at `LIMIT`, with no sort step. They also stay small, because sold
and archived stock never enters them.

Search needed a `pg_trgm` GIN index: the existing full-text `tsvector` index **cannot**
serve `ILIKE '%foo%'`, which is what the API actually runs.

Measured endpoint latency at that volume:

| Endpoint | Latency |
| --- | --- |
| `/api/properties?page=1&limit=9` | 3 ms |
| `/api/properties?page=100&limit=9` | 5 ms |
| `/api/properties?search=…` | 5 ms |
| `/api/properties/:slug` | 3 ms |
| `/api/admin/stats` | 6 ms |
| `/api/admin/enquiries` (1,500 rows) | 3 ms |

**Page 100 is as fast as page 1** — the proof that pagination is genuinely server-side.

---

## Architecture guarantees — verified, not assumed

| Requirement | How it was verified | Result |
| --- | --- | --- |
| Never load 2,000+ properties into the browser | Requested `?limit=5000` | Clamped to 48 rows |
| No unnecessary columns | Inspected a list row | 25 fields, `description` excluded |
| DB-side filtering/sorting/pagination | `EXPLAIN ANALYZE` on every filter path | All index-driven |
| Debounced search | Code + request trace | 400 ms, no duplicate requests |
| No admin JS on public pages | Per-route chunk audit | **0 admin chunks** on `/`, `/properties`, `/contact` |
| Admin fast with thousands of rows | Rendered list at 2,218 properties | **12 rows rendered**, ~1.2 s on 4× throttled CPU |
| Analytics never blocks rendering | Code path | Fire-and-forget, error swallowed |
| Animations don't thrash layout | Audited every transition | `transform`/`opacity` only |
| `prefers-reduced-motion` | CSS audit | Respected |
| No secrets in the bundle | Scanned `dist/` | Clean |

---

## One decision worth flagging

Supabase can resize images on the fly, which would give uploaded property photos the same
treatment as the bundled ones. **But image transformation is a paid Supabase feature** —
on the free plan that endpoint errors and every uploaded photo breaks.

So it is **opt-in** via `VITE_SUPABASE_IMAGE_TRANSFORMS=false` (default off). Turn it on
only if your plan includes it. It's a boolean, not a credential. With it off, uploaded
images still lazy-load and are still correctly sized by CSS — they just aren't resized
server-side.

---

## Regression

No functionality was traded for speed:

- **80/80** API assertions
- **50/50** admin flow assertions
- **14 routes × 2 viewports** — zero console errors, zero horizontal overflow
- All three migrations apply cleanly to a fresh database, including the new indexes
- The approved Stitch design is visually unchanged (verified by screenshot)

## Reproducing

```bash
npm run perf -- /properties slow    # measure any route under throttling
npm run assets                      # regenerate icons, images and fonts
node .qa/bulk-load.mjs              # load 2,200 synthetic properties
node .qa/cls.mjs /about             # attribute layout shift to a DOM node
```

Generated assets are committed, so Vercel builds need no image or font toolchain.
