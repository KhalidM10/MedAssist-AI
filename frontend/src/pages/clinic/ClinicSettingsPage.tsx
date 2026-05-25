import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Settings, Building2, Phone, Clock, Users, ShieldAlert,
  CheckCircle2, ChevronRight, Mail, MapPin, Hash, Plus, X, Lock, Send,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { cn } from '../../lib/utils'
import type { ClinicDetail } from '../../types'

type Tab = 'general' | 'contact' | 'hours' | 'team' | 'danger'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'general',  label: 'General',      icon: Building2 },
  { key: 'contact',  label: 'Contact',       icon: Phone },
  { key: 'hours',    label: 'Hours',         icon: Clock },
  { key: 'team',     label: 'Team',          icon: Users },
  { key: 'danger',   label: 'Danger Zone',   icon: ShieldAlert },
]

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

const ALL_SPECIALTIES = [
  'General Practice', 'Pediatrics', 'Gynecology & Obstetrics', 'Internal Medicine',
  'General Surgery', 'Dermatology', 'Orthopedics', 'Cardiology', 'Neurology',
  'Ophthalmology', 'ENT', 'Psychiatry', 'Radiology', 'Oncology', 'Urology',
  'Diabetology', 'Physiotherapy', 'Nutrition & Dietetics',
]

const KENYA_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi',
  'Kitale', 'Garissa', 'Kakamega', 'Machakos', 'Meru', 'Nyeri', 'Kisii',
  'Kilifi', 'Kericho', 'Embu', 'Migori', 'Homa Bay', 'Siaya', 'Vihiga',
  'Bungoma', 'Trans Nzoia', 'Uasin Gishu', 'Nandi', 'Bomet', 'Kericho',
]

// ─── Saved toast ─────────────────────────────────────────────────────────────

function SavedToast({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
      )}
      style={{ backgroundColor: '#0F172A' }}
    >
      <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
      <p className="text-sm font-semibold text-white">Settings saved</p>
    </div>
  )
}

// ─── Locked field with request-change ────────────────────────────────────────

function LockedField({
  label, value, fieldName, clinicId,
}: {
  label: string; value: string; fieldName: string; clinicId: string
}) {
  const { user } = useAuthStore()
  const [showModal, setShowModal] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState(false)

  const submit = useMutation({
    mutationFn: () =>
      api.post('/dashboard/change-requests', {
        field_name: fieldName,
        current_value: value,
        requested_value: newValue,
        reason,
      }),
    onSuccess: () => { setSent(true); setTimeout(() => { setShowModal(false); setSent(false) }, 2000) },
  })

  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      <div
        className="flex items-center justify-between rounded-xl border px-3.5 py-2.5"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
      >
        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{value || '—'}</span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <Lock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs font-semibold transition-colors"
            style={{ color: 'var(--color-brand)' }}
          >
            Request Change
          </button>
        </div>
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
        Requires super admin review to change.
      </p>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div
            className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Request Change: {label}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-text-tertiary)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {sent ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-success)' }}>
                <CheckCircle2 className="h-4 w-4" /> Request submitted for review.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Current Value</label>
                  <p className="text-sm px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>{value}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>New Value *</label>
                  <input
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder={`Enter new ${label.toLowerCase()}…`}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Reason *</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    placeholder="Why is this change needed?"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-brand"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <button
                  onClick={() => submit.mutate()}
                  disabled={!newValue.trim() || !reason.trim() || submit.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  <Send className="h-3.5 w-3.5" />
                  {submit.isPending ? 'Submitting…' : 'Submit Request'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab({ clinic, onSaved }: { clinic: ClinicDetail; onSaved: () => void }) {
  const qc = useQueryClient()
  const [specialties, setSpecialties] = useState<string[]>(clinic.specialties ?? [])
  const [specInput, setSpecInput] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/clinics/${clinic.id}`, { specialties }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-stats'] })
      qc.invalidateQueries({ queryKey: ['clinic-detail'] })
      onSaved()
    },
  })

  function addSpecialty(s: string) {
    if (s && !specialties.includes(s)) setSpecialties(prev => [...prev, s])
    setSpecInput('')
  }

  function removeSpecialty(s: string) {
    setSpecialties(prev => prev.filter(x => x !== s))
  }

  const suggestions = ALL_SPECIALTIES.filter(
    s => s.toLowerCase().includes(specInput.toLowerCase()) && !specialties.includes(s),
  ).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Locked fields */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
            Verified Fields — Request Change to Edit
          </h3>
        </div>
        <div className="space-y-4">
          <LockedField label="Clinic Name"     value={clinic.name}                fieldName="name"             clinicId={String(clinic.id)} />
          <LockedField label="Physical Address" value={clinic.address}             fieldName="address"          clinicId={String(clinic.id)} />
          <LockedField label="License Number"   value={clinic.license_number ?? ''} fieldName="license_number"  clinicId={String(clinic.id)} />
        </div>
      </div>

      <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />

      {/* Editable: Specialties */}
      <div>
        <h3 className="text-sm font-bold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>Medical Specialties</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          Patients filter clinics by specialty. Add all that apply.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {specialties.map(s => (
            <span
              key={s}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
            >
              {s}
              <button
                type="button"
                onClick={() => removeSpecialty(s)}
                className="transition-colors"
                style={{ color: 'var(--color-brand)' }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {specialties.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No specialties added yet</span>
          )}
        </div>
        <div className="relative">
          <input
            value={specInput}
            onChange={e => setSpecInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSpecialty(specInput))}
            placeholder="Type to add specialty…"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand-light"
          />
          {specInput && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10">
              {suggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSpecialty(s)}
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-brand-light hover:text-brand transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Contact tab ──────────────────────────────────────────────────────────────

interface ContactForm {
  phone: string
  email: string
}

function ContactTab({ clinic, onSaved }: { clinic: ClinicDetail; onSaved: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<ContactForm>({
    defaultValues: { phone: clinic.phone, email: clinic.email ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (data: ContactForm) =>
      api.put(`/clinics/${clinic.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-detail'] })
      onSaved()
    },
  })

  return (
    <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="space-y-6">
      <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Contact Details</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} /> Phone Number *
            </span>
          </label>
          <input
            {...register('phone', { required: true })}
            placeholder="+254 700 000 000"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand-light"
          />
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Displayed to patients on your clinic profile.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} /> Email Address
            </span>
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="clinic@example.com"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand-light"
          />
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Used for appointment notifications and system alerts.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          {mutation.isPending ? 'Saving…' : 'Save Contact'}
        </button>
      </div>
    </form>
  )
}

// ─── Hours tab ────────────────────────────────────────────────────────────────

function HoursTab({ clinic, onSaved }: { clinic: ClinicDetail; onSaved: () => void }) {
  const qc = useQueryClient()
  type DayHours = { open: string; close: string; closed: boolean }
  const [hours, setHours] = useState<Record<string, DayHours>>(() => {
    const base: Record<string, DayHours> = {}
    for (const day of DAYS_ORDER) {
      const existing = (clinic.operating_hours ?? {})[day]
      base[day] = existing
        ? { open: existing.open ?? '08:00', close: existing.close ?? '17:00', closed: false }
        : { open: '08:00', close: '17:00', closed: true }
    }
    return base
  })

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, { open: string; close: string }> = {}
      for (const [day, h] of Object.entries(hours)) {
        if (!h.closed) payload[day] = { open: h.open, close: h.close }
      }
      return api.put(`/clinics/${clinic.id}`, { operating_hours: payload })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-detail'] })
      onSaved()
    },
  })

  function update(day: string, field: 'open' | 'close' | 'closed', value: string | boolean) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Operating Hours</h3>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Set your opening and closing times for each day. Closed days won't appear in patient booking.</p>
      </div>

      <div className="space-y-2">
        {DAYS_ORDER.map(day => {
          const h = hours[day]
          return (
            <div
              key={day}
              className="flex items-center gap-4 rounded-xl px-4 py-3"
              style={{ backgroundColor: h.closed ? 'var(--color-surface-2)' : 'var(--color-surface)', border: h.closed ? 'none' : '1px solid var(--color-border)' }}
            >
              <div className="w-24 shrink-0">
                <p className="text-sm font-semibold" style={{ color: h.closed ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)' }}>
                  {DAY_LABELS[day]}
                </p>
              </div>

              {h.closed ? (
                <p className="flex-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Closed</p>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={h.open}
                    onChange={e => update(day, 'open', e.target.value)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand"
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>to</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={e => update(day, 'close', e.target.value)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand"
                  />
                </div>
              )}

              <button
                onClick={() => update(day, 'closed', !h.closed)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={h.closed
                  ? { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }
                  : { backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }
                }
              >
                {h.closed ? 'Open' : 'Close'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          {mutation.isPending ? 'Saving…' : 'Save Hours'}
        </button>
      </div>
    </div>
  )
}

// ─── Team tab ─────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  last_login_at: string | null
}

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  clinic_admin:         { label: 'Admin',        bg: 'var(--color-brand-light)',   color: 'var(--color-brand)' },
  clinic_doctor:        { label: 'Doctor',       bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  clinic_receptionist:  { label: 'Receptionist', bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  clinic_pharmacist:    { label: 'Pharmacist',   bg: 'var(--color-surface-2)',     color: 'var(--color-text-secondary)' },
}

function TeamTab() {
  const qc = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('clinic_doctor')

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ['clinic-staff'],
    queryFn: () => api.get('/dashboard/staff').then(r => r.data),
    staleTime: 60_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Team Members</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {isLoading ? 'Loading…' : `${staff.length} staff member${staff.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Invite Member
        </button>
      </div>

      {showInvite && (
        <div className="card p-5 space-y-4">
          <h4 className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>Invite New Team Member</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Email Address</label>
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@clinic.ke"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-brand"
              >
                <option value="clinic_doctor">Doctor</option>
                <option value="clinic_receptionist">Receptionist</option>
                <option value="clinic_pharmacist">Pharmacist</option>
                <option value="clinic_admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowInvite(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-bold hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-xl py-2 text-xs font-bold text-white opacity-70 cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-brand)' }}
              disabled
              title="Invite flow coming soon"
            >
              Send Invite (Coming Soon)
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Users className="h-8 w-8 mb-3" style={{ color: 'var(--color-border-strong)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No team members yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Invite staff to give them access to this clinic dashboard.
            </p>
          </div>
        ) : (
          staff.map((member, i) => {
            const badge = ROLE_BADGE[member.role] ?? ROLE_BADGE.clinic_doctor
            return (
              <div
                key={member.id}
                className={cn(
                  'flex items-center gap-4 px-5 py-4',
                  i < staff.length - 1 && 'border-b border-gray-50',
                )}
              >
                <div
                  className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                >
                  {member.full_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{member.full_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{member.email}</p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
                <div className="text-right shrink-0">
                  <span
                    className="block h-2 w-2 rounded-full mx-auto mb-1"
                    style={{ backgroundColor: member.is_active ? 'var(--color-success)' : 'var(--color-border-strong)' }}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Danger Zone tab ──────────────────────────────────────────────────────────

function DangerTab({ clinicName }: { clinicName: string }) {
  const [confirmName, setConfirmName] = useState('')
  const canDeactivate = confirmName === clinicName

  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-danger-light)' }}>
        <div className="px-5 py-4" style={{ backgroundColor: 'var(--color-danger-light)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>Danger Zone</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-danger)' }}>These actions are irreversible. Proceed with extreme caution.</p>
        </div>

        <div className="p-5 space-y-5 bg-white">
          {/* Deactivate */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Deactivate Clinic</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Your clinic will be hidden from patient search and booking will be disabled. Your data is preserved and you can reactivate at any time.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Type <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{clinicName}</span> to confirm
              </label>
              <input
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={clinicName}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger-light"
              />
            </div>
            <button
              disabled={!canDeactivate}
              className="w-full rounded-xl py-2.5 text-sm font-bold transition-all"
              style={canDeactivate
                ? { backgroundColor: 'var(--color-danger)', color: 'white' }
                : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)', cursor: 'not-allowed' }
              }
            >
              Deactivate Clinic
            </button>
          </div>

          <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />

          {/* Data export */}
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Export Clinic Data</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Download a complete export of your clinic data including appointments, patients, and analytics.
            </p>
            <button
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold hover:bg-gray-50 transition-colors opacity-60 cursor-not-allowed"
              style={{ color: 'var(--color-text-secondary)' }}
              disabled
              title="Coming soon"
            >
              Request Data Export (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClinicSettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [saved, setSaved] = useState(false)

  const { data: clinic, isLoading } = useQuery<ClinicDetail>({
    queryKey: ['clinic-detail'],
    queryFn: () => api.get(`/clinics/${user?.clinic_id}`).then(r => r.data),
    enabled: !!user?.clinic_id,
    staleTime: 120_000,
  })

  function handleSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (isLoading || !clinic) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 rounded-xl bg-gray-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{clinic.name}</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar nav */}
        <nav className="shrink-0 w-48 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all text-left',
                  activeTab === tab.key
                    ? tab.key === 'danger'
                      ? 'bg-danger-light text-danger'
                      : 'bg-brand-light text-brand'
                    : tab.key === 'danger'
                    ? 'text-danger hover:bg-danger-light'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{tab.label}</span>
                {activeTab === tab.key && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
              </button>
            )
          })}
        </nav>

        {/* Content panel */}
        <div className="flex-1 card p-6">
          {activeTab === 'general' && (
            <GeneralTab clinic={clinic} onSaved={handleSaved} />
          )}
          {activeTab === 'contact' && (
            <ContactTab clinic={clinic} onSaved={handleSaved} />
          )}
          {activeTab === 'hours' && (
            <HoursTab clinic={clinic} onSaved={handleSaved} />
          )}
          {activeTab === 'team' && <TeamTab />}
          {activeTab === 'danger' && <DangerTab clinicName={clinic.name} />}
        </div>
      </div>

      <SavedToast visible={saved} />
    </div>
  )
}
