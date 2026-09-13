import { Link } from 'react-router-dom';
import { adminStats } from '../lib/api';
import { useAsync } from '../hooks';
import { PROPERTY_TYPE_LABELS } from '../lib/types';
import { priceLabel, relativeDate } from '../lib/format';
import { useSettings } from '../lib/store';
import { AdminPageHeader, StatCard, useAdminAuth } from './AdminShell';
import { EmptyState, ErrorState, Icon, Img } from '../components/ui';

export default function Dashboard() {
  const { user } = useAdminAuth();
  const { settings } = useSettings();
  const { data, loading, error, reload } = useAsync(adminStats, []);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  const s = data?.stats;
  const firstName = (user?.full_name || 'there').split(' ')[0];

  return (
    <div>
      <AdminPageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Live figures from the property database."
        actions={
          <>
            <Link to="/admin/properties/new" className="btn-primary btn-sm">
              <Icon name="add" size={18} />
              Add property
            </Link>
            <Link to="/admin/enquiries" className="btn-secondary btn-sm">
              <Icon name="inbox" size={18} />
              Enquiries
              {s && s.new_enquiries > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-error text-on-error text-[10px] font-bold tabular">
                  {s.new_enquiries}
                </span>
              )}
            </Link>
          </>
        }
      />

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm lg:gap-space-md mb-space-md">
        {loading || !s ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 skeleton rounded-xl" />)
        ) : (
          <>
            <StatCard label="Total properties" value={s.total_properties} icon="home_work" to="/admin/properties" />
            <StatCard label="Published" value={s.published} icon="public" tone="green" to="/admin/properties?published=true" hint={`${s.drafts} draft / unpublished`} />
            <StatCard label="Featured" value={s.featured} icon="star" tone="bronze" to="/admin/properties?featured=true" />
            <StatCard label="New enquiries" value={s.new_enquiries} icon="mark_email_unread" tone={s.new_enquiries > 0 ? 'danger' : 'default'} to="/admin/enquiries?status=new" hint={`${s.enquiries} total`} />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm lg:gap-space-md mb-space-lg">
        {loading || !s ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 skeleton rounded-xl" />)
        ) : (
          <>
            <StatCard label="Available" value={s.available} icon="check_circle" to="/admin/properties?status=available" />
            <StatCard label="Sold / rented" value={s.closed} icon="task_alt" />
            <StatCard label="Property images" value={s.images} icon="photo_library" />
            <StatCard label="Page views" value={s.total_views} icon="visibility" hint="Across all listings" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md">
        {/* Recent enquiries */}
        <section className="xl:col-span-7 card overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-space-md py-space-md border-b border-[#e7e5e4]">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold">Recent enquiries</h2>
            <Link to="/admin/enquiries" className="font-label-ui text-label-ui text-secondary hover:underline shrink-0">
              View all
            </Link>
          </header>

          {loading ? (
            <div className="p-space-md space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 skeleton rounded-lg" />)}
            </div>
          ) : !data?.recentEnquiries.length ? (
            <EmptyState icon="inbox" title="No enquiries yet" message="Enquiries submitted from the website will appear here." />
          ) : (
            <ul className="divide-y divide-[#efeeeb]">
              {data.recentEnquiries.map((e) => (
                <li key={e.id} className="px-space-md py-space-sm hover:bg-surface-container-low transition-colors">
                  <Link to={`/admin/enquiries?search=${encodeURIComponent(e.phone)}`} className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 font-title-md text-title-md ${
                      e.status === 'new' ? 'bg-secondary text-on-secondary'
                        : e.status === 'contacted' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {e.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-title-md text-title-md text-on-surface truncate">{e.name}</span>
                        {e.status === 'new' && (
                          <span className="badge bg-error-container text-on-error-container !py-0 !px-2">New</span>
                        )}
                      </span>
                      <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                        {e.property_title || 'General enquiry'} · {e.phone}
                      </span>
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0 hidden sm:block">
                      {relativeDate(e.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent properties */}
        <section className="xl:col-span-5 card overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-space-md py-space-md border-b border-[#e7e5e4]">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold">Recently added</h2>
            <Link to="/admin/properties" className="font-label-ui text-label-ui text-secondary hover:underline shrink-0">
              Manage
            </Link>
          </header>

          {loading ? (
            <div className="p-space-md space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 skeleton rounded-lg" />)}
            </div>
          ) : !data?.recentProperties.length ? (
            <EmptyState
              icon="home_work"
              title="No properties yet"
              message="Add your first property to get started."
              action={<Link to="/admin/properties/new" className="btn-primary btn-sm">Add property</Link>}
            />
          ) : (
            <ul className="divide-y divide-[#efeeeb]">
              {data.recentProperties.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/properties/${p.id}`} className="flex items-center gap-3 px-space-md py-space-sm hover:bg-surface-container-low transition-colors">
                    <Img src={p.main_image} alt={p.title} className="w-14 h-11 rounded-lg shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-title-md text-title-md text-on-surface truncate">{p.title}</span>
                      <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
                        <span className="tabular">{priceLabel(p)}</span>
                        {!p.published && <span className="badge bg-surface-container text-on-surface-variant !py-0 !px-1.5">Draft</span>}
                        {p.featured && <Icon name="star" size={12} className="text-secondary" fill />}
                      </span>
                    </span>
                    <Icon name="chevron_right" size={18} className="text-outline shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Portfolio mix + quick actions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md mt-space-md">
        <section className="xl:col-span-7 card p-space-md">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold mb-space-md">Portfolio by type</h2>
          {loading || !data?.byType.length ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-8 skeleton rounded" />)}</div>
          ) : (
            <ul className="space-y-2.5">
              {data.byType.map((t) => {
                const max = Math.max(...data.byType.map((x) => x.count), 1);
                return (
                  <li key={t.key} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 font-body-md text-body-md text-on-surface-variant truncate">
                      {PROPERTY_TYPE_LABELS[t.key] ?? t.key}
                    </span>
                    <span className="flex-1 h-2.5 rounded-full bg-surface-container overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-secondary transition-all duration-700"
                        style={{ width: `${(t.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 text-right font-title-md text-title-md text-on-surface tabular shrink-0">
                      {t.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="xl:col-span-5 card p-space-md">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold mb-space-md">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: '/admin/properties/new', icon: 'add_home', label: 'Add property' },
              { to: '/admin/properties?published=false', icon: 'edit_note', label: 'Review drafts' },
              { to: '/admin/enquiries?status=new', icon: 'mark_email_unread', label: 'New enquiries' },
              { to: '/admin/settings', icon: 'settings', label: 'Site settings' },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="flex flex-col items-center gap-1.5 p-space-md rounded-lg border border-outline-variant hover:border-on-surface hover:bg-surface-container-low transition-all text-center"
              >
                <Icon name={a.icon} size={22} className="text-secondary" />
                <span className="font-label-ui text-label-ui text-on-surface">{a.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-space-md pt-space-md border-t border-[#e7e5e4]">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Public site contact: <span className="text-on-surface font-semibold tabular">{settings.phone_display}</span>
              {' · '}
              <Link to="/admin/settings" className="text-secondary hover:underline">Edit</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
