import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, ChevronDown, Search, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { formatKES } from '../../lib/utils'

interface DashboardAppointment {
  id: string
  patient_name: string
  appointment_date: string
  appointment_time: string
  status: string
  reason: string | null
  amount_kes: number
  booking_reference: string
  doctor_name: string | null
}

interface Doctor {
  id: string
  full_name: string
  specialty: string
}

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'var(--color-warning-light)', text: 'var(--color-warning)' },
  confirmed: { bg: 'var(--color-brand-light)',   text: 'var(--color-brand)' },
  completed: { bg: 'var(--color-success-light)', text: 'var(--color-success)' },
  cancelled: { bg: 'var(--color-surface-2)',     text: 'var(--color-text-tertiary)' },
}

const NEXT_ACTIONS: Record<string, { label: string; next: string; variant: 'brand' | 'success' | 'danger' }[]> = {
  pending:   [
    { label: 'Confirm', next: 'confirmed', variant: 'brand' },
    { label: 'Cancel',  next: 'cancelled', variant: 'danger' },
  ],
  confirmed: [
    { label: 'Complete', next: 'completed', variant: 'success' },
    { label: 'Cancel',   next: 'cancelled', variant: 'danger' },
  ],
  completed: [],
  cancelled: [],
}

const ACTION_STYLE: Record<'brand' | 'success' | 'danger', { bg: string; color: string; hoverBg: string }> = {
  brand:   { bg: 'var(--color-brand-light)',   color: 'var(--color-brand)',   hoverBg: 'var(--color-border)' },
  success: { bg: 'var(--color-success-light)', color: 'var(--color-success)', hoverBg: 'var(--color-border)' },
  danger:  { bg: 'var(--color-danger-light)',  color: 'var(--color-danger)',  hoverBg: 'var(--color-border)' },
}

export function ClinicAppointmentsPage() {
  const qc = useQueryClient()
  const [date, setDate] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const params: Record<string, string> = {}
  if (date) params.date = date
  if (doctorId) params.doctor_id = doctorId
  if (status) params.status = status

  const { data: appointments, isLoading, refetch } = useQuery<DashboardAppointment[]>({
    queryKey: ['clinic-appointments', date, doctorId, status],
    queryFn: () => api.get('/dashboard/appointments', { params: { ...params, limit: 200 } }).then(r => r.data),
  })

  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ['clinic-doctors'],
    queryFn: () => api.get('/dashboard/doctors').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.patch(`/dashboard/appointments/${id}/status`, null, { params: { status: newStatus } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-appointments'] })
      qc.invalidateQueries({ queryKey: ['clinic-stats'] })
    },
    onSettled: () => setUpdatingId(null),
  })

  const filtered = (appointments ?? []).filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.patient_name.toLowerCase().includes(q) ||
      (a.doctor_name ?? '').toLowerCase().includes(q) ||
      a.booking_reference.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Appointments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {filtered.length} appointment{filtered.length !== 1 ? 's' : ''} shown
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-[13px] font-medium transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--color-border)' }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search patient, doctor, reference…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-[13px] bg-transparent outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--color-border)' }}>
          <Calendar className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-[13px] bg-transparent outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {date && (
            <button onClick={() => setDate('')} className="ml-1 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>✕</button>
          )}
        </div>

        {/* Doctor */}
        <div className="relative flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--color-border)' }}>
          <select
            value={doctorId}
            onChange={e => setDoctorId(e.target.value)}
            className="text-[13px] bg-transparent outline-none pr-4 appearance-none cursor-pointer"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <option value="">All doctors</option>
            {(doctors ?? []).map(d => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          <ChevronDown className="h-3.5 w-3.5 absolute right-3 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
        </div>

        {/* Status */}
        <div className="relative flex items-center rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--color-border)' }}>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="text-[13px] bg-transparent outline-none pr-4 appearance-none cursor-pointer"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="h-3.5 w-3.5 absolute right-3 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-brand)', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-10 w-10 mb-3" style={{ color: 'var(--color-border)' }} />
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No appointments found</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Reference', 'Patient', 'Date & Time', 'Doctor', 'Reason', 'Amount', 'Status', 'Actions'].map(col => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(appt => {
                  const s = STATUS_STYLE[appt.status] ?? STATUS_STYLE.pending
                  const actions = NEXT_ACTIONS[appt.status] ?? []
                  const isUpdating = updatingId === appt.id

                  return (
                    <tr
                      key={appt.id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {appt.booking_reference}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{appt.patient_name}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{appt.appointment_date}</p>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{appt.appointment_time}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{appt.doctor_name ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3.5 max-w-[160px]">
                        <p className="text-[12px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{appt.reason ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatKES(appt.amount_kes)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full capitalize"
                          style={{ backgroundColor: s.bg, color: s.text }}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isUpdating ? (
                            <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-brand)', borderTopColor: 'transparent' }} />
                          ) : (
                            actions.map(({ label, next, variant }) => {
                              const ast = ACTION_STYLE[variant]
                              return (
                                <button
                                  key={next}
                                  onClick={() => {
                                    setUpdatingId(appt.id)
                                    mutation.mutate({ id: appt.id, newStatus: next })
                                  }}
                                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                                  style={{ backgroundColor: ast.bg, color: ast.color }}
                                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                >
                                  {label}
                                </button>
                              )
                            })
                          )}
                          {actions.length === 0 && (
                            <span className="text-[11px]" style={{ color: 'var(--color-border)' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
