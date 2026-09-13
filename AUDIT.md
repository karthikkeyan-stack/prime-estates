# Prime Estates — Production Readiness Audit

**Date:** 13 September 2026
**Scope:** GitHub → Supabase → Vercel deployment readiness
**Verdict:** **Code is production-ready. Deployment is blocked — no credentials were available to me.**

Everything below was *executed and observed*, not inferred from reading code. Where I
could not verify something, it says so explicitly.

---

## The headline

The audit found **five genuine production-breaking defects**. All five are fixed and
re-verified. The most serious one would have put a hard-coded admin password on the
public internet.

| # | Defect | Severity | Status |
|---|---|---|---|
| 1 | Hard-coded admin credentials (`admin@primeestates.in` / `PrimeEstates@2008`) compiled into the server | **Critical** | Fixed |
| 2 | No serverless entrypoint — Vercel would have deployed a site whose every API call 404s | **Critical** | Fixed |
| 3 | Production could silently fall back to an embedded throwaway database, losing all data on each cold start | **Critical** | Fixed |
| 4 | Image uploads wrote to the serverless filesystem — read-only and ephemeral, so uploads would fail or vanish | **High** | Fixed |
| 5 | README/`.env.example` documented Supabase support that did not exist in code | **High** | Fixed (now true) |

---

## 1–5. What was actually broken

### 1. Hard-coded admin credentials — Critical
`server/auth.mjs` contained a literal fallback admin login. Anyone who read the public
repo would have had the keys to the admin panel of every deployment that didn't override
them.

**Fix:** removed entirely. In production the server now *refuses to boot* without
`ADMIN_EMAIL` and `ADMIN_PASSWORD` (minimum 12 characters). In development it generates a
random password and prints it once. There is no default account anywhere.

### 2. No serverless entrypoint — Critical
`vercel.json` pointed at a static build, and the API only existed as a long-lived
`app.listen` server. Vercel cannot run that. The site would have deployed, looked fine,
and then every property listing, search, and enquiry would have failed — because the
frontend is entirely database-driven.

**Fix:** added `api/index.mjs`, which exports the Express app as a serverless function
(no `listen`), with a memoised per-instance boot that resets on failure so a transient
database error doesn't poison a warm container. Rewrote `vercel.json` with function
config, API/SEO rewrites, and an SPA fallback that excludes real asset paths.

### 3. Silent database fallback — Critical
If `DATABASE_URL` were missing or mistyped in Vercel's dashboard, the app fell back to
embedded PGlite. The site would have *appeared* to work while writing to a temporary
filesystem — every enquiry captured would be destroyed on the next cold start, invisibly.

**Fix:** production hard-fails with a loud error. Also tuned the pool for serverless
(`max: 1`, `allowExitOnIdle`, connection timeouts) so concurrent functions don't exhaust
Postgres connections.

### 4. Uploads to a read-only filesystem — High
Image uploads wrote to `public/uploads` via direct `fs` calls. On Vercel that is
read-only and ephemeral.

**Fix:** wrote `server/storage.mjs`, a real Supabase Storage adapter (the SDK was not
even installed before). It keeps the local-disk path for development and refuses to boot
in production if Storage isn't configured.

### 5. Documentation claimed capabilities that didn't exist — High
The README stated Supabase Auth and Storage were "ready to enable via env vars." That was
false: no adapter, no SDK, no code path. A client following the README would have hit a
wall.

**Fix:** Storage is now genuinely implemented, so that claim is true. The Auth claim is
**retracted and replaced with an accurate explanation** — see §14.

---

## 6–11. Verification performed

I installed **real PostgreSQL 17.11** rather than testing against the embedded database,
because the whole point was to find things that only break on real infrastructure.

### 6. Migrations — verified, and an earlier verdict corrected
An earlier check reported all migrations failing. **That was a false alarm caused by my
own test harness** (grepping for the string "ERROR" in output that legitimately contained
it). Re-run properly with `ON_ERROR_STOP=1` and real exit codes, **all three migrations
apply cleanly**: 9 tables, RLS on all 9, 26 policies, 13 indexes on `properties`.

I'm flagging this because the earlier reading was wrong and you may have seen it.

### 7. RLS — proven by attack, not assumed
I created an anonymous role and *tried to break in*:

| Attack as `anon` | Result |
|---|---|
| Read published properties | Allowed (correct) |
| Read an unpublished draft | **0 rows** — blocked |
| Read customer enquiries | **0 rows** — blocked |
| Insert a property | **Rejected** |
| Modify site settings | **Rejected** |
| Grant self admin rights | **Rejected** |

### 8. A real finding buried in that test
Anonymous `INSERT INTO enquiries ... RETURNING id` fails, while the same insert without
`RETURNING` succeeds. Root cause: `RETURNING` requires SELECT permission, which `anon`
must never have — it would expose every customer's phone number.

**This is correct behaviour and must not be "fixed."** The trap is that the obvious fix
(adding an anon SELECT policy) would leak your entire enquiry database. I documented this
directly in the migration file so a future developer doesn't make that mistake. Any
client code must call `.insert(payload)` **without** `.select()`.

### 9. Full test suite against real PostgreSQL, through the serverless handler
Built a Vercel simulator (`.qa/serverless-sim.mjs`) that loads the actual
`api/index.mjs` and applies the real `vercel.json` routing:

- **80/80** API assertions
- **50/50** admin flow assertions (Playwright)
- **14 routes × 2 viewports** — zero console errors, zero horizontal overflow
- `/api/health` confirms `driver: postgres`

### 10. Upload security — tested with hostile files
| Payload | Result |
|---|---|
| Shell script renamed `.png` | **Rejected** — content doesn't match type |
| SVG with `onload` XSS | **Rejected** — type not allowed |
| 9 MB file | **Rejected** — over 8 MB cap |
| Genuine PNG | Accepted |

Validation uses **magic numbers**, not the declared MIME type, which a client controls.

### 11. Supabase Storage adapter — tested over real HTTP
I ran a stand-in Storage API and confirmed the adapter performs genuine authenticated
uploads and deletes (bearer token, correct object paths, real bytes), returning
`backend: "supabase"`. Not just "it compiles."

---

## 12–15. Security review

### 12. No secrets reach the browser — verified in the built bundle
Scanned `dist/` for service-role keys, JWTs, connection strings, and passwords: **all
clean**. The frontend references **zero** `VITE_` variables — it never talks to Supabase
directly, only to this app's own API, so there is no key to leak.

### 13. Production guards — each one triggered deliberately
| Removed variable | Result |
|---|---|
| `DATABASE_URL` | Refuses to boot |
| `ADMIN_EMAIL`/`ADMIN_PASSWORD` | Refuses to boot |
| 5-character password | Refuses to boot |
| Supabase Storage config | Refuses to boot |

### 14. One thing I want to be straight about
**Supabase Auth is still not implemented, and I am not claiming it is.**

Admin login is this app's own implementation: scrypt-hashed passwords, random 256-bit
session tokens in the database, HttpOnly/SameSite/Secure cookies. It is real server-side
authentication — there is no fake frontend password check — and it is safe to ship.

But it is **not** Supabase Auth. The practical consequence: **do not create the admin
login through the Supabase dashboard's Authentication tab** — that user cannot sign in
here. Use `ADMIN_EMAIL`/`ADMIN_PASSWORD`. The `auth.users` scaffolding exists in the
migrations so the RLS policies are correct and a future switch is possible. This is now
documented in README §7.4.

### 15. Test credentials removed
The QA harnesses had the old hard-coded password baked in; they now require environment
variables and exit if unset.

---

## 16–18. Repository, docs, build

### 16. Git — initialized
The project was **not a git repository**, so nothing was recoverable. Now committed: 66
files, one clean commit. Verified that `.env`, `data/`, and `node_modules` are **not**
staged.

### 17. Documentation corrected
- `.env.example` rewritten — it documented `SESSION_SECRET` (never read by any code) and
  `VITE_SUPABASE_*` (would publish keys to the browser), while **omitting `SUPABASE_URL`**,
  which the adapter actually requires.
- README: env table now marks what's genuinely mandatory; Vercel section rewritten (it
  previously said Vercel *couldn't* run the API); added the pooler-port warning (`6543`,
  not `5432` — direct connections exhaust under serverless).

### 18. Build health
TypeScript strict: clean. Build: clean. Bundle unchanged — `vendor` 164.51 kB
(53.76 kB gzipped), CSS 59.27 kB (9.98 kB gzipped), with route-level code splitting.
Seeding is **disabled on Vercel** so demo listings can never appear on a client's live site.

---

## 19–21. What I could not do, and what you must do

### 19. Deployment is blocked — this is the one thing I could not complete
I checked for every credential and CLI needed to deploy. **None were present:** no GitHub
token, no `gh`, no Vercel token or CLI, no Supabase token or CLI. I cannot create your
GitHub repo, Supabase project, or Vercel deployment, and I won't pretend otherwise.

What I did instead: made the deployment *reproducible and verified locally* against real
PostgreSQL through the real serverless handler, so the live deploy is configuration, not
debugging.

### 20. Your steps (~20 minutes)

**1. GitHub** — the repo is committed locally:
```bash
git remote add origin https://github.com/<you>/prime-estates.git
git push -u origin main
```

**2. Supabase** — create a project, then run the three files in `supabase/migrations/`
in order in the SQL editor. Confirm the `property-images` bucket exists.

**3. Vercel** — import the repo, then set these Production variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Pooler string, **port 6543** |
| `ADMIN_EMAIL` | Your admin login |
| `ADMIN_PASSWORD` | **12+ characters** |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **never** with a `VITE_` prefix |
| `NODE_ENV` | `production` |

**4. Verify** — open `/api/health`. It must show:
```json
{ "db": { "driver": "postgres" }, "storage": { "backend": "supabase", "ok": true } }
```
If it says `pglite` or `local`, a variable didn't reach the function. If the deploy fails
at boot, read the error — the guards name the missing variable.

**5. Load real data** — the live site starts empty by design. Add listings through
`/admin`, or seed once locally against the production `DATABASE_URL`.

### 21. Two decisions left to you, deliberately

- **Contact email and address are blank** in Settings, as you instructed. The public site
  hides them until filled, and the Contact map has no invented pin. Fill them in
  **Admin → Settings** when you have verified details.
- **The 18 demo properties are demo data.** They're realistic and regionally accurate so
  the site never looks empty, but they are not represented as Prime Estates listings.
  Replace them before launch.

---

## Honest summary

The code is production-ready and I verified that against real infrastructure rather than
assuming it. Three of the five defects I found would have caused **silent** failure —
credentials in a public repo, enquiries vanishing into a temporary database, uploads
disappearing — the kind that surfaces after a client has been using the site for a week.

The remaining gap is entirely credentials. I can't deploy without them, and I'd rather
tell you that plainly than hand you a green checkmark I didn't earn.
