-- =====================================================================
-- PRIME ESTATES — 003 reference data
--
-- Categories, locations, services and site settings only. Demo PROPERTIES
-- are intentionally NOT seeded here: on Supabase you will load the client's
-- real listings. To load the 18 demo listings for a staging environment,
-- point DATABASE_URL at the database and run `npm run seed`.
--
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

INSERT INTO public.property_categories (slug, name, description, icon, sort_order) VALUES
  ('apartment',        'Apartments',        'Flats and gated apartment residences.',            'apartment',        1),
  ('villa',            'Villas',            'Independent and gated-community villas.',          'villa',            2),
  ('independent-house','Independent Houses','Standalone houses on private plots.',              'home',             3),
  ('plot',             'Plots & Land',      'DTCP-approved plots, farmland and development land.','landscape',      4),
  ('commercial',       'Commercial',        'Commercial buildings and mixed-use assets.',       'domain',           5),
  ('office',           'Office Space',      'Office floors and IT-park suites.',                'corporate_fare',   6),
  ('shop',             'Shops',             'High-street and neighbourhood retail units.',      'storefront',       7),
  ('showroom',         'Showrooms',         'Arterial-road showroom frontage.',                 'store',            8),
  ('investment',       'Investment',        'Yield and appreciation-led opportunities.',        'trending_up',      9),
  ('farmhouse',        'Farmhouses',        'Farmsteads and estate properties.',                'agriculture',     10),
  ('other',            'Other',             'Anything that does not fit the categories above.', 'category',        11)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description,
      icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;

INSERT INTO public.locations (slug, name, district, state, tagline, sort_order) VALUES
  ('coimbatore', 'Coimbatore', 'Coimbatore', 'Tamil Nadu', 'The core market',            1),
  ('tirupur',    'Tirupur',    'Tirupur',    'Tamil Nadu', 'Industrial & export belt',   2),
  ('pollachi',   'Pollachi',   'Coimbatore', 'Tamil Nadu', 'Farmland & foothills',       3),
  ('ooty',       'Ooty',       'Nilgiris',   'Tamil Nadu', 'Hill-station holdings',      4),
  ('erode',      'Erode',      'Erode',      'Tamil Nadu', 'Logistics & textiles',       5),
  ('palakkad',   'Palakkad',   'Palakkad',   'Kerala',     'Cross-border corridor',      6)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, district = EXCLUDED.district,
      state = EXCLUDED.state, tagline = EXCLUDED.tagline, sort_order = EXCLUDED.sort_order;

INSERT INTO public.services (slug, title, summary, icon, sort_order) VALUES
  ('residential-property',   'Residential Property',   'Apartments, villas and independent houses across Coimbatore and neighbouring districts.', 'home_work',         1),
  ('commercial-property',    'Commercial Property',    'Offices, shops, showrooms and commercial buildings for business use.',                    'domain',            2),
  ('property-sales',         'Property Sales',         'Outright purchase and sale representation from search through registration.',             'real_estate_agent', 3),
  ('property-rentals',       'Property Rentals',       'Rental and lease arrangements for homes and commercial premises.',                        'key',               4),
  ('real-estate-consulting', 'Real Estate Consulting', 'Advice on locality, pricing and suitability before you commit.',                          'monitoring',          5),
  ('plots-land',             'Plots & Land',           'Residential plots, farmland and land parcels for development.',                           'landscape',         6),
  ('property-development',   'Property Development',   'Development projects undertaken as a developer since 2008.',                              'foundation',        7)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title, summary = EXCLUDED.summary,
      icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------
-- Site settings.
-- email / address / maps / socials are deliberately BLANK: they are hidden
-- on the public site until the client supplies verified details via
-- Admin → Settings. Do not invent them here.
-- ---------------------------------------------------------------------
INSERT INTO public.site_settings (key, value) VALUES
  ('business_name',     'Prime Estates'),
  ('tagline',           'Consultants & Developers • CBE'),
  ('established',       '2008'),
  ('city',              'Coimbatore'),
  ('short_description', 'Leading real estate consultants and developers in Coimbatore since 2008.'),
  ('description',       'Prime Estates is a leading real estate consultant and developer in Coimbatore, Tamil Nadu, operating since 2008. We handle residential and commercial properties for outright purchase and rental in and around Coimbatore and the neighbouring districts of Tirupur, Pollachi, Ooty, Erode and Palakkad.'),
  ('phone',             '9486122022'),
  ('phone_display',     '94861 22022'),
  ('whatsapp',          '919486122022'),
  ('whatsapp_general',  'Hi, I''d like to know more about the properties available with Prime Estates.'),
  ('email',             ''),
  ('address',           ''),
  ('maps_url',          ''),
  ('maps_embed',        ''),
  ('facebook',          ''),
  ('instagram',         ''),
  ('youtube',           ''),
  ('linkedin',          ''),
  ('site_url',          ''),
  ('seo_title',         'Prime Estates | Real Estate Consultants & Developers in Coimbatore'),
  ('seo_description',   'Residential and commercial property for purchase and rental in Coimbatore, Tirupur, Pollachi, Ooty, Erode and Palakkad. Consultants and developers since 2008.'),
  ('footer_note',       'Real estate consultants and developers serving Coimbatore and the western Tamil Nadu corridor since 2008.'),
  ('demo_notice',       'Listings shown are demonstration data.')
ON CONFLICT (key) DO NOTHING;
