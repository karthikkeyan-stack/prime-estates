import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getServices, getLocations, getGallery, getProperties } from '../lib/api';
import { useAsync, useEscape, useRevealGroup, useScrollLock } from '../hooks';
import { useSettings } from '../lib/store';
import { Seo } from '../lib/seo';
import { PropertyCard } from '../components/PropertyCard';
import { EnquiryForm } from '../components/EnquiryForm';
import { EmptyState, Icon, Img, MapEmbed } from '../components/ui';

/* ================================ ABOUT ================================ */

export function About() {
  const { settings, tel, loading: loadingSettings } = useSettings();
  const ref = useRevealGroup<HTMLDivElement>([]);

  return (
    <div ref={ref} className="pt-space-lg pb-space-xl">
      <Seo
        title={`About ${settings.business_name} | Real Estate Consultants in ${settings.city} Since ${settings.established}`}
        description={settings.short_description || settings.description}
        image="/media/about-office.jpg"
      />

      <section className="shell mb-space-xl">
        <nav aria-label="Breadcrumb" className="mb-space-md">
          <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li className="text-on-surface font-medium">About</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-caps text-label-caps tracking-widest mb-space-md uppercase">
              Established {settings.established}
            </div>
            <h1 className="font-headline-lg text-headline-lg-mobile sm:text-display-hero text-on-surface font-semibold mb-space-md leading-tight">
              A Coimbatore practice, built on local knowledge.
            </h1>
            <div className="prose-estate">
              {/*
                settings.description arrives with the /api/settings fetch. Left
                unreserved it expands from 0 to ~208px on a phone and shoves the
                rest of the column down — the single largest shift on this page.
                min-h holds the space; the skeleton makes the wait intentional.
              */}
              <div className="min-h-[13rem] sm:min-h-[9rem]">
                {loadingSettings
                  ? (
                    <div className="space-y-2 pt-1" aria-hidden="true">
                      {[100, 96, 99, 92, 70].map((w, i) => (
                        <div key={i} className="h-4 skeleton rounded" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  )
                  : <p>{settings.description}</p>}
              </div>
              <p>
                Our work covers both sides of a transaction: helping buyers and tenants find the right
                property, and helping owners present and place theirs. Because we operate across
                Coimbatore, Tirupur, Pollachi, the Nilgiris, Erode and Palakkad, we can compare
                micro-markets rather than push whatever happens to be on the books.
              </p>
            </div>
            <div className="flex flex-wrap gap-space-md mt-space-lg">
              <Link to="/properties" className="btn-primary">
                Browse properties
                <Icon name="arrow_forward" size={16} />
              </Link>
              <a href={tel} className="btn-secondary">
                <Icon name="call" size={18} />
                {settings.phone_display}
              </a>
            </div>
          </div>
          <div className="lg:col-span-6" data-reveal>
            <div className="rounded-2xl overflow-hidden shadow-lvl3 aspect-[4/3]">
              <Img src="/media/about-office.jpg" alt="Prime Estates consultation room" className="w-full h-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="shell mb-space-xl">
        <div className="bg-surface-container-low rounded-xl p-space-lg lg:p-space-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-lg">
            {[
              { icon: 'schedule', title: `Operating since ${settings.established}`, copy: 'A continuous presence in the Coimbatore market through multiple property cycles.' },
              { icon: 'map', title: 'Six district coverage', copy: 'Coimbatore, Tirupur, Pollachi, the Nilgiris, Erode and Palakkad — including the border corridors.' },
              { icon: 'diversity_3', title: 'Consultants and developers', copy: 'We advise on acquisitions and also undertake development, so we understand both perspectives.' },
            ].map((item) => (
              <div key={item.title} data-reveal>
                <div className="w-11 h-11 rounded-lg bg-surface-container-lowest grid place-items-center text-secondary mb-space-sm shadow-lvl1">
                  <Icon name={item.icon} size={22} />
                </div>
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold mb-1">{item.title}</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="shell mb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
          <div className="lg:col-span-5">
            <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">How we work</span>
            <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1 mb-space-md">
              Straightforward, start to finish.
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Most of our business comes from people who have dealt with us before, or who were referred.
              That only works if the process is honest and the follow-through is real.
            </p>
          </div>
          <div className="lg:col-span-7">
            <ol className="space-y-space-md">
              {[
                { n: '01', t: 'Understand the requirement', c: 'Budget, locality, configuration, timeline and the practical constraints that come with each.' },
                { n: '02', t: 'Shortlist honestly', c: 'We show what genuinely fits, including options outside our own listings where that serves you better.' },
                { n: '03', t: 'Verify before you commit', c: 'Title documents, approvals, encumbrance and measurements checked with qualified local counsel.' },
                { n: '04', t: 'Close and hand over', c: 'Negotiation, agreement, registration and handover coordinated end to end.' },
              ].map((step) => (
                <li key={step.n} className="flex gap-space-md card p-space-md" data-reveal>
                  <span className="font-display-hero-mobile text-display-hero-mobile text-surface-container-highest font-semibold leading-none shrink-0 tabular">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="font-title-lg text-title-lg text-on-surface font-bold mb-0.5">{step.t}</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">{step.c}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}

/* =============================== SERVICES =============================== */

export function Services() {
  const { settings } = useSettings();
  const services = useAsync(getServices, []);
  const ref = useRevealGroup<HTMLDivElement>([services.data]);

  return (
    <div ref={ref} className="pt-space-lg pb-space-xl">
      <Seo
        title={`Services | ${settings.business_name} — Real Estate Consultants in ${settings.city}`}
        description="Residential and commercial property sales, rentals, plots and land, consulting and property development across Coimbatore and Western Tamil Nadu."
      />

      <section className="shell mb-space-xl">
        <nav aria-label="Breadcrumb" className="mb-space-md">
          <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li className="text-on-surface font-medium">Services</li>
          </ol>
        </nav>
        <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">What we do</span>
        <h1 className="font-headline-lg text-headline-lg-mobile sm:text-display-hero text-on-surface font-semibold mt-1 mb-space-sm">
          Services
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Consultancy and development across residential and commercial property — for outright purchase,
          rental and lease in and around {settings.city}.
        </p>
      </section>

      <section className="shell mb-space-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {(services.data ?? []).map((s) => (
            <article key={s.slug} className="card p-space-lg flex flex-col h-full" data-reveal>
              <div className="w-12 h-12 rounded-lg bg-surface-container grid place-items-center text-secondary mb-space-md">
                <Icon name={s.icon} size={24} />
              </div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1.5">{s.title}</h2>
              <p className="font-title-md text-title-md text-on-surface-variant mb-space-sm">{s.summary}</p>
              <p className="font-body-md text-body-md text-on-surface-variant flex-1">{s.body}</p>
              <Link to="/contact" className="inline-flex items-center gap-1 mt-space-md font-label-ui text-label-ui text-on-surface hover:text-secondary transition-colors">
                Discuss this service
                <Icon name="arrow_forward" size={15} />
              </Link>
            </article>
          ))}
          {services.loading && [0, 1, 2, 3].map((i) => <div key={i} className="h-64 skeleton rounded-xl" />)}
        </div>
      </section>

      <CtaBand />
    </div>
  );
}

/* =============================== LOCATIONS =============================== */

export function Locations() {
  const { settings } = useSettings();
  const locations = useAsync(getLocations, []);
  const ref = useRevealGroup<HTMLDivElement>([locations.data]);

  return (
    <div ref={ref} className="pt-space-lg pb-space-xl">
      <Seo
        title={`Locations We Serve | ${settings.business_name}`}
        description="Prime Estates covers Coimbatore, Tirupur, Pollachi, Ooty and the Nilgiris, Erode and Palakkad — residential and commercial property across Western Tamil Nadu."
      />

      <section className="shell mb-space-xl">
        <nav aria-label="Breadcrumb" className="mb-space-md">
          <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li className="text-on-surface font-medium">Locations</li>
          </ol>
        </nav>
        <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">Regional coverage</span>
        <h1 className="font-headline-lg text-headline-lg-mobile sm:text-display-hero text-on-surface font-semibold mt-1 mb-space-sm">
          Where We Operate
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          We work in and around {settings.city} and the neighbouring districts, with direct knowledge of
          each corridor rather than second-hand listings.
        </p>
      </section>

      <section className="shell mb-space-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {(locations.data ?? []).map((loc) => (
            <Link key={loc.slug} to={`/properties?location=${loc.slug}`} className="card p-space-lg group hover:shadow-lvl2 transition-all" data-reveal>
              <div className="flex items-start justify-between mb-space-md gap-2">
                <span className="w-11 h-11 rounded-lg bg-surface-container grid place-items-center text-secondary shrink-0">
                  <Icon name="location_city" size={22} />
                </span>
                <span className="badge bg-surface-container text-on-surface-variant tabular">
                  {loc.property_count} {loc.property_count === 1 ? 'listing' : 'listings'}
                </span>
              </div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-secondary transition-colors mb-1">
                {loc.name}
              </h2>
              <p className="font-label-caps text-label-caps text-secondary uppercase mb-space-sm">{loc.tagline}</p>
              <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">{loc.localities}</p>
              <span className="inline-flex items-center gap-1 font-label-ui text-label-ui text-on-surface group-hover:text-secondary transition-colors">
                View properties
                <Icon name="arrow_forward" size={15} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
          {locations.loading && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-56 skeleton rounded-xl" />)}
        </div>
      </section>

      <CtaBand />
    </div>
  );
}

/* ================================ GALLERY ================================ */

export function Gallery() {
  const { settings } = useSettings();
  const gallery = useAsync(getGallery, []);
  const [filter, setFilter] = useState('All');
  const [active, setActive] = useState<number | null>(null);
  const ref = useRevealGroup<HTMLDivElement>([gallery.data, filter]);

  useScrollLock(active !== null);
  useEscape(active !== null, () => setActive(null));

  const items = gallery.data ?? [];
  const categories = ['All', ...Array.from(new Set(items.map((i) => i.category)))];
  const visible = filter === 'All' ? items : items.filter((i) => i.category === filter);

  return (
    <div ref={ref} className="pt-space-lg pb-space-xl">
      <Seo
        title={`Gallery | ${settings.business_name}`}
        description="A visual selection of residences, plots, plantations and commercial properties represented by Prime Estates across Coimbatore and Western Tamil Nadu."
      />

      <section className="shell mb-space-lg">
        <nav aria-label="Breadcrumb" className="mb-space-md">
          <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li className="text-on-surface font-medium">Gallery</li>
          </ol>
        </nav>
        <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">Visual portfolio</span>
        <h1 className="font-headline-lg text-headline-lg-mobile sm:text-display-hero text-on-surface font-semibold mt-1 mb-space-md">
          Gallery
        </h1>
        {/*
          The category chips only exist once the gallery has loaded. Without a
          reserved height this row appears from nothing and pushes the grid
          below it down — a visible jump and a measurable layout shift.
          min-h matches one row of chips.
        */}
        {/*
          Reserve the real height of the chip row. On a 390px phone the
          categories wrap to three lines (112px); from `sm:` up they fit on
          one (36px). Measured, not guessed — an under-reserved box is what
          caused the remaining shift here.
        */}
        <div className="flex flex-wrap gap-2 min-h-[7rem] sm:min-h-[2.25rem] content-start">
          {gallery.loading
            ? [40, 72, 56, 64, 48, 60].map((w, i) => (
                <div key={i} className="h-9 skeleton rounded-full" style={{ width: `${w}px` }} aria-hidden="true" />
              ))
            : categories.map((c) => (
                <button key={c} onClick={() => setFilter(c)} className={`chip ${filter === c ? 'chip-active' : ''}`} aria-pressed={filter === c}>
                  {c}
                </button>
              ))}
        </div>
      </section>

      <section className="shell mb-space-xl">
        {gallery.loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-space-md">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-64 skeleton rounded-xl mb-space-md" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="card"><EmptyState icon="photo_library" title="No images yet" message="Gallery images are managed from the admin panel." /></div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-space-md [column-fill:_balance]">
            {visible.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setActive(i)}
                className="relative w-full mb-space-md break-inside-avoid rounded-xl overflow-hidden group block shadow-lvl1 hover:shadow-lvl2 transition-all"
                data-reveal
                aria-label={`View ${item.caption}`}
              >
                <Img
                  src={item.url}
                  alt={item.caption}
                  className={i % 3 === 0 ? 'aspect-[4/5]' : i % 3 === 1 ? 'aspect-[4/3]' : 'aspect-square'}
                  imgClassName="group-hover:scale-105 transition-transform duration-700"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary-container/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-space-md text-left translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all">
                  <span className="font-label-caps text-label-caps text-secondary-fixed uppercase block mb-0.5">{item.category}</span>
                  <span className="font-title-md text-title-md text-on-primary">{item.caption}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {active !== null && visible[active] && (
        <div className="fixed inset-0 z-[95] bg-[rgba(17,24,39,0.94)] flex flex-col" role="dialog" aria-modal="true" aria-label="Gallery image">
          <div className="flex items-center justify-between px-4 py-3 text-on-primary shrink-0">
            <span className="font-label-ui text-label-ui tabular">{active + 1} / {visible.length}</span>
            <button onClick={() => setActive(null)} className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10" aria-label="Close">
              <Icon name="close" size={24} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2 sm:px-12 min-h-0 relative">
            <button
              onClick={() => setActive((i) => ((i ?? 0) - 1 + visible.length) % visible.length)}
              className="absolute left-2 sm:left-4 w-11 h-11 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-on-primary z-10"
              aria-label="Previous image"
            >
              <Icon name="chevron_left" size={26} />
            </button>
            <img src={visible[active].url} alt={visible[active].caption} className="max-h-full max-w-full object-contain rounded-lg" />
            <button
              onClick={() => setActive((i) => ((i ?? 0) + 1) % visible.length)}
              className="absolute right-2 sm:right-4 w-11 h-11 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-on-primary z-10"
              aria-label="Next image"
            >
              <Icon name="chevron_right" size={26} />
            </button>
          </div>
          <p className="text-center font-body-md text-body-md text-primary-fixed-dim px-4 py-3 shrink-0">
            {visible[active].caption}
          </p>
        </div>
      )}

      <CtaBand />
    </div>
  );
}

/* ================================ CONTACT ================================ */

export function Contact() {
  const { settings, tel, waGeneral } = useSettings();

  const mapQuery = settings.address
    ? encodeURIComponent(settings.address)
    : encodeURIComponent(`${settings.city}, Tamil Nadu, India`);
  const mapSrc = settings.maps_embed || `https://www.google.com/maps?q=${mapQuery}&z=12&output=embed`;

  return (
    <div className="pt-space-lg pb-space-xl">
      <Seo
        title={`Contact ${settings.business_name} | ${settings.city}`}
        description={`Speak with Prime Estates — call ${settings.phone_display} or message us on WhatsApp for residential and commercial property in Coimbatore and Western Tamil Nadu.`}
      />

      <section className="shell mb-space-lg">
        <nav aria-label="Breadcrumb" className="mb-space-md">
          <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li className="text-on-surface font-medium">Contact</li>
          </ol>
        </nav>
        <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">Get in touch</span>
        <h1 className="font-headline-lg text-headline-lg-mobile sm:text-display-hero text-on-surface font-semibold mt-1 mb-space-sm">
          Contact Prime Estates
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Call or message us directly — every enquiry is handled by our advisory desk.
        </p>
      </section>

      <section className="shell mb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-5 space-y-space-md">
            <a href={tel} className="card p-space-lg flex items-center gap-space-md hover:shadow-lvl2 transition-all group">
              <span className="w-12 h-12 rounded-lg bg-primary-container grid place-items-center text-on-primary shrink-0">
                <Icon name="call" size={22} />
              </span>
              <span className="min-w-0">
                <span className="block font-label-caps text-label-caps text-on-surface-variant uppercase">Phone</span>
                <span className="block font-title-lg text-title-lg text-on-surface font-bold tabular group-hover:text-secondary transition-colors">
                  {settings.phone_display}
                </span>
              </span>
            </a>

            <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="card p-space-lg flex items-center gap-space-md hover:shadow-lvl2 transition-all group">
              <span className="w-12 h-12 rounded-lg bg-on-tertiary-fixed-variant grid place-items-center text-on-tertiary shrink-0">
                <Icon name="chat" size={22} />
              </span>
              <span className="min-w-0">
                <span className="block font-label-caps text-label-caps text-on-surface-variant uppercase">WhatsApp</span>
                <span className="block font-title-lg text-title-lg text-on-surface font-bold group-hover:text-on-tertiary-fixed-variant transition-colors">
                  Message us
                </span>
              </span>
            </a>

            {settings.email && (
              <a href={`mailto:${settings.email}`} className="card p-space-lg flex items-center gap-space-md hover:shadow-lvl2 transition-all group">
                <span className="w-12 h-12 rounded-lg bg-secondary grid place-items-center text-on-secondary shrink-0">
                  <Icon name="mail" size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block font-label-caps text-label-caps text-on-surface-variant uppercase">Email</span>
                  <span className="block font-title-md text-title-md text-on-surface font-bold break-all group-hover:text-secondary transition-colors">
                    {settings.email}
                  </span>
                </span>
              </a>
            )}

            {settings.address && (
              <div className="card p-space-lg flex items-start gap-space-md">
                <span className="w-12 h-12 rounded-lg bg-surface-container grid place-items-center text-secondary shrink-0">
                  <Icon name="pin_drop" size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block font-label-caps text-label-caps text-on-surface-variant uppercase">Office</span>
                  <span className="block font-body-lg text-body-lg text-on-surface">{settings.address}</span>
                </span>
              </div>
            )}

            <div className="card p-space-lg">
              <h2 className="font-title-lg text-title-lg text-on-surface font-bold mb-space-sm">Service area</h2>
              <div className="flex flex-wrap gap-2">
                {['Coimbatore', 'Tirupur', 'Pollachi', 'Ooty', 'Erode', 'Palakkad'].map((c) => (
                  <span key={c} className="chip">{c}</span>
                ))}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-md">
                Operating since {settings.established}. Consultants and developers for residential and
                commercial property.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="card p-space-lg lg:p-space-xl">
              <EnquiryForm
                source="contact-page"
                heading="Send us a message"
                subheading="Tell us what you are looking for and we will get back to you."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="shell">
        <div className="card overflow-hidden">
          <div className="aspect-[16/9] sm:aspect-[21/9] bg-surface-container">
            <MapEmbed
              title={`Map of ${settings.city}`}
              src={mapSrc}
              label={settings.address || settings.city}
            />
          </div>
          {settings.maps_url && (
            <div className="p-space-md flex justify-end">
              <a href={settings.maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                <Icon name="map" size={16} />
                Open in Google Maps
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ============================ shared CTA band ============================ */

function CtaBand() {
  const { settings, tel, waGeneral } = useSettings();
  const featured = useAsync(() => getProperties({ featured: true, limit: 3, sort: 'featured' }), []);

  return (
    <>
      {featured.data && featured.data.data.length > 0 && (
        <section className="shell mb-space-xl">
          <div className="flex items-end justify-between gap-space-md mb-space-lg">
            <div>
              <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">From the portfolio</span>
              <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1">
                Featured Properties
              </h2>
            </div>
            <Link to="/properties" className="btn-ghost btn-sm shrink-0">
              View all
              <Icon name="arrow_forward" size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {featured.data.data.map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        </section>
      )}

      <section className="shell">
        <div className="bg-primary-container text-on-primary rounded-2xl p-space-lg lg:p-space-xl text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem]" aria-hidden="true" />
          <div className="relative z-10">
            <h2 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg font-semibold mb-space-sm">
              Looking for something specific?
            </h2>
            <p className="font-body-lg text-body-lg text-primary-fixed-dim max-w-xl mx-auto mb-space-lg">
              Share your requirement and our advisory desk will revert with matching options.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-space-sm">
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <Icon name="chat" size={18} />
                WhatsApp us
              </a>
              <a href={tel} className="btn-bronze">
                <Icon name="call" size={18} />
                {settings.phone_display}
              </a>
              <Link to="/contact" className="btn-secondary">
                Send an enquiry
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
