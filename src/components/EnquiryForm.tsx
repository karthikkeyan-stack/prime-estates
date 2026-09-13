import React, { useState } from 'react';
import { createEnquiry, ApiError } from '../lib/api';
import { useSettings, useToast } from '../lib/store';
import { Field, Icon, Spinner } from './ui';

interface Props {
  propertyId?: number;
  propertyTitle?: string;
  source?: string;
  compact?: boolean;
  /** Dark panel styling for use on the noir conversion band. */
  tone?: 'light' | 'onDark';
  showInterest?: boolean;
  heading?: string;
  subheading?: string;
}

const INTERESTS = [
  'Buy a residential property',
  'Buy land or a plot',
  'Invest in commercial property',
  'Rent or lease a property',
  'List my property with Prime Estates',
  'General enquiry',
];

const BUDGETS = [
  'Under ₹50 Lakh',
  '₹50 Lakh – ₹1 Cr',
  '₹1 Cr – ₹2.5 Cr',
  '₹2.5 Cr – ₹5 Cr',
  '₹5 Cr – ₹10 Cr',
  'Above ₹10 Cr',
  'Rental budget',
];

export function EnquiryForm({
  propertyId, propertyTitle, source = 'website', compact = false,
  tone = 'light', showInterest = true, heading, subheading,
}: Props) {
  const { settings } = useSettings();
  const { push } = useToast();
  const [values, setValues] = useState({
    name: '', phone: '', email: '', message: '',
    interest: showInterest ? INTERESTS[0] : '', budget: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  function validate() {
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = 'Please enter your name';
    if (!/^[\d+\-\s()]{8,18}$/.test(values.phone.trim())) next.phone = 'Enter a valid phone number';
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email address';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await createEnquiry({
        ...values,
        property_id: propertyId ?? null,
        property_title: propertyTitle ?? '',
        source,
      });
      setDone(true);
      push('Enquiry received. Our advisory desk will contact you shortly.', 'success');
      setValues({ name: '', phone: '', email: '', message: '', interest: showInterest ? INTERESTS[0] : '', budget: '' });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields);
        push('Please check the highlighted fields.', 'error');
      } else {
        push(err instanceof Error ? err.message : 'Could not send your enquiry.', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  const dark = tone === 'onDark';
  const inputCls = `field ${dark ? 'bg-surface-container-low border-transparent' : ''}`;
  const labelCls = dark ? 'text-on-surface-variant' : '';

  if (done) {
    return (
      <div className="text-center py-10 px-4" role="status">
        <div className="w-14 h-14 mx-auto rounded-full bg-tertiary-fixed grid place-items-center text-on-tertiary-fixed mb-4">
          <Icon name="check_circle" size={30} fill />
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Enquiry received</h3>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mx-auto mb-5">
          Thank you. Our advisory desk will be in touch. For an immediate response, message us on WhatsApp.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href={propertyTitle
              ? `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Hi, I'm interested in ${propertyTitle}. Could you share more details?`)}`
              : `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(settings.whatsapp_general)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp btn-sm"
          >
            <Icon name="chat" size={16} />
            WhatsApp Us
          </a>
          <button className="btn-secondary btn-sm" onClick={() => setDone(false)}>
            Send another enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-space-sm">
      {heading && (
        <div className="mb-space-md">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1">{heading}</h3>
          {subheading && <p className="font-body-sm text-body-sm text-on-surface-variant">{subheading}</p>}
        </div>
      )}

      {propertyTitle && (
        <div className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2.5 mb-1">
          <Icon name="home_work" size={16} className="text-secondary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="block font-label-caps text-label-caps text-on-surface-variant uppercase">Enquiring about</span>
            <span className="block font-title-md text-title-md text-on-surface truncate">{propertyTitle}</span>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${compact ? '' : 'sm:grid-cols-2'} gap-space-sm`}>
        <Field label="Your name" htmlFor="enq-name" required error={errors.name}>
          <input
            id="enq-name" type="text" autoComplete="name" className={`${inputCls} ${errors.name ? 'field-error' : ''}`}
            value={values.name} onChange={set('name')} placeholder="e.g. Ramesh Sundaram"
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'enq-name-err' : undefined}
          />
        </Field>
        <Field label="Phone / WhatsApp" htmlFor="enq-phone" required error={errors.phone}>
          <input
            id="enq-phone" type="tel" inputMode="tel" autoComplete="tel"
            className={`${inputCls} ${errors.phone ? 'field-error' : ''}`}
            value={values.phone} onChange={set('phone')} placeholder="+91 98765 43210"
            aria-invalid={!!errors.phone}
          />
        </Field>
      </div>

      <Field label="Email" htmlFor="enq-email" hint="Optional" error={errors.email}>
        <input
          id="enq-email" type="email" autoComplete="email"
          className={`${inputCls} ${errors.email ? 'field-error' : ''}`}
          value={values.email} onChange={set('email')} placeholder="you@example.com"
          aria-invalid={!!errors.email}
        />
      </Field>

      {showInterest && (
        <div className={`grid grid-cols-1 ${compact ? '' : 'sm:grid-cols-2'} gap-space-sm`}>
          <Field label="I am looking to" htmlFor="enq-interest">
            <select id="enq-interest" className={inputCls} value={values.interest} onChange={set('interest')}>
              {INTERESTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Budget" htmlFor="enq-budget" hint="Optional">
            <select id="enq-budget" className={inputCls} value={values.budget} onChange={set('budget')}>
              <option value="">Select a range</option>
              {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
        </div>
      )}

      <Field label="Requirements" htmlFor="enq-message" hint="Tell us the locality, configuration or timeline you have in mind.">
        <textarea
          id="enq-message" rows={compact ? 3 : 4} className={`${inputCls} resize-none`}
          value={values.message} onChange={set('message')}
          placeholder="e.g. Looking for a 3 BHK east-facing home near Race Course, ready to move in."
        />
      </Field>

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? <><Spinner size={16} /> Sending…</> : <>Send Enquiry <Icon name="north_east" size={16} /></>}
      </button>

      <p className={`font-body-sm text-body-sm text-center ${dark ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}>
        We respond to every enquiry personally. Your details are never shared.
      </p>
    </form>
  );
}
