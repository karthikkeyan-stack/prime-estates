import React, { useEffect, useState } from 'react';
import { saveSettings } from '../lib/api';
import { useSettings, useToast } from '../lib/store';
import { AdminPageHeader } from './AdminShell';
import { Field, Icon, Spinner } from '../components/ui';

const GROUPS: { title: string; icon: string; fields: { key: string; label: string; hint?: string; type?: 'text' | 'textarea' | 'url' | 'email' | 'tel' }[] }[] = [
  {
    title: 'Business identity',
    icon: 'storefront',
    fields: [
      { key: 'business_name', label: 'Business name' },
      { key: 'tagline', label: 'Tagline', hint: 'Shown under the logo' },
      { key: 'established', label: 'Established year' },
      { key: 'city', label: 'Primary city' },
      { key: 'short_description', label: 'Short description', type: 'textarea', hint: 'Used in the footer and meta descriptions' },
      { key: 'description', label: 'Full business description', type: 'textarea', hint: 'Shown on the homepage and About page' },
    ],
  },
  {
    title: 'Contact details',
    icon: 'contacts',
    fields: [
      { key: 'phone', label: 'Phone number (digits)', type: 'tel', hint: 'Used for tel: links' },
      { key: 'phone_display', label: 'Phone (display format)' },
      { key: 'whatsapp', label: 'WhatsApp number', hint: 'With country code, e.g. 919486122022' },
      { key: 'email', label: 'Email address', type: 'email', hint: 'Leave blank to hide it across the site' },
      { key: 'address', label: 'Office address', type: 'textarea', hint: 'Leave blank to hide it across the site' },
      { key: 'maps_url', label: 'Google Maps link', type: 'url', hint: 'Optional — adds an “Open in Maps” button' },
      { key: 'maps_embed', label: 'Google Maps embed URL', type: 'url', hint: 'Optional — overrides the default map' },
      { key: 'whatsapp_general', label: 'Default WhatsApp message', type: 'textarea' },
    ],
  },
  {
    title: 'Social links',
    icon: 'share',
    fields: [
      { key: 'facebook', label: 'Facebook URL', type: 'url' },
      { key: 'instagram', label: 'Instagram URL', type: 'url' },
      { key: 'youtube', label: 'YouTube URL', type: 'url' },
      { key: 'linkedin', label: 'LinkedIn URL', type: 'url' },
    ],
  },
  {
    title: 'SEO defaults',
    icon: 'travel_explore',
    fields: [
      { key: 'site_url', label: 'Canonical site URL', type: 'url', hint: 'e.g. https://primeestates.in — used in the sitemap' },
      { key: 'seo_title', label: 'Default page title' },
      { key: 'seo_description', label: 'Default meta description', type: 'textarea' },
    ],
  },
  {
    title: 'Footer',
    icon: 'call_to_action',
    fields: [
      { key: 'footer_note', label: 'Footer note' },
      { key: 'demo_notice', label: 'Demo notice', hint: 'Clear this when the real listings go live' },
    ],
  },
];

export default function Settings() {
  const { settings, refresh } = useSettings();
  const { push } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, String(v ?? '')])));
  }, [settings]);

  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings(values);
      await refresh();
      setDirty(false);
      push('Settings saved. The website has been updated.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <AdminPageHeader
        title="Site settings"
        subtitle="Business information used across the public website. Nothing is hard-coded."
        actions={
          <button type="submit" className="btn-primary btn-sm" disabled={saving || !dirty}>
            {saving ? <><Spinner size={15} /> Saving…</> : <><Icon name="save" size={16} /> Save settings</>}
          </button>
        }
      />

      {dirty && (
        <div className="flex items-center gap-2 rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant px-space-md py-2.5 mb-space-md" role="status">
          <Icon name="info" size={18} />
          <span className="font-body-md text-body-md">You have unsaved changes.</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md items-start">
        {GROUPS.map((group) => (
          <section key={group.title} className="card p-space-md lg:p-space-lg">
            <h2 className="flex items-center gap-2 font-title-lg text-title-lg text-on-surface font-bold mb-space-md pb-space-sm border-b border-[#efeeeb]">
              <Icon name={group.icon} size={20} className="text-secondary" />
              {group.title}
            </h2>
            <div className="space-y-space-md">
              {group.fields.map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`s-${f.key}`} hint={f.hint}>
                  {f.type === 'textarea' ? (
                    <textarea
                      id={`s-${f.key}`} rows={3} className="field resize-none"
                      value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      id={`s-${f.key}`} type={f.type ?? 'text'} className="field"
                      value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card p-space-md mt-space-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
          <div className="flex items-start gap-2.5">
            <Icon name="lightbulb" size={20} className="text-secondary shrink-0 mt-0.5" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              Blank email and address fields are hidden across the public site — nothing is invented.
              Fill them in when the client confirms the details.
            </p>
          </div>
          <button type="submit" className="btn-primary btn-sm shrink-0" disabled={saving || !dirty}>
            {saving ? <><Spinner size={15} /> Saving…</> : <><Icon name="save" size={16} /> Save settings</>}
          </button>
        </div>
      </div>
    </form>
  );
}
