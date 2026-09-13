import { useEffect } from 'react';

interface SeoProps {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  /** JSON-LD structured data object(s). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Declarative document head management: titles, meta descriptions,
 * canonicals, Open Graph, Twitter cards and JSON-LD structured data.
 */
export function Seo({ title, description, canonical, image, type = 'website', noindex, jsonLd }: SeoProps) {
  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', { name: 'description', content: description });
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    }

    const url = canonical || window.location.origin + window.location.pathname;
    upsertLink('canonical', url);

    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Prime Estates' });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'en_IN' });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });

    if (image) {
      const abs = image.startsWith('http') ? image : window.location.origin + image;
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: abs });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: abs });
    }

    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    });

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      script.setAttribute('data-seo', 'page');
      document.head.appendChild(script);
    }
    return () => { script?.remove(); };
  }, [title, description, canonical, image, type, noindex, JSON.stringify(jsonLd)]);

  return null;
}

/** Organisation-level structured data, emitted once on the homepage. */
export function organizationJsonLd(s: {
  business_name: string; description: string; phone: string; city: string;
  site_url: string; email?: string; address?: string; established?: string;
}) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: s.business_name,
    description: s.description,
    telephone: `+91${String(s.phone).replace(/\D/g, '').slice(-10)}`,
    areaServed: ['Coimbatore', 'Tirupur', 'Pollachi', 'Ooty', 'Erode', 'Palakkad'],
    address: { '@type': 'PostalAddress', addressLocality: s.city, addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
    priceRange: '₹₹₹',
  };
  if (s.site_url) data.url = s.site_url;
  if (s.email) (data.address as Record<string, unknown>).email = s.email;
  if (s.address) (data.address as Record<string, unknown>).streetAddress = s.address;
  if (s.established) data.foundingDate = s.established;
  return data;
}
