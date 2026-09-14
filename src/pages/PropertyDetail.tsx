import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProperty } from '../lib/api';
import type { Property } from '../lib/types';
import { PROPERTY_TYPE_LABELS, LISTING_LABELS, STATUS_LABELS } from '../lib/types';
import { formatArea, priceLabel } from '../lib/format';
import { useEscape, useScrollLock } from '../hooks';
import { useSettings } from '../lib/store';
import { Seo } from '../lib/seo';
import { PropertyCard } from '../components/PropertyCard';
import { EnquiryForm } from '../components/EnquiryForm';
import { Icon, Img, MapEmbed, Spinner } from '../components/ui';
import NotFound from './NotFound';

export default function PropertyDetail() {
  const { slug = '' } = useParams();
  const { settings, tel, waFor } = useSettings();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useScrollLock(lightbox);
  useEscape(lightbox, () => setLightbox(false));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    setActive(0);
    getProperty(slug)
      .then((p) => { if (alive) setProperty(p); })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  // Arrow-key navigation inside the lightbox
  useEffect(() => {
    if (!lightbox || !property) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % property.images.length);
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + property.images.length) % property.images.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, property]);

  if (notFound) return <NotFound />;

  if (loading || !property) {
    // The skeleton deliberately mirrors the real page's block heights. An
    // undersized skeleton is worse than none: the page grows when content
    // arrives and everything below it jumps, which is a large layout shift.
    // The bottom padding matches the sticky mobile action bar so the page
    // does not lurch when that bar mounts.
    // The outer wrapper must match the loaded page's wrapper exactly
    // (`pt-space-lg pb-28 lg:pb-space-xl`), and the inner content must sit
    // inside `.shell` just as it does when loaded. Earlier this component put
    // `.shell` on the outer element, so the whole page changed width and
    // offset when real content arrived — a 0.83 CLS all by itself.
    return (
      <div className="pt-space-lg pb-28 lg:pb-space-xl">
        <div className="shell">
          <div className="h-4 w-64 skeleton mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg lg:gap-space-xl items-start">
            <div className="lg:col-span-8 space-y-4">
              <div className="aspect-[16/10] skeleton rounded-xl" />
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/3] skeleton rounded-lg" />)}
              </div>
              <div className="h-10 w-3/4 skeleton" />
              <div className="h-5 w-1/2 skeleton" />
              <div className="h-24 w-full skeleton rounded-xl" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <div className="h-96 skeleton rounded-xl" />
            </div>
          </div>
          <div className="sr-only" role="status">Loading property</div>
        </div>
      </div>
    );
  }

  const images = property.images.length
    ? property.images
    : [{ id: 0, url: property.main_image, alt: property.title, is_primary: true, sort_order: 0 }];
  const price = priceLabel(property);
  const typeLabel = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;
  const listingLabel = LISTING_LABELS[property.listing_type] ?? property.listing_type;
  const isClosed = property.status === 'sold' || property.status === 'rented';

  const specs = [
    property.bedrooms ? { icon: 'bed', label: 'Bedrooms', value: `${property.bedrooms} BHK` } : null,
    property.bathrooms ? { icon: 'shower', label: 'Bathrooms', value: String(property.bathrooms) } : null,
    property.property_area ? { icon: 'square_foot', label: 'Total Area', value: formatArea(property.property_area, property.property_area_unit) } : null,
    property.built_up_area ? { icon: 'straighten', label: 'Built-up', value: formatArea(property.built_up_area, 'sqft') } : null,
    property.parking ? { icon: 'directions_car', label: 'Parking', value: `${property.parking} cars` } : null,
    property.facing ? { icon: 'explore', label: 'Facing', value: property.facing } : null,
    property.furnishing ? { icon: 'chair', label: 'Furnishing', value: property.furnishing } : null,
    property.property_age ? { icon: 'calendar_month', label: 'Age', value: property.property_age } : null,
    property.floor !== null && property.floor !== undefined ? { icon: 'stairs', label: 'Floor', value: `${property.floor}${property.total_floors ? ` of ${property.total_floors}` : ''}` } : null,
    !property.floor && property.total_floors ? { icon: 'apartment', label: 'Floors', value: String(property.total_floors) } : null,
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  const mapQuery = property.latitude && property.longitude
    ? `${property.latitude},${property.longitude}`
    : encodeURIComponent(`${property.location}, ${property.district || ''} Tamil Nadu`);
  const mapSrc = `https://www.google.com/maps?q=${mapQuery}&z=13&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return (
    <div className="pt-space-lg pb-28 lg:pb-space-xl">
      <Seo
        title={property.seo_title || `${property.title} — ${property.location} | ${settings.business_name}`}
        description={property.seo_description || property.short_description}
        image={property.main_image}
        type="article"
        canonical={settings.site_url ? `${settings.site_url}/properties/${property.slug}` : undefined}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': ['Product', 'Residence'],
          name: property.title,
          description: property.short_description || property.description,
          image: images.map((i) => (i.url.startsWith('http') ? i.url : `${settings.site_url}${i.url}`)),
          offers: {
            '@type': 'Offer',
            price: Number(property.price),
            priceCurrency: 'INR',
            availability: isClosed ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            seller: { '@type': 'RealEstateAgent', name: settings.business_name, telephone: settings.phone_display },
          },
          address: {
            '@type': 'PostalAddress',
            streetAddress: property.address || property.area_locality,
            addressLocality: property.city,
            addressRegion: property.state,
            addressCountry: 'IN',
          },
          ...(property.bedrooms ? { numberOfRooms: property.bedrooms } : {}),
          ...(property.property_area && property.property_area_unit === 'sqft'
            ? { floorSize: { '@type': 'QuantitativeValue', value: Number(property.property_area), unitCode: 'FTK' } }
            : {}),
        }}
      />

      <div className="shell">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-space-md">
          <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant flex-wrap">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li><Link to="/properties" className="hover:text-secondary">Properties</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li><Link to={`/properties?type=${property.property_type}`} className="hover:text-secondary">{typeLabel}</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li className="text-on-surface font-medium line-clamp-1">{property.title}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg lg:gap-space-xl items-start">
          {/* ---------------- main column ---------------- */}
          <div className="lg:col-span-8 min-w-0">
            {/* Gallery */}
            <div className="mb-space-lg">
              <button
                onClick={() => setLightbox(true)}
                className="relative w-full aspect-[16/10] rounded-xl overflow-hidden group block shadow-lvl1"
                aria-label="Open image gallery"
              >
                <Img
                  src={images[active].url}
                  alt={images[active].alt || property.title}
                  priority
                  className="w-full h-full"
                  imgClassName="group-hover:scale-[1.02] transition-transform duration-700"
                  sizes="(max-width: 1024px) 100vw, 66vw"
                />
                <div className="absolute top-4 left-4 flex flex-wrap gap-2 pr-4">
                  <span className="badge bg-primary-container/90 backdrop-blur-md text-on-primary">{listingLabel}</span>
                  {property.featured && <span className="badge bg-secondary text-on-secondary">Featured</span>}
                  {isClosed && <span className="badge bg-surface-container-lowest/90 text-on-surface">{STATUS_LABELS[property.status]}</span>}
                  {property.verified_title && (
                    <span className="badge-heritage backdrop-blur-md"><Icon name="verified" size={12} />Title Verified</span>
                  )}
                </div>
                <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-container/85 backdrop-blur-md text-on-primary font-label-ui text-label-ui">
                  <Icon name="fullscreen" size={16} />
                  {images.length} {images.length === 1 ? 'photo' : 'photos'}
                </span>
              </button>

              {images.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Property images">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setActive(i)}
                      role="tab"
                      aria-selected={i === active}
                      aria-label={`View image ${i + 1}`}
                      className={`relative w-24 h-16 sm:w-28 sm:h-20 rounded-lg overflow-hidden shrink-0 transition-all ${
                        i === active ? 'ring-2 ring-secondary ring-offset-2' : 'opacity-65 hover:opacity-100'
                      }`}
                    >
                      <Img
                        src={img.url}
                        alt={img.alt || `${property.title} thumbnail ${i + 1}`}
                        className="w-full h-full"
                        /* thumbnails are ~90-150px: never fetch a card-sized file */
                        sizes="150px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title block */}
            <header className="mb-space-lg">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-label-caps text-label-caps text-secondary uppercase">{typeLabel}</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant" aria-hidden="true" />
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{listingLabel}</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant" aria-hidden="true" />
                <span className="font-label-caps text-label-caps text-on-tertiary-fixed-variant uppercase">
                  {STATUS_LABELS[property.status]}
                </span>
              </div>
              <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mb-2">
                {property.title}
              </h1>
              <p className="flex items-center gap-1.5 font-body-lg text-body-lg text-on-surface-variant">
                <Icon name="location_on" size={18} className="text-secondary shrink-0" />
                {property.location}
              </p>
              <div className="lg:hidden mt-space-md">
                <div className="font-metric-price text-metric-price text-secondary tabular">{price}</div>
              </div>
            </header>

            {/* Specification matrix */}
            {specs.length > 0 && (
              <section aria-labelledby="specs-heading" className="mb-space-lg">
                <h2 id="specs-heading" className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Specifications</h2>
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-[#e7e5e4] rounded-xl overflow-hidden border border-[#e7e5e4]">
                  {specs.map((s) => (
                    <div key={s.label} className="bg-[#f5f5f4] p-space-md">
                      <dt className="flex items-center gap-1.5 font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                        <Icon name={s.icon} size={14} className="text-secondary" />
                        {s.label}
                      </dt>
                      <dd className="font-title-lg text-title-lg text-on-surface font-bold tabular">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Description */}
            {(property.description || property.short_description) && (
              <section aria-labelledby="desc-heading" className="mb-space-lg">
                <h2 id="desc-heading" className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">
                  About this property
                </h2>
                <div className="prose-estate">
                  {property.short_description && <p className="!text-on-surface font-medium">{property.short_description}</p>}
                  {property.description?.split('\n').filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
                </div>
              </section>
            )}

            {/* Highlights */}
            {property.highlights?.length > 0 && (
              <section aria-labelledby="high-heading" className="mb-space-lg">
                <h2 id="high-heading" className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Key highlights</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {property.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 bg-surface-container-low rounded-lg px-space-md py-2.5">
                      <Icon name="star" size={16} className="text-secondary shrink-0 mt-0.5" fill />
                      <span className="font-body-md text-body-md text-on-surface">{h}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Amenities */}
            {property.amenities?.length > 0 && (
              <section aria-labelledby="amen-heading" className="mb-space-lg">
                <h2 id="amen-heading" className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Amenities</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-space-md gap-y-2.5">
                  {property.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2 font-body-md text-body-md text-on-surface-variant">
                      <Icon name="check_circle" size={16} className="text-on-tertiary-fixed-variant shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Location / map */}
            <section aria-labelledby="map-heading" className="mb-space-lg">
              <h2 id="map-heading" className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Location</h2>
              <div className="card overflow-hidden">
                <div className="aspect-[16/9] sm:aspect-[21/9] bg-surface-container">
                  <MapEmbed
                    title={`Map of ${property.location}`}
                    src={mapSrc}
                    label={[property.area_locality, property.city].filter(Boolean).join(', ')}
                  />
                </div>
                <div className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                  <div className="min-w-0">
                    <p className="font-title-md text-title-md text-on-surface">{property.area_locality || property.city}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {[property.city, property.district, property.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <a href={mapLink} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm shrink-0">
                    <Icon name="map" size={16} />
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </section>
          </div>

          {/* ---------------- sticky sidebar ---------------- */}
          <aside className="lg:col-span-4 lg:sticky lg:top-[8.5rem] space-y-space-md">
            <div className="card p-space-lg">
              <div className="pb-space-md border-b border-[#e7e5e4] mb-space-md">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                  {property.listing_type === 'sale' ? 'Asking price' : 'Rental'}
                </span>
                <div className="font-display-hero-mobile text-display-hero-mobile text-secondary font-semibold tabular leading-tight mt-1">
                  {price}
                </div>
                {property.property_area && property.property_area_unit === 'sqft' && Number(property.price) > 0 && property.listing_type === 'sale' && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 tabular">
                    ≈ ₹{Math.round(Number(property.price) / Number(property.property_area)).toLocaleString('en-IN')} per sq.ft
                  </p>
                )}
              </div>

              <div className="space-y-2 mb-space-md">
                <a href={waFor(property.title)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full">
                  <Icon name="chat" size={18} />
                  WhatsApp about this property
                </a>
                <a href={tel} className="btn-primary w-full">
                  <Icon name="call" size={18} />
                  Call {settings.phone_display}
                </a>
              </div>

              <div className="pt-space-md border-t border-[#e7e5e4]">
                <EnquiryForm
                  propertyId={property.id}
                  propertyTitle={property.title}
                  source="property-detail"
                  compact
                  showInterest={false}
                  heading="Request details"
                  subheading="Site visits, documents and pricing discussions."
                />
              </div>
            </div>

            <div className="card p-space-md">
              <div className="flex items-start gap-2.5">
                <Icon name="shield" size={20} className="text-secondary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-title-md text-title-md text-on-surface">Advisory since {settings.established}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Prime Estates assists with title documents, approvals and registration through local counsel.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Related */}
        {property.related?.length > 0 && (
          <section aria-labelledby="rel-heading" className="mt-space-xl">
            <div className="flex items-end justify-between gap-space-md mb-space-lg">
              <div>
                <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">You may also like</span>
                <h2 id="rel-heading" className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1">
                  Similar Properties
                </h2>
              </div>
              <Link to={`/properties?location=${property.location_slug}`} className="btn-ghost btn-sm shrink-0">
                More in {property.city || 'this area'}
                <Icon name="arrow_forward" size={15} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
              {property.related.map((r) => <PropertyCard key={r.id} property={r} />)}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest border-t border-[#e7e5e4] shadow-lvl3 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 pr-1">
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase truncate">
              {property.listing_type === 'sale' ? 'Price' : 'Rent'}
            </div>
            <div className="font-title-lg text-title-lg text-secondary tabular truncate">{price}</div>
          </div>
          <a href={tel} className="w-12 h-12 grid place-items-center rounded-lg bg-primary-container text-on-primary shrink-0" aria-label={`Call ${settings.phone_display}`}>
            <Icon name="call" size={20} />
          </a>
          <a
            href={waFor(property.title)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 max-w-[180px] h-12 grid place-items-center rounded-lg bg-on-tertiary-fixed-variant text-on-tertiary font-title-md text-title-md shrink-0"
          >
            <span className="flex items-center gap-1.5">
              <Icon name="chat" size={18} />
              Enquire
            </span>
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[95] bg-[rgba(17,24,39,0.94)] flex flex-col" role="dialog" aria-modal="true" aria-label="Property gallery">
          <div className="flex items-center justify-between px-4 py-3 text-on-primary shrink-0">
            <span className="font-label-ui text-label-ui tabular">{active + 1} / {images.length}</span>
            <button onClick={() => setLightbox(false)} className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10" aria-label="Close gallery">
              <Icon name="close" size={24} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2 sm:px-12 min-h-0 relative">
            {images.length > 1 && (
              <button
                onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 sm:left-4 w-11 h-11 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-on-primary backdrop-blur-sm z-10"
                aria-label="Previous image"
              >
                <Icon name="chevron_left" size={26} />
              </button>
            )}
            <img
              src={images[active].url}
              alt={images[active].alt || property.title}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
            {images.length > 1 && (
              <button
                onClick={() => setActive((i) => (i + 1) % images.length)}
                className="absolute right-2 sm:right-4 w-11 h-11 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-on-primary backdrop-blur-sm z-10"
                aria-label="Next image"
              >
                <Icon name="chevron_right" size={26} />
              </button>
            )}
          </div>
          <div className="shrink-0 px-4 py-3">
            <p className="text-center font-body-sm text-body-sm text-primary-fixed-dim">
              {images[active].alt || property.title}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
