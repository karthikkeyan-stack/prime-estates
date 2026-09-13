import { lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AdminAuthProvider, AdminLogin, AdminShell, useAdminAuth } from './AdminShell';
import { Seo } from '../lib/seo';
import { Icon, Spinner } from '../components/ui';

const Dashboard = lazy(() => import('./Dashboard'));
const PropertyList = lazy(() => import('./PropertyList'));
const PropertyForm = lazy(() => import('./PropertyForm'));
const Enquiries = lazy(() => import('./Enquiries'));
const Settings = lazy(() => import('./Settings'));

function AdminLoader() {
  return (
    <div className="min-h-[50vh] grid place-items-center" role="status" aria-live="polite">
      <Spinner size={28} className="text-secondary" />
    </div>
  );
}

function AdminNotFound() {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 mx-auto rounded-full bg-surface-container grid place-items-center text-on-surface-variant mb-4">
        <Icon name="search_off" size={26} />
      </div>
      <h1 className="font-headline-sm text-headline-sm text-on-surface mb-1.5">Admin page not found</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-5">
        This admin route does not exist.
      </p>
      <Link to="/admin" className="btn-primary btn-sm">Back to dashboard</Link>
    </div>
  );
}

/**
 * Route guard. The real protection is server-side (every /api/admin route
 * requires a valid session cookie); this only controls what is rendered.
 */
function Guarded() {
  const { user, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <Spinner size={30} className="text-secondary" />
          <span className="font-body-md text-body-md">Checking your session…</span>
        </div>
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  return (
    <AdminShell>
      <Suspense fallback={<AdminLoader />}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="properties" element={<PropertyList />} />
          <Route path="properties/new" element={<PropertyForm />} />
          <Route path="properties/:id" element={<PropertyForm />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<AdminNotFound />} />
        </Routes>
      </Suspense>
    </AdminShell>
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Seo title="Admin Console | Prime Estates" noindex />
      <Guarded />
    </AdminAuthProvider>
  );
}
