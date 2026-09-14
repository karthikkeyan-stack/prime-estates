/**
 * Typed fetch client. Same-origin relative URLs only — never localhost —
 * so it works behind the sandbox preview proxy and on Vercel alike.
 */
import type { AdminUser, AnalyticsResponse, Category, DashboardStats, Enquiry, GalleryItem, LocationItem, Paged, Property, PropertyCardData, ServiceItem, SiteSettings } from './types';

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.errors || {});
  }
  return body as T;
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

/* ------------------------------- public ------------------------------- */

export const getSettings = () => request<SiteSettings>('/settings');
export const getCategories = () => request<Category[]>('/categories');
export const getLocations = () => request<LocationItem[]>('/locations');
export const getServices = () => request<ServiceItem[]>('/services');
export const getGallery = () => request<GalleryItem[]>('/gallery');

export interface PropertyQuery {
  listing?: string; type?: string; location?: string; min_price?: string | number;
  max_price?: string | number; bedrooms?: string | number; min_area?: string | number;
  search?: string; sort?: string; page?: number; limit?: number;
  featured?: boolean; verified?: boolean; status?: string;
}

export const getProperties = (q: PropertyQuery = {}) =>
  request<Paged<PropertyCardData>>(`/properties${qs(q as Record<string, string>)}`);

export const getProperty = (slug: string) => request<Property>(`/properties/${encodeURIComponent(slug)}`);

export const getFacets = () =>
  request<{
    byType: { key: string; count: number }[];
    byListing: { key: string; count: number }[];
    byLocation: { key: string; count: number }[];
    priceRange: { min: number; max: number };
  }>('/properties/facets');

export interface EnquiryPayload {
  name: string; phone: string; email?: string; message?: string;
  property_id?: number | null; property_title?: string;
  interest?: string; budget?: string; source?: string;
}

export const createEnquiry = (payload: EnquiryPayload) =>
  request<{ ok: true; id: number }>('/enquiries', { method: 'POST', body: JSON.stringify(payload) });

/* -------------------------------- admin -------------------------------- */

export const adminLogin = (email: string, password: string) =>
  request<{ user: AdminUser }>('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const adminLogout = () => request<{ ok: true }>('/admin/logout', { method: 'POST' });
export const adminMe = () => request<{ user: AdminUser | null }>('/admin/me');

export const adminStats = () =>
  request<{
    stats: DashboardStats;
    recentEnquiries: Enquiry[];
    recentProperties: (PropertyCardData & { published: boolean })[];
    byType: { key: string; count: number }[];
  }>('/admin/stats');

export const adminProperties = (q: Record<string, string | number | boolean | undefined> = {}) =>
  request<Paged<PropertyCardData & { published: boolean; views: number; updated_at: string }>>(
    `/admin/properties${qs(q)}`,
  );

export const adminProperty = (id: number | string) => request<Property>(`/admin/properties/${id}`);

export const createProperty = (payload: Record<string, unknown>) =>
  request<Property>('/admin/properties', { method: 'POST', body: JSON.stringify(payload) });

export const updateProperty = (id: number, payload: Record<string, unknown>) =>
  request<Property>(`/admin/properties/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const patchProperty = (id: number, payload: Record<string, unknown>) =>
  request<Property>(`/admin/properties/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteProperty = (id: number, mode: 'delete' | 'archive' = 'delete') =>
  request<{ ok: true }>(`/admin/properties/${id}?mode=${mode}`, { method: 'DELETE' });

export const uploadImage = (propertyId: number, data: string, alt: string) =>
  request<{ id: number; url: string; alt: string; is_primary: boolean; sort_order: number }>(
    `/admin/properties/${propertyId}/images`,
    { method: 'POST', body: JSON.stringify({ data, alt }) },
  );

export const patchImage = (imageId: number, payload: Record<string, unknown>) =>
  request(`/admin/images/${imageId}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteImage = (imageId: number) =>
  request<{ ok: true }>(`/admin/images/${imageId}`, { method: 'DELETE' });

export const adminEnquiries = (q: Record<string, string | number | boolean | undefined> = {}) =>
  request<Paged<Enquiry>>(`/admin/enquiries${qs(q)}`);

export const patchEnquiry = (id: number, payload: Record<string, unknown>) =>
  request<Enquiry>(`/admin/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteEnquiry = (id: number) =>
  request<{ ok: true }>(`/admin/enquiries/${id}`, { method: 'DELETE' });

export const saveSettings = (payload: Record<string, string>) =>
  request<SiteSettings>('/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });

export const adminAnalytics = (q: Record<string, string | number | undefined> = {}) =>
  request<AnalyticsResponse>(`/admin/analytics${qs(q)}`);

export const submitContact = (payload: Record<string, unknown>) =>
  request<{ ok: true; id: number }>('/contact', { method: 'POST', body: JSON.stringify(payload) });
