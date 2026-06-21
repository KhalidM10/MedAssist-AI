import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Search, Stethoscope, BadgeCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { formatKES, cn } from '../../lib/utils'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SPECIALTIES = [
  'General Practice', 'Pediatrics', 'Gynecology & Obstetrics', 'Internal Medicine',
  'General Surgery', 'Dermatology', 'Orthopedics', 'Cardiology', 'Neurology',
  'Ophthalmology', 'ENT', 'Psychiatry', 'Radiology', 'Oncology', 'Urology',
]

interface DashboardDoctor {
  id: string
  full_name: string
  specialty: string
  qualification: string | null
  available_days: number[]
  consultation_fee_kes: number
  is_active: boolean
}

interface DoctorFormData {
  full_name: string
  specialty: string
  qualification: string
  bio: string
  consultation_fee_kes: number
}

function DoctorAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div
      style={{
        width: size, height: size,
        fontSize: size < 40 ? 12 : 15,
        backgroundColor: 'var(--color-brand-light)',
        color: 'var(--color-brand)',
      }}
      className="shrink-0 flex items-center justify-center rounded-xl font-bold"
    >
      {initials}
    </div>
  )
}

function DoctorCard({ doctor }: { doctor: DashboardDoctor }) {
  return (
    <div className="card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3.5">
        <DoctorAvatar name={doctor.full_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{doctor.full_name}</p>
            <span
              className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={doctor.is_active
                ? { backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }
                : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }
              }
            >
              {doctor.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-brand)' }}>{doctor.specialty}</p>
          {doctor.qualification && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{doctor.qualification}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Consultation</p>
          <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{formatKES(doctor.consultation_fee_kes)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Availability</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {doctor.available_days.length > 0 ? `${doctor.available_days.length} days/week` : 'Not set'}
          </p>
        </div>
      </div>

      {doctor.available_days.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {doctor.available_days.map(day => (
            <span
              key={day}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
            >
              {DAY_ABBR[day] ?? '?'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function AddDoctorModal({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const { register, handleSubmit, formState: { errors } } = useForm<DoctorFormData>({
    defaultValues: { consultation_fee_kes: 1500 },
  })

  const mutation = useMutation({
    mutationFn: (data: DoctorFormData) =>
      api.post(`/clinics/${clinicId}/doctors`, { ...data, available_days: selectedDays }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-doctors'] })
      onClose()
    },
  })

  function toggleDay(idx: number) {
    setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])
  }

  const inputBase = 'w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Add New Doctor</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Immediately available for patient bookings</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl transition-colors"
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(data => mutation.mutate(data))}
          className="p-6 space-y-4 overflow-y-auto max-h-[65vh]"
        >
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Full Name *</label>
            <input
              {...register('full_name', { required: 'Required' })}
              placeholder="Dr. Jane Kamau"
              className={cn(inputBase, 'border')}
              style={{ borderColor: errors.full_name ? 'var(--color-danger)' : 'var(--color-border)' }}
            />
            {errors.full_name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.full_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Specialty *</label>
              <select
                {...register('specialty', { required: 'Required' })}
                className={cn(inputBase, 'border cursor-pointer')}
                style={{ borderColor: errors.specialty ? 'var(--color-danger)' : 'var(--color-border)' }}
              >
                <option value="">Select…</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.specialty && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.specialty.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Qualification</label>
              <input
                {...register('qualification')}
                placeholder="MBChB, MMed"
                className={cn(inputBase, 'border')}
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Consultation Fee (KES)
            </label>
            <input
              type="number"
              {...register('consultation_fee_kes', { valueAsNumber: true, min: 0 })}
              className={cn(inputBase, 'border')}
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Professional Bio</label>
            <textarea
              {...register('bio')}
              placeholder="Brief professional background…"
              rows={2}
              className={cn(inputBase, 'border resize-none')}
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Available Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={selectedDays.includes(idx)
                    ? { backgroundColor: 'var(--color-brand)', color: 'white' }
                    : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {mutation.isError && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)' }}>
              Failed to add doctor. Please try again.
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              {mutation.isPending ? 'Adding…' : 'Add Doctor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ClinicDoctorsPage() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  const { data: doctors = [], isLoading } = useQuery<DashboardDoctor[]>({
    queryKey: ['clinic-doctors'],
    queryFn: () => api.get('/dashboard/doctors').then(r => r.data),
    staleTime: 60_000,
  })

  const filtered = doctors.filter(d =>
    !search ||
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty.toLowerCase().includes(search.toLowerCase()),
  )

  const activeCount = doctors.filter(d => d.is_active).length

  const STATS = [
    { label: 'Total',    val: doctors.length,               bg: 'var(--color-brand-light)',   color: 'var(--color-brand)' },
    { label: 'Active',   val: activeCount,                  bg: 'var(--color-success-light)', color: 'var(--color-success)' },
    { label: 'Inactive', val: doctors.length - activeCount, bg: 'var(--color-surface-2)',     color: 'var(--color-text-secondary)' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Doctors</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {activeCount} active · {doctors.length} total
          </p>
        </div>
        {user?.clinic_id && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: 'var(--color-brand)' }}
          >
            <Plus className="h-4 w-4" />
            Add Doctor
          </button>
        )}
      </div>

      {/* Search + stats row */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or specialty…"
            className="w-64 rounded-xl bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{ border: '1px solid var(--color-border)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-light)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
        <div className="flex gap-3 ml-auto">
          {STATS.map(s => (
            <div
              key={s.label}
              className="card px-4 py-2.5 text-center"
            >
              <p className="text-xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.val}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-48 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-brand-light)' }}>
            <Stethoscope className="h-7 w-7" style={{ color: 'var(--color-brand)' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
            {search ? 'No matching doctors' : 'No doctors yet'}
          </p>
          <p className="text-xs mt-1 max-w-[280px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {search
              ? 'Try a different name or specialty.'
              : 'Add your first doctor to enable patient bookings.'}
          </p>
          {!search && user?.clinic_id && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              <Plus className="h-4 w-4" /> Add Doctor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(doctor => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}

      {/* Verification note */}
      {doctors.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: 'var(--color-brand-light)', border: '1px solid var(--color-border)' }}>
          <BadgeCheck className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-brand)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>Doctor verification</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand)' }}>
              All doctors are visible to patients immediately after being added. Ensure credentials are verified before adding.
            </p>
          </div>
        </div>
      )}

      {showModal && user?.clinic_id && (
        <AddDoctorModal clinicId={user.clinic_id} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
