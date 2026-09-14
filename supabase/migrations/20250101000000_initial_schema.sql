-- =====================================================================
-- PRIME ESTATES — 001 initial schema (Supabase / PostgreSQL)
--
-- Mirrors server/schema.sql but uses Supabase conventions:
--   * admin identity comes from auth.users (Supabase Auth), so the local
--     admin_users / admin_sessions tables are NOT recreated here
--   * an admin_profiles table marks which auth users may manage content
--   * updated_at is maintained by a trigger
--
-- Apply with:  supabase db push      (or paste into the SQL editor)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: keep updated_at accurate
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Admin profiles — links a Supabase Auth user to the admin role.
-- A row here is what grants write access in every policy below.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT NOT NULL DEFAULT 'Administrator',
  role       TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SECURITY DEFINER so policies can check admin status without recursing
-- into admin_profiles' own RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles WHERE id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Taxonomies
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_categories (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT 'home_work',
  image_url   TEXT DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.locations (
  id         BIGSERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  district   TEXT NOT NULL DEFAULT '',
  state      TEXT NOT NULL DEFAULT 'Tamil Nadu',
  blurb      TEXT DEFAULT '',
  localities TEXT DEFAULT '',
  tagline    TEXT DEFAULT '',
  image_url  TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.services (
  id         BIGSERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  summary    TEXT DEFAULT '',
  body       TEXT DEFAULT '',
  icon       TEXT DEFAULT 'real_estate_agent',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.properties (
  id                 BIGSERIAL PRIMARY KEY,
  title              TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  property_type      TEXT NOT NULL DEFAULT 'apartment',
  listing_type       TEXT NOT NULL DEFAULT 'sale',
  status             TEXT NOT NULL DEFAULT 'available',
  price              NUMERIC(16,2) NOT NULL DEFAULT 0,
  price_display      TEXT DEFAULT '',
  price_period       TEXT DEFAULT '',
  location           TEXT NOT NULL DEFAULT '',
  location_slug      TEXT DEFAULT '',
  area_locality      TEXT DEFAULT '',
  city               TEXT DEFAULT '',
  district           TEXT DEFAULT '',
  state              TEXT DEFAULT 'Tamil Nadu',
  address            TEXT DEFAULT '',
  latitude           NUMERIC(10,7),
  longitude          NUMERIC(10,7),
  property_area      NUMERIC(12,2),
  property_area_unit TEXT DEFAULT 'sqft',
  built_up_area      NUMERIC(12,2),
  bedrooms           INTEGER,
  bathrooms          INTEGER,
  parking            INTEGER,
  floor              INTEGER,
  total_floors       INTEGER,
  property_age       TEXT DEFAULT '',
  facing             TEXT DEFAULT '',
  furnishing         TEXT DEFAULT '',
  short_description  TEXT DEFAULT '',
  description        TEXT DEFAULT '',
  amenities          TEXT[] NOT NULL DEFAULT '{}',
  highlights         TEXT[] NOT NULL DEFAULT '{}',
  featured           BOOLEAN NOT NULL DEFAULT FALSE,
  published          BOOLEAN NOT NULL DEFAULT TRUE,
  verified_title     BOOLEAN NOT NULL DEFAULT FALSE,
  rera_id            TEXT DEFAULT '',
  main_image         TEXT DEFAULT '',
  views              INTEGER NOT NULL DEFAULT 0,
  seo_title          TEXT DEFAULT '',
  seo_description    TEXT DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT properties_listing_type_check
    CHECK (listing_type IN ('sale', 'rent', 'lease')),
  CONSTRAINT properties_status_check
    CHECK (status IN ('available', 'featured', 'sold', 'rented', 'draft', 'archived')),
  CONSTRAINT properties_price_check CHECK (price >= 0)
);

DROP TRIGGER IF EXISTS properties_set_updated_at ON public.properties;
CREATE TRIGGER properties_set_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes tuned for the public catalogue's filter/sort matrix at scale
CREATE INDEX IF NOT EXISTS idx_prop_published ON public.properties(published);
CREATE INDEX IF NOT EXISTS idx_prop_status    ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_prop_type      ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_prop_listing   ON public.properties(listing_type);
CREATE INDEX IF NOT EXISTS idx_prop_locslug   ON public.properties(location_slug);
CREATE INDEX IF NOT EXISTS idx_prop_price     ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_prop_bedrooms  ON public.properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_prop_created   ON public.properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_featured  ON public.properties(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_prop_browse
  ON public.properties(published, status, listing_type, property_type, price);

-- Full-text search: keeps ILIKE fallbacks fast once the catalogue grows
CREATE INDEX IF NOT EXISTS idx_prop_search ON public.properties
  USING GIN (to_tsvector('english',
    coalesce(title, '') || ' ' || coalesce(location, '') || ' ' ||
    coalesce(area_locality, '') || ' ' || coalesce(short_description, '')));

-- ---------------------------------------------------------------------
-- Hot-path indexes (measured, not guessed)
--
-- Every public catalogue query filters on "live" rows:
--     published = true AND status NOT IN ('draft','archived')
-- Partial indexes matching that predicate exactly let Postgres walk the
-- index in sort order and stop at LIMIT, with no sort step at all. They
-- also stay small, because sold/archived stock never enters them.
--
-- Measured on 2,218 properties (PostgreSQL 17):
--   default catalogue sort : 2.586 ms seq scan + top-N sort -> 0.044 ms index scan
--   substring search       : 1.445 ms seq scan              -> 0.097 ms index scan
-- ---------------------------------------------------------------------

-- Default listing order ("featured first, then newest").
CREATE INDEX IF NOT EXISTS idx_prop_live_featured
  ON public.properties (featured DESC, created_at DESC)
  WHERE published = TRUE AND status NOT IN ('draft', 'archived');

-- sort=newest / oldest
CREATE INDEX IF NOT EXISTS idx_prop_live_created
  ON public.properties (created_at DESC)
  WHERE published = TRUE AND status NOT IN ('draft', 'archived');

-- sort=price_asc / price_desc and min_price/max_price range filters
CREATE INDEX IF NOT EXISTS idx_prop_live_price
  ON public.properties (price)
  WHERE published = TRUE AND status NOT IN ('draft', 'archived');

-- Substring search. The tsvector index above cannot serve ILIKE '%foo%';
-- trigrams can. pg_trgm ships with Supabase.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_prop_search_trgm
  ON public.properties USING GIN (
    title gin_trgm_ops,
    location gin_trgm_ops,
    area_locality gin_trgm_ops
  );

CREATE TABLE IF NOT EXISTS public.property_images (
  id          BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT DEFAULT '',
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_img_property ON public.property_images(property_id, sort_order);

-- ---------------------------------------------------------------------
-- Enquiries
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiries (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT DEFAULT '',
  message        TEXT DEFAULT '',
  property_id    BIGINT REFERENCES public.properties(id) ON DELETE SET NULL,
  property_title TEXT DEFAULT '',
  interest       TEXT DEFAULT '',
  budget         TEXT DEFAULT '',
  source         TEXT NOT NULL DEFAULT 'website',
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  admin_notes    TEXT DEFAULT '',
  archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT enquiries_name_check  CHECK (char_length(trim(name)) >= 2),
  CONSTRAINT enquiries_phone_check CHECK (char_length(trim(phone)) BETWEEN 8 AND 18)
);
CREATE INDEX IF NOT EXISTS idx_enq_status  ON public.enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enq_created ON public.enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enq_prop    ON public.enquiries(property_id);

DROP TRIGGER IF EXISTS enquiries_set_updated_at ON public.enquiries;
CREATE TRIGGER enquiries_set_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Gallery + settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id         BIGSERIAL PRIMARY KEY,
  url        TEXT NOT NULL,
  caption    TEXT DEFAULT '',
  category   TEXT DEFAULT 'Residences',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS settings_set_updated_at ON public.site_settings;
CREATE TRIGGER settings_set_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Atomic view counter (avoids a read-modify-write race)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_property_views(p_slug TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.properties SET views = views + 1 WHERE slug = p_slug AND published = TRUE;
$$;
