import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  Building2, User, Clock, FileText, Check,
  ChevronRight, ChevronLeft, Eye, EyeOff, X,
  AlertCircle, CheckCircle2, Upload,
} from 'lucide-react'
import { api } from '../lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo Marakwet', 'Embu',
  'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
  'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui',
  'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
  'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang\'a', 'Nairobi',
  'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita Taveta', 'Tana River', 'Tharaka Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
]

const ALL_SPECIALTIES = [
  'General Practice', 'Pediatrics', 'Gynecology & Obstetrics', 'Internal Medicine',
  'General Surgery', 'Dermatology', 'Orthopedics', 'Cardiology', 'Neurology',
  'Ophthalmology', 'ENT', 'Psychiatry', 'Radiology', 'Oncology', 'Urology',
  'Diabetology', 'Physiotherapy', 'Nutrition & Dietetics', 'Emergency Medicine',
  'Dentistry', 'Mental Health',
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

// ── Types ─────────────────────────────────────────────────────────────────────

type DayHours = { enabled: boolean; open: string; close: string }

interface FormData {
  admin_full_name: string
  admin_email: string
  admin_phone: string
  admin_password: string
  admin_confirm_password: string
  clinic_name: string
  county: string
  sub_county: string
  address: string
  license_number: string
  business_registration_number: string
  year_established: string
  clinic_phone: string
  clinic_email: string
  website: string
  description: string
  specialties: string[]
  operating_hours: Record<string, DayHours>
  doc_medical_license: File | null
  doc_business_registration: File | null
  doc_kra_pin: File | null
}

const defaultHours: Record<string, DayHours> = {
  monday:    { enabled: true,  open: '08:00', close: '17:00' },
  tuesday:   { enabled: true,  open: '08:00', close: '17:00' },
  wednesday: { enabled: true,  open: '08:00', close: '17:00' },
  thursday:  { enabled: true,  open: '08:00', close: '17:00' },
  friday:    { enabled: true,  open: '08:00', close: '17:00' },
  saturday:  { enabled: false, open: '09:00', close: '13:00' },
  sunday:    { enabled: false, open: '09:00', close: '13:00' },
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateStep1(fd: FormData): Record<string, string> {
  const e: Record<string, string> = {}
  if (!fd.admin_full_name.trim() || fd.admin_full_name.trim().length < 3)
    e.admin_full_name = 'Full name must be at least 3 characters'
  if (!fd.admin_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
    e.admin_email = 'Enter a valid email address'
  if (!fd.admin_phone.match(/^(07|01)\d{8}$/))
    e.admin_phone = 'Enter a valid Kenyan phone number (07XX or 01XX)'
  if (fd.admin_password.length < 8)
    e.admin_password = 'Password must be at least 8 characters'
  if (fd.admin_password !== fd.admin_confirm_password)
    e.admin_confirm_password = 'Passwords do not match'
  return e
}

function validateStep2(fd: FormData): Record<string, string> {
  const e: Record<string, string> = {}
  if (!fd.clinic_name.trim() || fd.clinic_name.trim().length < 3)
    e.clinic_name = 'Clinic name must be at least 3 characters'
  if (!fd.county) e.county = 'Please select a county'
  if (!fd.address.trim() || fd.address.trim().length < 5)
    e.address = 'Enter a valid street address'
  if (!fd.license_number.trim())
    e.license_number = 'License number is required'
  if (!fd.clinic_phone.match(/^(07|01|\+254)\d{7,9}$/))
    e.clinic_phone = 'Enter a valid clinic phone number'
  if (!fd.clinic_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
    e.clinic_email = 'Enter a valid clinic email address'
  return e
}

function validateStep3(fd: FormData): Record<string, string> {
  const enabled = DAYS.filter(d => fd.operating_hours[d].enabled)
  if (enabled.length === 0) return { hours: 'Set at least one operating day' }
  return {}
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label, error, required, children, hint,
}: {
  label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-[11px] mt-1 text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

const inputCls = `
  w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors
  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200
`
const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({ fd, setFd, errors }: { fd: FormData; setFd: (u: Partial<FormData>) => void; errors: Record<string, string> }) {
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  return (
    <div className="space-y-4">
      <Field label="Full Name" required error={errors.admin_full_name}>
        <input
          value={fd.admin_full_name}
          onChange={e => setFd({ admin_full_name: e.target.value })}
          placeholder="Dr. Jane Wanjiku"
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      <Field label="Email Address" required error={errors.admin_email}>
        <input
          type="email"
          value={fd.admin_email}
          onChange={e => setFd({ admin_email: e.target.value })}
          placeholder="jane@example.com"
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      <Field
        label="Phone Number" required error={errors.admin_phone}
        hint="Kenyan mobile: 07XX or 01XX"
      >
        <input
          value={fd.admin_phone}
          onChange={e => setFd({ admin_phone: e.target.value })}
          placeholder="0712 345 678"
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      <Field label="Password" required error={errors.admin_password}>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={fd.admin_password}
            onChange={e => setFd({ admin_password: e.target.value })}
            placeholder="Min. 8 characters"
            className={inputCls}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPw(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <Field label="Confirm Password" required error={errors.admin_confirm_password}>
        <div className="relative">
          <input
            type={showPw2 ? 'text' : 'password'}
            value={fd.admin_confirm_password}
            onChange={e => setFd({ admin_confirm_password: e.target.value })}
            placeholder="Repeat password"
            className={inputCls}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPw2(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {showPw2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({ fd, setFd, errors }: { fd: FormData; setFd: (u: Partial<FormData>) => void; errors: Record<string, string> }) {
  function toggleSpecialty(s: string) {
    setFd({
      specialties: fd.specialties.includes(s)
        ? fd.specialties.filter(x => x !== s)
        : [...fd.specialties, s],
    })
  }

  return (
    <div className="space-y-4">
      <Field label="Clinic Name" required error={errors.clinic_name}>
        <input
          value={fd.clinic_name}
          onChange={e => setFd({ clinic_name: e.target.value })}
          placeholder="Nairobi West Medical Centre"
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="County" required error={errors.county}>
          <select
            value={fd.county}
            onChange={e => setFd({ county: e.target.value })}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">Select county…</option>
            {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Sub-County">
          <input
            value={fd.sub_county}
            onChange={e => setFd({ sub_county: e.target.value })}
            placeholder="Westlands"
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Street Address" required error={errors.address}>
        <input
          value={fd.address}
          onChange={e => setFd({ address: e.target.value })}
          placeholder="123 Hospital Road, 2nd Floor"
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="License Number" required error={errors.license_number} hint="e.g. KMPDB-2024-001">
          <input
            value={fd.license_number}
            onChange={e => setFd({ license_number: e.target.value })}
            placeholder="KMPDB-2024-001"
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Business Reg. Number">
          <input
            value={fd.business_registration_number}
            onChange={e => setFd({ business_registration_number: e.target.value })}
            placeholder="CPR/2024/XXXX"
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Clinic Phone" required error={errors.clinic_phone}>
          <input
            value={fd.clinic_phone}
            onChange={e => setFd({ clinic_phone: e.target.value })}
            placeholder="0200 000 000"
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Year Established">
          <input
            type="number"
            value={fd.year_established}
            onChange={e => setFd({ year_established: e.target.value })}
            placeholder="2018"
            min={1900} max={2026}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Clinic Email" required error={errors.clinic_email}>
        <input
          type="email"
          value={fd.clinic_email}
          onChange={e => setFd({ clinic_email: e.target.value })}
          placeholder="info@myclinic.ke"
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      <Field label="Website" hint="Optional — include https://">
        <input
          value={fd.website}
          onChange={e => setFd({ website: e.target.value })}
          placeholder="https://myclinic.ke"
          className={inputCls}
          style={inputStyle}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={fd.description}
          onChange={e => setFd({ description: e.target.value })}
          rows={3}
          placeholder="Brief description of your clinic services and approach…"
          className={inputCls + ' resize-none'}
          style={inputStyle}
        />
      </Field>

      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Medical Specialties <span className="font-normal" style={{ color: 'var(--color-text-tertiary)' }}>(select all that apply)</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_SPECIALTIES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSpecialty(s)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-left transition-all"
              style={fd.specialties.includes(s)
                ? { backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }
                : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid transparent' }
              }
            >
              {fd.specialties.includes(s) && <Check className="h-3 w-3 shrink-0" />}
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

function Step3({ fd, setFd, errors }: { fd: FormData; setFd: (u: Partial<FormData>) => void; errors: Record<string, string> }) {
  function updateDay(day: string, field: keyof DayHours, value: string | boolean) {
    setFd({
      operating_hours: {
        ...fd.operating_hours,
        [day]: { ...fd.operating_hours[day], [field]: value },
      },
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Set your clinic's opening hours for each day. Days marked as closed will not be shown in patient booking.
      </p>

      {errors.hours && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errors.hours}
        </div>
      )}

      <div className="space-y-2">
        {DAYS.map(day => {
          const h = fd.operating_hours[day]
          return (
            <div
              key={day}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                backgroundColor: h.enabled ? 'var(--color-surface)' : 'var(--color-surface-2)',
                border: h.enabled ? '1px solid var(--color-border)' : '1px solid transparent',
              }}
            >
              <div className="w-24 shrink-0">
                <p className="text-sm font-semibold" style={{ color: h.enabled ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                  {DAY_LABELS[day]}
                </p>
              </div>

              {h.enabled ? (
                <div className="flex flex-1 items-center gap-2">
                  <select
                    value={h.open}
                    onChange={e => updateDay(day, 'open', e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>to</span>
                  <select
                    value={h.close}
                    onChange={e => updateDay(day, 'close', e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ) : (
                <p className="flex-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Closed</p>
              )}

              <button
                type="button"
                onClick={() => updateDay(day, 'enabled', !h.enabled)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
                style={h.enabled
                  ? { backgroundColor: '#FEF2F2', color: '#DC2626' }
                  : { backgroundColor: '#EFF6FF', color: '#1D4ED8' }
                }
              >
                {h.enabled ? 'Close' : 'Open'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

function Step4({ fd, setFd }: { fd: FormData; setFd: (u: Partial<FormData>) => void }) {
  const docs = [
    { key: 'doc_medical_license' as const, label: 'Medical License Certificate', required: true, hint: 'Current KMPDB/KMDPB license certificate' },
    { key: 'doc_business_registration' as const, label: 'Business Registration Certificate', required: true, hint: 'Certificate of Registration from Business Registration Service' },
    { key: 'doc_kra_pin' as const, label: 'KRA PIN Certificate', required: false, hint: 'Kenya Revenue Authority PIN certificate' },
  ]

  const openDays = DAYS.filter(d => fd.operating_hours[d].enabled)
  const hoursStr = openDays.length > 0
    ? openDays.map(d => `${DAY_LABELS[d].slice(0, 3)}: ${fd.operating_hours[d].open}–${fd.operating_hours[d].close}`).join(', ')
    : 'No days set'

  return (
    <div className="space-y-6">
      {/* Documents */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Required Documents</h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Upload PDF or image files. Documents are reviewed securely by our team.
          </p>
        </div>

        {docs.map(doc => (
          <div
            key={doc.key}
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {doc.label}
                {doc.required && <span className="text-red-500 ml-1">*</span>}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{doc.hint}</p>
              {fd[doc.key] && (
                <div className="flex items-center gap-1.5 mt-2">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--color-success)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                    {(fd[doc.key] as File).name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFd({ [doc.key]: null })}
                    className="ml-1"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  setFd({ [doc.key]: file })
                }}
              />
              <span
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all"
                style={fd[doc.key]
                  ? { backgroundColor: '#DCFCE7', color: '#15803D' }
                  : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }
                }
              >
                <Upload className="h-3.5 w-3.5" />
                {fd[doc.key] ? 'Replace' : 'Choose File'}
              </span>
            </label>
          </div>
        ))}
      </div>

      {/* Summary review */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="px-4 py-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Application Summary
          </h4>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Admin Account</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{fd.admin_full_name || '—'}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fd.admin_email} · {fd.admin_phone}</p>
          </div>
          <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Clinic</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{fd.clinic_name || '—'}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {[fd.address, fd.county].filter(Boolean).join(', ') || '—'}
            </p>
            {fd.specialties.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {fd.specialties.join(' · ')}
              </p>
            )}
          </div>
          <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Operating Hours</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{hoursStr}</p>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
      >
        By submitting, you confirm that all information provided is accurate and that your clinic complies with Kenya Medical Practitioners and Dentists Board regulations.
      </div>
    </div>
  )
}

// ── Steps config ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Account',    icon: User },
  { label: 'Clinic',     icon: Building2 },
  { label: 'Hours',      icon: Clock },
  { label: 'Documents',  icon: FileText },
]

// ── Success state ─────────────────────────────────────────────────────────────

function SuccessScreen({ regRef, clinicName, email }: { regRef: string; clinicName: string; email: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-canvas)' }}>
      <div className="w-full max-w-md text-center space-y-6">
        <div
          className="h-20 w-20 rounded-3xl mx-auto flex items-center justify-center"
          style={{ backgroundColor: '#DCFCE7' }}
        >
          <CheckCircle2 className="h-10 w-10" style={{ color: '#15803D' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
            Application Submitted
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {clinicName} has been submitted for review. We'll notify you within 2–3 business days.
          </p>
        </div>
        <div
          className="rounded-2xl p-5 text-left space-y-3"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
              Registration Reference
            </p>
            <p className="text-xl font-bold tracking-widest" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
              {regRef}
            </p>
          </div>
          <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            A confirmation will be sent to <strong>{email}</strong> once your application is reviewed. Keep your reference number for follow-up queries.
          </p>
        </div>
        <div className="space-y-2">
          <Link
            to="/"
            className="block w-full rounded-2xl py-3 text-sm font-bold text-center text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#1D4ED8' }}
          >
            Back to Home
          </Link>
          <Link
            to="/login"
            className="block w-full rounded-2xl py-3 text-sm font-bold text-center transition-colors"
            style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-surface-2)' }}
          >
            Sign In (after approval)
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClinicRegisterPage() {
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [regResult, setRegResult] = useState<{ ref: string; clinicName: string; email: string } | null>(null)
  const [apiError, setApiError] = useState('')

  const [fd, _setFd] = useState<FormData>({
    admin_full_name: '', admin_email: '', admin_phone: '',
    admin_password: '', admin_confirm_password: '',
    clinic_name: '', county: '', sub_county: '', address: '',
    license_number: '', business_registration_number: '',
    year_established: '', clinic_phone: '', clinic_email: '',
    website: '', description: '', specialties: [],
    operating_hours: defaultHours,
    doc_medical_license: null, doc_business_registration: null, doc_kra_pin: null,
  })

  function setFd(update: Partial<FormData>) {
    _setFd(prev => ({ ...prev, ...update }))
    setErrors({})
  }

  const submit = useMutation({
    mutationFn: () => {
      const opHours: Record<string, { open: string; close: string }> = {}
      for (const [day, h] of Object.entries(fd.operating_hours)) {
        if (h.enabled) opHours[day] = { open: h.open, close: h.close }
      }

      const documents = [
        fd.doc_medical_license && { type: 'medical_license', filename: fd.doc_medical_license.name },
        fd.doc_business_registration && { type: 'business_registration', filename: fd.doc_business_registration.name },
        fd.doc_kra_pin && { type: 'kra_pin', filename: fd.doc_kra_pin.name },
      ].filter(Boolean)

      return api.post('/clinics/register', {
        admin: {
          full_name: fd.admin_full_name,
          email: fd.admin_email,
          phone: fd.admin_phone,
          password: fd.admin_password,
        },
        clinic: {
          name: fd.clinic_name,
          county: fd.county,
          sub_county: fd.sub_county || undefined,
          address: fd.address,
          license_number: fd.license_number,
          business_registration_number: fd.business_registration_number || undefined,
          year_established: fd.year_established ? parseInt(fd.year_established) : undefined,
          phone: fd.clinic_phone,
          email: fd.clinic_email,
          website: fd.website || undefined,
          description: fd.description || undefined,
          specialties: fd.specialties,
          operating_hours: opHours,
        },
        documents,
      })
    },
    onSuccess: (res) => {
      setRegResult({
        ref: res.data.registration_reference,
        clinicName: res.data.clinic_name,
        email: res.data.admin_email,
      })
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.detail ?? 'Submission failed. Please try again.')
    },
  })

  function nextStep() {
    let errs: Record<string, string> = {}
    if (step === 1) errs = validateStep1(fd)
    if (step === 2) errs = validateStep2(fd)
    if (step === 3) errs = validateStep3(fd)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setStep(s => s + 1)
  }

  function handleSubmit() {
    setApiError('')
    submit.mutate()
  }

  if (regResult) {
    return <SuccessScreen regRef={regResult.ref} clinicName={regResult.clinicName} email={regResult.email} />
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-canvas)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
              style={{ backgroundColor: '#1D4ED8' }}
            >
              M
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
              MedAssist <span style={{ color: '#1D4ED8' }}>AI</span>
            </span>
          </Link>
          <Link to="/login" className="text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
            Sign In
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
            Register Your Clinic
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Join MedAssist AI — reviewed and approved within 2–3 business days.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => {
            const n = i + 1
            const done = step > n
            const active = step === n
            const Icon = s.icon
            return (
              <div key={s.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center transition-all"
                    style={done
                      ? { backgroundColor: '#DCFCE7', color: '#15803D' }
                      : active
                      ? { backgroundColor: '#1D4ED8', color: 'white' }
                      : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }
                    }
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: active ? '#1D4ED8' : 'var(--color-text-tertiary)' }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-2 mb-4 transition-all"
                    style={{ backgroundColor: step > n ? '#86EFAC' : 'var(--color-border)' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Form card */}
        <div
          className="rounded-3xl p-6 mb-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h2 className="text-base font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            {step === 1 && 'Admin Account Details'}
            {step === 2 && 'Clinic Information'}
            {step === 3 && 'Operating Hours'}
            {step === 4 && 'Documents & Review'}
          </h2>

          {step === 1 && <Step1 fd={fd} setFd={setFd} errors={errors} />}
          {step === 2 && <Step2 fd={fd} setFd={setFd} errors={errors} />}
          {step === 3 && <Step3 fd={fd} setFd={setFd} errors={errors} />}
          {step === 4 && <Step4 fd={fd} setFd={setFd} />}

          {apiError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {apiError}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-colors"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          <button
            type="button"
            onClick={step < 4 ? nextStep : handleSubmit}
            disabled={submit.isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#1D4ED8' }}
          >
            {step < 4 ? (
              <>Next <ChevronRight className="h-4 w-4" /></>
            ) : submit.isPending ? (
              'Submitting…'
            ) : (
              'Submit Application'
            )}
          </button>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--color-text-tertiary)' }}>
          Already registered?{' '}
          <Link to="/login" className="font-semibold" style={{ color: '#1D4ED8' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
