-- ---------------------------------------------------------------------
-- Prime Estates — first-party visitor analytics + enquiry pipeline
--
-- Design notes
-- ------------
-- Analytics tables are APPEND-HEAVY: they take far more writes than the
-- rest of the schema combined, and they grow without bound. So:
--
--   * No foreign key from page_views/visitor_events to visitor_sessions.
--     A FK would add a lookup on every single insert for very little
--     benefit; the session id is a client-generated UUID and orphan rows
--     are harmless in analytics.
--   * Indexes are on (created_at DESC) and the specific columns the
--     dashboard groups by — nothing speculative.
--   * No IP address is stored. Country/city are coarse, optional, and
--     supplied by the edge; nothing here can re-identify a person.
--   * visitor_id is a random client-generated id in localStorage. It is
--     pseudonymous, not an identity.
-- ---------------------------------------------------------------------

-- --------------------- prerequisites (idempotent) --------------------
-- This migration is self-sufficient: it recreates the two helpers it
-- depends on if they are absent, so it can be applied to a database that
-- was bootstrapped by the application rather than by migration 0000.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DO $prereq$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE p.proname = 'is_admin' AND n.nspname = 'public') THEN
    -- Fallback only for databases where migration 0000 has not run (e.g. a
    -- plain Postgres used in local development, which has no Supabase
    -- `auth` schema). It denies by default; on Supabase the real
    -- definition from migration 0000 is used instead and grants access
    -- via a row in admin_profiles.
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')
       AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_profiles') THEN
      EXECUTE 'CREATE FUNCTION public.is_admin() RETURNS BOOLEAN '
           || 'LANGUAGE sql STABLE SECURITY DEFINER AS '
           || '$q$ SELECT EXISTS (SELECT 1 FROM public.admin_profiles a WHERE a.id = auth.uid()) $q$';
    ELSE
      EXECUTE 'CREATE FUNCTION public.is_admin() RETURNS BOOLEAN '
           || 'LANGUAGE sql IMMUTABLE AS $q$ SELECT false $q$';
    END IF;
  END IF;
END $prereq$;

-- ------------------------- visitor_sessions --------------------------
CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id             TEXT PRIMARY KEY,                 -- client-generated uuid
  visitor_id     TEXT NOT NULL,                    -- pseudonymous, localStorage
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  landing_path   TEXT,
  exit_path      TEXT,
  referrer_host  TEXT,                             -- host only, never the full URL
  referrer_kind  TEXT,                             -- direct | search | social | referral
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  device_type    TEXT,                             -- mobile | tablet | desktop
  browser        TEXT,                             -- coarse family only
  os             TEXT,
  country        TEXT,                             -- approximate, from edge headers
  city           TEXT,                             -- approximate, from edge headers
  is_returning   BOOLEAN NOT NULL DEFAULT FALSE,
  page_count     INTEGER NOT NULL DEFAULT 0,
  event_count    INTEGER NOT NULL DEFAULT 0,
  duration_ms    BIGINT  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vs_created   ON public.visitor_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vs_visitor   ON public.visitor_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_vs_device    ON public.visitor_sessions (device_type);
CREATE INDEX IF NOT EXISTS idx_vs_refkind   ON public.visitor_sessions (referrer_kind);
CREATE INDEX IF NOT EXISTS idx_vs_country   ON public.visitor_sessions (country);

-- ----------------------------- page_views ----------------------------
CREATE TABLE IF NOT EXISTS public.page_views (
  id           BIGSERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  visitor_id   TEXT NOT NULL,
  path         TEXT NOT NULL,
  title        TEXT,
  property_id  BIGINT REFERENCES public.properties(id) ON DELETE SET NULL,
  dwell_ms     INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_created  ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_path     ON public.page_views (path);
CREATE INDEX IF NOT EXISTS idx_pv_session  ON public.page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_pv_property ON public.page_views (property_id) WHERE property_id IS NOT NULL;

-- --------------------------- visitor_events --------------------------
-- whatsapp_click | phone_click | enquiry_submit | search | filter |
-- gallery_open | share | map_load
CREATE TABLE IF NOT EXISTS public.visitor_events (
  id           BIGSERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  visitor_id   TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  path         TEXT,
  property_id  BIGINT REFERENCES public.properties(id) ON DELETE SET NULL,
  label        TEXT,
  meta         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ve_created  ON public.visitor_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ve_type     ON public.visitor_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ve_property ON public.visitor_events (property_id) WHERE property_id IS NOT NULL;

-- ------------------------ contact_submissions ------------------------
-- Kept separate from `enquiries`: a contact-form message is not a
-- property lead and should not pollute the sales pipeline or its counts.
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  subject     TEXT,
  message     TEXT,
  source_path TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_created ON public.contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_status  ON public.contact_submissions (status);

DROP TRIGGER IF EXISTS trg_cs_updated ON public.contact_submissions;
CREATE TRIGGER trg_cs_updated BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------- enquiries: pipeline columns -------------------
-- The spec requires New / Contacted / Follow-up / Qualified / Closed /
-- Spam. The table shipped with only new/contacted/closed.
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS enquiry_type TEXT NOT NULL DEFAULT 'property';
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS source_path  TEXT;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS session_id   TEXT;

DO $$
BEGIN
  ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_status_check;
  ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_check
    CHECK (status IN ('new','contacted','follow_up','qualified','closed','spam'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_enq_status_created ON public.enquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enq_type           ON public.enquiries (enquiry_type);

-- ------------------------------- RLS ---------------------------------
ALTER TABLE public.visitor_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors may WRITE analytics but never READ it. Raw visitor
-- data is not public. Note there is deliberately no anon SELECT policy,
-- so any client insert must not use RETURNING (see the note in
-- 20250101000001_rls_policies.sql).
DROP POLICY IF EXISTS vs_insert_anon ON public.visitor_sessions;
CREATE POLICY vs_insert_anon ON public.visitor_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS vs_update_anon ON public.visitor_sessions;
CREATE POLICY vs_update_anon ON public.visitor_sessions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pv_insert_anon ON public.page_views;
CREATE POLICY pv_insert_anon ON public.page_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS ve_insert_anon ON public.visitor_events;
CREATE POLICY ve_insert_anon ON public.visitor_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS cs_insert_anon ON public.contact_submissions;
CREATE POLICY cs_insert_anon ON public.contact_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only admins may read or manage any of it.
DROP POLICY IF EXISTS vs_admin_all ON public.visitor_sessions;
CREATE POLICY vs_admin_all ON public.visitor_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pv_admin_all ON public.page_views;
CREATE POLICY pv_admin_all ON public.page_views
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS ve_admin_all ON public.visitor_events;
CREATE POLICY ve_admin_all ON public.visitor_events
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS cs_admin_all ON public.contact_submissions;
CREATE POLICY cs_admin_all ON public.contact_submissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------ retention helper ---------------------------
-- Analytics grows forever. Call this from a scheduled job (pg_cron on
-- Supabase) to keep the tables bounded. Sessions are kept longer than
-- raw page views because they are already aggregated.
CREATE OR REPLACE FUNCTION public.prune_analytics(retain_days INTEGER DEFAULT 400)
RETURNS TABLE (deleted_page_views BIGINT, deleted_events BIGINT, deleted_sessions BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pv BIGINT; ev BIGINT; ss BIGINT;
BEGIN
  DELETE FROM public.page_views     WHERE created_at < now() - (retain_days || ' days')::interval;
  GET DIAGNOSTICS pv = ROW_COUNT;
  DELETE FROM public.visitor_events WHERE created_at < now() - (retain_days || ' days')::interval;
  GET DIAGNOSTICS ev = ROW_COUNT;
  DELETE FROM public.visitor_sessions WHERE created_at < now() - ((retain_days * 2) || ' days')::interval;
  GET DIAGNOSTICS ss = ROW_COUNT;
  RETURN QUERY SELECT pv, ev, ss;
END $$;
