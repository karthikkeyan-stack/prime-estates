import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SettingsProvider, ToastProvider } from './lib/store';
import { Header, Footer, WhatsAppFloat, ScrollToTop } from './components/Layout';
import { trackPageView, installLinkTracking, installSessionPing } from './lib/analytics';
import { Spinner } from './components/ui';
import Home from './pages/Home';

/* Code splitting: the homepage ships eagerly, everything else on demand. */
const Properties = lazy(() => import('./pages/Properties'));
const PropertyDetail = lazy(() => import('./pages/PropertyDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));
const About = lazy(() => import('./pages/Static').then((m) => ({ default: m.About })));
const Services = lazy(() => import('./pages/Static').then((m) => ({ default: m.Services })));
const Locations = lazy(() => import('./pages/Static').then((m) => ({ default: m.Locations })));
const Gallery = lazy(() => import('./pages/Static').then((m) => ({ default: m.Gallery })));
const Contact = lazy(() => import('./pages/Static').then((m) => ({ default: m.Contact })));
const Enquire = lazy(() => import('./pages/Static').then((m) => ({ default: m.Enquire })));
const AdminApp = lazy(() => import('./admin/AdminApp'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
        <Spinner size={28} className="text-secondary" />
        <span className="font-body-md text-body-md">Loading…</span>
      </div>
    </div>
  );
}

/** Public chrome wraps everything except /admin, which has its own shell. */
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200]
                   focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-primary-container focus:text-on-primary
                   focus:font-title-md focus:text-title-md focus:shadow-lvl3"
      >
        Skip to main content
      </a>
      <Header />
      {/* Offset matches the fixed header: 24px rail + 68px bar below 768px,
          24px + 80px from 768px up. Must stay in step with the bar height in
          Header and with the hero's negative margin in Home. */}
      <main id="main" className="w-full pt-[5.75rem] md:pt-[7.25rem] bg-background min-h-screen">
        {children}
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}

function Shell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  /*
   * Page-view tracking for the public site only — admin activity is the
   * business's own staff and would pollute visitor numbers.
   *
   * This runs in an effect after paint and every call inside is
   * fire-and-forget, so analytics can never delay a route transition.
   * Property detail pages attach their property id separately, once the
   * property has actually loaded.
   */
  useEffect(() => {
    if (isAdmin) return;
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search, isAdmin]);

  // One delegated listener covers every WhatsApp/Call link on the site,
  // including ones added later. Mounted once, not per route.
  useEffect(() => installLinkTracking(), []);

  // Closes the session on exit so session duration includes the last page.
  useEffect(() => installSessionPing(), []);

  if (isAdmin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <PublicLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:slug" element={<PropertyDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/enquire" element={<Enquire />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PublicLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
        <ToastProvider>
          <ScrollToTop />
          <Shell />
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
