import type { PropertyCardData } from './types';

/** ₹4.25 Cr / ₹85 Lakh / ₹45,000 — Indian numbering, never raw paise. */
export function formatPrice(value: string | number, listing?: string, period?: string): string {
  const n = Number(value) || 0;
  let label: string;
  if (n >= 1e7) label = `₹${trimZeros((n / 1e7).toFixed(2))} Cr`;
  else if (n >= 1e5) label = `₹${trimZeros((n / 1e5).toFixed(2))} Lakh`;
  else label = `₹${n.toLocaleString('en-IN')}`;
  if (listing === 'rent' || listing === 'lease') label += period ? `/${period}` : '/month';
  return label;
}

const trimZeros = (s: string) => s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');

export function priceLabel(p: Pick<PropertyCardData, 'price' | 'price_display' | 'listing_type' | 'price_period'>) {
  return p.price_display?.trim() || formatPrice(p.price, p.listing_type, p.price_period);
}

/** "4,800 sq.ft" | "9.2 cent" | "42 acres" */
export function formatArea(value: string | number | null | undefined, unit = 'sqft'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '—';
  const pretty = n % 1 === 0 ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const unitLabel =
    unit === 'sqft' ? 'sq.ft' : unit === 'acre' ? (n === 1 ? 'acre' : 'acres') : unit === 'cent' ? 'cent' : unit;
  return `${pretty} ${unitLabel}`;
}

export function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const day = 864e5;
  if (diff < 36e5) return 'Just now';
  if (diff < day) return `${Math.floor(diff / 36e5)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Short, natural WhatsApp copy — never spammy. */
export function whatsappUrl(number: string, message: string): string {
  const digits = String(number).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function telUrl(number: string): string {
  const digits = String(number).replace(/\D/g, '');
  return `tel:+${digits.length === 10 ? '91' + digits : digits}`;
}

export function slugify(text: string): string {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90);
}
