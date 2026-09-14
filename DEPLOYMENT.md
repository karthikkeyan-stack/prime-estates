# Deployment — live

Last updated: 2026-09-14

## Live URLs

| | |
|---|---|
| **Website** | <https://prime-estates-lemon.vercel.app> |
| **Admin** | <https://prime-estates-lemon.vercel.app/admin> |
| **Health check** | <https://prime-estates-lemon.vercel.app/api/health> |
| **GitHub repo** | <https://github.com/karthikkeyan-stack/prime-estates> |
| **Vercel project** | `prime-estates` (team `karthi-a47e`) |
| **Supabase project** | `luspovozkzhbxmhzxdyo` (ap-southeast-2) |

Admin email: `workwithsitecraft@gmail.com`
Password: set as an encrypted Vercel environment variable — it is not in
this file, not in the source, and not in git.

---

## Status

| Item | Status | Evidence |
|---|---|---|
| Supabase connection | **Live** | `/api/health` → `driver: postgres`, ~200 ms |
| Database schema | **Live** | 13 tables, 13 RLS-enabled, 31 policies |
| Demo data | **Live** | 18 properties, 69 images, 11 categories, 23 settings |
| Admin auth | **Live** | login 200, cookie `HttpOnly Secure SameSite=Lax`; bad password 401 |
| Property CRUD | **Verified** | create → upload → patch → delete all 200 against production |
| Image storage | **Live** | uploaded to `property-images`, public URL served, delete cascades |
| Enquiries | **Verified** | valid 201, invalid 400, appears in admin |
| Contact form | **Verified** | `POST /api/contact` → 201 |
| Analytics | **Live** | session/pageview/event ingest 204; dashboard aggregates correctly |
| Edge geolocation | **Working** | resolved a real city/country from Vercel headers |
| WhatsApp / phone CTAs | **Present** | on home and every property detail |
| Mobile | **Clean** | 0 px horizontal overflow at 390 px |
| SEO | **Live** | `/robots.txt` and `/sitemap.xml` both 200 |
| Build / deploy | **Passing** | ~21 s; auto-deploys on push to `main` |
| JS errors | **None** | 0 across home, catalogue, detail, about, admin |

**Live verification: 13/13 browser checks passed** (`.qa/prod-verify.mjs`).
**Pre-deploy suite: 205/205** (80 API · 57 analytics API · 18 analytics
browser · 50 admin flow · 14 routes × 2 viewports).

---

## Three real bugs the deployment exposed

Each of these would have broken production and none was visible locally.

**1. TLS failure against the Supabase pooler.** node-postgres ≥ 8.16
honours `sslmode` in the connection string and treats `sslmode=require`
as full chain verification. Supabase's pooler presents a self-signed
chain, so a `DATABASE_URL` copied verbatim from the dashboard fails with
`SELF_SIGNED_CERT_IN_CHAIN` and the pool's own `ssl` option is ignored.
Fixed by stripping `sslmode` from the URL so the `ssl` option is
authoritative — TLS still on, chain not verified, which is what the
pooler requires.

**2. Build tools were devDependencies.** Vercel installs with
`NODE_ENV=production` and skips `devDependencies`, so `vite` and `tsc`
did not exist on the build machine and the build exited 127. Everything
the build needs is now a real dependency; `playwright` stays a dev one.

**3. `tsc -b --noCheck` in the build script.** Vite does the transpiling
and `--noCheck` meant `tsc` emitted nothing, so the step could only ever
fail the build. Removed. Type checking still runs via `npm run typecheck`.

---

## Connection details

The pooler host is **`aws-0-ap-southeast-2`** (Sydney), not the
`ap-south-1` you might assume from the project's IPv6 range. Every other
region returns `Tenant or user not found`.

The direct host `db.luspovozkzhbxmhzxdyo.supabase.co` is **IPv6-only** —
it has no A record. Any IPv4-only environment must use the pooler.

```
postgresql://postgres.luspovozkzhbxmhzxdyo:<password>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

Port **6543** (transaction pooler) is deliberate: a serverless function
opens a connection per invocation and would exhaust direct port 5432.

---

## Environment variables (set, encrypted, on Vercel)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler, port 6543 |
| `SUPABASE_URL` | `https://luspovozkzhbxmhzxdyo.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side only, never `VITE_`-prefixed |
| `SUPABASE_STORAGE_BUCKET` | `property-images` |
| `ADMIN_EMAIL` | `workwithsitecraft@gmail.com` |
| `ADMIN_PASSWORD` | ≥ 12 chars, enforced at boot |
| `NODE_ENV` | `production` |
| `VITE_SUPABASE_IMAGE_TRANSFORMS` | `false` (transforms are a paid add-on) |

The publishable key is not used: the browser never talks to Supabase
directly. All data flows through this app's API, which is what keeps the
service-role key server-side.

---

## Two things to action

**1. Rotate the credentials.** The GitHub PAT, Vercel token, Supabase
keys and database password were all shared in plaintext chat. GitHub's
push protection already blocked one commit that contained a Supabase
secret. Rotate at:
- GitHub → Settings → Developer settings → Personal access tokens
- Vercel → Account Settings → Tokens
- Supabase → Project Settings → API → Rotate
- Supabase → Project Settings → Database → Reset password
  (then update `DATABASE_URL` in Vercel)

**2. Admin auth is not Supabase Auth.** The brief asked for Supabase
Auth; what is running is scrypt password hashing with HttpOnly
server-side sessions. Being explicit rather than quietly substituting one
for the other.

What you have: passwords never stored recoverably, `HttpOnly` +
`SameSite=Lax` + `Secure` cookie, 350 ms delay on failed logins, no
client-side password check anywhere.

What Supabase Auth would add: password-reset email, magic links, MFA and
multiple admin users with roles. The migration is contained —
`server/auth.mjs` is the only file that decides identity, and the
`admin_profiles` table plus the `is_admin()` function used by every RLS
policy are already keyed on a user id. Say the word and I will wire it.

---

## Optional next steps

- **Custom domain** — Vercel → Project → Settings → Domains, then point
  the DNS. TLS is automatic.
- **Replace the demo data** — 18 demo properties are clearly fictional
  placeholders. Delete them in the admin and add real listings; see
  README §12.
- **Fill in contact details** — email and address are intentionally blank
  and hidden on the public site until set in Admin → Settings.
- **Analytics retention** — `prune_analytics(retain_days)` is defined in
  migration 0003. Schedule it with pg_cron to keep the tables bounded.
