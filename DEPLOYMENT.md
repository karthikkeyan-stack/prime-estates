# Deployment status and remaining steps

Last updated: 2026-09-14

---

## 1. What is actually done

| Step | Status | Evidence |
|---|---|---|
| Code committed | **Done** | `d0b4c52` on `main` |
| Pushed to GitHub | **Done** | <https://github.com/karthikkeyan-stack/prime-estates> — 179/179 files, SHA matches local exactly |
| No secrets in the repo | **Verified** | Only `.env.example`; scanned for `ghp_`, `vck_`, `sb_secret_`, `sb_publishable_`, `SERVICE_ROLE`, `postgresql://` |
| Token kept out of git config | **Verified** | Pushed via a one-shot credential helper; `grep -c ghp_ .git/config` → `0` |
| Vercel project created | **Blocked** | Token is read-only — see §2 |
| Supabase DB / Auth / Storage | **Blocked** | Project URL was never supplied — see §3 |
| Live production URL | **Not available** | Cannot be produced without the two items above |

**Test suite at the pushed commit: 205/205 passing.**
80 API · 57 analytics API · 18 analytics browser · 50 admin flow · 14 routes × 2 viewports · dedupe/duration checks.

---

## 2. Vercel — token lacks write permission

The token authenticates correctly as `karthikkeyan1570-3610`
(`karthikkeyan1570@gmail.com`) but is **read-only**:

```
GET  /v2/user           200   authenticates fine
GET  /v9/projects       200   can read
GET  /v6/deployments    200   can read
POST /v11/projects      403   "You don't have permission to create the project."
POST /v13/deployments   403   "You don't have permission to create a project."
GET  /v2/teams          403
```

Tried in both personal scope and the account's default team
(`team_4IZJZ0dVDFAKwECnrJU73Vi3`) — 403 in both. This is a permission
boundary on the token, not something retrying or a different endpoint can
work around.

Also note: **GitHub is not connected to the Vercel account**
(`/v1/integrations/git-namespaces?provider=github` → 404), so even with a
write token, the one-click "import from GitHub" path needs that
connection made once in the dashboard.

### To finish (about 3 minutes)

Easiest is the dashboard, since the repo is already public:

1. <https://vercel.com/new> → **Import Git Repository** → connect GitHub if
   prompted → pick `karthikkeyan-stack/prime-estates`.
2. Framework preset **Vite** (already declared in `vercel.json`);
   build `npm run build`; output `dist`.
3. Add the environment variables in §4 **before** the first deploy.
4. Deploy.

Or, with a token that has write scope:

```bash
npx vercel --token "$VERCEL_TOKEN" --prod --yes
```

---

## 3. Supabase — the project URL is missing

Two keys were supplied and both are genuine, but neither identifies a project:

| Key | Class | Usable for |
|---|---|---|
| `sb_publishable_…` | publishable (replaces the legacy `anon` key) | browser-side reads under RLS |
| `sb_secret_…` | secret (service-role class) | server-side full access |

Both are **opaque tokens**. The legacy `anon` key was a JWT with the
project ref inside it, so a URL could be derived; these new-format keys
carry no ref:

```
sb_secret_<22 random chars>_<8 random chars>
           └── random, not a project ref (refs are 20 lowercase letters)
```

They are also the wrong class for the Management API
(`GET https://api.supabase.com/v1/projects` → 401 `JWT could not be
decoded`; that needs an `sbp_…` personal access token), so the project
cannot be looked up from the key either. I checked the GitHub and Vercel
accounts for an existing `*.supabase.co` URL — nothing there (0 code
matches, 0 Vercel projects).

### What is still needed

From **Supabase dashboard → Project Settings**:

1. **Project URL** — `https://<ref>.supabase.co` (API section).
2. **Connection string** — Database section → *Connection pooling* →
   **Transaction** mode, port **6543**. Looks like:
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
   Port 6543 matters: the serverless function opens a connection per
   invocation and the direct 5432 port will exhaust connections.
3. **Storage bucket** named `property-images` (Storage → New bucket, public).

Then apply the migrations, in order, via the SQL editor or:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20250101000000_initial_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20250101000001_rls_policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20250101000002_seed_reference_data.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20250101000003_analytics_and_enquiries.sql
```

All four are verified to apply cleanly to an empty database: 13 tables,
13 RLS-enabled, 31 policies. They are idempotent, so re-running is safe.

---

## 4. Environment variables for Vercel

Set these in **Project → Settings → Environment Variables** (Production).
None of them may ever appear in client code — the build fails loudly if a
required one is missing, rather than starting in a degraded state.

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | pooler string, port **6543** | required in production |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | required for Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` | **server-side only**, never `VITE_`-prefixed |
| `SUPABASE_STORAGE_BUCKET` | `property-images` | optional, this is the default |
| `ADMIN_EMAIL` | `workwithsitecraft@gmail.com` | see §5 |
| `ADMIN_PASSWORD` | choose in the Vercel UI | **≥ 12 characters**, enforced at boot |
| `NODE_ENV` | `production` | |
| `VITE_SUPABASE_IMAGE_TRANSFORMS` | `false` | Supabase image transforms are a paid add-on |

The publishable key is **not** required: the browser never talks to
Supabase directly — all data goes through this app's own API, which is
what keeps the service-role key server-side.

Guards that will stop a misconfigured boot (verbatim):

```
DATABASE_URL is required in production.
ADMIN_EMAIL and ADMIN_PASSWORD are required in production.
ADMIN_PASSWORD must be at least 12 characters in production.
Supabase Storage is required in production.
```

---

## 5. Admin login — one deliberate difference from the brief

The brief asked for admin login through **Supabase Auth**. The shipped
implementation is **scrypt password hashing + HttpOnly server-side
sessions**, not Supabase Auth. I have not silently substituted one for the
other, so to be explicit:

- Set `ADMIN_EMAIL=workwithsitecraft@gmail.com` and a `ADMIN_PASSWORD` of
  your choosing **in the Vercel dashboard**. The password is never in the
  source, never in git, and never in this file.
- The admin user is created on first boot from those variables.

What you get either way: passwords are never stored in recoverable form,
the session cookie is HttpOnly + SameSite=Lax + Secure in production,
failed logins are rate-delayed by 350 ms, and there is no client-side
password check anywhere.

What Supabase Auth would add: password-reset emails, magic links, MFA and
multiple admin accounts with roles. If you want those, the migration is
contained — `server/auth.mjs` is the only file that decides identity, and
the `admin_profiles` table plus `is_admin()` used by every RLS policy are
already keyed on a user id, so they carry over unchanged. Say the word and
I will wire it.

---

## 6. After deploying — verification checklist

```bash
curl -s https://<your-domain>/api/health
# expect: {"ok":true,"properties":18,"db":{"driver":"postgres",...},"storage":{"kind":"supabase"...}}
```

Then check by hand:

- [ ] `/` renders with the Stitch design and real property cards
- [ ] `/properties` filters, sorts and paginates (URL query params update)
- [ ] a property detail page loads with its gallery
- [ ] an enquiry submits and appears in `/admin/enquiries`
- [ ] `/admin` login works with the credentials you configured
- [ ] creating a property with an image upload works (proves Storage)
- [ ] `/admin/analytics` shows the visit you just made
- [ ] WhatsApp and Call buttons open correctly on a phone
- [ ] `/sitemap.xml` and `/robots.txt` resolve

---

## 7. Summary

Everything within reach of the credentials provided is done: the code is
complete, tested at 205/205, committed, and pushed to GitHub with no
secrets in the tree.

Two external blockers remain, both outside my control:

1. **Vercel token is read-only** — needs a token with write scope, or
   ~3 minutes in the dashboard.
2. **Supabase project URL + pooler connection string were never provided** —
   the two keys alone cannot identify a project.

I have deliberately not invented a deployment URL or claimed a deploy that
did not happen.
