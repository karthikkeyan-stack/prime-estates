import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAnalytics } from '../lib/api';
import type { AnalyticsResponse } from '../lib/types';
import { Icon } from '../components/ui';
import { AdminPageHeader, StatCard } from './AdminShell';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
] as const;

function duration(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return '<1s';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Trend chart.
 *
 * Drawn as a plain inline SVG rather than pulling in a charting library:
 * the whole component is a few hundred bytes of markup versus ~50 KB of
 * JavaScript for Recharts or Chart.js, and this is the only chart in the
 * product. It stays keyboard and screen-reader accessible through the
 * table that follows it.
 */
function TrendChart({ data }: { data: AnalyticsResponse['trend'] }) {
  const { path, area, peak, ticks } = useMemo(() => {
    const w = 720, h = 180, pad = 4;
    if (!data.length) return { path: '', area: '', peak: 0, ticks: [] as { x: number; label: string }[] };
    const peakValue = Math.max(1, ...data.map((d) => d.sessions));
    const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
    const pts = data.map((d, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (d.sessions / peakValue) * (h - pad * 2);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const fill = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;

    // At most 6 x-axis labels so they never collide on mobile.
    const every = Math.max(1, Math.ceil(data.length / 6));
    const labels = data
      .map((d, i) => ({ i, d }))
      .filter(({ i }) => i % every === 0)
      .map(({ i, d }) => ({
        x: pad + i * stepX,
        label: new Date(`${d.day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      }));
    return { path: line, area: fill, peak: peakValue, ticks: labels };
  }, [data]);

  const totalSessions = data.reduce((a, d) => a + d.sessions, 0);

  if (!data.length || totalSessions === 0) {
    return (
      <div className="h-[180px] grid place-items-center text-center">
        <div>
          <Icon name="show_chart" className="text-4xl text-outline-variant" />
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            No visits recorded in this period yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <svg
        viewBox="0 0 720 180"
        className="w-full h-[180px]"
        role="img"
        aria-label={`Sessions per day. Peak ${peak} sessions. ${totalSessions} sessions in total for the selected period.`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141b2b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#141b2b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={180 * f} x2="720" y2={180 * f} stroke="#e3e2e0" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#trendFill)" />
        <path d={path} fill="none" stroke="#141b2b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between mt-1.5" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.label} className="font-body-sm text-body-sm text-on-surface-variant">{t.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar list used for sources, devices, pages and geography. */
function BarList({
  rows, emptyLabel, renderLabel, hrefFor,
}: {
  rows: { label: string; sub?: string; value: number }[];
  emptyLabel: string;
  renderLabel?: (r: { label: string; sub?: string; value: number }) => React.ReactNode;
  hrefFor?: (r: { label: string; sub?: string; value: number }) => string | null;
}) {
  if (!rows.length) {
    return <p className="font-body-md text-body-md text-on-surface-variant py-4">{emptyLabel}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => {
        const href = hrefFor?.(r) ?? null;
        const label = renderLabel ? renderLabel(r) : r.label;
        return (
          <li key={`${r.label}-${i}`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="font-body-md text-body-md text-on-surface truncate min-w-0">
                {href ? <Link to={href} className="hover:underline">{label}</Link> : label}
                {r.sub && <span className="text-on-surface-variant"> · {r.sub}</span>}
              </span>
              <span className="font-title-md text-title-md tabular shrink-0">{r.value.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-container"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest border border-[#e7e5e4] rounded-xl p-space-md">
      <h2 className="font-title-lg text-title-lg flex items-center gap-2 mb-space-sm">
        <Icon name={icon} className="text-xl text-on-surface-variant" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<string>('30d');
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });

  const load = useCallback(async (q: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminAnalytics(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (range === 'custom') {
      if (custom.from && custom.to) void load({ from: custom.from, to: custom.to });
      return;
    }
    void load({ range });
  }, [range, custom, load]);

  const s = data?.summary;

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        subtitle="First-party visitor data. No third-party trackers, no cookies, no personal data."
      />

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2 mb-space-md">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            aria-pressed={range === r.key}
            className={`px-3 py-1.5 rounded-full font-label-ui text-label-ui border transition-colors ${
              range === r.key
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container'
            }`}
          >
            {r.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor="an-from">From</label>
          <input
            id="an-from" type="date" value={custom.from}
            max={custom.to || undefined}
            onChange={(e) => { setCustom((c) => ({ ...c, from: e.target.value })); setRange('custom'); }}
            className="input-field h-9 py-0 w-[9.5rem]"
          />
          <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor="an-to">To</label>
          <input
            id="an-to" type="date" value={custom.to}
            min={custom.from || undefined}
            onChange={(e) => { setCustom((c) => ({ ...c, to: e.target.value })); setRange('custom'); }}
            className="input-field h-9 py-0 w-[9.5rem]"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-space-md p-space-sm rounded-lg bg-error-container text-on-surface font-body-md text-body-md">
          {error}
        </div>
      )}

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm mb-space-md">
        {loading || !s
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-36 skeleton rounded-xl" />)
          : (
            <>
              <StatCard label="Unique visitors" value={s.unique_visitors.toLocaleString('en-IN')} icon="group" />
              <StatCard label="Sessions" value={s.sessions.toLocaleString('en-IN')} icon="timeline"
                hint={`${s.returning_sessions} returning`} />
              <StatCard label="Page views" value={s.page_views.toLocaleString('en-IN')} icon="visibility" />
              <StatCard label="Avg. session" value={duration(s.avg_duration_ms)} icon="schedule"
                hint={`${s.bounce_rate}% single-page`} />
              <StatCard label="WhatsApp clicks" value={s.whatsapp_clicks.toLocaleString('en-IN')} icon="chat" tone="green" />
              <StatCard label="Phone clicks" value={s.phone_clicks.toLocaleString('en-IN')} icon="call" tone="bronze" />
              <StatCard label="Enquiries" value={s.enquiries.toLocaleString('en-IN')} icon="inbox"
                to="/admin/enquiries" />
              <StatCard label="Conversion" value={`${s.conversion_rate}%`} icon="trending_up"
                hint="enquiries per session" />
            </>
          )}
      </div>

      {/* Trend */}
      <div className="mb-space-md">
        <Panel title="Visitors over time" icon="show_chart">
          {loading || !data ? <div className="h-[180px] skeleton rounded-lg" /> : <TrendChart data={data.trend} />}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-space-md">
        <Panel title="Top pages" icon="description">
          {loading || !data ? <div className="h-40 skeleton rounded-lg" /> : (
            <BarList
              emptyLabel="No page views recorded in this period."
              rows={data.topPages.map((p) => ({ label: p.path, sub: `${p.visitors} visitors`, value: p.views }))}
            />
          )}
        </Panel>

        <Panel title="Most viewed properties" icon="home_work">
          {loading || !data ? <div className="h-40 skeleton rounded-lg" /> : (
            <BarList
              emptyLabel="No property views recorded in this period."
              rows={data.topProperties.map((p) => ({ label: p.title, value: p.views, sub: undefined }))}
              hrefFor={(r) => {
                const match = data.topProperties.find((p) => p.title === r.label);
                return match ? `/properties/${match.slug}` : null;
              }}
            />
          )}
        </Panel>

        <Panel title="Traffic sources" icon="alt_route">
          {loading || !data ? <div className="h-40 skeleton rounded-lg" /> : (
            <BarList
              emptyLabel="No sessions recorded in this period."
              rows={data.sources.map((r) => ({
                label: r.host === '(direct)' ? 'Direct / typed in' : r.host,
                sub: r.source,
                value: r.sessions,
              }))}
            />
          )}
        </Panel>

        <Panel title="Devices" icon="devices">
          {loading || !data ? <div className="h-40 skeleton rounded-lg" /> : (
            <BarList
              emptyLabel="No sessions recorded in this period."
              rows={data.devices.map((d) => ({
                label: d.device.charAt(0).toUpperCase() + d.device.slice(1),
                value: d.sessions,
              }))}
            />
          )}
        </Panel>

        <Panel title="Geography" icon="public">
          {loading || !data ? <div className="h-40 skeleton rounded-lg" /> : (
            <>
              <BarList
                emptyLabel="No location data recorded in this period."
                rows={data.geo
                  .filter((g) => g.country !== '—' || g.city !== '—')
                  .map((g) => ({ label: g.city !== '—' ? g.city : g.country, sub: g.city !== '—' ? g.country : undefined, value: g.sessions }))}
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm">
                Approximate, derived from the edge network. Available once deployed behind Vercel.
              </p>
            </>
          )}
        </Panel>

        <Panel title="Recent activity" icon="bolt">
          {loading || !data ? <div className="h-40 skeleton rounded-lg" /> : (
            data.recent.length === 0
              ? <p className="font-body-md text-body-md text-on-surface-variant py-4">No events recorded in this period.</p>
              : (
                <ul className="divide-y divide-[#e7e5e4]">
                  {data.recent.map((e, i) => (
                    <li key={i} className="py-2 flex items-baseline justify-between gap-3">
                      <span className="font-body-md text-body-md text-on-surface truncate">
                        <span className="font-title-md text-title-md">{e.event_type.replace(/_/g, ' ')}</span>
                        {e.label && <span className="text-on-surface-variant"> — {e.label}</span>}
                      </span>
                      <time className="font-body-sm text-body-sm text-on-surface-variant shrink-0 tabular"
                        dateTime={e.created_at}>
                        {new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </li>
                  ))}
                </ul>
              )
          )}
        </Panel>
      </div>
    </>
  );
}
