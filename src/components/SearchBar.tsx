import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Category, LocationItem } from '../lib/types';
import { Icon } from './ui';

const INTENTS = [
  { key: 'sale', label: 'Buy / Outright' },
  { key: 'rent', label: 'Rent / Lease' },
  { key: 'commercial', label: 'Commercial & IT' },
  { key: 'plots', label: 'Plots & Farmland' },
];

const BUDGETS = [
  { key: '', label: 'Any Budget' },
  { key: '0-7500000', label: 'Under ₹75 Lakh' },
  { key: '7500000-15000000', label: '₹75 Lakh – ₹1.5 Cr' },
  { key: '15000000-35000000', label: '₹1.5 Cr – ₹3.5 Cr' },
  { key: '35000000-75000000', label: '₹3.5 Cr – ₹7.5 Cr' },
  { key: '75000000-', label: '₹7.5 Cr and above' },
];

/**
 * The floating hero search module. Builds a URL query and navigates to
 * /properties — the catalogue then performs the actual DB query.
 */
export function SearchBar({
  categories, locations, total,
}: { categories: Category[]; locations: LocationItem[]; total: number }) {
  const navigate = useNavigate();
  const [intent, setIntent] = useState('sale');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');
  const [beds, setBeds] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (intent === 'sale' || intent === 'rent') params.set('listing', intent);
    if (intent === 'commercial') params.set('type', 'commercial,office,showroom,shop');
    if (intent === 'plots') params.set('type', 'plot,farmhouse');
    if (location) params.set('location', location);
    if (type) params.set('type', type);
    if (beds) params.set('bedrooms', beds);
    if (budget) {
      const [min, max] = budget.split('-');
      if (min) params.set('min_price', min);
      if (max) params.set('max_price', max);
    }
    navigate(`/properties?${params.toString()}`);
  }

  const selectCls =
    'w-full bg-surface-container-low rounded-lg px-space-md py-3 pr-9 font-body-md text-body-md text-on-surface ' +
    'appearance-none cursor-pointer focus:outline-none focus:ring-[1.5px] focus:ring-on-surface min-h-[48px]';

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-float p-space-md lg:p-space-lg">
      <div className="flex items-center gap-space-xs overflow-x-auto pb-space-xs mb-space-md no-scrollbar" role="tablist" aria-label="Search intent">
        {INTENTS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={intent === t.key}
            onClick={() => setIntent(t.key)}
            className={`px-space-md py-2 rounded-full font-label-ui text-label-ui transition-all shrink-0 ${
              intent === t.key
                ? 'bg-primary-container text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-space-sm items-end">
        <div className="lg:col-span-4 flex flex-col gap-1.5 min-w-0">
          <label className="font-label-caps text-label-caps text-on-surface-variant tracking-wider flex items-center gap-1" htmlFor="hero-loc">
            <Icon name="location_on" size={14} />
            <span>REGIONAL MICRO-MARKET</span>
          </label>
          <div className="relative">
            <select id="hero-loc" className={selectCls} value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name}{l.localities ? ` — ${l.localities.split(',')[0]}` : ''}
                </option>
              ))}
            </select>
            <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-1.5 min-w-0">
          <label className="font-label-caps text-label-caps text-on-surface-variant tracking-wider flex items-center gap-1" htmlFor="hero-type">
            <Icon name="apartment" size={14} />
            <span>ASSET TYPE</span>
          </label>
          <div className="relative">
            <select id="hero-type" className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All asset classes</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-1.5 min-w-0">
          <label className="font-label-caps text-label-caps text-on-surface-variant tracking-wider flex items-center gap-1" htmlFor="hero-budget">
            <Icon name="currency_rupee" size={14} />
            <span>BUDGET</span>
          </label>
          <div className="relative">
            <select id="hero-budget" className={selectCls} value={budget} onChange={(e) => setBudget(e.target.value)}>
              {BUDGETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
            <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
          </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-1.5 min-w-0">
          <label className="font-label-caps text-label-caps text-on-surface-variant tracking-wider flex items-center gap-1" htmlFor="hero-beds">
            <Icon name="bed" size={14} />
            <span>BEDS</span>
          </label>
          <div className="relative">
            <select id="hero-beds" className={`${selectCls} px-space-sm`} value={beds} onChange={(e) => setBeds(e.target.value)}>
              <option value="">Any</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5+</option>
            </select>
            <Icon name="expand_more" size={18} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
          </div>
        </div>

        <div className="lg:col-span-2 sm:col-span-2">
          <button type="submit" className="btn bg-primary-container text-on-primary w-full py-3.5 hover:bg-[#2a3550] min-h-[48px]">
            <Icon name="search" size={18} />
            <span>Search{total ? ` (${total})` : ''}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
