-- =====================================================================
-- PRIME ESTATES — 002 Row Level Security
--
-- Model:
--   anon        → may READ published content only; may INSERT enquiries
--   authenticated admin (row in admin_profiles) → full read/write
--   service_role → bypasses RLS entirely (server-side only, never in the
--                  browser bundle)
--
-- Every table below has RLS ENABLED, so anything not explicitly allowed
-- is denied by default.
-- =====================================================================

ALTER TABLE public.admin_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- admin_profiles — an admin may read the roster; nobody may self-promote.
-- Creating admins is done with the service role or the Supabase dashboard.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "admins read roster" ON public.admin_profiles;
CREATE POLICY "admins read roster" ON public.admin_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------
-- properties — public sees published & non-archived; admins see all
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "public reads published properties" ON public.properties;
CREATE POLICY "public reads published properties" ON public.properties
  FOR SELECT TO anon, authenticated
  USING (published = TRUE AND status <> 'archived' AND status <> 'draft');

DROP POLICY IF EXISTS "admins read all properties" ON public.properties;
CREATE POLICY "admins read all properties" ON public.properties
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins insert properties" ON public.properties;
CREATE POLICY "admins insert properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins update properties" ON public.properties;
CREATE POLICY "admins update properties" ON public.properties
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins delete properties" ON public.properties;
CREATE POLICY "admins delete properties" ON public.properties
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------
-- property_images — visible only when the parent property is visible
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "public reads images of published properties" ON public.property_images;
CREATE POLICY "public reads images of published properties" ON public.property_images
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND p.published = TRUE
      AND p.status NOT IN ('archived', 'draft')
  ));

DROP POLICY IF EXISTS "admins manage images" ON public.property_images;
CREATE POLICY "admins manage images" ON public.property_images
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- Taxonomies + gallery — world-readable when active, admin-writable
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "public reads categories" ON public.property_categories;
CREATE POLICY "public reads categories" ON public.property_categories
  FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS "admins manage categories" ON public.property_categories;
CREATE POLICY "admins manage categories" ON public.property_categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public reads locations" ON public.locations;
CREATE POLICY "public reads locations" ON public.locations
  FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS "admins manage locations" ON public.locations;
CREATE POLICY "admins manage locations" ON public.locations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public reads services" ON public.services;
CREATE POLICY "public reads services" ON public.services
  FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS "admins manage services" ON public.services;
CREATE POLICY "admins manage services" ON public.services
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public reads gallery" ON public.gallery_items;
CREATE POLICY "public reads gallery" ON public.gallery_items
  FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS "admins manage gallery" ON public.gallery_items;
CREATE POLICY "admins manage gallery" ON public.gallery_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- site_settings — readable by the public site, writable only by admins
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "public reads settings" ON public.site_settings;
CREATE POLICY "public reads settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "admins write settings" ON public.site_settings;
CREATE POLICY "admins write settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- enquiries — anyone may SUBMIT, only admins may READ.
-- This is the most security-sensitive table: it holds customer phone
-- numbers, so there is deliberately NO public SELECT policy.
-- ---------------------------------------------------------------------
-- NOTE for any client that talks to PostgREST/supabase-js directly:
-- anon may INSERT but has NO SELECT policy here (deliberate - enquiries hold
-- customer phone numbers). `INSERT ... RETURNING` therefore fails for anon,
-- because returning the row requires SELECT. Submit with
-- `.insert(payload)` WITHOUT `.select()`, or post through the server API
-- (which uses the service role). Verified against PostgreSQL 17.
DROP POLICY IF EXISTS "anyone submits an enquiry" ON public.enquiries;
CREATE POLICY "anyone submits an enquiry" ON public.enquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(trim(name)) >= 2
    AND char_length(trim(phone)) BETWEEN 8 AND 18
    AND status = 'new'
    AND archived = FALSE
    AND coalesce(admin_notes, '') = ''
  );

DROP POLICY IF EXISTS "admins read enquiries" ON public.enquiries;
CREATE POLICY "admins read enquiries" ON public.enquiries
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admins update enquiries" ON public.enquiries;
CREATE POLICY "admins update enquiries" ON public.enquiries
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins delete enquiries" ON public.enquiries;
CREATE POLICY "admins delete enquiries" ON public.enquiries
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------
-- Storage: property images bucket
-- Public READ so <img> tags work without signed URLs; writes admin-only.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images', 'property-images', TRUE, 8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public reads property images" ON storage.objects;
CREATE POLICY "public reads property images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "admins upload property images" ON storage.objects;
CREATE POLICY "admins upload property images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-images' AND public.is_admin());

DROP POLICY IF EXISTS "admins update property images" ON storage.objects;
CREATE POLICY "admins update property images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'property-images' AND public.is_admin());

DROP POLICY IF EXISTS "admins delete property images" ON storage.objects;
CREATE POLICY "admins delete property images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'property-images' AND public.is_admin());
