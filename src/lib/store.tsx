import { Icon } from '../components/ui';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSettings } from './api';
import type { SiteSettings } from './types';
import { telUrl, whatsappUrl } from './format';

/* ============================ site settings ============================ */

const FALLBACK: SiteSettings = {
  business_name: 'Prime Estates',
  tagline: 'Consultants & Developers • CBE',
  phone: '9486122022',
  phone_display: '+91 94861 22022',
  whatsapp: '919486122022',
  email: '', address: '', maps_url: '', maps_embed: '',
  established: '2008', city: 'Coimbatore',
  description: '', short_description: '',
  whatsapp_general: "Hi, I'd like to know more about the properties available with Prime Estates.",
  seo_title: 'Prime Estates | Real Estate Consultants & Developers in Coimbatore',
  seo_description: '', footer_note: '', site_url: '',
  facebook: '', instagram: '', youtube: '', linkedin: '', demo_notice: '',
};

interface SettingsCtx {
  settings: SiteSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Canonical contact helpers so business info is never hard-coded in components. */
  tel: string;
  waGeneral: string;
  waFor: (propertyName: string) => string;
}

const SettingsContext = createContext<SettingsCtx>({
  settings: FALLBACK, loading: true, refresh: async () => {},
  tel: telUrl(FALLBACK.phone), waGeneral: '', waFor: () => '',
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings((prev) => ({ ...prev, ...data }));
    } catch {
      /* keep fallback — the site must never blank out over settings */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<SettingsCtx>(() => {
    const wa = settings.whatsapp || settings.phone;
    return {
      settings, loading, refresh,
      tel: telUrl(settings.phone),
      waGeneral: whatsappUrl(wa, settings.whatsapp_general || FALLBACK.whatsapp_general),
      waFor: (name: string) =>
        whatsappUrl(wa, `Hi, I'm interested in ${name}. Could you share more details?`),
    };
  }, [settings, loading, refresh]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

/* ================================ toasts ================================ */

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastCtx {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastCtx>({ toasts: [], push: () => {}, dismiss: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[100]
                   flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-auto sm:max-w-sm pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3 shadow-lvl3 animate-fade-up
              ${t.tone === 'error' ? 'bg-error text-on-error'
                : t.tone === 'info' ? 'bg-primary-container text-on-primary'
                : 'bg-on-tertiary-fixed-variant text-on-tertiary'}`}
          >
            <Icon
              name={t.tone === 'error' ? 'error' : t.tone === 'info' ? 'info' : 'check_circle'}
              size={20}
              className="shrink-0"
            />
            <span className="font-body-md text-body-md flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-70 hover:opacity-100 shrink-0"
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
