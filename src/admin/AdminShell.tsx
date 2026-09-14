import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { adminMe, adminLogin, adminLogout } from '../lib/api';
import type { AdminUser } from '../lib/types';
import { useEscape, useScrollLock } from '../hooks';
import { useSettings, useToast } from '../lib/store';
import { Icon, Spinner } from '../components/ui';

/* ============================== auth context ============================== */

interface AuthCtx {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, login: async () => {}, logout: async () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminMe()
      .then((r) => setUser(r.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await adminLogin(email, password);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try { await adminLogout(); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAdminAuth = () => useContext(AuthContext);

/* ================================= login ================================= */

export function AdminLogin() {
  const { login } = useAdminAuth();
  const { settings } = useSettings();
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      push('Signed in successfully.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-primary-container text-on-primary p-space-xl overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity"
          /* decorative background: use the optimised derivative, not the 225 KB original */
            style={{ backgroundImage: "image-set(url('/media/r/hero-estate-800.avif') type('image/avif'), url('/media/r/hero-estate-800.webp') type('image/webp'), url('/media/r/hero-estate-800.jpg') type('image/jpeg'))" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/85 to-primary-container/60" aria-hidden="true" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-surface-bright/10 grid place-items-center">
              <svg viewBox="0 0 32 32" className="w-5 h-5" aria-hidden="true">
                <path d="M6 25V13l10-7 10 7v12" fill="none" stroke="#9b4500" strokeWidth="2.6" strokeLinejoin="round" />
                <path d="M12.5 25v-7h7v7" fill="none" stroke="#faf9f6" strokeWidth="2.2" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-semibold leading-none">
                {settings.business_name.toUpperCase()}
              </span>
              <span className="font-label-caps text-label-caps text-primary-fixed-dim mt-1">{settings.tagline}</span>
            </span>
          </Link>
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-bright/10 backdrop-blur-md mb-space-md">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" aria-hidden="true" />
            <span className="font-label-caps text-label-caps text-secondary-fixed tracking-[0.18em]">
              MANAGEMENT CONSOLE
            </span>
          </div>
          <h1 className="font-display-hero text-display-hero font-semibold leading-tight mb-space-md">
            Manage your <span className="italic font-normal text-secondary-fixed">portfolio.</span>
          </h1>
          <p className="font-body-lg text-body-lg text-primary-fixed-dim max-w-md">
            Properties, images, enquiries and site settings — all in one place.
          </p>
        </div>
        <p className="relative z-10 font-body-sm text-body-sm text-on-primary-container">
          © {new Date().getFullYear()} {settings.business_name} • Established {settings.established}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-gutter-mobile lg:p-space-xl">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-space-lg">
            <Link to="/" className="inline-flex items-center gap-2 font-label-ui text-label-ui text-on-surface-variant hover:text-secondary">
              <Icon name="arrow_back" size={16} />
              Back to website
            </Link>
          </div>

          <h2 className="font-headline-lg text-headline-lg-mobile text-on-surface font-semibold mb-1">Admin sign in</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
            Authorised personnel only.
          </p>

          <form onSubmit={submit} className="space-y-space-md" noValidate>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-error-container text-on-error-container px-space-md py-3" role="alert">
                <Icon name="error" size={18} className="shrink-0 mt-0.5" />
                <span className="font-body-md text-body-md">{error}</span>
              </div>
            )}

            <div>
              <label className="label" htmlFor="admin-email">Email address</label>
              <input
                id="admin-email" type="email" autoComplete="username" required
                className="field" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="label" htmlFor="admin-password">Password</label>
              <input
                id="admin-password" type="password" autoComplete="current-password" required
                className="field" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <><Spinner size={16} /> Signing in…</> : <>Sign in <Icon name="login" size={18} /></>}
            </button>
          </form>

          <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-lg text-center">
            Sessions are server-side and expire after 7 days.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================ shell ================================ */

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/properties', label: 'Properties', icon: 'home_work' },
  { to: '/admin/properties/new', label: 'Add Property', icon: 'add_circle' },
  { to: '/admin/enquiries', label: 'Enquiries', icon: 'inbox' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAdminAuth();
  const { settings } = useSettings();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebar, setSidebar] = useState(false);

  useScrollLock(sidebar);
  useEscape(sidebar, () => setSidebar(false));
  useEffect(() => { setSidebar(false); }, [location.pathname]);

  async function onLogout() {
    await logout();
    push('Signed out.', 'info');
    navigate('/admin');
  }

  const SidebarContent = (
    <>
      <div className="px-space-md py-space-md border-b border-white/10 shrink-0">
        <Link to="/admin" className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-surface-bright/10 grid place-items-center shrink-0">
            <svg viewBox="0 0 32 32" className="w-5 h-5" aria-hidden="true">
              <path d="M6 25V13l10-7 10 7v12" fill="none" stroke="#9b4500" strokeWidth="2.6" strokeLinejoin="round" />
              <path d="M12.5 25v-7h7v7" fill="none" stroke="#faf9f6" strokeWidth="2.2" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="flex flex-col min-w-0">
            <span className="font-title-lg text-title-lg text-on-primary font-bold leading-none truncate">
              {settings.business_name}
            </span>
            <span className="font-label-caps text-label-caps text-primary-fixed-dim mt-1">ADMIN CONSOLE</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-space-sm py-space-md" aria-label="Admin navigation">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-space-md py-2.5 rounded-lg font-label-ui text-label-ui transition-colors ${
                    isActive
                      ? 'bg-surface-bright/10 text-on-primary'
                      : 'text-primary-fixed-dim hover:bg-surface-bright/5 hover:text-on-primary'
                  }`
                }
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-space-lg pt-space-md border-t border-white/10">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-space-md py-2.5 rounded-lg font-label-ui text-label-ui text-primary-fixed-dim hover:bg-surface-bright/5 hover:text-on-primary transition-colors"
          >
            <Icon name="open_in_new" size={20} />
            View website
          </a>
        </div>
      </nav>

      <div className="px-space-sm py-space-md border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 px-space-md py-2 mb-1">
          <span className="w-8 h-8 rounded-full bg-secondary grid place-items-center text-on-secondary font-title-md text-title-md shrink-0">
            {(user?.full_name || user?.email || 'A').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-label-ui text-label-ui text-on-primary truncate">{user?.full_name}</span>
            <span className="block font-body-sm text-body-sm text-on-primary-container truncate">{user?.email}</span>
          </span>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-space-md py-2.5 rounded-lg font-label-ui text-label-ui text-primary-fixed-dim hover:bg-error/20 hover:text-on-primary transition-colors"
        >
          <Icon name="logout" size={20} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex flex-col w-64 bg-primary-container shrink-0 fixed inset-y-0 left-0 z-40">
        {SidebarContent}
      </aside>

      {sidebar && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-[rgba(17,24,39,0.5)] backdrop-blur-[4px]" onClick={() => setSidebar(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-primary-container flex flex-col shadow-lvl3 animate-fade-in">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 bg-surface-container-lowest border-b border-[#e7e5e4] px-gutter-mobile h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => setSidebar(true)}
            className="w-10 h-10 grid place-items-center rounded-lg border border-outline-variant text-on-surface"
            aria-label="Open admin menu"
          >
            <Icon name="menu" size={22} />
          </button>
          <span className="font-title-lg text-title-lg text-on-surface font-bold truncate">Admin</span>
          <button onClick={onLogout} className="w-10 h-10 grid place-items-center rounded-lg text-on-surface-variant" aria-label="Sign out">
            <Icon name="logout" size={20} />
          </button>
        </header>

        <main className="flex-1 p-gutter-mobile lg:p-space-lg xl:p-space-xl min-w-0">{children}</main>
      </div>
    </div>
  );
}

/* ---------------------------- page primitives ---------------------------- */

export function AdminPageHeader({
  title, subtitle, actions, breadcrumb,
}: { title: string; subtitle?: string; actions?: React.ReactNode; breadcrumb?: React.ReactNode }) {
  return (
    <div className="mb-space-lg">
      {breadcrumb}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface font-semibold">{title}</h1>
          {subtitle && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  label, value, icon, tone = 'default', to, hint,
}: {
  label: string; value: number | string; icon: string;
  tone?: 'default' | 'bronze' | 'green' | 'danger'; to?: string; hint?: string;
}) {
  const tones = {
    default: 'bg-surface-container text-on-surface-variant',
    bronze: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    green: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    danger: 'bg-error-container text-on-error-container',
  };
  const body = (
    <>
      <div className="flex items-start justify-between gap-2 mb-space-sm">
        <span className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${tones[tone]}`}>
          <Icon name={icon} size={20} />
        </span>
        {to && <Icon name="arrow_outward" size={16} className="text-outline" />}
      </div>
      <div className="font-display-hero-mobile text-display-hero-mobile text-on-surface font-semibold tabular leading-none">
        {value}
      </div>
      <div className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-1.5">{label}</div>
      {hint && <div className="font-body-sm text-body-sm text-on-surface-variant mt-1">{hint}</div>}
    </>
  );
  return to ? (
    <Link to={to} className="card p-space-md hover:shadow-lvl2 transition-all block">{body}</Link>
  ) : (
    <div className="card p-space-md">{body}</div>
  );
}
