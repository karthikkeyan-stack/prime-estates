import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminProperty, createProperty, updateProperty, deleteProperty,
  uploadImage, patchImage, deleteImage, getCategories, getLocations, ApiError,
} from '../lib/api';
import type { PropertyImage } from '../lib/types';
import { PROPERTY_TYPE_LABELS, LISTING_LABELS, STATUS_LABELS } from '../lib/types';
import { slugify, formatPrice } from '../lib/format';
import { useAsync } from '../hooks';
import { useToast } from '../lib/store';
import { AdminPageHeader } from './AdminShell';
import { ConfirmDialog, Field, Icon, Img, Spinner, Toggle } from '../components/ui';

const AMENITY_SUGGESTIONS = [
  'Covered Car Parking', 'Power Backup', '24x7 Security', 'Lift', 'Modular Kitchen',
  'Private Garden', 'Swimming Pool', 'Clubhouse', 'Gymnasium', 'Children’s Play Area',
  'Borewell', 'Rainwater Harvesting', 'CCTV Surveillance', 'Intercom', 'Servant Quarters',
  'Air Conditioned', 'Furnished', 'Gated Community', 'Compound Wall', 'Approach Road',
];

const FACING = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
const FURNISHING = ['Unfurnished', 'Semi-Furnished', 'Fully Furnished'];
const AREA_UNITS = [
  { key: 'sqft', label: 'Sq.ft' }, { key: 'cent', label: 'Cent' },
  { key: 'acre', label: 'Acre' }, { key: 'sqm', label: 'Sq.m' }, { key: 'ground', label: 'Ground' },
];

type FormState = Record<string, any>;

const EMPTY: FormState = {
  title: '', slug: '', property_type: 'apartment', listing_type: 'sale', status: 'available',
  price: '', price_display: '', price_period: 'month',
  location: '', location_slug: '', area_locality: '', city: '', district: '', state: 'Tamil Nadu',
  address: '', latitude: '', longitude: '',
  property_area: '', property_area_unit: 'sqft', built_up_area: '',
  bedrooms: '', bathrooms: '', parking: '', floor: '', total_floors: '',
  property_age: '', facing: '', furnishing: '',
  short_description: '', description: '',
  amenities: [] as string[], highlights: [] as string[],
  featured: false, published: true, verified_title: false, rera_id: '',
  main_image: '', seo_title: '', seo_description: '',
};

export default function PropertyForm() {
  const { id } = useParams();
  const isEdit = id !== 'new' && id !== undefined;
  const navigate = useNavigate();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useAsync(getCategories, []);
  const locations = useAsync(getLocations, []);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [amenityInput, setAmenityInput] = useState('');
  const [highlightInput, setHighlightInput] = useState('');

  /* ------------------------------ load ------------------------------ */
  useEffect(() => {
    if (!isEdit) { setForm(EMPTY); setImages([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    adminProperty(id!)
      .then((p) => {
        if (!alive) return;
        setForm({
          ...EMPTY, ...p,
          price: String(p.price ?? ''),
          property_area: p.property_area ?? '',
          built_up_area: p.built_up_area ?? '',
          bedrooms: p.bedrooms ?? '', bathrooms: p.bathrooms ?? '', parking: p.parking ?? '',
          floor: p.floor ?? '', total_floors: p.total_floors ?? '',
          latitude: p.latitude ?? '', longitude: p.longitude ?? '',
          amenities: p.amenities ?? [], highlights: p.highlights ?? [],
        });
        setImages(p.images ?? []);
        setSlugEdited(true);
      })
      .catch((e: Error) => push(e.message, 'error'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* Warn before leaving with unsaved changes */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const set = (key: string, value: unknown) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'title' && !slugEdited) next.slug = slugify(String(value));
      if (key === 'location' && !f.location_slug) {
        const match = (locations.data ?? []).find((l) => String(value).toLowerCase().includes(l.name.toLowerCase()));
        if (match) next.location_slug = match.slug;
      }
      return next;
    });
    setDirty(true);
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  function validate() {
    const next: Record<string, string> = {};
    if (!String(form.title).trim()) next.title = 'Title is required';
    if (!String(form.location).trim()) next.location = 'Location is required';
    if (form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) next.price = 'Enter a valid price';
    if (!form.property_type) next.property_type = 'Select a property type';
    if (!form.listing_type) next.listing_type = 'Select a listing type';
    setErrors(next);
    if (Object.keys(next).length) {
      push('Please fix the highlighted fields.', 'error');
      const first = document.querySelector<HTMLElement>('[data-invalid="true"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return Object.keys(next).length === 0;
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, images: images.map((i) => ({ url: i.url })) };
      if (isEdit) {
        await updateProperty(Number(id), payload);
        push('Property saved.', 'success');
        setDirty(false);
      } else {
        const created = await createProperty(payload);
        push('Property created.', 'success');
        setDirty(false);
        navigate(`/admin/properties/${created.id}`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields);
        push('Please fix the highlighted fields.', 'error');
      } else {
        push(err instanceof Error ? err.message : 'Save failed', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------- image handling --------------------------- */
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!isEdit) { push('Save the property first, then add images.', 'info'); return; }
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
        push(`${file.name}: only JPG, PNG, WebP or AVIF allowed`, 'error');
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        push(`${file.name}: must be under 8 MB`, 'error');
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Could not read file'));
          reader.readAsDataURL(file);
        });
        const img = await uploadImage(Number(id), dataUrl, form.title || file.name);
        setImages((prev) => [...prev, img as PropertyImage]);
        if (img.is_primary) setForm((f) => ({ ...f, main_image: img.url }));
        ok++;
      } catch (err) {
        push(err instanceof Error ? err.message : `Upload failed: ${file.name}`, 'error');
      }
    }
    if (ok) push(`${ok} image${ok > 1 ? 's' : ''} uploaded.`, 'success');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function makePrimary(imageId: number) {
    try {
      await patchImage(imageId, { is_primary: true });
      const target = images.find((i) => i.id === imageId);
      setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === imageId })));
      if (target) setForm((f) => ({ ...f, main_image: target.url }));
      push('Primary image updated.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not set primary image', 'error');
    }
  }

  async function removeImage(imageId: number) {
    try {
      await deleteImage(imageId);
      const remaining = images.filter((i) => i.id !== imageId);
      setImages(remaining);
      if (!remaining.some((i) => i.url === form.main_image)) {
        setForm((f) => ({ ...f, main_image: remaining[0]?.url ?? '' }));
      }
      push('Image removed.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not remove image', 'error');
    }
  }

  async function reorder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    try {
      await Promise.all(next.map((img, i) => patchImage(img.id, { sort_order: i })));
    } catch {
      push('Could not save the new order', 'error');
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteProperty(Number(id), 'delete');
      push('Property deleted.', 'success');
      navigate('/admin/properties');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Delete failed', 'error');
      setDeleting(false);
    }
  }

  const addTag = (field: 'amenities' | 'highlights', value: string) => {
    const v = value.trim();
    if (!v || form[field].includes(v)) return;
    set(field, [...form[field], v]);
  };
  const removeTag = (field: 'amenities' | 'highlights', value: string) => {
    set(field, form[field].filter((x: string) => x !== value));
  };

  if (loading) {
    return (
      <div>
        <div className="h-10 w-64 skeleton mb-6 rounded" />
        <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-64 skeleton rounded-xl" />)}</div>
      </div>
    );
  }

  const pricePreview = form.price !== '' && !Number.isNaN(Number(form.price))
    ? formatPrice(form.price, form.listing_type, form.price_period)
    : '';

  return (
    <form onSubmit={save}>
      <AdminPageHeader
        breadcrumb={
          <nav aria-label="Breadcrumb" className="mb-space-sm">
            <ol className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
              <li><Link to="/admin" className="hover:text-secondary">Dashboard</Link></li>
              <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
              <li><Link to="/admin/properties" className="hover:text-secondary">Properties</Link></li>
              <li aria-hidden="true"><Icon name="chevron_right" size={14} /></li>
              <li className="text-on-surface font-medium">{isEdit ? 'Edit' : 'New'}</li>
            </ol>
          </nav>
        }
        title={isEdit ? 'Edit property' : 'Add property'}
        subtitle={isEdit ? form.title : 'Create a new listing in the database.'}
        actions={
          <>
            {isEdit && form.slug && (
              <a href={`/properties/${form.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                <Icon name="open_in_new" size={16} />
                <span className="hidden sm:inline">Preview</span>
              </a>
            )}
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              {saving ? <><Spinner size={15} /> Saving…</> : <><Icon name="save" size={16} /> {isEdit ? 'Save changes' : 'Create property'}</>}
            </button>
          </>
        }
      />

      {dirty && (
        <div className="flex items-center gap-2 rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant px-space-md py-2.5 mb-space-md" role="status">
          <Icon name="info" size={18} />
          <span className="font-body-md text-body-md">You have unsaved changes.</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
        <div className="xl:col-span-8 space-y-space-md min-w-0">
          {/* Basic information */}
          <Section title="Basic information" icon="info">
            <Field label="Property title" htmlFor="f-title" required error={errors.title} className="sm:col-span-2">
              <input id="f-title" className={`field ${errors.title ? 'field-error' : ''}`} data-invalid={!!errors.title}
                value={form.title} onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Contemporary 4 BHK Villa in Saravanampatti" />
            </Field>
            <Field label="URL slug" htmlFor="f-slug" hint="Used in the public link" className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0 hidden sm:inline">/properties/</span>
                <input id="f-slug" className="field" value={form.slug}
                  onChange={(e) => { setSlugEdited(true); set('slug', slugify(e.target.value)); }}
                  placeholder="auto-generated-from-title" />
              </div>
            </Field>
            <Field label="Short description" htmlFor="f-short" hint="One line shown on property cards" className="sm:col-span-2">
              <textarea id="f-short" rows={2} className="field resize-none" value={form.short_description}
                onChange={(e) => set('short_description', e.target.value)}
                placeholder="e.g. East-facing villa with private garden inside a gated enclave." />
            </Field>
          </Section>

          {/* Type & listing */}
          <Section title="Type & listing" icon="category">
            <Field label="Property type" htmlFor="f-type" required error={errors.property_type}>
              <select id="f-type" className={`field cursor-pointer ${errors.property_type ? 'field-error' : ''}`}
                value={form.property_type} onChange={(e) => set('property_type', e.target.value)}>
                {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Listing type" htmlFor="f-listing" required error={errors.listing_type}>
              <select id="f-listing" className="field cursor-pointer" value={form.listing_type} onChange={(e) => set('listing_type', e.target.value)}>
                {Object.entries(LISTING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Status" htmlFor="f-status">
              <select id="f-status" className="field cursor-pointer" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="RERA / approval ID" htmlFor="f-rera" hint="Optional">
              <input id="f-rera" className="field" value={form.rera_id} onChange={(e) => set('rera_id', e.target.value)} placeholder="TN/00/Building/0000/2024" />
            </Field>
          </Section>

          {/* Pricing */}
          <Section title="Pricing" icon="payments">
            <Field label="Price (₹)" htmlFor="f-price" required error={errors.price}
              hint={pricePreview ? `Displays as ${pricePreview}` : 'Enter the full amount in rupees'}>
              <input id="f-price" type="number" min="0" step="1000" inputMode="numeric"
                className={`field tabular ${errors.price ? 'field-error' : ''}`} data-invalid={!!errors.price}
                value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="18500000" />
            </Field>
            {(form.listing_type === 'rent' || form.listing_type === 'lease') && (
              <Field label="Per" htmlFor="f-period">
                <select id="f-period" className="field cursor-pointer" value={form.price_period} onChange={(e) => set('price_period', e.target.value)}>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="sq.ft">Sq.ft</option>
                </select>
              </Field>
            )}
            <Field label="Custom price label" htmlFor="f-pricedisp" hint="Leave blank to auto-format" className="sm:col-span-2">
              <input id="f-pricedisp" className="field" value={form.price_display}
                onChange={(e) => set('price_display', e.target.value)} placeholder="e.g. Price on request" />
            </Field>
          </Section>

          {/* Location */}
          <Section title="Location" icon="location_on">
            <Field label="Location (display)" htmlFor="f-loc" required error={errors.location} className="sm:col-span-2">
              <input id="f-loc" className={`field ${errors.location ? 'field-error' : ''}`} data-invalid={!!errors.location}
                value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Saravanampatti, Coimbatore" />
            </Field>
            <Field label="Region" htmlFor="f-locslug" hint="Groups the listing under a location page">
              <select id="f-locslug" className="field cursor-pointer" value={form.location_slug} onChange={(e) => set('location_slug', e.target.value)}>
                <option value="">— Select —</option>
                {(locations.data ?? []).map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Locality / area" htmlFor="f-locality">
              <input id="f-locality" className="field" value={form.area_locality} onChange={(e) => set('area_locality', e.target.value)} placeholder="Saravanampatti" />
            </Field>
            <Field label="City" htmlFor="f-city">
              <input id="f-city" className="field" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Coimbatore" />
            </Field>
            <Field label="District" htmlFor="f-district">
              <input id="f-district" className="field" value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="Coimbatore" />
            </Field>
            <Field label="Full address" htmlFor="f-address" hint="Optional — not shown publicly unless you want it" className="sm:col-span-2">
              <input id="f-address" className="field" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Latitude" htmlFor="f-lat" hint="Optional, for the map pin">
              <input id="f-lat" type="number" step="any" className="field tabular" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="11.0785" />
            </Field>
            <Field label="Longitude" htmlFor="f-lng" hint="Optional">
              <input id="f-lng" type="number" step="any" className="field tabular" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="77.0027" />
            </Field>
          </Section>

          {/* Specifications */}
          <Section title="Specifications" icon="straighten">
            <Field label="Total area" htmlFor="f-area">
              <input id="f-area" type="number" step="any" min="0" className="field tabular" value={form.property_area} onChange={(e) => set('property_area', e.target.value)} />
            </Field>
            <Field label="Area unit" htmlFor="f-unit">
              <select id="f-unit" className="field cursor-pointer" value={form.property_area_unit} onChange={(e) => set('property_area_unit', e.target.value)}>
                {AREA_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            </Field>
            <Field label="Built-up area (sq.ft)" htmlFor="f-builtup">
              <input id="f-builtup" type="number" step="any" min="0" className="field tabular" value={form.built_up_area} onChange={(e) => set('built_up_area', e.target.value)} />
            </Field>
            <Field label="Bedrooms" htmlFor="f-beds">
              <input id="f-beds" type="number" min="0" max="20" className="field tabular" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
            </Field>
            <Field label="Bathrooms" htmlFor="f-baths">
              <input id="f-baths" type="number" min="0" max="20" className="field tabular" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
            </Field>
            <Field label="Car parking" htmlFor="f-parking">
              <input id="f-parking" type="number" min="0" max="50" className="field tabular" value={form.parking} onChange={(e) => set('parking', e.target.value)} />
            </Field>
            <Field label="Floor" htmlFor="f-floor">
              <input id="f-floor" type="number" className="field tabular" value={form.floor} onChange={(e) => set('floor', e.target.value)} />
            </Field>
            <Field label="Total floors" htmlFor="f-floors">
              <input id="f-floors" type="number" min="0" className="field tabular" value={form.total_floors} onChange={(e) => set('total_floors', e.target.value)} />
            </Field>
            <Field label="Facing" htmlFor="f-facing">
              <select id="f-facing" className="field cursor-pointer" value={form.facing} onChange={(e) => set('facing', e.target.value)}>
                <option value="">— Not specified —</option>
                {FACING.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Furnishing" htmlFor="f-furnish">
              <select id="f-furnish" className="field cursor-pointer" value={form.furnishing} onChange={(e) => set('furnishing', e.target.value)}>
                <option value="">— Not specified —</option>
                {FURNISHING.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Property age" htmlFor="f-age">
              <input id="f-age" className="field" value={form.property_age} onChange={(e) => set('property_age', e.target.value)} placeholder="e.g. New / 5 years" />
            </Field>
          </Section>

          {/* Description */}
          <Section title="Description" icon="description">
            <Field label="Full description" htmlFor="f-desc" hint="Use blank lines to separate paragraphs." className="sm:col-span-2">
              <textarea id="f-desc" rows={8} className="field resize-y" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </Section>

          {/* Amenities & highlights */}
          <Section title="Amenities & highlights" icon="checklist" grid={false}>
            <div className="space-y-space-md">
              <div>
                <label className="label" htmlFor="f-amenity">Amenities</label>
                <div className="flex gap-2 mb-2">
                  <input id="f-amenity" className="field" value={amenityInput}
                    onChange={(e) => setAmenityInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('amenities', amenityInput); setAmenityInput(''); } }}
                    placeholder="Type an amenity and press Enter" />
                  <button type="button" className="btn-secondary btn-sm shrink-0"
                    onClick={() => { addTag('amenities', amenityInput); setAmenityInput(''); }}>
                    Add
                  </button>
                </div>
                {form.amenities.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 mb-2">
                    {form.amenities.map((a: string) => (
                      <li key={a}>
                        <span className="chip chip-active">
                          {a}
                          <button type="button" onClick={() => removeTag('amenities', a)} aria-label={`Remove ${a}`} className="ml-0.5">
                            <Icon name="close" size={13} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {AMENITY_SUGGESTIONS.filter((s) => !form.amenities.includes(s)).slice(0, 10).map((s) => (
                    <button key={s} type="button" onClick={() => addTag('amenities', s)} className="chip !py-1 !text-[12px]">
                      <Icon name="add" size={12} />{s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="f-highlight">Key highlights</label>
                <div className="flex gap-2 mb-2">
                  <input id="f-highlight" className="field" value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('highlights', highlightInput); setHighlightInput(''); } }}
                    placeholder="e.g. Corner plot with 40 ft road" />
                  <button type="button" className="btn-secondary btn-sm shrink-0"
                    onClick={() => { addTag('highlights', highlightInput); setHighlightInput(''); }}>
                    Add
                  </button>
                </div>
                {form.highlights.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {form.highlights.map((h: string) => (
                      <li key={h}>
                        <span className="chip chip-active">
                          {h}
                          <button type="button" onClick={() => removeTag('highlights', h)} aria-label={`Remove ${h}`} className="ml-0.5">
                            <Icon name="close" size={13} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* Images */}
          <Section title="Images" icon="photo_library" grid={false}>
            {!isEdit ? (
              <div className="rounded-lg border border-dashed border-outline-variant p-space-lg text-center">
                <Icon name="cloud_upload" size={28} className="text-outline" />
                <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                  Save the property first — you can upload images straight after.
                </p>
              </div>
            ) : (
              <>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                  className="rounded-lg border-2 border-dashed border-outline-variant hover:border-secondary transition-colors p-space-lg text-center mb-space-md"
                >
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple
                    className="sr-only" id="f-images" onChange={(e) => onFiles(e.target.files)} />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                      <Spinner size={24} className="text-secondary" />
                      <span className="font-body-md text-body-md">Uploading…</span>
                    </div>
                  ) : (
                    <>
                      <Icon name="cloud_upload" size={30} className="text-secondary" />
                      <p className="font-title-md text-title-md text-on-surface mt-2">Drag images here</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
                        JPG, PNG, WebP or AVIF · up to 8 MB each
                      </p>
                      <label htmlFor="f-images" className="btn-secondary btn-sm cursor-pointer inline-flex">
                        <Icon name="add_photo_alternate" size={16} />
                        Choose files
                      </label>
                    </>
                  )}
                </div>

                {images.length > 0 && (
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
                    {images.map((img, i) => (
                      <li key={img.id} className="relative group rounded-lg overflow-hidden border border-[#e7e5e4]">
                        <Img src={img.url} alt={img.alt} className="aspect-[4/3]" />
                        {img.is_primary && (
                          <span className="absolute top-1.5 left-1.5 badge bg-secondary text-on-secondary !px-2 !py-0.5">Primary</span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-primary-container/90 backdrop-blur-sm p-1.5 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => reorder(i, -1)} disabled={i === 0}
                              className="w-7 h-7 grid place-items-center rounded text-on-primary hover:bg-white/15 disabled:opacity-30"
                              aria-label="Move earlier"><Icon name="arrow_back" size={15} /></button>
                            <button type="button" onClick={() => reorder(i, 1)} disabled={i === images.length - 1}
                              className="w-7 h-7 grid place-items-center rounded text-on-primary hover:bg-white/15 disabled:opacity-30"
                              aria-label="Move later"><Icon name="arrow_forward" size={15} /></button>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {!img.is_primary && (
                              <button type="button" onClick={() => makePrimary(img.id)}
                                className="w-7 h-7 grid place-items-center rounded text-on-primary hover:bg-white/15"
                                aria-label="Set as primary" title="Set as primary"><Icon name="star" size={15} /></button>
                            )}
                            <button type="button" onClick={() => removeImage(img.id)}
                              className="w-7 h-7 grid place-items-center rounded text-on-primary hover:bg-error"
                              aria-label="Remove image" title="Remove"><Icon name="delete" size={15} /></button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <Field label="Main image URL" htmlFor="f-main" hint="Set automatically by the primary image" className="mt-space-md">
                  <input id="f-main" className="field" value={form.main_image} onChange={(e) => set('main_image', e.target.value)} placeholder="/media/... or https://…" />
                </Field>
              </>
            )}
          </Section>

          {/* SEO */}
          <Section title="SEO" icon="travel_explore">
            <Field label="SEO title" htmlFor="f-seotitle" hint={`${String(form.seo_title).length}/60 recommended`} className="sm:col-span-2">
              <input id="f-seotitle" className="field" value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)}
                placeholder={form.title ? `${form.title} — ${form.location} | Prime Estates` : 'Auto-generated from the title'} />
            </Field>
            <Field label="Meta description" htmlFor="f-seodesc" hint={`${String(form.seo_description).length}/160 recommended`} className="sm:col-span-2">
              <textarea id="f-seodesc" rows={3} className="field resize-none" value={form.seo_description}
                onChange={(e) => set('seo_description', e.target.value)} placeholder={form.short_description} />
            </Field>
          </Section>
        </div>

        {/* Sidebar */}
        <aside className="xl:col-span-4 xl:sticky xl:top-6 space-y-space-md">
          <div className="card p-space-md">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold mb-space-md">Publishing</h2>
            <div className="space-y-space-md">
              <Toggle id="t-published" checked={!!form.published} onChange={(v) => set('published', v)} label="Published on website" />
              <Toggle id="t-featured" checked={!!form.featured} onChange={(v) => set('featured', v)} label="Featured property" />
              <Toggle id="t-verified" checked={!!form.verified_title} onChange={(v) => set('verified_title', v)} label="Title verified badge" />
            </div>
            <div className="mt-space-md pt-space-md border-t border-[#e7e5e4] space-y-2">
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? <><Spinner size={16} /> Saving…</> : <><Icon name="save" size={18} />{isEdit ? 'Save changes' : 'Create property'}</>}
              </button>
              <Link to="/admin/properties" className="btn-secondary w-full">Cancel</Link>
            </div>
          </div>

          {form.main_image && (
            <div className="card overflow-hidden">
              <div className="px-space-md py-2.5 border-b border-[#e7e5e4]">
                <h2 className="font-title-md text-title-md text-on-surface">Card preview</h2>
              </div>
              <Img src={form.main_image} alt="Preview" className="aspect-[4/3]" />
              <div className="p-space-md">
                <span className="font-label-caps text-label-caps text-secondary uppercase">
                  {PROPERTY_TYPE_LABELS[form.property_type]}
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface line-clamp-2 mt-0.5">
                  {form.title || 'Property title'}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{form.location || 'Location'}</p>
                <p className="font-metric-price text-metric-price text-secondary tabular mt-1">
                  {form.price_display || pricePreview || '₹—'}
                </p>
              </div>
            </div>
          )}

          {isEdit && (
            <div className="card p-space-md border-error/30">
              <h2 className="font-title-md text-title-md text-error mb-1">Danger zone</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
                Deleting removes the property and its images permanently.
              </p>
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="btn btn-sm w-full bg-error-container text-on-error-container hover:bg-error hover:text-on-error py-2.5">
                <Icon name="delete" size={16} />
                Delete property
              </button>
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this property?"
        message={`“${form.title}” and all of its images will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete permanently"
        busy={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

function Section({
  title, icon, children, grid = true,
}: { title: string; icon: string; children: React.ReactNode; grid?: boolean }) {
  return (
    <section className="card p-space-md lg:p-space-lg">
      <h2 className="flex items-center gap-2 font-title-lg text-title-lg text-on-surface font-bold mb-space-md pb-space-sm border-b border-[#efeeeb]">
        <Icon name={icon} size={20} className="text-secondary" />
        {title}
      </h2>
      {grid ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">{children}</div> : children}
    </section>
  );
}
