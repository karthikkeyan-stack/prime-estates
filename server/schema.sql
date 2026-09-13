-- =====================================================================
-- PRIME ESTATES — PostgreSQL schema
-- Designed for 2,000+ properties. Portable between local Postgres/PGlite
-- and Supabase (see supabase/migrations for the RLS-enabled variant).
-- =====================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT 'Administrator',
  role          TEXT NOT NULL DEFAULT 'admin',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON admin_sessions(user_id);

-- ---------------------------------------------------------------------
-- Taxonomies: editable, so new categories/locations can be added later
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS property_categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT 'home_work',
  image_url   TEXT DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  district    TEXT NOT NULL DEFAULT '',
  state       TEXT NOT NULL DEFAULT 'Tamil Nadu',
  blurb       TEXT DEFAULT '',
  localities  TEXT DEFAULT '',
  tagline     TEXT DEFAULT '',
  image_url   TEXT DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id                SERIAL PRIMARY KEY,
  title             TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  property_type     TEXT NOT NULL DEFAULT 'apartment',
  listing_type      TEXT NOT NULL DEFAULT 'sale',
  status            TEXT NOT NULL DEFAULT 'available',
  price             NUMERIC(16,2) NOT NULL DEFAULT 0,
  price_display     TEXT DEFAULT '',
  price_period      TEXT DEFAULT '',
  location          TEXT NOT NULL DEFAULT '',
  location_slug     TEXT DEFAULT '',
  area_locality     TEXT DEFAULT '',
  city              TEXT DEFAULT '',
  district          TEXT DEFAULT '',
  state             TEXT DEFAULT 'Tamil Nadu',
  address           TEXT DEFAULT '',
  latitude          NUMERIC(10,7),
  longitude         NUMERIC(10,7),
  property_area     NUMERIC(12,2),
  property_area_unit TEXT DEFAULT 'sqft',
  built_up_area     NUMERIC(12,2),
  bedrooms          INTEGER,
  bathrooms         INTEGER,
  parking           INTEGER,
  floor             INTEGER,
  total_floors      INTEGER,
  property_age      TEXT DEFAULT '',
  facing            TEXT DEFAULT '',
  furnishing        TEXT DEFAULT '',
  short_description TEXT DEFAULT '',
  description       TEXT DEFAULT '',
  amenities         TEXT[] NOT NULL DEFAULT '{}',
  highlights        TEXT[] NOT NULL DEFAULT '{}',
  featured          BOOLEAN NOT NULL DEFAULT FALSE,
  published         BOOLEAN NOT NULL DEFAULT TRUE,
  verified_title    BOOLEAN NOT NULL DEFAULT FALSE,
  rera_id           TEXT DEFAULT '',
  main_image        TEXT DEFAULT '',
  views             INTEGER NOT NULL DEFAULT 0,
  seo_title         TEXT DEFAULT '',
  seo_description   TEXT DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes tuned for the public catalogue's filter/sort matrix at scale
CREATE INDEX IF NOT EXISTS idx_prop_published   ON properties(published);
CREATE INDEX IF NOT EXISTS idx_prop_status      ON properties(status);
CREATE INDEX IF NOT EXISTS idx_prop_type        ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_prop_listing     ON properties(listing_type);
CREATE INDEX IF NOT EXISTS idx_prop_locslug     ON properties(location_slug);
CREATE INDEX IF NOT EXISTS idx_prop_price       ON properties(price);
CREATE INDEX IF NOT EXISTS idx_prop_bedrooms    ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_prop_created     ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_featured    ON properties(featured) WHERE featured = TRUE;
-- Composite covering the default catalogue query shape
CREATE INDEX IF NOT EXISTS idx_prop_browse      ON properties(published, status, listing_type, property_type, price);

CREATE TABLE IF NOT EXISTS property_images (
  id          SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT DEFAULT '',
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_img_property ON property_images(property_id, sort_order);

-- ---------------------------------------------------------------------
-- Enquiries
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiries (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT DEFAULT '',
  message        TEXT DEFAULT '',
  property_id    INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  property_title TEXT DEFAULT '',
  interest       TEXT DEFAULT '',
  budget         TEXT DEFAULT '',
  source         TEXT NOT NULL DEFAULT 'website',
  status         TEXT NOT NULL DEFAULT 'new',
  admin_notes    TEXT DEFAULT '',
  archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enq_status  ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enq_created ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enq_prop    ON enquiries(property_id);

-- ---------------------------------------------------------------------
-- Gallery + site settings (key/value so new keys need no migration)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_items (
  id         SERIAL PRIMARY KEY,
  url        TEXT NOT NULL,
  caption    TEXT DEFAULT '',
  category   TEXT DEFAULT 'Residences',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  summary     TEXT DEFAULT '',
  body        TEXT DEFAULT '',
  icon        TEXT DEFAULT 'real_estate_agent',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
