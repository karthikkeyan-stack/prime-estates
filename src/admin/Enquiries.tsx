import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminEnquiries, patchEnquiry, deleteEnquiry } from '../lib/api';
import type { Enquiry, Paged } from '../lib/types';
import { formatDateTime, relativeDate, telUrl, whatsappUrl } from '../lib/format';
import { useDebounced } from '../hooks';
import { useSettings, useToast } from '../lib/store';
import { AdminPageHeader } from './AdminShell';
import { ConfirmDialog, EmptyState, ErrorState, Icon, Modal, Spinner } from '../components/ui';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'closed', label: 'Closed' },
  { key: 'spam', label: 'Spam' },
];

/* Pipeline order, with the icon shown on each action chip. */
const PIPELINE = [
  { key: 'new', label: 'New', icon: 'fiber_new' },
  { key: 'contacted', label: 'Contacted', icon: 'phone_forwarded' },
  { key: 'follow_up', label: 'Follow-up', icon: 'event_repeat' },
  { key: 'qualified', label: 'Qualified', icon: 'verified' },
  { key: 'closed', label: 'Closed', icon: 'task_alt' },
  { key: 'spam', label: 'Spam', icon: 'block' },
] as const;

const STATUS_STYLE: Record<string, string> = {
  follow_up: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  qualified: 'bg-tertiary-fixed text-on-tertiary-container',
  spam: 'bg-surface-container-high text-on-surface-variant',
  new: 'bg-error-container text-on-error-container',
  contacted: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  closed: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
};

export default function Enquiries() {
  const [params, setParams] = useSearchParams();
  const { push } = useToast();
  const [result, setResult] = useState<Paged<Enquiry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const debounced = useDebounced(searchText, 400);

  const status = params.get('status') ?? '';
  const archived = params.get('archived') ?? '';
  const page = Number(params.get('page') ?? 1);

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
    adminEnquiries({ status, archived, search: params.get('search') ?? '', page, limit: 15 })
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

  async function setStatus(enquiry: Enquiry, value: string) {
    setBusy(true);
    try {
      const updated = await patchEnquiry(enquiry.id, { status: value });
      setResult((r) => r && { ...r, data: r.data.map((x) => (x.id === enquiry.id ? updated : x)) });
      if (selected?.id === enquiry.id) setSelected(updated);
      push(`Marked as ${value}.`, 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await patchEnquiry(selected.id, { admin_notes: notes });
      setResult((r) => r && { ...r, data: r.data.map((x) => (x.id === selected.id ? updated : x)) });
      setSelected(updated);
      push('Notes saved.', 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save notes', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(enquiry: Enquiry) {
    setBusy(true);
    try {
      await patchEnquiry(enquiry.id, { archived: !enquiry.archived });
      push(enquiry.archived ? 'Restored from archive.' : 'Enquiry archived.', 'success');
      setSelected(null);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (confirmId === null) return;
    setBusy(true);
    try {
      await deleteEnquiry(confirmId);
      push('Enquiry deleted.', 'success');
      setConfirmId(null);
      setSelected(null);
      load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  const total = result?.total ?? 0;
  const pages = result?.pages ?? 1;

  return (
    <div>
      <AdminPageHeader
        title="Enquiries"
        subtitle={loading ? 'Loading…' : `${total} ${total === 1 ? 'enquiry' : 'enquiries'}${archived === 'true' ? ' in archive' : ''}`}
        actions={
          <button
            onClick={() => update({ archived: archived === 'true' ? null : 'true' })}
            className={`btn-sm ${archived === 'true' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Icon name="inventory_2" size={16} />
            {archived === 'true' ? 'Viewing archive' : 'View archive'}
          </button>
        }
      />

      <div className="card p-space-md mb-space-md">
        <div className="flex flex-col lg:flex-row gap-space-sm">
          <div className="relative flex-1 min-w-0">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
            <input
              type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, phone, email or property…" aria-label="Search enquiries" className="field pl-10"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key || 'all'} role="tab" aria-selected={status === t.key}
                onClick={() => update({ status: t.key || null })}
                className={`chip shrink-0 ${status === t.key ? 'chip-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="card p-space-md space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 skeleton rounded-lg" />)}
        </div>
      ) : total === 0 ? (
        <div className="card">
          <EmptyState
            icon="inbox"
            title="No enquiries found"
            message={status || searchText ? 'Nothing matches these filters.' : 'Enquiries submitted from the website will appear here.'}
          />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-[#efeeeb]">
              {result!.data.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => { setSelected(e); setNotes(e.admin_notes || ''); }}
                    className="w-full text-left px-space-md py-space-md hover:bg-surface-container-low transition-colors flex items-start gap-3"
                  >
                    <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 font-title-md text-title-md ${STATUS_STYLE[e.status]}`}>
                      {e.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-title-md text-title-md text-on-surface">{e.name}</span>
                        <span className={`badge ${STATUS_STYLE[e.status]} !py-0 !px-2`}>{e.status}</span>
                        {e.source && <span className="badge bg-surface-container text-on-surface-variant !py-0 !px-2">{e.source}</span>}
                      </span>
                      <span className="block font-body-md text-body-md text-on-surface-variant truncate">
                        {e.property_title || e.interest || 'General enquiry'}
                      </span>
                      <span className="flex items-center gap-3 font-body-sm text-body-sm text-on-surface-variant mt-0.5 flex-wrap">
                        <span className="tabular">{e.phone}</span>
                        {e.email && <span className="truncate max-w-[200px]">{e.email}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right hidden sm:block">
                      <span className="block font-body-sm text-body-sm text-on-surface-variant">{relativeDate(e.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {pages > 1 && (
            <nav className="flex items-center justify-between gap-3 mt-space-md flex-wrap" aria-label="Pagination">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Page {page} of {pages} · {total} total</span>
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

      {/* Detail drawer */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Enquiry'}
        size="lg"
        footer={
          selected && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleArchive(selected)} disabled={busy} className="btn-secondary btn-sm">
                  <Icon name="inventory_2" size={15} />
                  {selected.archived ? 'Restore' : 'Archive'}
                </button>
                <button onClick={() => setConfirmId(selected.id)} disabled={busy}
                  className="btn btn-sm px-space-md py-2 bg-error-container text-on-error-container hover:bg-error hover:text-on-error">
                  <Icon name="delete" size={15} />
                  Delete
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <a href={telUrl(selected.phone)} className="btn-secondary btn-sm flex-1 sm:flex-none">
                  <Icon name="call" size={15} />Call
                </a>
                <a
                  href={whatsappUrl(selected.phone, selected.property_title
                    ? `Hi ${selected.name}, thank you for your enquiry about ${selected.property_title}.`
                    : `Hi ${selected.name}, thank you for contacting Prime Estates.`)}
                  target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-sm flex-1 sm:flex-none"
                >
                  <Icon name="chat" size={15} />WhatsApp
                </a>
              </div>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-space-md">
            <div className="flex items-center gap-1.5 flex-wrap">
              {PIPELINE.map((s) => (
                <button
                  key={s.key} onClick={() => setStatus(selected, s.key)} disabled={busy || selected.status === s.key}
                  className={`chip ${selected.status === s.key ? 'chip-active' : ''} disabled:opacity-100`}
                >
                  {busy && selected.status !== s.key ? <Spinner size={12} /> : <Icon name={s.icon} size={14} />}
                  {s.label}
                </button>
              ))}
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <Detail label="Phone" value={selected.phone} href={telUrl(selected.phone)} />
              <Detail label="Email" value={selected.email || '—'} href={selected.email ? `mailto:${selected.email}` : undefined} />
              <Detail label="Property" value={selected.property_title || '— General enquiry —'} />
              <Detail label="Interest" value={selected.interest || '—'} />
              <Detail label="Budget" value={selected.budget || '—'} />
              <Detail label="Source" value={selected.source} />
              <Detail label="Received" value={formatDateTime(selected.created_at)} />
              <Detail label="Status" value={selected.status} />
            </dl>

            {selected.message && (
              <div>
                <h3 className="label">Message</h3>
                <p className="font-body-md text-body-md text-on-surface bg-surface-container-low rounded-lg p-space-md whitespace-pre-wrap">
                  {selected.message}
                </p>
              </div>
            )}

            <div>
              <label className="label" htmlFor="enq-notes">Internal notes</label>
              <textarea
                id="enq-notes" rows={4} className="field resize-none" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Follow-up actions, site visit dates, quoted price…"
              />
              <button onClick={saveNotes} disabled={busy || notes === (selected.admin_notes || '')} className="btn-secondary btn-sm mt-2">
                {busy ? <Spinner size={14} /> : <Icon name="save" size={15} />}
                Save notes
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete this enquiry?"
        message="This permanently removes the enquiry and its notes. Consider archiving instead if you may need it later."
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

function Detail({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="label !mb-0.5">{label}</dt>
      <dd className="font-body-lg text-body-lg text-on-surface break-words">
        {href ? <a href={href} className="text-secondary hover:underline">{value}</a> : value}
      </dd>
    </div>
  );
}
