import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Building2, Search, Eye, CheckCircle2, XCircle,
  Pause, Play, ChevronRight, Clock, MapPin, AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminClinic {
  id: string
  name: string
  county: string
  address: string
  phone: string
  email: string
  owner_name: string
  owner_email: string
  owner_phone: string
  is_verified: boolean
  is_active: boolean
  approval_status: string
  approval_notes: string | null
  registration_reference: string | null
  submitted_at: string | null
  approved_at: string | null
  subscription_plan: string
  license_number: string | null
  business_registration_number: string | null
  year_established: number | null
  mrr_kes: number
  total_revenue_kes: number
  doctor_count: number
  specialties: string[]
  documents: { type: string; filename: string }[]
  created_at: string
}

type Tab = 'pending' | 'approved' | 'rejected' | 'suspended'

const TAB_CONFIG: { key: Tab; label: string; activeColor: string }[] = [
  { key: 'pending',   label: 'Pending Review', activeColor: '#D97706' },
  { key: 'approved',  label: 'Approved',        activeColor: '#059669' },
  { key: 'rejected',  label: 'Rejected',        activeColor: '#DC2626' },
  { key: 'suspended', label: 'Suspended',       activeColor: '#6B7280' },
]

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, danger,
  onConfirm, onCancel, loading,
  requireReason, reasonPlaceholder,
}: {
  title: string; message: string; confirmLabel: string; danger?: boolean
  onConfirm: (reason?: string) => void; onCancel: () => void; loading: boolean
  requireReason?: boolean; reasonPlaceholder?: string
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{ backgroundColor: danger ? '#FEF2F2' : '#ECFDF5' }}
          >
            {danger
              ? <AlertCircle className="h-5 w-5" style={{ color: '#DC2626' }} />
              : <CheckCircle2 className="h-5 w-5" style={{ color: '#059669' }} />
            }
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
          </div>
        </div>
        {requireReason && (
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder={reasonPlaceholder ?? 'Enter reason…'}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-500"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
          />
        )}
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold border transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason || undefined)}
            disabled={loading || (requireReason && !reason.trim())}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: danger ? '#DC2626' : '#059669' }}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row components ────────────────────────────────────────────────────────────

function PendingRow({ clinic }: { clinic: AdminClinic }) {
  return (
    <div
      className="flex items-start gap-4 px-5 py-4 border-b last:border-b-0 transition-colors hover:bg-amber-50/30"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: '#D97706' }}
      >
        {clinic.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{clinic.name}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <MapPin className="h-3 w-3" />{clinic.county}
              </span>
              {clinic.registration_reference && (
                <span className="text-xs font-mono font-bold" style={{ color: '#D97706' }}>
                  {clinic.registration_reference}
                </span>
              )}
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}
          >
            Pending
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1.5">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {clinic.owner_email || clinic.email}
          </span>
          {clinic.submitted_at && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(parseISO(clinic.submitted_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
      <Link
        to={`/admin/clinics/${clinic.id}/review`}
        className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90"
        style={{ backgroundColor: '#1D4ED8' }}
      >
        Review <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function ApprovedRow({ clinic, onSuspend }: { clinic: AdminClinic; onSuspend: () => void }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0 transition-colors hover:bg-gray-50/30"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: '#059669' }}
      >
        {clinic.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{clinic.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{clinic.county}</span>
          <span className="text-xs capitalize" style={{ color: 'var(--color-text-tertiary)' }}>{clinic.subscription_plan}</span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{clinic.doctor_count} doctor{clinic.doctor_count !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
          KES {clinic.mrr_kes.toLocaleString()}/mo
        </p>
        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>MRR</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/admin/clinics/${clinic.id}/review`}
          className="rounded-xl border p-2 transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          title="View details"
        >
          <Eye className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={onSuspend}
          className="rounded-xl border p-2 transition-colors"
          style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
          title="Suspend"
        >
          <Pause className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function RejectedRow({ clinic }: { clinic: AdminClinic }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
      >
        {clinic.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{clinic.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          {clinic.county} · {clinic.owner_email || clinic.email}
        </p>
        {clinic.approval_notes && (
          <p className="text-xs mt-1 line-clamp-1" style={{ color: '#DC2626' }}>
            Reason: {clinic.approval_notes}
          </p>
        )}
      </div>
      <Link
        to={`/admin/clinics/${clinic.id}/review`}
        className="shrink-0 flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors hover:bg-gray-50"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
      >
        Re-review <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function SuspendedRow({ clinic, onReactivate }: { clinic: AdminClinic; onReactivate: () => void }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: '#F9FAFB', color: '#6B7280' }}
      >
        {clinic.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{clinic.name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          {clinic.county} · {clinic.email}
        </p>
        {clinic.approval_notes && (
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Suspension reason: {clinic.approval_notes}
          </p>
        )}
      </div>
      <button
        onClick={onReactivate}
        className="shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all hover:opacity-90"
        style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
      >
        <Play className="h-3.5 w-3.5" /> Reactivate
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdminClinicsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const [suspendTarget, setSuspendTarget] = useState<AdminClinic | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<AdminClinic | null>(null)

  const { data: clinics = [], isLoading } = useQuery<AdminClinic[]>({
    queryKey: ['admin-clinics', activeTab],
    queryFn: () => api.get('/admin/clinics', { params: { status: activeTab } }).then(r => r.data),
    staleTime: 30_000,
  })

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/admin/clinics/${id}/suspend`, { reason: reason ?? 'Admin action' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-clinics'] }); setSuspendTarget(null) },
  })

  const reactivate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/clinics/${id}/reactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-clinics'] }); setReactivateTarget(null) },
  })

  const filtered = clinics.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.county.toLowerCase().includes(search.toLowerCase()) ||
    (c.owner_email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
          Clinic Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Review applications, manage approved clinics, and handle moderation.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ backgroundColor: 'var(--color-surface-2)' }}>
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch('') }}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all"
            style={activeTab === tab.key
              ? { backgroundColor: 'var(--color-surface)', color: tab.activeColor, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: 'var(--color-text-tertiary)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${activeTab} clinics…`}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--color-text-tertiary)' }}>
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl" style={{ backgroundColor: 'var(--color-surface-2)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Building2 className="h-10 w-10 mb-3" style={{ color: 'var(--color-border-strong)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              {search ? 'No clinics match your search' : `No ${activeTab} clinics`}
            </p>
            {activeTab === 'pending' && !search && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                New applications will appear here for review.
              </p>
            )}
          </div>
        ) : (
          <>
            {activeTab === 'pending'   && filtered.map(c => <PendingRow   key={c.id} clinic={c} />)}
            {activeTab === 'approved'  && filtered.map(c => <ApprovedRow  key={c.id} clinic={c} onSuspend={() => setSuspendTarget(c)} />)}
            {activeTab === 'rejected'  && filtered.map(c => <RejectedRow  key={c.id} clinic={c} />)}
            {activeTab === 'suspended' && filtered.map(c => <SuspendedRow key={c.id} clinic={c} onReactivate={() => setReactivateTarget(c)} />)}
          </>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {filtered.length} clinic{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {suspendTarget && (
        <ConfirmModal
          title={`Suspend ${suspendTarget.name}?`}
          message="This clinic will be hidden from patients and the admin will lose access immediately."
          confirmLabel="Suspend Clinic"
          danger requireReason
          reasonPlaceholder="Reason for suspension (required)…"
          loading={suspend.isPending}
          onConfirm={reason => suspend.mutate({ id: suspendTarget.id, reason })}
          onCancel={() => setSuspendTarget(null)}
        />
      )}

      {reactivateTarget && (
        <ConfirmModal
          title={`Reactivate ${reactivateTarget.name}?`}
          message="This clinic will become visible to patients and the clinic admin can log in again."
          confirmLabel="Reactivate"
          loading={reactivate.isPending}
          onConfirm={() => reactivate.mutate(reactivateTarget.id)}
          onCancel={() => setReactivateTarget(null)}
        />
      )}
    </div>
  )
}
