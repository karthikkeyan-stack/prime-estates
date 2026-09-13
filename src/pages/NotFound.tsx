import { Link } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { Seo } from '../lib/seo';
import { Icon } from '../components/ui';

export default function NotFound() {
  const { settings, waGeneral } = useSettings();

  return (
    <div className="pt-space-xl pb-space-xl">
      <Seo title={`Page not found | ${settings.business_name}`} noindex />

      <section className="shell">
        <div className="relative rounded-2xl overflow-hidden bg-primary-container text-on-primary px-space-lg py-space-xl lg:py-20 text-center">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity"
            style={{ backgroundImage: "url('/media/hero-estate.jpg')" }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/80 to-primary-container/50" aria-hidden="true" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-bright/10 backdrop-blur-md mb-space-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" aria-hidden="true" />
              <span className="font-label-caps text-label-caps text-secondary-fixed tracking-[0.18em]">ERROR 404</span>
            </div>

            <p className="font-display-hero text-[72px] sm:text-[104px] leading-none text-secondary-fixed/30 font-semibold tabular mb-2">
              404
            </p>
            <h1 className="font-display-hero text-display-hero-mobile sm:text-display-hero font-semibold mb-space-md leading-tight">
              This address doesn’t exist{' '}
              <span className="italic font-normal text-secondary-fixed">on our books.</span>
            </h1>
            <p className="font-body-lg text-body-lg text-primary-fixed-dim mb-space-xl max-w-lg mx-auto">
              The page you were looking for may have been moved, or the property may no longer be listed.
              Let us help you find the right one.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-space-sm">
              <Link to="/properties" className="btn-bronze">
                <Icon name="search" size={18} />
                Browse properties
              </Link>
              <Link to="/" className="btn-secondary">
                <Icon name="home" size={18} />
                Back to homepage
              </Link>
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <Icon name="chat" size={18} />
                WhatsApp us
              </a>
            </div>
          </div>
        </div>

        <nav aria-label="Helpful links" className="mt-space-xl">
          <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase text-center mb-space-md">
            Popular destinations
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm max-w-3xl mx-auto">
            {[
              { to: '/properties?listing=sale', label: 'For Sale', icon: 'sell' },
              { to: '/properties?listing=rent', label: 'For Rent', icon: 'key' },
              { to: '/locations', label: 'Locations', icon: 'map' },
              { to: '/contact', label: 'Contact', icon: 'call' },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="card p-space-md flex flex-col items-center gap-1.5 hover:shadow-lvl2 transition-all group">
                <Icon name={l.icon} size={22} className="text-secondary" />
                <span className="font-label-ui text-label-ui text-on-surface group-hover:text-secondary transition-colors">{l.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </section>
    </div>
  );
}
