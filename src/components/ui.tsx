import React, { useEffect, useRef, useState } from 'react';
import { useEscape, useScrollLock } from '../hooks';

/* ------------------------------- icon ------------------------------- */

export function Icon({
  name, size = 20, className = '', fill = false,
}: { name: string; size?: number; className?: string; fill?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{ fontSize: size, ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}) }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

/* --------------------------- lazy image ----------------------------- */

/**
 * Image with skeleton placeholder, native lazy loading, async decoding and a
 * graceful fallback. Alt text is required by the type signature.
 */
export function Img({
  src, alt, className = '', imgClassName = '', priority = false, sizes,
}: {
  src: string; alt: string; className?: string; imgClassName?: string;
  priority?: boolean; sizes?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish decoding before React attaches onLoad, which
  // would leave it stuck at opacity-0 behind the skeleton. Catch that here.
  useEffect(() => {
    const el = imgRef.current;
    const done = !!el?.complete;
    setFailed(done && el!.naturalWidth === 0);
    setLoaded(done && el!.naturalWidth > 0);
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-surface-container ${className}`}>
      {!loaded && !failed && <div className="absolute inset-0 skeleton" aria-hidden="true" />}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-surface-container text-outline">
          <Icon name="imagesmode" size={28} />
        </div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          // lowercase attribute: React 18 does not map the camelCase prop
          {...{ fetchpriority: priority ? 'high' : 'auto' }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        />
      )}
    </div>
  );
}

/* ------------------------------- modal ------------------------------ */

export function Modal({
  open, onClose, title, children, footer, size = 'md',
}: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useEscape(open, onClose);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 30);
    return () => clearTimeout(timer);
  }, [open]);

  // Focus trap so keyboard users can't tab behind the scrim.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[rgba(17,24,39,0.45)] backdrop-blur-[8px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl shadow-lvl3
                    max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-fade-up`}
      >
        <header className="flex items-center justify-between gap-4 px-space-lg py-space-md border-b border-[#e7e5e4] shrink-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-surface-container text-on-surface-variant shrink-0"
            aria-label="Close dialog"
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="px-space-lg py-space-md overflow-y-auto flex-1">{children}</div>
        {footer && (
          <footer className="px-space-lg py-space-md border-t border-[#e7e5e4] shrink-0 bg-surface-container-low rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* --------------------------- confirm dialog -------------------------- */

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', tone = 'danger', busy = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  tone?: 'danger' | 'primary'; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className={`btn btn-sm px-space-lg py-2.5 text-on-primary ${tone === 'danger' ? 'bg-error hover:bg-[#93000a]' : 'bg-primary-container hover:bg-[#2a3550]'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Spinner size={14} />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="font-body-md text-body-md text-on-surface-variant">{message}</p>
    </Modal>
  );
}

/* ------------------------------ spinner ------------------------------ */

export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------- states ------------------------------ */

export function EmptyState({
  icon = 'search_off', title, message, action,
}: { icon?: string; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-14 h-14 mx-auto rounded-full bg-surface-container grid place-items-center text-on-surface-variant mb-4">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1.5">{title}</h3>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto mb-5">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-14 h-14 mx-auto rounded-full bg-error-container grid place-items-center text-on-error-container mb-4">
        <Icon name="error" size={26} />
      </div>
      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1.5">Something went wrong</h3>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto mb-5">{message}</p>
      {onRetry && <button className="btn-secondary btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* ---------------------------- form helpers --------------------------- */

export function Field({
  label, htmlFor, error, hint, required, children, className = '',
}: {
  label: string; htmlFor?: string; error?: string; hint?: string;
  required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="text-error ml-0.5" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{hint}</p>}
      {error && (
        <p className="mt-1 font-body-sm text-body-sm text-error flex items-center gap-1" role="alert">
          <Icon name="error" size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

export function Toggle({
  checked, onChange, label, id,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer group">
      <span className="relative inline-block shrink-0">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="block w-11 h-6 rounded-full bg-surface-container-highest transition-colors
                     peer-checked:bg-on-tertiary-fixed-variant peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2"
        />
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                      ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
      <span className="font-body-md text-body-md text-on-surface select-none">{label}</span>
    </label>
  );
}
