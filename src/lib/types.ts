export type ListingType = 'sale' | 'rent' | 'lease';
export type PropertyStatus = 'available' | 'featured' | 'sold' | 'rented' | 'draft' | 'archived';

export interface PropertyImage {
  id: number;
  url: string;
  alt: string;
  is_primary: boolean;
  sort_order: number;
}

export interface PropertyCardData {
  id: number;
  title: string;
  slug: string;
  property_type: string;
  listing_type: ListingType;
  status: PropertyStatus;
  price: string | number;
  price_display: string;
  price_period?: string;
  location: string;
  location_slug?: string;
  area_locality?: string;
  city?: string;
  property_area: string | number | null;
  property_area_unit?: string;
  built_up_area?: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking?: number | null;
  facing?: string;
  featured: boolean;
  verified_title?: boolean;
  main_image: string;
  short_description?: string;
  created_at?: string;
}

export interface Property extends PropertyCardData {
  district?: string;
  state?: string;
  address?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  floor?: number | null;
  total_floors?: number | null;
  property_age?: string;
  furnishing?: string;
  description?: string;
  amenities: string[];
  highlights: string[];
  published: boolean;
  rera_id?: string;
  views?: number;
  seo_title?: string;
  seo_description?: string;
  updated_at?: string;
  images: PropertyImage[];
  related: PropertyCardData[];
}

export interface Paged<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image_url: string;
  sort_order: number;
  property_count: number;
}

export interface LocationItem {
  id: number;
  slug: string;
  name: string;
  district: string;
  state: string;
  localities: string;
  tagline: string;
  image_url: string;
  property_count: number;
}

export interface ServiceItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: string;
  icon: string;
}

export interface GalleryItem {
  id: number;
  url: string;
  caption: string;
  category: string;
}

export interface Enquiry {
  id: number;
  name: string;
  phone: string;
  email: string;
  message: string;
  property_id: number | null;
  property_title: string;
  interest: string;
  budget: string;
  source: string;
  status: 'new' | 'contacted' | 'closed';
  admin_notes: string;
  archived: boolean;
  created_at: string;
}

export interface SiteSettings {
  business_name: string;
  tagline: string;
  phone: string;
  phone_display: string;
  whatsapp: string;
  email: string;
  address: string;
  maps_url: string;
  maps_embed: string;
  established: string;
  city: string;
  description: string;
  short_description: string;
  whatsapp_general: string;
  seo_title: string;
  seo_description: string;
  footer_note: string;
  site_url: string;
  facebook: string;
  instagram: string;
  youtube: string;
  linkedin: string;
  demo_notice: string;
  [key: string]: string;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
}

export interface DashboardStats {
  total_properties: number;
  published: number;
  drafts: number;
  featured: number;
  available: number;
  closed: number;
  archived: number;
  enquiries: number;
  new_enquiries: number;
  contacted_enquiries: number;
  closed_enquiries: number;
  images: number;
  total_views: number;
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  'independent-house': 'Independent House',
  plot: 'Plot / Land',
  commercial: 'Commercial',
  office: 'Office',
  shop: 'Shop',
  showroom: 'Showroom',
  investment: 'Investment',
  farmhouse: 'Plantation / Farmhouse',
  other: 'Other',
};

export const LISTING_LABELS: Record<string, string> = {
  sale: 'For Sale',
  rent: 'For Rent',
  lease: 'For Lease',
};

export const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  featured: 'Featured',
  sold: 'Sold',
  rented: 'Rented',
  draft: 'Draft',
  archived: 'Archived',
};

/* ----------------------------- analytics ---------------------------- */

export interface AnalyticsSummary {
  unique_visitors: number;
  sessions: number;
  page_views: number;
  avg_duration_ms: number;
  returning_sessions: number;
  bounced: number;
  whatsapp_clicks: number;
  phone_clicks: number;
  searches: number;
  enquiry_events: number;
  enquiries: number;
  conversion_rate: number;
  bounce_rate: number;
}

export interface AnalyticsResponse {
  range: { from: string; to: string; label: string };
  summary: AnalyticsSummary;
  trend: { day: string; sessions: number; visitors: number; views: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  topProperties: { property_id: number; title: string; slug: string; views: number }[];
  sources: { source: string; host: string; sessions: number }[];
  devices: { device: string; sessions: number }[];
  geo: { country: string; city: string; sessions: number }[];
  recent: { event_type: string; path: string | null; label: string | null; created_at: string }[];
}

export const ENQUIRY_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  follow_up: 'Follow-up',
  qualified: 'Qualified',
  closed: 'Closed',
  spam: 'Spam',
};
