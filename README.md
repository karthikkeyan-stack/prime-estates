# Prime Estates — Website & Admin Panel

Full-stack website and admin console for **Prime Estates**, real estate consultants and
developers in Coimbatore, Tamil Nadu (established 2008). Residential and commercial
property for outright purchase and rental in and around Coimbatore and the neighbouring
districts of Tirupur, Pollachi, Ooty, Erode and Palakkad.

- **Public site** — React + Vite + TypeScript + Tailwind, built to the approved design.
- **Admin console** — property CRUD, image management, enquiry pipeline, site settings.
- **Database-driven** — every property, category, location, service, gallery item and
  setting is read from PostgreSQL. There are no hard-coded property cards anywhere.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [How the backend works](#2-how-the-backend-works)
3. [Environment variables](#3-environment-variables)
4. [Project structure](#4-project-structure)
5. [Database schema](#5-database-schema)
6. [Admin panel guide](#6-admin-panel-guide)
7. [Moving to Supabase](#7-moving-to-supabase)
8. [Deployment](#8-deployment)
9. [Testing](#9-testing)
10. [Performance](#10-performance)
11. [Security notes](#11-security-notes)
12. [Replacing the demo data](#12-replacing-the-demo-data)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Quick start

Requires **Node.js 20+**.

```bash
git clone <your-repo-url> prime-estates
cd prime-estates
npm install

cp .env.example .env
#  For LOCAL development you can leave .env entirely blank:
#    • no DATABASE_URL  → bundled embedded Postgres (PGlite), zero setup
#    • no ADMIN_*       → a random admin password is generated and printed once
#  Set ADMIN_EMAIL + ADMIN_PASSWORD if you prefer a login you choose yourself.

npm run dev
```

Open **http://localhost:3000**. The admin console is at **/admin**.

On first boot the console prints the admin login, e.g.

```
[auth] admin user created: admin@prime.local
[auth] generated dev password: 7f2c9a41bd0e4c8b   (shown once — set ADMIN_PASSWORD to choose your own)
```

The database is seeded with 18 demo properties so every page has realistic content
immediately. They are clearly demo data, not listings owned by Prime Estates.

On first boot the server automatically:

1. creates the schema (10 tables + indexes),
2. creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`,
3. seeds reference data and 18 demo properties.

No database installation is needed for local development — see below.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR on port 3000 (API + site on one origin) |
| `npm run build` | Type-check and build the production bundle to `dist/` |
| `npm start` | Serve the production build (`server/prod.mjs`) |
| `npm run seed` | Seed reference + demo data (idempotent) |
| `npm run seed -- --force` | Wipe and re-seed demo content |
| `npm run typecheck` | `tsc --noEmit` |

---

## 2. How the backend works

The app talks to PostgreSQL through one thin adapter, `server/db.mjs`, which picks a
driver at boot:

| `DATABASE_URL` | Driver | Use case |
| --- | --- | --- |
| **empty** | **PGlite** — embedded PostgreSQL, data in `./data/pgdata` | Local development, zero setup |
| **set** | **`pg`** connection pool | Real PostgreSQL, Supabase, RDS, Neon… |

Both drivers expose the same `query` / `rows` / `one` / `exec` interface, so **no
application code changes** when you switch. The SQL is plain PostgreSQL — the same
schema runs in all cases.

Because PGlite *is* PostgreSQL (compiled to WASM), what you build locally behaves the
same on a hosted database.

> **Data directory:** `./data/pgdata` is git-ignored. Delete it to reset your local
> database; the next boot recreates and re-seeds it.

### Architecture at a glance

```
Browser ──► Express (server/) ──► PostgreSQL
            │  /api/*                (PGlite or pg)
            └─ Vite middleware (dev) / static dist (prod)
```

Filtering, sorting, searching and pagination all run **as SQL in the database**. The
browser only ever receives the current page of results (default 9, max 48), so the
architecture scales to thousands of listings without changing the frontend.

---

## 3. Environment variables

Copy `.env.example` → `.env`. **Never commit `.env`.**

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `PORT` | no | `3000` | HTTP port (ignored on Vercel) |
| `NODE_ENV` | no | `development` | `production` enables secure cookies + boot guards |
| `ADMIN_EMAIL` | **yes in production** | — | No default account exists |
| `ADMIN_PASSWORD` | **yes in production** | — | Must be **≥ 12 characters** |
| `DATABASE_URL` | **yes in production** | empty → PGlite | Supabase: use the **pooler** (port `6543`) |
| `SUPABASE_URL` | **yes in production** | — | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes in production** | — | **Server only.** Never prefix with `VITE_` |
| `SUPABASE_STORAGE_BUCKET` | no | `property-images` | Storage bucket name |
| `SEED_ON_BOOT` | no | `true` locally | Never seeds on Vercel |

**These are enforced, not merely documented.** With `NODE_ENV=production` the server
refuses to boot if `DATABASE_URL` is missing (it will not silently fall back to a
throwaway embedded database), if `ADMIN_EMAIL`/`ADMIN_PASSWORD` are missing or the
password is under 12 characters, or if Supabase Storage is unconfigured (a serverless
filesystem cannot retain uploads). Each failure is a loud startup error.

> ⚠️ Only variables prefixed `VITE_` are exposed to the browser — and this app
> deliberately uses **none**. The frontend never talks to Supabase directly; it only
> calls this app's own `/api` routes, so no key of any kind ships to the browser.
> The service-role key bypasses every RLS policy, so it must never carry a `VITE_`
> prefix.

**`SESSION_SECRET` is not used.** Sessions are not signed cookies — they are random
256-bit tokens stored in `admin_sessions` and matched server-side. There is no signing
secret to leak or rotate.

---

## 4. Project structure

```
prime-estates/
├── server/                   # Express API + SSR-less host
│   ├── db.mjs                # Driver selection (PGlite | pg) + query helpers
│   ├── schema.sql            # PostgreSQL DDL — 10 tables + indexes
│   ├── auth.mjs              # scrypt hashing, DB sessions, HttpOnly cookies
│   ├── api.mjs               # All REST endpoints, validation, uploads
│   ├── seed.mjs              # Idempotent reference + demo data
│   ├── dev.mjs               # Dev server (Vite middleware + API)
│   └── prod.mjs              # Production server (static dist + API)
├── src/
│   ├── pages/                # Public routes
│   ├── admin/                # Admin console (lazy-loaded, separate chunks)
│   ├── components/           # Layout, PropertyCard, EnquiryForm, UI primitives
│   ├── lib/                  # api client, types, formatters, settings store, SEO
│   └── hooks/                # useReveal, useDebounced, useScrollLock, …
├── supabase/migrations/      # Supabase schema + RLS + reference data
├── public/
│   ├── media/                # Demo imagery
│   └── uploads/              # Admin-uploaded images (local driver)
├── .qa/                      # Automated test harnesses
└── vercel.json
```

### Routes

| Public | Admin |
| --- | --- |
| `/` | `/admin` (login) |
| `/properties` | `/admin` (dashboard) |
| `/properties/:slug` | `/admin/properties` |
| `/about` | `/admin/properties/new` |
| `/services` | `/admin/properties/:id` |
| `/locations` | `/admin/enquiries` |
| `/gallery` | `/admin/settings` |
| `/contact` | |
| 404 catch-all | |

Filter state lives in the URL, so any view is shareable and bookmarkable:
`/properties?type=villa&listing=sale&location=coimbatore&sort=price_desc&page=2`

---

## 5. Database schema

Ten tables (`server/schema.sql`):

| Table | Purpose |
| --- | --- |
| `properties` | The catalogue — 40 columns, fully indexed |
| `property_images` | Gallery per property, with primary flag and ordering |
| `property_categories` | Property types (editable, not hard-coded) |
| `locations` | Regions served (editable) |
| `services` | Service offerings |
| `enquiries` | Customer enquiries + status pipeline + internal notes |
| `gallery_items` | Standalone gallery |
| `site_settings` | Key/value — new keys need no migration |
| `admin_users` | Local auth (replaced by Supabase Auth when enabled) |
| `admin_sessions` | Server-side sessions |

**Enums** (validated in the API, stored as text so new values need no migration):

- **Property types** — apartment, villa, independent-house, plot, commercial, office,
  shop, showroom, investment, farmhouse, other
- **Listing types** — sale, rent, lease
- **Statuses** — available, featured, sold, rented, draft, archived

**Indexes** cover the catalogue's filter/sort matrix: `published`, `status`,
`property_type`, `listing_type`, `location_slug`, `price`, `bedrooms`, `created_at`,
a partial index on `featured`, and a composite `idx_prop_browse` matching the default
query shape. The Supabase migration adds a GIN full-text index as well.

---

## 6. Admin panel guide

Sign in at `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**Dashboard** — live counts straight from the database (total, published, drafts,
featured, available, sold/rented, images, page views, enquiries), recent enquiries,
recently added properties, and a portfolio-by-type breakdown. No figure is fabricated.

**Properties** — searchable, filterable table (desktop) / cards (mobile) with:
- inline publish and featured toggles
- preview, edit, archive, delete
- pagination, and filter state kept in the URL

**Add / Edit property** — a sectioned form: basic info, type & listing, pricing,
location, specifications, description, amenities & highlights, images, SEO. Includes
live slug generation, live price formatting (₹1.45 Cr), inline validation, unsaved-change
warnings, a card preview, and confirmation on delete.

**Images** — drag-and-drop or file picker, multiple uploads, thumbnail previews,
set-primary, reorder, remove. Type and size are validated on the server (JPG/PNG/WebP/AVIF,
max 8 MB); the extension is derived from the sniffed MIME type, never from user input.
Deleting a property also removes the image files it owned.

**Enquiries** — list with search and status tabs (new / contacted / closed), detail
drawer with full context, internal notes, one-tap **Call** and **WhatsApp** reply,
archive and delete.

**Settings** — business identity, contact details, social links, SEO defaults and
footer text. These drive the whole public site; nothing is hard-coded in components.

> Email and office address ship **blank on purpose**. The public site hides those
> fields until they are filled in, so no unverified contact detail is ever published.

---

## 7. Moving to Supabase

The app runs on embedded PostgreSQL out of the box. To move to Supabase:

### 7.1 Create the project

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database** → copy the connection string.
3. **Project Settings → API** → copy the Project URL and the `anon` key.

### 7.2 Apply the migrations

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Or paste these into the SQL editor, in order:

| File | Contents |
| --- | --- |
| `supabase/migrations/20250101000000_initial_schema.sql` | Tables, indexes, triggers, `is_admin()` |
| `supabase/migrations/20250101000001_rls_policies.sql` | RLS on every table + storage bucket |
| `supabase/migrations/20250101000002_seed_reference_data.sql` | Categories, locations, services, settings |

### 7.3 Point the app at it

```bash
# Use the CONNECTION POOLER (port 6543), not 5432 — serverless functions
# open many short-lived connections and will exhaust a direct connection.
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server only, never VITE_
SUPABASE_STORAGE_BUCKET=property-images
```

Restart. The app now uses the `pg` driver against Supabase, and image uploads go to
Supabase Storage instead of local disk. Confirm both at `/api/health`, which reports
the live driver and storage backend:

```json
{ "ok": true, "db": { "driver": "postgres" },
  "storage": { "backend": "supabase", "ok": true, "bucket": "property-images" } }
```

If `driver` still says `pglite` or `backend` says `local`, the variables did not reach
the running process.

### 7.4 How admin authentication actually works

**This app does not use Supabase Auth.** Admin login is implemented in `server/auth.mjs`:
scrypt-hashed passwords in `admin_users`, plus random 256-bit session tokens in
`admin_sessions` delivered as an HttpOnly, SameSite=Lax, Secure cookie. It is real
server-side authentication — there is no frontend-only password check — but it is this
app's own implementation, not Supabase's.

Consequences worth understanding before you deploy:

- You create the admin by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Do **not** create
  the login through the Supabase dashboard's Authentication tab — that user would not be
  able to sign in here.
- The `auth.users` table, `auth.uid()`, `is_admin()` and the `admin_profiles` table exist
  in the migrations so that the **RLS policies** are correct and ready if you later adopt
  Supabase Auth, or if you connect other clients directly to the database. They are not
  on this app's login path.
- Because the server connects with the service-role key / database owner, it bypasses
  RLS. RLS is the second line of defence protecting the database from *direct* client
  access — the API's own `requireAuth` middleware is what protects these endpoints.

Switching to Supabase Auth later means replacing `server/auth.mjs` and the admin login
screen; the schema and policies already support it.

### 7.5 Storage

`20250101000001_rls_policies.sql` creates a public-read `property-images` bucket
(8 MB limit, images only) with admin-only writes. `server/storage.mjs` uploads through
the Supabase Storage API using the service-role key, verifies each file's **magic number**
(not just its declared MIME type, so a renamed script or an SVG XSS payload is rejected),
caps uploads at 8 MB, and deletes objects when an image or property is removed. With the
variables unset it falls back to `public/uploads` for local development only.

### RLS summary

| Role | Properties | Enquiries | Settings |
| --- | --- | --- | --- |
| `anon` | read published only | **insert only** | read |
| admin (`admin_profiles`) | full access | full access | full access |
| `service_role` | bypasses RLS (server only) | — | — |

Enquiries hold customer phone numbers, so there is deliberately **no public SELECT
policy** on that table: the public can submit, but only admins can read.

---

## 8. Deployment

### 8.1 Deploying to Vercel

The repo includes `api/index.mjs`, which exports the Express app as a **serverless
function** (no `app.listen`), and a `vercel.json` that routes to it. The whole app —
site and API — runs on Vercel as one project.

| Request | Handled by |
| --- | --- |
| `/api/*` | `api/index.mjs` serverless function |
| `/sitemap.xml`, `/robots.txt` | same function (generated from the database) |
| `/assets/*`, `/media/*` | static CDN, immutable cache |
| everything else | `dist/index.html` (SPA fallback, so deep links and refreshes work) |

**Steps**

1. Push the repo to GitHub.
2. In Vercel, **Add New → Project** and import it. The build settings are detected
   (`npm run build` → `dist`).
3. Add the environment variables from §3 to **Production**:
   `DATABASE_URL` (Supabase **pooler**, port 6543), `ADMIN_EMAIL`,
   `ADMIN_PASSWORD` (≥ 12 chars), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NODE_ENV=production`.
4. Deploy, then open `/api/health`. It must report
   `"driver": "postgres"` and `"backend": "supabase"`.

**Two things that are deliberate, not oversights**

- **Seeding never runs on Vercel.** Demo listings must not appear on a client's live
  site. Load real data through the admin panel, or run the seed once locally against the
  production `DATABASE_URL`.
- **The database must be reachable from Vercel.** Supabase, Neon and RDS-with-public-
  access all work; a database on a private network will not.

### 8.2 Any Node host (Railway, Render, Fly.io, VPS)

```bash
npm ci
npm run build
npm start          # serves dist/ + /api on $PORT
```

Set the same production variables. This path uses `server/prod.mjs` (a normal
long-lived Express server) instead of the serverless entrypoint.

### 8.2b Production checklist

- [ ] `NODE_ENV=production`
- [ ] `ADMIN_EMAIL` + `ADMIN_PASSWORD` (≥ 12 chars) set — no default account exists
- [ ] `DATABASE_URL` pointing at managed PostgreSQL with backups (pooler on Vercel)
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set — uploads fail without them
- [ ] Service-role key stored only as a server-side variable, never `VITE_`-prefixed
- [ ] Migrations applied (§7.2)
- [ ] `/api/health` shows `postgres` + `supabase`
- [ ] `site_url` set in **Admin → Settings** (drives canonicals + sitemap)
- [ ] Demo listings replaced with, or clearly distinguished from, real ones
- [ ] Real contact email/address filled in, or intentionally left blank
- [ ] `.env` not committed

### 8.3 SEO

Per-page titles, meta descriptions, canonicals, Open Graph tags, semantic landmarks,
a single `<h1>` per page, alt text on every image, `JSON-LD` structured data
(`RealEstateAgent` + `Offer`), plus `/robots.txt` and a database-driven
`/sitemap.xml` that lists every published property. Set `site_url` in Admin → Settings
so canonical URLs and the sitemap use your real domain.

---

## 9. Testing

Three harnesses live in `.qa/` and run against a live dev server.

```bash
npm run dev            # in one terminal

node .qa/api-test.mjs    # 80 API assertions
node .qa/routes.mjs      # every route × desktop + mobile
node .qa/admin-flow.mjs  # full admin journey in a real browser
```

They need Chromium once: `npx playwright install chromium`.

| Harness | Covers |
| --- | --- |
| `api-test.mjs` | Filtering, sorting, pagination, facets, search, detail, enquiry validation, auth rejection, full admin CRUD, image upload + MIME rejection, settings, logout invalidation |
| `routes.mjs` | Console errors, failed requests, horizontal overflow, `<h1>` count, missing alt text, broken images, SEO tags — at 1440px and 390px |
| `admin-flow.mjs` | Login (wrong + right), dashboard, search, validation, create, upload, toggles, public reflection, enquiry pipeline, settings persistence, delete, mobile widths, logout |

Current status: **80/80**, **all routes clean**, **50/50**.

---

## 10. Performance

Performance was treated as a feature, measured on **Slow 4G with 4x CPU throttling**
(a mid-range Android phone on an average Indian mobile network), not on a desktop
connection.

### Results

| Route | LCP | CLS | Requests | Transferred |
| --- | --- | --- | --- | --- |
| `/` | 1.32 s | 0.0007 | 16 | 206 KB |
| `/properties` | 1.95 s | 0 | 17 | 201 KB |
| `/properties?type=villa&listing=sale` | 1.82 s | 0 | 15 | 172 KB |
| `/properties/:slug` | 1.82 s | 0 | 15 | 194 KB |
| `/about` | 1.39 s | 0 | 12 | 173 KB |
| `/gallery` | 1.64 s | 0 | 16 | 201 KB |
| `/contact` | 1.38 s | 0 | 10 | 159 KB |

Homepage before this work: **LCP 3.14 s, 672 KB**. After: **1.32 s, 206 KB**.

### The five things that actually mattered

1. **A 3.9 MB icon font.** The Material Symbols *variable font* was being downloaded to
   render 77 glyphs. Those glyphs are now inlined as SVG path data
   (`src/components/icon-paths.ts`, ~26 KB of source, tree-shaken and compressed). No
   request, no FOUT. This was by far the largest single win.
2. **Full-resolution images on phone-sized cards.** A 390px-wide card was downloading a
   1408px JPEG. `.qa/gen-images.mjs` generates AVIF/WebP/JPEG at 400/800/1408px and
   `<Img>` emits a `<picture>` with proper `sizes`. A card image went **266 KB -> 12 KB**.
3. **Google Maps loading eagerly.** The embed pulled ~1.6 MB of third-party JavaScript
   across ~19 requests on both the contact and property detail pages — `loading="lazy"`
   does not help when the map is inside the first viewport on mobile. It is now a
   click-to-load facade (`MapEmbed`). Detail page: **641 KB -> 194 KB**.
4. **Layout shift.** Property detail measured **CLS 0.83** because the loading skeleton
   had a different wrapper to the loaded page, so the entire column changed width and
   position. Skeletons now mirror the real structure, and asynchronous text
   (`settings.description`, gallery filter chips) has its height reserved. Every page is
   now **CLS 0**.
5. **Fonts.** Self-hosted (no third-party DNS + TLS handshake), variable fonts instead of
   6 static weights, latin subset only, and **metric-matched fallbacks** with
   `size-adjust` so the swap does not re-wrap text. 146 KB across 6 files -> 81 KB across 3.

### Database

Measured with **2,218 properties and 1,500 enquiries** loaded (`.qa/bulk-load.mjs`):

| Query | Before | After |
| --- | --- | --- |
| Default catalogue sort | 2.586 ms (seq scan + sort) | **0.044 ms** (index scan) |
| Substring search | 1.445 ms (seq scan) | **0.097 ms** (trigram index) |

The fix was partial indexes matching the exact predicate every public query uses
(`published = true AND status NOT IN ('draft','archived')`), so Postgres walks the index
in sort order and stops at `LIMIT` with no sort step — plus a `pg_trgm` GIN index,
because the existing full-text index cannot serve `ILIKE '%foo%'`.

Every API endpoint responds in **1-6 ms** at that volume, and page 100 is as fast as
page 1. Admin endpoints stay at 3-6 ms.

### Architecture guarantees (verified, not assumed)

- The browser never receives more than one page of properties. `limit` is clamped
  server-side: a hostile `?limit=5000` returns 48 rows.
- List responses omit the `description` column — 25 fields, not the full record.
- Filtering, sorting, searching and pagination all run in SQL. Nothing is filtered in
  JavaScript.
- **Admin JavaScript never loads on public pages** (verified per-route: 0 admin chunks).
- The admin property list renders 12 rows out of 2,218 — pagination is real at the UI
  layer, not just the API.
- Search inputs are debounced (400 ms); no duplicate requests were observed on any page.
- View counting is fire-and-forget with a swallowed error, so analytics can never block
  or break a page render.
- Animations use `transform`/`opacity` only, and `prefers-reduced-motion` is respected.

### Regenerating assets

Generated assets are **committed**, so Vercel builds stay fast and need no image or font
toolchain. Re-run these only when the source assets change:

```bash
npm run assets:icons     # rescans src/ for icon names, regenerates icon-paths.ts
npm run assets:images    # AVIF/WebP/JPEG derivatives for public/media
npm run assets:fonts     # re-download + re-subset the webfonts
npm run assets           # all three
```

To re-measure: `npm run perf -- /properties slow` (requires a running server).

---

## 11. Security notes

- **Passwords** — hashed with `scrypt` and a per-user random salt; verified in constant
  time. Plaintext is never stored or logged.
- **Sessions** — random 32-byte tokens stored server-side, sent as an `HttpOnly`,
  `SameSite=Lax` cookie (`Secure` in production). Logout deletes the row, so the token
  dies immediately. No JWT in `localStorage`.
- **Authorisation** — every `/api/admin/*` route is guarded server-side by `requireAuth`.
  The React guard only decides what to *render*; hiding UI is never the security boundary.
- **No fake auth** — there is no frontend-only password check anywhere.
- **Input validation** — all writes are validated server-side and return field-level
  errors. Every query is parameterised, so there is no SQL injection surface.
- **Uploads** — MIME allowlist (JPG/PNG/WebP/AVIF), 8 MB cap, extension derived from the
  sniffed type, filenames randomised. Large binaries are never stored in PostgreSQL.
- **Secrets** — only `VITE_`-prefixed variables reach the browser. The service-role key,
  database password and session secret stay server-side.
- **RLS** — enabled on every Supabase table; anonymous users can read published content
  and submit enquiries, nothing more.

---

## 12. Replacing the demo data

The 18 seeded properties are **demonstration data** to show the system working. They are
not represented as listings owned by or available through Prime Estates, and the site
carries a `demo_notice` setting saying so.

To go live with real listings:

1. Sign in to `/admin`.
2. Delete the demo properties (or archive them to keep the URLs reserved).
3. Add real listings via **Add Property**, uploading genuine photography.
4. Update **Settings** with the verified email, address and social links.
5. Clear the `demo_notice` setting to remove the banner.
6. Set `SEED_ON_BOOT=false` so the demo set is never recreated.

Reference data (categories, locations, services) is safe to keep and is editable in the
database.

---

## 13. Troubleshooting

**`42601: cannot insert multiple commands into a prepared statement`**
Multi-statement SQL must go through `exec()`, not `query()`. `server/db.mjs` already
handles this — keep using `driver.exec(sql)` for scripts.

**Admin login fails on first boot**
The admin user is created only when the table is empty. Either delete `./data/pgdata`
and restart, or insert a user manually. Changing `ADMIN_PASSWORD` after the first boot
does not update an existing user.

**Port 3000 already in use**
Set `PORT=4000` in `.env`.

**Images upload but do not appear**
Confirm `public/uploads/` exists and is writable. On ephemeral hosts (including Vercel's
serverless filesystem) local uploads do not persist — use Supabase Storage in production.

**`RuntimeError: Aborted()` on startup, or the server exits immediately**
The embedded datastore could not be opened. This normally means the process was
killed mid-write, or `data/pgdata` was copied/restored while the server was running.

`server/db.mjs` now handles both cases automatically on boot: it clears stale
`postmaster.pid` / socket locks first, and if the directory is genuinely unreadable it
moves it to `data/pgdata-corrupt-<timestamp>` and builds a fresh database from
`schema.sql` + `seed.mjs`. Demo content is fully reproducible, but **listings you added
through the admin panel are not carried over** — so use a real PostgreSQL
`DATABASE_URL` (with backups) for anything you cannot afford to lose.

To recover manually:
```bash
rm -f data/pgdata/postmaster.pid        # stale lock only
rm -rf data/pgdata && npm run dev       # full rebuild
```

**Dependencies or browsers disappear between sessions**
`node_modules/` and Playwright's browser cache are not part of the saved workspace.
Restore them with:
```bash
npm install
npx playwright install chromium         # only needed to run the .qa/ harnesses
```

**Reset everything locally**
```bash
rm -rf data/pgdata && npm run dev
```

---

## Licence & credits

Built for Prime Estates, Coimbatore. Demo imagery is illustrative. Stack: React 18,
Vite 5, TypeScript 5, Tailwind 3, Express 4, PostgreSQL (PGlite / `pg`), React Router 6.
No heavyweight UI kit — the design system is implemented directly in Tailwind.
