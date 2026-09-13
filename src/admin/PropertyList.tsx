import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminProperties, patchProperty, deleteProperty } from '../lib/api';
import type { Paged, PropertyCardData } from '../lib/types';
import { PROPERTY_TYPE_LABELS, LISTING_LABELS, STATUS_LABELS } from '../lib/types';
import { priceLabel, formatArea, relativeDate } from '../lib/format';
import { useDebounced } from '../hooks';
import { useToast } from '../lib/store';
import { AdminPageHeader } from './AdminShell';
import { ConfirmDialog, EmptyState, ErrorState, Icon, Img, Spinner } from '../components/ui';

type Row = PropertyCardData & { published: boolean; views: number; updated_at: string };

export default function PropertyList() {
  const [params, setParams] = useSearchParams();
  const { push } = useToast();
  const [result, setResult] = useState<Paged<Row> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; title: string; mode: 'archive' | 'delete' } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const debounced = useDebounced(searchText, 400);

  const query = {
    search: params.get('search') ?? '',
    status: params.get('status') ?? '',
    listing: params.get('listing') ?? '',
    published: params.get('published') ?? '',
    featured: params.get('featured') ?? '',
    sort: params.get('sort') ?? 'newest',
    page: Number(params.get('page') ?? 1),
  };

  useEffect(() => {
    const current = params.get('search') ?? '';
    if (debounced === current) return;
    const next = new URLSearchParams(params);
    if (debounced) next.set('search', debounced); else next.delete('search');
    next.delete('page');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminProperties({ ...query, limit: 12 })
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  useEffect(load, [load]);

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === '') next.delete(k); else next.set(k, v); });
    if (resetPage) next.delete('page');
    setParams(next);
  };

  async function toggle(id: number, field: 'published' | 'featured', value: boolean) {
    setBusyId(id);
    try {
      await patchProperty(id, { [field]: value });
      setResult((r) => r && { ...r, data: r.data.map((p) => (p.id === id ? { ...p, [field]: value } : p)) });
      push(
        field === 'published'
          ? value ? 'Property published.' : 'Property unpublished.'
          : value ? 'Marked as featured.' : 'Removed from featured.',
        'success',
      );
    } catch (e) {
      push(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await deleteProperty(confirm.id, confirm.mode);
      push(confirm.mode === 'archive' ? 'Property archived.' : 'Property deleted.', 'success');
      setConfirm(null);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setConfirmBusy(false);
    }
  }

  const total = result?.total ?? 0;
  const pages = result?.pages ?? 1;
  const page = result?.page ?? 1;
  const activeFilters = ['status', 'listing', 'published', 'featured', 'search'].filter((k) => params.get(k)).length;

  return (
    <div>
      <AdminPageHeader
        title="Properties"
        subtitle={loading ? 'Loading…' : `${total} ${total === 1 ? 'property' : 'properties'} in the database`}
        actions={
          <Link to="/admin/properties/new" className="btn-primary btn-sm">
            <Icon name="add" size={18} />
            Add property
          </Link>
        }
      />

      {/* Filter bar */}
      <div className="card p-space-md mb-space-md">
        <div className="flex flex-col lg:flex-row gap-space-sm">
          <div className="relative flex-1 min-w-0">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by title, location or slug…"
              aria-label="Search properties"
              className="field pl-10"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:flex lg:items-center">
            <select value={query.status} onChange={(e) => update({ status: e.target.value })} className="field !min-h-[44px] cursor-pointer" aria-label="Filter by status">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={query.listing} onChange={(e) => update({ listing: e.target.value })} className="field !min-h-[44px] cursor-pointer" aria-label="Filter by listing type">
              <option value="">All listings</option>
              {Object.entries(LISTING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={query.published} onChange={(e) => update({ published: e.target.value })} className="field !min-h-[44px] cursor-pointer" aria-label="Filter by visibility">
              <option value="">All visibility</option>
              <option value="true">Published</option>
              <option value="false">Unpublished</option>
            </select>
            <select value={query.sort} onChange={(e) => update({ sort: e.target.value })} className="field !min-h-[44px] cursor-pointer" aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="updated">Recently updated</option>
              <option value="price_desc">Price high–low</option>
              <option value="price_asc">Price low–high</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </div>
        {activeFilters > 0 && (
          <div className="flex items-center gap-2 mt-space-sm pt-space-sm border-t border-[#efeeeb]">
            <span className="font-body-sm text-body-sm text-on-surface-variant">{activeFilters} filter(s) active</span>
            <button onClick={() => { setParams(new URLSearchParams()); setSearchText(''); }} className="font-label-ui text-label-ui text-secondary hover:underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="card p-space-md space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 skeleton rounded-lg" />)}
        </div>
      ) : total === 0 ? (
        <div className="card">
          <EmptyState
            icon="home_work"
            title="No properties found"
            message={activeFilters ? 'No properties match these filters.' : 'Add your first property to get started.'}
            action={
              activeFilters
                ? <button onClick={() => { setParams(new URLSearchParams()); setSearchText(''); }} className="btn-secondary btn-sm">Clear filters</button>
                : <Link to="/admin/properties/new" className="btn-primary btn-sm">Add property</Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <caption className="sr-only">Property list</caption>
                <thead>
                  <tr className="bg-surface-container-low border-b border-[#e7e5e4] text-left">
                    <th scope="col" className="font-label-caps text-label-caps text-on-surface-variant uppercase px-space-md py-3">Property</th>
                    <th scope="col" className="font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-3">Type</th>
                    <th scope="col" className="font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-3">Price</th>
                    <th scope="col" className="font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-3">Status</th>
                    <th scope="col" className="font-label-caps text-label-caps text-on-surface-variant uppercase px-2 py-3 text-center">Live</th>
                    <th scope="col" className="font-label-caps text-label-caps text-on-surface-variant uppercase px-2 py-3 text-center whitespace-nowrap hidden xl:table-cell">Featured</th>
                    <th scope="col" className="font-label-caps text-label-caps text-on-surface-variant uppercase pl-2 pr-space-md py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efeeeb]">
                  {result!.data.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-space-md py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Img src={p.main_image} alt={p.title} className="w-16 h-12 rounded-lg shrink-0" />
                          <div className="min-w-0">
                            <Link to={`/admin/properties/${p.id}`} className="block font-title-md text-title-md text-on-surface hover:text-secondary truncate max-w-[180px] 2xl:max-w-[260px]">
                              {p.title}
                            </Link>
                            <span className="block font-body-sm text-body-sm text-on-surface-variant truncate max-w-[180px] 2xl:max-w-[260px]">
                              {p.location}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block font-body-md text-body-md text-on-surface">{PROPERTY_TYPE_LABELS[p.property_type]}</span>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant">{LISTING_LABELS[p.listing_type]}</span>
                      </td>
                      <td className="px-3 py-3 font-title-md text-title-md text-on-surface tabular whitespace-nowrap">
                        {priceLabel(p)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`badge ${
                          p.status === 'featured' ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
                            : p.status === 'available' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                            : p.status === 'archived' || p.status === 'draft' ? 'bg-surface-container text-on-surface-variant'
                            : 'bg-surface-container-high text-on-surface'
                        }`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => toggle(p.id, 'published', !p.published)}
                          disabled={busyId === p.id}
                          className="inline-grid place-items-center w-9 h-9 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                          aria-label={p.published ? `Unpublish ${p.title}` : `Publish ${p.title}`}
                          title={p.published ? 'Published — click to unpublish' : 'Unpublished — click to publish'}
                        >
                          {busyId === p.id ? <Spinner size={16} /> : (
                            <Icon name={p.published ? 'visibility' : 'visibility_off'} size={20}
                              className={p.published ? 'text-on-tertiary-fixed-variant' : 'text-outline'} />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-3 text-center hidden xl:table-cell">
                        <button
                          onClick={() => toggle(p.id, 'featured', !p.featured)}
                          disabled={busyId === p.id}
                          className="inline-grid place-items-center w-9 h-9 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                          aria-label={p.featured ? `Remove ${p.title} from featured` : `Mark ${p.title} as featured`}
                          title={p.featured ? 'Featured — click to remove' : 'Click to feature'}
                        >
                          <Icon name="star" size={20} fill={p.featured} className={p.featured ? 'text-secondary' : 'text-outline'} />
                        </button>
                      </td>
                      <td className="pl-2 pr-space-md py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a href={`/properties/${p.slug}`} target="_blank" rel="noopener noreferrer"
                            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-surface-container text-on-surface-variant"
                            aria-label={`Preview ${p.title}`} title="Preview on website">
                            <Icon name="open_in_new" size={18} />
                          </a>
                          <Link to={`/admin/properties/${p.id}`}
                            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-surface-container text-on-surface-variant"
                            aria-label={`Edit ${p.title}`} title="Edit">
                            <Icon name="edit" size={18} />
                          </Link>
                          <button onClick={() => setConfirm({ id: p.id, title: p.title, mode: 'archive' })}
                            className="w-9 h-9 hidden 2xl:grid place-items-center rounded-lg hover:bg-surface-container text-on-surface-variant"
                            aria-label={`Archive ${p.title}`} title="Archive">
                            <Icon name="inventory_2" size={18} />
                          </button>
                          <button onClick={() => setConfirm({ id: p.id, title: p.title, mode: 'delete' })}
                            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-error-container text-error"
                            aria-label={`Delete ${p.title}`} title="Delete">
                            <Icon name="delete" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-space-sm">
            {result!.data.map((p) => (
              <article key={p.id} className="card p-space-md">
                <div className="flex gap-3 mb-space-sm">
                  <Img src={p.main_image} alt={p.title} className="w-20 h-16 rounded-lg shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/properties/${p.id}`} className="block font-title-md text-title-md text-on-surface line-clamp-2">
                      {p.title}
                    </Link>
                    <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">{p.location}</span>
                    <span className="block font-title-md text-title-md text-secondary tabular mt-0.5">{priceLabel(p)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-space-sm">
                  <span className="badge bg-surface-container text-on-surface-variant">{PROPERTY_TYPE_LABELS[p.property_type]}</span>
                  <span className="badge bg-surface-container text-on-surface-variant">{LISTING_LABELS[p.listing_type]}</span>
                  <span className={`badge ${p.published ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container text-on-surface-variant'}`}>
                    {p.published ? 'Live' : 'Draft'}
                  </span>
                  {p.featured && <span className="badge bg-secondary-fixed text-on-secondary-fixed-variant">Featured</span>}
                </div>
                <div className="flex items-center gap-1.5 pt-space-sm border-t border-[#efeeeb]">
                  <Link to={`/admin/properties/${p.id}`} className="btn-secondary btn-sm flex-1">
                    <Icon name="edit" size={15} />Edit
                  </Link>
                  <button onClick={() => toggle(p.id, 'published', !p.published)} disabled={busyId === p.id}
                    className="w-10 h-10 grid place-items-center rounded-lg border border-outline-variant text-on-surface-variant"
                    aria-label={p.published ? 'Unpublish' : 'Publish'}>
                    <Icon name={p.published ? 'visibility' : 'visibility_off'} size={18} />
                  </button>
                  <button onClick={() => toggle(p.id, 'featured', !p.featured)} disabled={busyId === p.id}
                    className="w-10 h-10 grid place-items-center rounded-lg border border-outline-variant"
                    aria-label={p.featured ? 'Unfeature' : 'Feature'}>
                    <Icon name="star" size={18} fill={p.featured} className={p.featured ? 'text-secondary' : 'text-outline'} />
                  </button>
                  <button onClick={() => setConfirm({ id: p.id, title: p.title, mode: 'delete' })}
                    className="w-10 h-10 grid place-items-center rounded-lg border border-outline-variant text-error"
                    aria-label="Delete">
                    <Icon name="delete" size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {pages > 1 && (
            <nav className="flex items-center justify-between gap-3 mt-space-md flex-wrap" aria-label="Pagination">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Page {page} of {pages} · {total} total
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => update({ page: String(page - 1) }, false)} disabled={page <= 1} className="btn-secondary btn-sm disabled:opacity-40">
                  <Icon name="chevron_left" size={16} />Previous
                </button>
                <button onClick={() => update({ page: String(page + 1) }, false)} disabled={page >= pages} className="btn-secondary btn-sm disabled:opacity-40">
                  Next<Icon name="chevron_right" size={16} />
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.mode === 'archive' ? 'Archive this property?' : 'Delete this property?'}
        message={
          confirm?.mode === 'archive'
            ? `“${confirm?.title}” will be hidden from the website and marked as archived. You can restore it later by changing its status.`
            : `“${confirm?.title}” and all of its images will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={confirm?.mode === 'archive' ? 'Archive' : 'Delete permanently'}
        tone={confirm?.mode === 'archive' ? 'primary' : 'danger'}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
