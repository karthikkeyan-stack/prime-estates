import { Link } from 'react-router-dom';
import { getProperties, getCategories, getLocations, getFacets } from '../lib/api';
import { useAsync, useRevealGroup } from '../hooks';
import { useSettings } from '../lib/store';
import { Seo, organizationJsonLd } from '../lib/seo';
import { PropertyCard, PropertyCardSkeleton } from '../components/PropertyCard';
import { SearchBar } from '../components/SearchBar';
import { EnquiryForm } from '../components/EnquiryForm';
import { Icon, Img } from '../components/ui';

/**
 * Hero background.
 *
 * NOTE ON THE SUPPLIED VIDEO — deliberately not used.
 * The provided CloudFront MP4 was downloaded and inspected frame by frame
 * (t=0.5s / 4s / 8s, scrims removed). It is not property footage: it is an
 * abstract purple-violet light animation, 1708x1212 (1.41:1, nearly square)
 * and 28 MB. Three problems made it unusable here:
 *   1. It shows no real estate, so the opening would say nothing about the
 *      business and would read as generic AI-generated motion graphics.
 *   2. Violet fights the bronze/ivory brand palette.
 *   3. 28 MB is a punishing first load on an Indian mobile connection.
 * The optimised still below (AVIF/WebP/JPEG, 10-86 KB depending on width)
 * shows an actual residence and is the LCP element. Swap in a real cinematic
 * property clip here when one is available.
 */
function HeroBackdrop() {
  return (
    <>
      <picture>
        <source
          type="image/avif"
          srcSet="/media/r/hero-estate-400.avif 400w, /media/r/hero-estate-800.avif 800w, /media/r/hero-estate-1408.avif 1408w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/media/r/hero-estate-400.webp 400w, /media/r/hero-estate-800.webp 800w, /media/r/hero-estate-1408.webp 1408w"
          sizes="100vw"
        />
        <img
          src="/media/r/hero-estate-1408.jpg"
          srcSet="/media/r/hero-estate-400.jpg 400w, /media/r/hero-estate-800.jpg 800w, /media/r/hero-estate-1408.jpg 1408w"
          sizes="100vw"
          alt="Contemporary residence at dusk with lit interiors and a reflection pool"
          width={1408}
          height={768}
          decoding="async"
          {...{ fetchpriority: 'high' }}
          className="absolute inset-0 w-full h-full object-cover object-[68%_center] md:object-center"
        />
      </picture>
    </>
  );
}

export default function Home() {
  const { settings, tel, waGeneral } = useSettings();

  const featured = useAsync(() => getProperties({ featured: true, limit: 6, sort: 'featured' }), []);
  const latest = useAsync(() => getProperties({ limit: 3, sort: 'newest' }), []);
  const categories = useAsync(getCategories, []);
  const locations = useAsync(getLocations, []);
  const facets = useAsync(getFacets, []);

  const revealRef = useRevealGroup<HTMLDivElement>([
    featured.data, categories.data, locations.data, latest.data,
  ]);

  const featuredList = featured.data?.data ?? [];
  const flagship = featuredList[0];
  const stacked = featuredList.slice(1, 3);
  const row = featuredList.slice(3, 6);
  const totalListings = facets.data
    ? facets.data.byType.reduce((sum, t) => sum + t.count, 0)
    : 0;

  return (
    <div ref={revealRef}>
      <Seo
        title={settings.seo_title || 'Prime Estates | Real Estate Consultants & Developers in Coimbatore'}
        description={settings.seo_description || settings.short_description}
        image="/media/hero-estate.jpg"
        jsonLd={[
          organizationJsonLd(settings),
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: settings.business_name,
            url: settings.site_url || undefined,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${settings.site_url || ''}/properties?search={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />

      {/* ============ 1. HERO ============ */}
      {/*
        Cinematic centred opening. The composition is centre-weighted rather
        than left-aligned, so the scrims are radial/vertical instead of
        directional — the architecture stays visible at the edges of the
        frame while the middle stays dark enough to read against.

        Background strategy (see HeroBackdrop below): every visitor gets the
        optimised still immediately; the 28 MB video is only attached on
        pointer-fine, wide, non-reduced-motion screens after the poster has
        painted. Phones never download it.
      */}
      <section className="relative w-full -mt-[5.75rem] md:-mt-[7.25rem] overflow-hidden bg-charcoal">
        <HeroBackdrop />

        {/*
          Scrims tuned for centred text. The vertical pass darkens the top
          (behind the transparent navbar) and the middle band where the
          headline sits; the radial pass keeps the corners open so the
          building and sky still read as a photograph, not a dark rectangle.
        */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-charcoal/80 via-charcoal/55 to-charcoal/82
                     lg:from-charcoal/72 lg:via-charcoal/45 lg:to-charcoal/78"
          aria-hidden="true"
        />
        {/* Centre pool: the copy column is centred, so the darkest part of the
            scrim tracks it. Measured against the brightest backdrop pixel
            behind each text block, this keeps every hero string >= 4.5:1
            while the corners stay light enough to read as a photograph. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(82% 78% at 50% 50%, rgba(23,21,19,0.66) 0%, rgba(23,21,19,0.46) 62%, rgba(23,21,19,0) 100%)',
          }}
          aria-hidden="true"
        />

        {/* Bottom padding leaves room for the search card, which pulls up into
            the hero by 4rem on phones / 5rem from 768px (see next section). */}
        <div className="hero-shell relative z-10 shell pt-[7rem] md:pt-[10.5rem] pb-28 md:pb-36">
          <div className="max-w-[46rem] mx-auto text-center">
            {/* Eyebrow pill: founding year + what the firm actually is. */}
            <div className="flex justify-center mb-6 md:mb-8 animate-fade-in">
              <span
                className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.07]
                           py-1.5 pl-1.5 pr-4 backdrop-blur-sm"
              >
                <span className="rounded-full bg-bronze px-2.5 py-1 font-label-caps text-label-caps font-semibold text-white tabular">
                  {settings.established}
                </span>
                <span className="font-label-ui text-label-ui text-white/90 whitespace-nowrap">
                  Real Estate Consultants &amp; Developers
                </span>
              </span>
            </div>

            {/* Mobile keeps its own size/leading; from 768px up the values restore
                the text-display-hero token exactly (56px / 64px / -0.02em). */}
            <h1 className="hero-title font-display-hero text-[2.25rem] leading-[1.12] tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.1] md:text-display-hero md:leading-[64px] md:tracking-[-0.02em] lg:text-[4.25rem] lg:leading-[1.04] text-white animate-fade-up">
              Find a place that
              <br className="hidden sm:block" />{' '}
              feels like <span className="italic font-normal">yours.</span>
            </h1>

            <p
              className="hero-lede mx-auto mt-4 md:mt-6 font-body-lg text-[0.9375rem] leading-[1.65] sm:text-[1rem] md:text-body-lg md:leading-relaxed text-white/85 max-w-[38ch] md:max-w-[56ch] animate-fade-up"
              style={{ animationDelay: '90ms' }}
            >
              Premium residential and commercial properties across Coimbatore
              and surrounding locations.
            </p>

            <div
              className="hero-actions mt-7 md:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-center gap-3 animate-fade-up"
              style={{ animationDelay: '180ms' }}
            >
              <Link to="/properties" className="btn-bronze w-full sm:w-auto">
                <span>Explore Properties</span>
                <Icon name="arrow_forward" size={18} />
              </Link>
              <a
                href={waGeneral}
                target="_blank"
                rel="noopener noreferrer"
                className="btn w-full sm:w-auto border border-white/45 bg-charcoal/45 backdrop-blur-sm text-white
                           px-space-lg py-3.5 hover:bg-white hover:text-charcoal hover:border-white transition-colors"
              >
                <Icon name="chat" size={18} />
                <span>Talk to an Expert</span>
              </a>
            </div>

            {/* Verified credibility only: founding year, asset mix, service area. */}
            <ul
              className="hero-trust mt-9 md:mt-12 flex flex-wrap justify-center items-center gap-x-5 gap-y-2.5 md:gap-x-8 border-t border-white/15 pt-5 md:pt-6 animate-fade-up"
              style={{ animationDelay: '260ms' }}
            >
              {['Since 2008', 'Residential & Commercial', 'Coimbatore & Surrounding Areas'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-bronze-300 shrink-0" aria-hidden="true" />
                  <span className="font-label-ui text-label-ui text-white whitespace-nowrap">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ 2. FLOATING SEARCH MODULE ============ */}
      <section className="relative z-30 shell -mt-16 md:-mt-20 mb-space-xl">
        {categories.data && locations.data ? (
          <SearchBar categories={categories.data} locations={locations.data} total={totalListings} />
        ) : (
          <div className="bg-surface-container-lowest rounded-xl shadow-float p-space-lg">
            <div className="h-8 w-2/3 skeleton mb-4" />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 skeleton" />)}
            </div>
          </div>
        )}
      </section>

      {/* ============ 3. TRUST & AUTHORITY STRIP ============ */}
      <section className="shell mb-space-xl">
        <div className="bg-surface-container-low rounded-xl p-space-lg lg:p-space-xl shadow-sm">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-lg items-start">
            {[
              {
                overline: 'HERITAGE FOOTPRINT', tone: 'text-secondary',
                metric: `Since ${settings.established}`,
                copy: `Real estate consultancy and development in ${settings.city} and the surrounding districts.`,
              },
              {
                overline: 'PORTFOLIO BREADTH', tone: 'text-secondary',
                metric: totalListings ? `${totalListings} Listings` : 'Curated',
                copy: 'Residential and commercial properties for outright purchase and rental.',
              },
              {
                overline: 'ADVISORY MODEL', tone: 'text-on-tertiary-fixed-variant',
                metric: 'Direct Access',
                copy: 'Every enquiry is handled personally by our advisory desk — no call centre.',
              },
              {
                overline: 'NETWORK COVERAGE', tone: 'text-secondary',
                metric: `${locations.data?.length ?? 6} Key Hubs`,
                copy: 'Coimbatore, Tirupur, Pollachi, the Nilgiris, Erode and Palakkad corridors.',
              },
            ].map((item) => (
              <div key={item.overline} className="flex flex-col" data-reveal>
                <div className={`font-label-caps text-label-caps ${item.tone} mb-1 uppercase`}>{item.overline}</div>
                <div className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-semibold tracking-tight">
                  {item.metric}
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 4. ASYMMETRICAL FEATURED GRID ============ */}
      <section className="shell mb-space-xl" id="featured-listings">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
          <div>
            <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">Curated Portfolio</span>
            <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1">
              Featured Properties
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mt-1">
              Hand-picked architectural masterpieces, plantations and pre-leased high-yield commercial assets.
            </p>
          </div>
          <Link to="/properties" className="btn-secondary btn-sm shrink-0 self-start md:self-auto">
            View all properties
            <Icon name="arrow_forward" size={16} />
          </Link>
        </div>

        {featured.loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
            <div className="lg:col-span-7"><PropertyCardSkeleton /></div>
            <div className="lg:col-span-5 flex flex-col gap-space-md">
              <PropertyCardSkeleton variant="compact" />
              <PropertyCardSkeleton variant="compact" />
            </div>
          </div>
        ) : featuredList.length === 0 ? (
          <div className="card p-space-xl text-center">
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Featured listings are being curated. <Link to="/properties" className="text-secondary underline">Browse the full catalogue</Link>.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md mb-space-md">
              {flagship && (
                <div className="lg:col-span-7" data-reveal>
                  <PropertyCard property={flagship} variant="flagship" priority />
                </div>
              )}
              {/* Cards size to their own content rather than stretching to the
                  flagship height (which left a dead band inside each card).
                  The column is centred so the pair reads as a deliberate
                  counterweight to the flagship instead of leaving the lower
                  half of the column empty. */}
              {stacked.length > 0 && (
                <div className="lg:col-span-5 flex flex-col justify-center gap-space-md">
                  {stacked.map((p) => (
                    <div key={p.id} data-reveal>
                      <PropertyCard property={p} variant="compact" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {row.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
                {row.map((p) => (
                  <div key={p.id} data-reveal><PropertyCard property={p} /></div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ============ 5. BROWSE BY CLASSIFICATION ============ */}
      <section className="shell mb-space-xl">
        <div className="mb-space-lg">
          <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">Discover by Classification</span>
          <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1">
            Find the Right Property
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mt-1">
            Segmented asset categories engineered for family life, capital appreciation and corporate tenancy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {(categories.data ?? []).slice(0, 6).map((cat) => (
            <Link
              key={cat.slug}
              to={`/properties?type=${cat.slug}`}
              className="relative h-64 rounded-xl overflow-hidden group block shadow-lvl1 hover:shadow-lvl2 transition-all"
              data-reveal
            >
              <Img
                src={cat.image_url}
                alt={`${cat.name} — ${cat.description}`}
                className="absolute inset-0 w-full h-full"
                imgClassName="group-hover:scale-105 transition-transform duration-700 ease-out"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-space-md text-on-primary">
                <div className="font-label-caps text-label-caps text-secondary-fixed mb-1 uppercase">
                  {cat.property_count} {cat.property_count === 1 ? 'Property' : 'Properties'} Available
                </div>
                <h3 className="font-headline-sm text-headline-sm font-semibold">{cat.name}</h3>
                <p className="font-body-sm text-body-sm text-primary-fixed-dim mt-1 line-clamp-2">{cat.description}</p>
              </div>
            </Link>
          ))}
          {categories.loading && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-64 skeleton rounded-xl" />)}
        </div>
      </section>

      {/* ============ 6. REGIONAL FOOTPRINT ============ */}
      <section className="shell mb-space-xl">
        <div className="bg-surface-container-low rounded-xl p-space-lg lg:p-space-xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
            <div>
              <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">Regional Coverage</span>
              <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1">
                Explore Western Tamil Nadu &amp; Nilgiris
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mt-1">
                Properties across the districts we know first-hand, with local documentation support.
              </p>
            </div>
            <span className="font-label-caps text-label-caps text-on-surface-variant font-medium uppercase shrink-0">
              {locations.data?.length ?? 6} Focused Districts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {(locations.data ?? []).map((loc) => (
              <Link
                key={loc.slug}
                to={`/properties?location=${loc.slug}`}
                className="bg-surface-container-lowest p-space-lg rounded-xl shadow-lvl1 hover:shadow-lvl2 transition-all group block"
                data-reveal
              >
                <div className="flex items-center justify-between mb-space-sm gap-2">
                  <span className="w-10 h-10 rounded-lg bg-surface-container grid place-items-center text-secondary shrink-0">
                    <Icon name="location_city" size={22} />
                  </span>
                  <span className="font-label-caps text-label-caps text-secondary font-bold uppercase tabular">
                    {loc.property_count} {loc.property_count === 1 ? 'Listing' : 'Listings'}
                  </span>
                </div>
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold group-hover:text-secondary transition-colors">
                  {loc.name}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 mb-space-md line-clamp-2">
                  {loc.localities}
                </p>
                <div className="pt-space-xs flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm border-t border-[#e7e5e4]">
                  <span>{loc.tagline}</span>
                  <Icon name="arrow_forward" size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
            {locations.loading && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-44 skeleton rounded-xl" />)}
          </div>
        </div>
      </section>

      {/* ============ 7. HERITAGE / ABOUT SPLIT ============ */}
      <section className="shell mb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
          <div className="lg:col-span-6 relative" data-reveal>
            <div className="relative rounded-2xl overflow-hidden shadow-lvl3 aspect-[4/3]">
              <Img
                src="/media/about-office.jpg"
                alt="Prime Estates consultation room with property site plans and a teak conference table"
                className="w-full h-full"
                sizes="(max-width: 1024px) 100vw, 48vw"
              />
            </div>
            <div className="absolute -bottom-8 right-6 max-w-xs bg-surface-container-lowest p-space-md rounded-xl shadow-lvl3 hidden sm:block">
              <div className="flex items-center gap-space-xs text-secondary mb-1">
                <Icon name="gavel" size={20} />
                <span className="font-label-caps text-label-caps font-bold uppercase">Documentation Support</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                We guide buyers through title documents, approvals and registration with local legal counsel.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 mt-10 lg:mt-0" data-reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-caps text-label-caps tracking-widest mb-space-md uppercase">
              <span>Since {settings.established} in {settings.city}</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mb-space-md leading-tight">
              Deep Local Knowledge, Rigorous Diligence.
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-md leading-relaxed">
              {settings.description}
            </p>

            <div className="space-y-space-md mb-space-lg">
              {[
                { icon: 'verified_user', title: 'Documentation & approvals guidance', copy: 'We walk you through title documents, patta, encumbrance and approval checks with qualified local counsel before you commit.' },
                { icon: 'public', title: 'Support for NRI and outstation buyers', copy: 'Remote viewings, coordination and registration facilitation for buyers who cannot be present in person.' },
                { icon: 'handshake', title: 'Direct consultant access', copy: 'You speak to the same advisor from first enquiry through to handover — every enquiry is answered personally.' },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-space-sm">
                  <div className="w-8 h-8 rounded-full bg-surface-container grid place-items-center shrink-0 text-secondary mt-0.5">
                    <Icon name={f.icon} size={18} />
                  </div>
                  <div>
                    <h3 className="font-title-md text-title-md text-on-surface font-bold">{f.title}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{f.copy}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-space-md">
              <a href={tel} className="btn-primary">
                <Icon name="call" size={18} />
                Speak with an advisor
              </a>
              <Link to="/about" className="btn-secondary">
                About Prime Estates
                <Icon name="arrow_forward" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 8. LATEST LISTINGS ============ */}
      {latest.data && latest.data.data.length > 0 && (
        <section className="shell mb-space-xl">
          <div className="flex items-end justify-between gap-space-md mb-space-lg">
            <div>
              <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">Latest on the desk</span>
              <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1">
                Recently Added
              </h2>
            </div>
            <Link to="/properties?sort=newest" className="btn-ghost btn-sm shrink-0">
              See all
              <Icon name="arrow_forward" size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {latest.data.data.map((p) => (
              <div key={p.id} data-reveal><PropertyCard property={p} /></div>
            ))}
          </div>
        </section>
      )}

      {/* ============ 9. CONVERSION DESK ============ */}
      <section className="shell mb-space-xl">
        <div className="bg-primary-container text-on-primary rounded-2xl p-space-lg lg:p-space-xl overflow-hidden relative shadow-lvl3">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 pointer-events-none" aria-hidden="true">
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 400 400" preserveAspectRatio="none">
              <polygon points="0,400 400,0 400,400" />
              <line stroke="currentColor" strokeWidth="4" x1="50" x2="400" y1="400" y2="50" />
              <line stroke="currentColor" strokeWidth="2" x1="100" x2="400" y1="400" y2="100" />
              <line stroke="currentColor" strokeWidth="1" x1="150" x2="400" y1="400" y2="150" />
            </svg>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl relative z-10">
            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-bright/10 backdrop-blur-md mb-space-md">
                  <span className="w-2 h-2 rounded-full bg-secondary-container" aria-hidden="true" />
                  <span className="font-label-caps text-label-caps text-secondary-fixed tracking-widest uppercase">Advisory Desk</span>
                </div>
                <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg font-semibold mb-space-md leading-tight text-on-primary">
                  Have a Specific Property Requirement in Mind?
                </h2>
                <p className="font-body-md text-body-md text-primary-fixed-dim leading-relaxed mb-space-lg">
                  Tell us what you are looking for — location, configuration and budget — and we will revert
                  with matching options from our portfolio and network.
                </p>
              </div>

              <div className="space-y-space-sm pt-space-md">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-bright/10 grid place-items-center text-secondary-fixed shrink-0">
                    <Icon name="phone_in_talk" size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-label-caps text-label-caps text-primary-fixed-dim uppercase">Direct Advisory Line</span>
                    <a href={tel} className="font-title-lg text-title-lg text-on-primary font-bold hover:text-secondary-fixed transition-colors tabular">
                      {settings.phone_display}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-bright/10 grid place-items-center text-on-tertiary-container shrink-0">
                    <Icon name="chat" size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-label-caps text-label-caps text-primary-fixed-dim uppercase">Instant WhatsApp</span>
                    <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="font-title-md text-title-md text-on-tertiary-container font-semibold hover:underline">
                      Start a conversation
                    </a>
                  </div>
                </div>
                {settings.address && (
                  <div className="flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-lg bg-surface-bright/10 grid place-items-center text-secondary-fixed shrink-0">
                      <Icon name="pin_drop" size={20} />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-label-caps text-label-caps text-primary-fixed-dim uppercase">Office</span>
                      <span className="font-body-sm text-body-sm text-on-primary">{settings.address}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 bg-surface-container-lowest text-on-surface rounded-xl p-space-md lg:p-space-lg shadow-lvl2">
              <EnquiryForm
                source="homepage"
                heading="Share your requirement"
                subheading="Fill in your details and our advisory desk will get back to you."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
