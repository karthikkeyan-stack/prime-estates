import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { useScrollLock, useEscape } from '../hooks';
import { Icon } from './ui';

const NAV = [
  { to: '/properties', label: 'Properties' },
  { to: '/properties?listing=sale', label: 'Buy' },
  { to: '/properties?listing=rent', label: 'Rent' },
  { to: '/locations', label: 'Locations' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
];

/* ------------------------------- logo ------------------------------- */

export function Logo({ inverse = false }: { inverse?: boolean }) {
  const { settings } = useSettings();
  return (
    <Link
      to="/"
      /* min-w-0 lets the logo yield width below ~360px so the menu button can
         never be pushed off-screen; it keeps its natural size above that. */
      className="flex items-center gap-2.5 min-w-0 group"
      aria-label={`${settings.business_name} home`}
    >
      <span
        className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 transition-colors
          ${inverse ? 'bg-surface-bright/10' : 'bg-primary-container'}`}
      >
        <svg viewBox="0 0 32 32" className="w-5 h-5" aria-hidden="true">
          <path d="M6 25V13l10-7 10 7v12" fill="none" stroke="#9b4500" strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M12.5 25v-7h7v7" fill="none" stroke={inverse ? '#faf9f6' : '#ffffff'} strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="flex flex-col justify-center min-w-0">
        <span
          className={`font-headline-sm text-headline-sm leading-none tracking-tight font-semibold truncate
            ${inverse ? 'text-on-primary' : 'text-on-surface'}`}
        >
          {settings.business_name.toUpperCase()}
        </span>
        <span
          className={`font-label-caps text-label-caps tracking-wider mt-1 truncate
            ${inverse ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}`}
        >
          {settings.tagline}
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------ header ------------------------------ */

export function Header() {
  const { settings, tel, waGeneral } = useSettings();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useScrollLock(open);
  useEscape(open, () => setOpen(false));
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Announcement rail — established credibility + direct line */}
      <div className="bg-primary-container text-on-primary py-space-xs px-gutter-mobile lg:px-gutter-desktop">
        <div className="max-w-shell mx-auto flex items-center justify-between gap-3 font-label-caps text-label-caps tracking-[0.06em] sm:tracking-widest">
          <div className="flex items-center gap-space-sm min-w-0 flex-1 sm:flex-none">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary-container shrink-0" aria-hidden="true" />
            {/* Below 640px the full line cannot fit. Instead of an ellipsis
                cut-off it scrolls seamlessly; see .ticker-* in index.css. */}
            <span className="ticker-mask min-w-0">
              <span className="ticker-track">
                <span>
                  ESTABLISHED {settings.established} • {settings.city.toUpperCase()} • RESIDENTIAL &amp; COMMERCIAL
                </span>
                <span className="ticker-dup" aria-hidden="true">
                  ESTABLISHED {settings.established} • {settings.city.toUpperCase()} • RESIDENTIAL &amp; COMMERCIAL
                </span>
              </span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-space-md shrink-0">
            <span className="text-on-primary-container font-medium">DIRECT ADVISORY:</span>
            <a href={tel} className="text-on-primary hover:text-secondary-fixed transition-colors font-semibold tabular">
              {settings.phone_display}
            </a>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div
        className={`h-[4.25rem] sm:h-20 backdrop-blur-xl transition-shadow ${
          scrolled ? 'bg-surface-bright/95 shadow-[0_1px_12px_rgba(0,0,0,0.07)]' : 'bg-surface-bright/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)]'
        }`}
      >
        <div className="max-w-shell h-full mx-auto px-gutter-mobile lg:px-gutter-desktop flex items-center justify-between gap-space-md">
          <Logo />

          <nav className="hidden xl:flex items-center gap-space-lg" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/properties'}
                className={({ isActive }) =>
                  `font-label-ui text-label-ui transition-colors hover:text-on-surface relative py-1 ${
                    isActive && location.search === (item.to.split('?')[1] ? `?${item.to.split('?')[1]}` : '')
                      ? 'text-on-surface font-semibold after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-0.5 after:bg-secondary after:rounded-full'
                      : 'text-on-surface-variant'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-space-sm shrink-0">
            <a
              href={waGeneral}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-lg
                         bg-on-tertiary-fixed-variant text-on-tertiary font-label-ui text-label-ui
                         hover:bg-on-tertiary-fixed transition-colors"
            >
              <Icon name="chat" size={18} />
              <span>WhatsApp</span>
            </a>
            <Link
              to="/contact"
              className="hidden sm:inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-lg
                         bg-primary-container text-on-primary font-title-md text-title-md
                         hover:bg-[#2a3550] transition-colors"
            >
              <span>Enquire Now</span>
              <Icon name="north_east" size={16} />
            </Link>
            <a
              href={tel}
              className="sm:hidden w-10 h-10 grid place-items-center rounded-lg bg-primary-container text-on-primary"
              aria-label={`Call ${settings.phone_display}`}
            >
              <Icon name="call" size={20} />
            </a>
            <button
              onClick={() => setOpen(true)}
              className="xl:hidden w-10 h-10 grid place-items-center rounded-lg border border-outline-variant
                         text-on-surface hover:bg-surface-container transition-colors"
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Icon name="menu" size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer — purpose-built, not a stacked desktop nav */}
      {open && (
        <div className="xl:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-[rgba(17,24,39,0.45)] backdrop-blur-[6px] animate-fade-in" onClick={() => setOpen(false)} />
          <nav
            className="absolute right-0 top-0 bottom-0 w-[86%] max-w-sm bg-surface-bright shadow-lvl3
                       flex flex-col animate-fade-in"
            aria-label="Mobile navigation"
          >
            <div className="flex items-center justify-between px-gutter-mobile h-[4.25rem] sm:h-20 border-b border-[#e7e5e4] shrink-0">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-surface-container text-on-surface"
                aria-label="Close menu"
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-gutter-mobile py-space-md">
              <ul className="flex flex-col">
                {NAV.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="flex items-center justify-between py-3.5 border-b border-[#efeeeb]
                                 font-title-lg text-title-lg text-on-surface hover:text-secondary transition-colors"
                    >
                      {item.label}
                      <Icon name="chevron_right" size={20} className="text-outline" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-gutter-mobile py-space-md border-t border-[#e7e5e4] space-y-2 shrink-0 bg-surface-container-low">
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full">
                <Icon name="chat" size={18} />
                WhatsApp Us
              </a>
              <a href={tel} className="btn-secondary w-full">
                <Icon name="call" size={18} />
                {settings.phone_display}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ------------------------------ footer ------------------------------ */

export function Footer() {
  const { settings, tel, waGeneral } = useSettings();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: 'Asset Classes',
      links: [
        { label: 'Villas & Bungalows', to: '/properties?type=villa' },
        { label: 'Apartments', to: '/properties?type=apartment' },
        { label: 'Plots & Land', to: '/properties?type=plot' },
        { label: 'Commercial', to: '/properties?type=commercial' },
        { label: 'Showrooms & Retail', to: '/properties?type=showroom' },
        { label: 'Plantations', to: '/properties?type=farmhouse' },
      ],
    },
    {
      title: 'Regional Corridors',
      links: [
        { label: 'Coimbatore', to: '/properties?location=coimbatore' },
        { label: 'Tirupur', to: '/properties?location=tirupur' },
        { label: 'Pollachi', to: '/properties?location=pollachi' },
        { label: 'Ooty & Nilgiris', to: '/properties?location=ooty' },
        { label: 'Erode', to: '/properties?location=erode' },
        { label: 'Palakkad', to: '/properties?location=palakkad' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', to: '/about' },
        { label: 'Services', to: '/services' },
        { label: 'Locations', to: '/locations' },
        { label: 'Gallery', to: '/gallery' },
        { label: 'Contact', to: '/contact' },
        { label: 'All Properties', to: '/properties' },
      ],
    },
  ];

  const socials = [
    { key: 'facebook', icon: 'public', label: 'Facebook' },
    { key: 'instagram', icon: 'photo_camera', label: 'Instagram' },
    { key: 'youtube', icon: 'smart_display', label: 'YouTube' },
    { key: 'linkedin', icon: 'work', label: 'LinkedIn' },
  ].filter((s) => settings[s.key]);

  return (
    <footer className="bg-primary-container text-on-primary mt-space-xl">
      <div className="shell py-space-xl">
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-space-lg lg:gap-space-xl">
          <div className="col-span-2 lg:col-span-4">
            <Logo inverse />
            <p className="font-body-md text-body-md text-primary-fixed-dim mt-space-md leading-relaxed max-w-sm">
              {settings.short_description || settings.description}
            </p>
            <div className="mt-space-md space-y-2">
              <a href={tel} className="flex items-center gap-2 font-title-md text-title-md text-on-primary hover:text-secondary-fixed transition-colors">
                <Icon name="call" size={18} className="text-secondary-fixed" />
                <span className="tabular">{settings.phone_display}</span>
              </a>
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-body-md text-body-md text-on-tertiary-container hover:underline">
                <Icon name="chat" size={18} />
                WhatsApp enquiry
              </a>
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="flex items-center gap-2 font-body-md text-body-md text-primary-fixed-dim hover:text-on-primary transition-colors break-all">
                  <Icon name="mail" size={18} className="text-secondary-fixed shrink-0" />
                  {settings.email}
                </a>
              )}
              {settings.address && (
                <p className="flex items-start gap-2 font-body-md text-body-md text-primary-fixed-dim">
                  <Icon name="pin_drop" size={18} className="text-secondary-fixed shrink-0 mt-0.5" />
                  <span>{settings.address}</span>
                </p>
              )}
            </div>
            {socials.length > 0 && (
              <div className="flex items-center gap-2 mt-space-md">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={settings[s.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-9 h-9 grid place-items-center rounded-lg bg-surface-bright/10 hover:bg-surface-bright/20 transition-colors text-on-primary"
                  >
                    <Icon name={s.icon} size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {columns.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <h3 className="font-label-caps text-label-caps text-secondary-fixed uppercase mb-space-md">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="font-body-md text-body-md text-primary-fixed-dim hover:text-on-primary transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 lg:col-span-2">
            <h3 className="font-label-caps text-label-caps text-secondary-fixed uppercase mb-space-md">Private Advisory</h3>
            <p className="font-body-sm text-body-sm text-primary-fixed-dim leading-relaxed mb-space-md">
              Speak directly with our advisory desk about requirements, valuations or listing your property.
            </p>
            <Link to="/contact" className="btn-bronze btn-sm w-full">
              Enquire Now
              <Icon name="north_east" size={15} />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell py-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="font-body-sm text-body-sm text-on-primary-container">
            © {year} {settings.business_name}. {settings.footer_note}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body-sm text-body-sm text-on-primary-container">
            <span>Established {settings.established}</span>
            <span aria-hidden="true">•</span>
            <span>{settings.city}, Tamil Nadu</span>
            <span aria-hidden="true">•</span>
            <Link to="/admin" className="hover:text-on-primary transition-colors">Admin</Link>
          </div>
        </div>
        {settings.demo_notice && (
          <div className="shell pb-space-md">
            <p className="font-body-sm text-body-sm text-on-primary-container/70 italic">{settings.demo_notice}</p>
          </div>
        )}
      </div>
    </footer>
  );
}

/* ------------------------ floating WhatsApp ------------------------- */

export function WhatsAppFloat() {
  const { waGeneral } = useSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <a
      href={waGeneral}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Prime Estates on WhatsApp"
      className={`fixed z-40 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:right-6 lg:bottom-6
                  w-14 h-14 rounded-full bg-on-tertiary-fixed-variant text-on-tertiary
                  grid place-items-center shadow-lvl3 hover:bg-on-tertiary-fixed hover:scale-105
                  transition-all duration-300 group
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <Icon name="chat" size={26} fill />
      <span className="absolute inset-0 rounded-full bg-on-tertiary-fixed-variant animate-ping opacity-20 motion-reduce:hidden" aria-hidden="true" />
      <span
        className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary
                   font-label-ui text-label-ui whitespace-nowrap opacity-0 group-hover:opacity-100
                   pointer-events-none transition-opacity hidden lg:block shadow-lvl2"
      >
        Chat with us
      </span>
    </a>
  );
}

/** Scrolls to top on route change (not on back/forward). */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}
