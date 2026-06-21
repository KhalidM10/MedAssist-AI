import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronRight,
  Download, Edit2, Mail, MapPin, Phone, Save, Shield,
  Stethoscope, Trash2, User, X, XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import type { Patient } from '../types'

const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu',
  'Machakos','Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',
  "Murang'a",'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua',
  'Nyeri','Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi',
  'Trans-Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
]

const BLOOD_TYPES = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown']

const COMMON_ALLERGIES = [
  'Penicillin', 'Sulfa drugs', 'Aspirin', 'NSAIDs', 'Latex',
  'Peanuts', 'Tree nuts', 'Shellfish', 'Eggs', 'Milk', 'Wheat', 'Soy',
]

const CHRONIC_CONDITIONS = [
  'Diabetes', 'Hypertension', 'Asthma', 'Heart disease', 'COPD',
  'HIV/AIDS', 'Epilepsy', 'Sickle cell', 'Kidney disease',
  'Thyroid disorder', 'Immunocompromised',
]

const inputClass = `
  w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900
  placeholder:text-gray-400 outline-none transition-all
  focus:border-blue-500 focus:ring-2 focus:ring-blue-100
`

type SectionVariant = 'brand' | 'success' | 'warning' | 'danger'

const SECTION_VAR: Record<SectionVariant, { bg: string; color: string }> = {
  brand:   { bg: 'var(--color-brand-light)',   color: 'var(--color-brand)' },
  success: { bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  danger:  { bg: 'var(--color-danger-light)',  color: 'var(--color-danger)' },
}

function SectionHeader({ icon: Icon, title, subtitle, variant = 'brand' }: {
  icon: React.ElementType; title: string; subtitle?: string; variant?: SectionVariant
}) {
  const { bg, color } = SECTION_VAR[variant]
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="h-[18px] w-[18px]" style={{ color }} />
      </div>
      <div>
        <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{subtitle}</p>}
      </div>
    </div>
  )
}

function TagInput({
  value, onChange, suggestions, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)

  function add(tag: string) {
    const t = tag.trim()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setDraft('')
    setShowSuggest(false)
  }

  const filtered = (suggestions ?? []).filter(
    s => !value.includes(s) && s.toLowerCase().includes(draft.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {value.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-border)' }}
          >
            {tag}
            <button onClick={() => onChange(value.filter(t => t !== tag))} className="hover:opacity-60 transition-opacity">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          className={inputClass}
          value={draft}
          onChange={e => { setDraft(e.target.value); setShowSuggest(true) }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(draft) } }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          placeholder={placeholder ?? 'Type and press Enter…'}
        />
        {showSuggest && filtered.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {filtered.slice(0, 6).map(s => (
              <button
                key={s}
                onMouseDown={() => add(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DeleteAccountModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [input, setInput] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ border: '1px solid var(--color-danger-light)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-danger-light)' }}>
            <Trash2 className="h-5 w-5" style={{ color: 'var(--color-danger)' }} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Delete your account?</h3>
        <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          This action is irreversible. All your data — appointments, triage history, and health records — will be permanently deleted.
        </p>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Type <strong>DELETE</strong> to confirm:</p>
        <input
          className={inputClass + ' mb-4'}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="DELETE"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={input !== 'DELETE'}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-danger)' }}
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  )
}

export function HealthProfilePage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery<Patient>({
    queryKey: ['patient-profile'],
    queryFn: async () => {
      const { data } = await api.get('/patients/me')
      return data
    },
  })

  const [editPersonal, setEditPersonal] = useState(false)
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [county, setCounty] = useState('')

  const [editHealth, setEditHealth] = useState(false)
  const [allergies, setAllergies] = useState<string[]>([])
  const [conditions, setConditions] = useState<string[]>([])
  const [bloodType, setBloodType] = useState('Unknown')

  const [editEmergency, setEditEmergency] = useState(false)
  const [ecName, setEcName] = useState('')
  const [ecPhone, setEcPhone] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name ?? '')
    setDob(profile.date_of_birth ?? '')
    setGender(profile.gender ?? '')
    setCounty(profile.county ?? '')
    setAllergies(profile.allergies ?? [])
    setConditions(profile.chronic_conditions ?? [])
    setEcName(profile.emergency_contact_name ?? '')
    setEcPhone(profile.emergency_contact_phone ?? '')
  }, [profile])

  const { mutateAsync: saveProfile, isPending: saving } = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put('/patients/me', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-profile'] })
    },
  })

  async function savePersonal() {
    await saveProfile({ full_name: fullName, date_of_birth: dob || null, gender: gender || null, county: county || null })
    setEditPersonal(false)
    showSaved('Personal info saved')
  }

  async function saveHealth() {
    await saveProfile({ allergies, chronic_conditions: conditions })
    setEditHealth(false)
    showSaved('Health info saved')
  }

  async function saveEmergency() {
    await saveProfile({ emergency_contact_name: ecName || null, emergency_contact_phone: ecPhone || null })
    setEditEmergency(false)
    showSaved('Emergency contact saved')
  }

  function showSaved(msg: string) {
    setSaved(msg)
    setTimeout(() => setSaved(null), 3000)
  }

  function downloadData() {
    const blob = new Blob([JSON.stringify({ profile, user }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medassist-health-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleDeleteAccount() {
    logout()
    navigate('/')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-40 animate-pulse" />
        ))}
      </div>
    )
  }

  const initials = (user?.full_name ?? 'U').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  return (
    <div className="space-y-6 animate-fade-in pb-8">

      {/* ── Success toast ─────────────────────────────────────── */}
      {saved && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ backgroundColor: 'var(--color-success)' }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {saved}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>My Health Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Manage your personal health information.</p>
      </div>

      {/* ── Profile card ─────────────────────────────────────── */}
      <div className="card p-5 flex items-center gap-4">
        <div
          className="h-16 w-16 shrink-0 rounded-full flex items-center justify-center text-2xl font-black text-white"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{user?.full_name}</h2>
          <div className="flex items-center gap-1 mt-0.5">
            <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
            <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{user?.email}</span>
          </div>
          {user?.phone && (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{user.phone}</span>
            </div>
          )}
        </div>
        {profile?.county && (
          <div className="flex items-center gap-1 shrink-0">
            <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{profile.county}</span>
          </div>
        )}
      </div>

      {/* ── Personal Info ─────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-5">
          <SectionHeader icon={User} title="Personal Information" subtitle="Your basic details" />
          {!editPersonal && (
            <button
              onClick={() => setEditPersonal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        {!editPersonal ? (
          <div className="space-y-3">
            {[
              { label: 'Full Name', value: profile?.full_name || '—' },
              { label: 'Date of Birth', value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
              { label: 'Gender', value: profile?.gender || '—' },
              { label: 'County', value: profile?.county || '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 last:border-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{row.label}</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Full Name</label>
              <input className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Date of Birth</label>
                <input type="date" className={inputClass} value={dob} onChange={e => setDob(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Gender</label>
                <select className={inputClass + ' cursor-pointer'} value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">Select…</option>
                  {['Male', 'Female', 'Other', 'Prefer not to say'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>County</label>
              <select className={inputClass + ' cursor-pointer'} value={county} onChange={e => setCounty(e.target.value)}>
                <option value="">Select county…</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditPersonal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePersonal}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-brand)' }}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Health Info ───────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-5">
          <SectionHeader icon={Stethoscope} title="Health Information" subtitle="Allergies & conditions" variant="success" />
          {!editHealth && (
            <button
              onClick={() => setEditHealth(true)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        {!editHealth ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Blood Type</p>
              <span
                className="inline-block text-sm font-bold rounded-full px-3 py-1"
                style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}
              >
                {bloodType}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Allergies</p>
              {allergies.length === 0
                ? <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>None recorded</p>
                : (
                  <div className="flex flex-wrap gap-1.5">
                    {allergies.map(a => (
                      <span key={a} className="text-xs font-semibold rounded-full px-3 py-1" style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                        {a}
                      </span>
                    ))}
                  </div>
                )
              }
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Pre-existing Conditions</p>
              {conditions.length === 0
                ? <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>None recorded</p>
                : (
                  <div className="flex flex-wrap gap-1.5">
                    {conditions.map(c => (
                      <span key={c} className="text-xs font-semibold rounded-full px-3 py-1" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Blood Type</label>
              <div className="flex flex-wrap gap-2">
                {BLOOD_TYPES.map(bt => (
                  <button
                    key={bt}
                    onClick={() => setBloodType(bt)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
                    style={bloodType === bt
                      ? { backgroundColor: 'var(--color-danger)', color: 'white', borderColor: 'var(--color-danger)' }
                      : { backgroundColor: 'white', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }
                    }
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Allergies</label>
              <TagInput value={allergies} onChange={setAllergies} suggestions={COMMON_ALLERGIES} placeholder="Add allergy…" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Pre-existing Conditions</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {CHRONIC_CONDITIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition-all"
                    style={conditions.includes(c)
                      ? { backgroundColor: 'var(--color-brand)', color: 'white', borderColor: 'var(--color-brand)' }
                      : { backgroundColor: 'white', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditHealth(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveHealth}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-success)' }}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save health info'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Emergency Contact ─────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-5">
          <SectionHeader icon={Phone} title="Emergency Contact" subtitle="Who to call if you're incapacitated" variant="warning" />
          {!editEmergency && (
            <button
              onClick={() => setEditEmergency(true)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        {!editEmergency ? (
          <div className="space-y-3">
            {[
              { label: 'Name', value: profile?.emergency_contact_name || '—' },
              { label: 'Phone', value: profile?.emergency_contact_phone || '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 last:border-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{row.label}</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Contact Name</label>
              <input className={inputClass} value={ecName} onChange={e => setEcName(e.target.value)} placeholder="e.g. Jane Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Phone Number</label>
              <input className={inputClass} value={ecPhone} onChange={e => setEcPhone(e.target.value)} placeholder="e.g. 0712 345 678" type="tel" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditEmergency(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEmergency}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-warning)' }}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save contact'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Account & Security ───────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader icon={Shield} title="Account & Security" />
        <div className="space-y-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          {[
            {
              label: 'Active Sessions', sub: 'Manage devices logged in to your account',
              icon: Shield, onClick: () => navigate('/sessions'),
            },
            {
              label: 'Change Password', sub: 'Update your account password',
              icon: Shield, onClick: () => navigate('/forgot-password'),
            },
          ].map(({ label, sub, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center justify-between gap-4 py-3.5 text-left transition-colors rounded-xl px-1 -mx-1"
              style={{ borderBottom: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--color-border-strong)' }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Data & Privacy ─────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader icon={Download} title="Data & Privacy" subtitle="Your health data belongs to you" />
        <div className="space-y-3">
          <button
            onClick={downloadData}
            className="w-full flex items-center gap-3 rounded-xl p-4 text-left transition-colors"
            style={{ border: '1px solid var(--color-border)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)' }}>
              <Download className="h-[18px] w-[18px]" style={{ color: 'var(--color-brand)' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Download my health data</p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>JSON export of all your records</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--color-border-strong)' }} />
          </button>
        </div>
      </div>

      {/* ── Danger Zone ──────────────────────────────────────── */}
      <div className="card p-5" style={{ border: '1px solid var(--color-danger-light)' }}>
        <SectionHeader icon={AlertTriangle} title="Danger Zone" subtitle="Irreversible actions" variant="danger" />
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full flex items-center gap-3 rounded-xl p-4 text-left transition-all"
          style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-light)' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-danger-light)' }}>
            <Trash2 className="h-[18px] w-[18px]" style={{ color: 'var(--color-danger)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>Delete my account</p>
            <p className="text-xs" style={{ color: 'var(--color-danger)' }}>Permanently delete all your data</p>
          </div>
          <XCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--color-danger)' }} />
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
        />
      )}

    </div>
  )
}
