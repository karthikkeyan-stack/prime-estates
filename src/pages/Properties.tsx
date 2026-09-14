import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProperties, getCategories, getLocations, getFacets } from '../lib/api';
import type { Paged, PropertyCardData } from '../lib/types';
import { PROPERTY_TYPE_LABELS } from '../lib/types';
import { useAsync, useDebounced, useEscape, useScrollLock } from '../hooks';
import { useSettings } from '../lib/store';
import { Seo } from '../lib/seo';
import { PropertyCard, PropertyCardSkeleton } from '../components/PropertyCard';
import { EmptyState, ErrorState, Icon } from '../components/ui';

const SORTS = [
  { key: 'featured', label: 'Featured first' },
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'area_desc', label: 'Largest area' },
];

const PRICE_BANDS = [
  { label: 'Under ₹50 L', min: '', max: '5000000' },
  { label: '₹50 L – ₹1 Cr', min: '5000000', max: '10000000' },
  { label: '₹1 – 2.5 Cr', min: '10000000', max: '25000000' },
  { label: '₹2.5 – 5 Cr', min: '25000000', max: '50000000' },
  { label: '₹5 Cr +', min: '50000000', max: '' },
];

export default function Properties() {
  const [params, setParams] = useSearchParams();
  const { settings } = useSettings();
  const [result, setResult] = useState<Paged<PropertyCardData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const categories = useAsync(getCategories, []);
  const locations = useAsync(getLocations, []);
  const facets = useAsync(getFacets, []);

  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounced(searchText, 400);

  useScrollLock(drawerOpen);
  useEscape(drawerOpen, () => setDrawerOpen(false));

  /** Single source of truth: URL query params drive the DB query. */
  const query = useMemo(() => ({
    listing: params.get('listing') ?? '',
    type: params.get('type') ?? '',
    location: params.get('location') ?? '',
    min_price: params.get('min_price') ?? '',
    max_price: params.get('max_price') ?? '',
    bedrooms: params.get('bedrooms') ?? '',
    search: params.get('search') ?? '',
    sort: params.get('sort') ?? 'featured',
    page: Number(params.get('page') ?? 1),
  }), [params]);

  // Keep the debounced text box in sync with the URL.
  useEffect(() => {
    const current = params.get('search') ?? '';
    if (debouncedSearch === current) return;
    const next = new URLSearchParams(params);
    if (debouncedSearch) next.set('search', debouncedSearch); else next.delete('search');
    next.delete('page');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => { setSearchText(params.get('search') ?? ''); }, [params.get('search')]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getProperties({ ...query, limit: 9 })
      .then((res) => { if (alive) setResult(res); })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query]);

  const update = useCallback((patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    });
    if (resetPage) next.delete('page');
    setParams(next);
  }, [params, setParams]);

  const toggleType = (slug: string) => {
    const current = query.type ? query.type.split(',') : [];
    const next = current.includes(slug) ? current.filter((t) => t !== slug) : [...current, slug];
    update({ type: next.join(',') });
  };

  const activeCount = ['listing', 'type', 'location', 'min_price', 'max_price', 'bedrooms', 'search']
    .filter((k) => params.get(k)).length;

  const clearAll = () => {
    const next = new URLSearchParams();
    if (query.sort !== 'featured') next.set('sort', query.sort);
    setParams(next);
    setSearchText('');
  };

  const selectedTypes = query.type ? query.type.split(',') : [];
  const countFor = (key: string) => facets.data?.byType.find((t) => t.key === key)?.count ?? 0;
  const locCountFor = (key: string) => facets.data?.byLocation.find((t) => t.key === key)?.count ?? 0;

  /* -------------------------- filter panel -------------------------- */
  const FilterPanel = ({ inDrawer = false }: { inDrawer?: boolean }) => (
    <div className={inDrawer ? 'space-y-space-lg' : 'space-y-space-lg'}>
      <div>
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-space-sm">Listing type</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { key: '', label: 'All' },
            { key: 'sale', label: 'For Sale' },
            { key: 'rent', label: 'For Rent' },
            { key: 'lease', label: 'For Lease' },
          ].map((opt) => (
            <button
              key={opt.key || 'all'}
              onClick={() => update({ listing: opt.key || null })}
              className={`chip ${query.listing === opt.key ? 'chip-active' : ''}`}
              aria-pressed={query.listing === opt.key}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-space-sm">Property type</h3>
        <div className="flex flex-wrap gap-2">
          {(categories.data ?? []).map((cat) => {
            const active = selectedTypes.includes(cat.slug);
            const count = countFor(cat.slug);
            return (
              <button
                key={cat.slug}
                onClick={() => toggleType(cat.slug)}
                className={`chip ${active ? 'chip-active' : ''}`}
                aria-pressed={active}
              >
                {PROPERTY_TYPE_LABELS[cat.slug] ?? cat.name}
                <span className={`inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular
                  ${active ? 'bg-[#374151] text-white' : 'bg-[#f3f4f6] text-[#111827]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-space-sm">Location</h3>
        <div className="flex flex-wrap gap-2">
          {(locations.data ?? []).map((loc) => {
            const active = query.location === loc.slug;
            return (
              <button
                key={loc.slug}
                onClick={() => update({ location: active ? null : loc.slug })}
                className={`chip ${active ? 'chip-active' : ''}`}
                aria-pressed={active}
              >
                {loc.name}
                <span className={`inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular
                  ${active ? 'bg-[#374151] text-white' : 'bg-[#f3f4f6] text-[#111827]'}`}>
                  {locCountFor(loc.slug)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-space-sm">Budget</h3>
        <div className="flex flex-wrap gap-2">
          {PRICE_BANDS.map((band) => {
            const active = query.min_price === band.min && query.max_price === band.max && (band.min || band.max);
            return (
              <button
                key={band.label}
                onClick={() => update(active ? { min_price: null, max_price: null } : { min_price: band.min || null, max_price: band.max || null })}
                className={`chip ${active ? 'chip-active' : ''}`}
                aria-pressed={!!active}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-space-sm">Bedrooms</h3>
        <div className="flex flex-wrap gap-2">
          {['1', '2', '3', '4', '5'].map((b) => (
            <button
              key={b}
              onClick={() => update({ bedrooms: query.bedrooms === b ? null : b })}
              className={`chip ${query.bedrooms === b ? 'chip-active' : ''}`}
              aria-pressed={query.bedrooms === b}
            >
              {b}+ BHK
            </button>
          ))}
        </div>
      </div>

      {activeCount > 0 && (
        <button onClick={clearAll} className="btn-secondary btn-sm w-full">
          <Icon name="close" size={15} />
          Clear all filters
        </button>
      )}
    </div>
  );

  const total = result?.total ?? 0;
  const pages = result?.pages ?? 1;
  const page = result?.page ?? 1;

  const heading = query.listing === 'rent' ? 'Properties for Rent'
    : query.listing === 'sale' ? 'Properties for Sale'
    : query.listing === 'lease' ? 'Properties for Lease'
    : 'Property Catalogue';

  return (
    <div className="pt-space-xl">
      <Seo
        title={`${heading} in Coimbatore & Western Tamil Nadu | ${settings.business_name}`}
        description={`Browse ${total || ''} residential and commercial properties for sale and rent across Coimbatore, Tirupur, Pollachi, Ooty, Erode and Palakkad with Prime Estates.`}
        jsonLd={result && result.data.length ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          numberOfItems: total,
          itemListElement: result.data.slice(0, 10).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.title,
            url: `${settings.site_url}/properties/${p.slug}`,
          })),
        } : undefined}
      />

      {/* Page header */}
      <section className="shell mb-space-lg">
        <nav aria-label="Breadcrumb" className="mb-space-sm">
          <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
            <li className="text-on-surface font-medium">Properties</li>
          </ol>
        </nav>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
          <div>
            <span className="font-label-caps text-label-caps text-secondary tracking-widest uppercase">
              {settings.city} • Tirupur • Pollachi • Nilgiris • Erode • Palakkad
            </span>
            <h1 className="font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface font-semibold mt-1">
              {heading}
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
              {loading ? 'Searching the portfolio…' : `${total} ${total === 1 ? 'property' : 'properties'} matching your criteria.`}
            </p>
          </div>
        </div>
      </section>

      {/* Search + sort bar */}
      <section className="shell mb-space-lg">
        <div className="card p-space-md flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm">
          <div className="relative flex-1 min-w-0">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by title, locality or city…"
              aria-label="Search properties"
              className="field pl-10"
            />
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="relative flex-1 sm:flex-none">
              <select
                value={query.sort}
                onChange={(e) => update({ sort: e.target.value })}
                aria-label="Sort properties"
                className="field pr-9 appearance-none cursor-pointer sm:w-52"
              >
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <Icon name="keyboard_arrow_down" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden btn-secondary relative shrink-0 px-4"
              aria-label="Open filters"
            >
              <Icon name="tune" size={18} />
              <span className="hidden xs:inline">Filters</span>
              {activeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary text-on-secondary text-[10px] font-bold grid place-items-center">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Catalogue: sticky rail + results */}
      <section className="shell pb-space-xl">
        <div className="flex gap-space-xl items-start">
          <aside className="hidden lg:block w-[280px] shrink-0 sticky top-[8.5rem]">
            <div className="card p-space-lg max-h-[calc(100vh-10rem)] overflow-y-auto">
              <div className="flex items-center justify-between mb-space-md">
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold">Filters</h2>
                {activeCount > 0 && (
                  <span className="font-label-caps text-label-caps text-secondary uppercase">{activeCount} active</span>
                )}
              </div>
              <FilterPanel />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {error ? (
              <ErrorState message={error} onRetry={() => update({}, false)} />
            ) : loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-md">
                {Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
              </div>
            ) : total === 0 ? (
              <div className="card">
                <EmptyState
                  icon="search_off"
                  title="No properties match these filters"
                  message="Try widening your budget, removing a filter, or tell us what you are looking for — we will search our wider network."
                  action={
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button onClick={clearAll} className="btn-secondary btn-sm">Clear filters</button>
                      <Link to="/contact" className="btn-primary btn-sm">Tell us your requirement</Link>
                    </div>
                  }
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-md">
                  {result!.data.map((p, i) => (
                    <PropertyCard key={p.id} property={p} priority={i < 3} />
                  ))}
                </div>

                {pages > 1 && (
                  <nav className="flex items-center justify-center gap-1.5 mt-space-xl flex-wrap" aria-label="Pagination">
                    <button
                      onClick={() => update({ page: String(page - 1) }, false)}
                      disabled={page <= 1}
                      className="btn-secondary btn-sm disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <Icon name="chevron_left" size={16} />
                      <span className="hidden sm:inline">Previous</span>
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1)
                      .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                      .map((n, idx, arr) => (
                        <React.Fragment key={n}>
                          {idx > 0 && arr[idx - 1] !== n - 1 && (
                            <span className="px-1 text-on-surface-variant" aria-hidden="true">…</span>
                          )}
                          <button
                            onClick={() => update({ page: String(n) }, false)}
                            aria-current={n === page ? 'page' : undefined}
                            className={`min-w-[40px] h-10 px-2 rounded-lg font-label-ui text-label-ui transition-colors ${
                              n === page
                                ? 'bg-primary-container text-on-primary'
                                : 'border border-outline-variant text-on-surface hover:bg-surface-container'
                            }`}
                          >
                            {n}
                          </button>
                        </React.Fragment>
                      ))}
                    <button
                      onClick={() => update({ page: String(page + 1) }, false)}
                      disabled={page >= pages}
                      className="btn-secondary btn-sm disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <Icon name="chevron_right" size={16} />
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-[rgba(17,24,39,0.45)] backdrop-blur-[6px]" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] bg-surface-bright rounded-t-2xl shadow-lvl3 flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-gutter-mobile py-space-md border-b border-[#e7e5e4] shrink-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Filters</h2>
              <button onClick={() => setDrawerOpen(false)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-surface-container" aria-label="Close filters">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-gutter-mobile py-space-md">
              <FilterPanel inDrawer />
            </div>
            <div className="px-gutter-mobile py-space-md border-t border-[#e7e5e4] shrink-0 bg-surface-container-low">
              <button onClick={() => setDrawerOpen(false)} className="btn-primary w-full">
                Show {total} {total === 1 ? 'property' : 'properties'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
