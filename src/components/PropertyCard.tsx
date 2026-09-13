import { Link } from 'react-router-dom';
import type { PropertyCardData } from '../lib/types';
import { PROPERTY_TYPE_LABELS, LISTING_LABELS } from '../lib/types';
import { formatArea, priceLabel } from '../lib/format';
import { useSettings } from '../lib/store';
import { Icon, Img } from './ui';

/**
 * The reusable premium property card from the Stitch design.
 * Variants:
 *   default  — 4:3 image, full spec strip (catalogue + related)
 *   flagship — 16:10 hero image, spec shelf, dual CTA (homepage tier 1)
 *   compact  — horizontal split (homepage stacked column)
 */
export function PropertyCard({
  property, variant = 'default', priority = false,
}: {
  property: PropertyCardData;
  variant?: 'default' | 'flagship' | 'compact';
  priority?: boolean;
}) {
  const { waFor } = useSettings();
  const href = `/properties/${property.slug}`;
  const price = priceLabel(property);
  const typeLabel = PROPERTY_TYPE_LABELS[property.property_type] || property.property_type;
  const listingLabel = LISTING_LABELS[property.listing_type] || property.listing_type;
  const isClosed = property.status === 'sold' || property.status === 'rented';
  const alt = `${property.title} — ${typeLabel} ${listingLabel.toLowerCase()} in ${property.location}`;

  /* ------------------------------ compact ------------------------------ */
  if (variant === 'compact') {
    return (
      <article className="group bg-surface-container-lowest rounded-xl border border-[#e7e5e4] shadow-lvl1 hover:shadow-lvl2 transition-all duration-300 overflow-hidden flex flex-row h-full">
        <Link to={href} className="relative w-[38%] min-w-[120px] shrink-0 overflow-hidden" tabIndex={-1} aria-hidden="true">
          <Img
            src={property.main_image}
            alt={alt}
            className="h-full min-h-[150px]"
            imgClassName="group-hover:scale-105 transition-transform duration-700 ease-out"
          />
          {property.featured && (
            <span className="absolute top-2 left-2 badge bg-secondary text-on-secondary shadow-sm !px-2 !py-0.5">
              Featured
            </span>
          )}
        </Link>
        <div className="flex-1 p-space-md flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="font-label-caps text-label-caps text-secondary uppercase">{typeLabel}</span>
              <span className="w-1 h-1 rounded-full bg-outline-variant shrink-0" aria-hidden="true" />
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{listingLabel}</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface leading-snug mb-1 line-clamp-2">
              <Link to={href} className="hover:text-secondary transition-colors">{property.title}</Link>
            </h3>
            <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant line-clamp-1">
              <Icon name="location_on" size={13} className="text-outline shrink-0" />
              {property.location}
            </p>
          </div>
          <div className="mt-space-sm">
            <div className="font-metric-price text-metric-price text-secondary tabular mb-1.5 truncate">{price}</div>
            <div className="flex items-center gap-2.5 font-body-sm text-body-sm text-on-surface-variant tabular flex-wrap">
              {property.bedrooms ? <span className="flex items-center gap-1"><Icon name="bed" size={13} />{property.bedrooms}</span> : null}
              {property.bathrooms ? <span className="flex items-center gap-1"><Icon name="shower" size={13} />{property.bathrooms}</span> : null}
              {property.property_area ? (
                <span className="flex items-center gap-1 truncate">
                  <Icon name="square_foot" size={13} />
                  {formatArea(property.property_area, property.property_area_unit)}
                </span>
              ) : null}
            </div>
            <Link
              to={href}
              className="inline-flex items-center gap-1 mt-space-sm font-label-ui text-label-ui text-on-surface hover:text-secondary transition-colors"
            >
              Explore Details
              <Icon name="arrow_forward" size={14} />
            </Link>
          </div>
        </div>
      </article>
    );
  }

  /* ----------------------------- flagship ----------------------------- */
  if (variant === 'flagship') {
    return (
      <article className="group bg-surface-container-lowest rounded-xl border border-[#e7e5e4] overflow-hidden shadow-lvl1 hover:shadow-lvl2 transition-all duration-300 flex flex-col h-full">
        <Link to={href} className="relative block w-full aspect-[16/10] overflow-hidden" aria-label={property.title}>
          <Img
            src={property.main_image}
            alt={alt}
            priority={priority}
            className="w-full h-full"
            imgClassName="group-hover:scale-105 transition-transform duration-700 ease-out"
            sizes="(max-width: 1024px) 100vw, 58vw"
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 pr-16">
            {property.featured && (
              <span className="badge bg-secondary text-on-secondary shadow-sm">Exclusive Flagship</span>
            )}
            <span className="badge bg-surface-container-lowest/90 backdrop-blur-md text-on-surface">
              {property.area_locality || property.city || property.location}
            </span>
            {isClosed && <span className="badge bg-primary-container text-on-primary">{property.status}</span>}
          </div>
          <span className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-lowest/80 backdrop-blur-md text-on-surface grid place-items-center shadow-md">
            <Icon name="villa" size={18} />
          </span>
        </Link>

        <div className="p-space-lg flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-space-sm mb-2 flex-wrap">
              <span className="font-metric-price text-metric-price text-secondary tabular">{price}</span>
              {property.verified_title && (
                <span className="font-label-caps text-label-caps text-on-tertiary-fixed-variant font-semibold uppercase">
                  Title Verified
                </span>
              )}
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
              <Link to={href} className="hover:text-secondary transition-colors">{property.title}</Link>
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-space-md line-clamp-2">
              {property.short_description}
            </p>

            {/* Specification matrix — stone shelf per DESIGN.md */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs bg-surface-container-low rounded-lg p-space-sm mb-space-md text-center">
              {[
                property.bedrooms ? { v: `${property.bedrooms} BHK`, l: 'Bedrooms' } : null,
                property.property_area ? { v: formatArea(property.property_area, property.property_area_unit).split(' ')[0], l: property.property_area_unit === 'sqft' ? 'Sq.Ft' : property.property_area_unit === 'acre' ? 'Acres' : 'Cent' } : null,
                property.bathrooms ? { v: String(property.bathrooms), l: 'Baths' } : null,
                property.facing ? { v: property.facing, l: 'Facing' } : null,
                property.parking ? { v: String(property.parking), l: 'Parking' } : null,
              ].filter(Boolean).slice(0, 4).map((spec, i) => (
                <div key={i} className="min-w-0">
                  <dt className="sr-only">{spec!.l}</dt>
                  <dd>
                    <span className="block font-title-md text-title-md text-on-surface font-bold tabular truncate">{spec!.v}</span>
                    <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">{spec!.l}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex items-center gap-space-sm pt-space-xs">
            <Link to={href} className="flex-1 py-3 text-center rounded-lg bg-primary-container text-on-primary font-title-md text-title-md hover:bg-[#2a3550] transition-colors">
              View Property Dossier
            </Link>
            <a
              href={waFor(property.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 rounded-lg bg-surface-container text-on-tertiary-fixed-variant hover:bg-on-tertiary-fixed-variant hover:text-on-tertiary transition-all flex items-center gap-1 font-label-ui text-label-ui shrink-0"
              aria-label={`WhatsApp about ${property.title}`}
            >
              <Icon name="chat" size={18} />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>
        </div>
      </article>
    );
  }

  /* ------------------------------ default ------------------------------ */
  return (
    <article className="group bg-surface-container-lowest rounded-xl border border-[#e7e5e4] overflow-hidden shadow-lvl1 hover:shadow-lvl2 hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full">
      <Link to={href} className="relative block w-full aspect-[4/3] overflow-hidden" aria-label={property.title}>
        <Img
          src={property.main_image}
          alt={alt}
          priority={priority}
          className="w-full h-full"
          imgClassName="group-hover:scale-105 transition-transform duration-700 ease-out"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pr-12">
          <span className="badge bg-primary-container/90 backdrop-blur-md text-on-primary">{listingLabel}</span>
          {property.featured && <span className="badge bg-secondary text-on-secondary">Featured</span>}
          {isClosed && <span className="badge bg-surface-container-lowest/90 backdrop-blur-md text-on-surface">{property.status}</span>}
        </div>
        {property.verified_title && (
          <span className="absolute bottom-3 left-3 badge bg-surface-container-lowest/90 backdrop-blur-md text-on-tertiary-fixed-variant">
            <Icon name="verified" size={12} />
            Verified
          </span>
        )}
      </Link>

      <div className="p-space-md sm:p-space-lg flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="font-label-caps text-label-caps text-secondary uppercase">{typeLabel}</span>
          {property.area_locality && (
            <>
              <span className="w-1 h-1 rounded-full bg-outline-variant shrink-0" aria-hidden="true" />
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase truncate">
                {property.area_locality}
              </span>
            </>
          )}
        </div>

        <h3 className="font-headline-sm text-headline-sm text-on-surface leading-snug mb-1.5 line-clamp-2">
          <Link to={href} className="hover:text-secondary transition-colors">{property.title}</Link>
        </h3>

        <p className="flex items-start gap-1 font-body-sm text-body-sm text-on-surface-variant mb-space-md line-clamp-1">
          <Icon name="location_on" size={14} className="text-outline shrink-0 mt-0.5" />
          <span className="truncate">{property.location}</span>
        </p>

        <div className="font-metric-price text-metric-price text-secondary tabular mb-space-md">{price}</div>

        {/* Inline key-value amenity strip with hairline dividers */}
        <dl className="flex items-stretch gap-0 border-y border-[#e7e5e4] py-space-sm mb-space-md text-center divide-x divide-[#e7e5e4]">
          {[
            property.bedrooms ? { icon: 'bed', v: String(property.bedrooms), l: 'Beds' } : null,
            property.bathrooms ? { icon: 'shower', v: String(property.bathrooms), l: 'Baths' } : null,
            property.property_area
              ? { icon: 'square_foot', v: formatArea(property.property_area, property.property_area_unit), l: 'Area' }
              : null,
            !property.bedrooms && !property.property_area && property.facing
              ? { icon: 'explore', v: property.facing, l: 'Facing' } : null,
          ].filter(Boolean).slice(0, 3).map((spec, i) => (
            <div key={i} className="flex-1 px-1 min-w-0">
              <dt className="sr-only">{spec!.l}</dt>
              <dd className="flex flex-col items-center gap-0.5">
                <Icon name={spec!.icon} size={15} className="text-outline" />
                <span className="font-title-md text-title-md text-on-surface tabular truncate max-w-full text-[14px] leading-tight">
                  {spec!.v}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant text-[11px]">{spec!.l}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex items-center gap-2">
          <Link
            to={href}
            className="flex-1 py-2.5 text-center rounded-lg border border-outline-variant text-on-surface
                       font-label-ui text-label-ui hover:bg-primary-container hover:text-on-primary hover:border-primary-container transition-all"
          >
            View Details
          </Link>
          <a
            href={waFor(property.title)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 grid place-items-center rounded-lg bg-surface-container text-on-tertiary-fixed-variant
                       hover:bg-on-tertiary-fixed-variant hover:text-on-tertiary transition-all shrink-0"
            aria-label={`WhatsApp enquiry about ${property.title}`}
          >
            <Icon name="chat" size={18} />
          </a>
        </div>
      </div>
    </article>
  );
}

/** Matching skeleton so loading states hold the exact card geometry. */
export function PropertyCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-[#e7e5e4] overflow-hidden flex h-[150px]">
        <div className="w-[38%] skeleton rounded-none" />
        <div className="flex-1 p-space-md space-y-2">
          <div className="h-3 w-20 skeleton" />
          <div className="h-5 w-3/4 skeleton" />
          <div className="h-3 w-1/2 skeleton" />
          <div className="h-6 w-24 skeleton mt-3" />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-[#e7e5e4] overflow-hidden">
      <div className="aspect-[4/3] skeleton rounded-none" />
      <div className="p-space-lg space-y-3">
        <div className="h-3 w-24 skeleton" />
        <div className="h-6 w-4/5 skeleton" />
        <div className="h-3 w-1/2 skeleton" />
        <div className="h-8 w-32 skeleton" />
        <div className="h-12 w-full skeleton" />
        <div className="h-10 w-full skeleton" />
      </div>
    </div>
  );
}
