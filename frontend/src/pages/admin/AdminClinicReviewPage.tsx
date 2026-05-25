import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, Building2, User, Mail, Phone, MapPin,
  FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  Calendar, Hash, Globe, Stethoscope,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClinicReviewDetail {
  id: string
  name: string
  county: string
  sub_county: string | null
  address: string
  phone: string
  email: string
  website: string | null
  description: string | null
  license_number: string | null
  business_registration_number: string | null
  year_established: number | null
  specialties: string[]
  operating_hours: Record<string, { open: string; close: string }>
  is_verified: boolean
  is_active: boolean
  approval_status: string
  approval_notes: string | null
  registration_reference: string | null
  submitted_at: string | null
  approved_at: string | null
  documents: { type: string; filename: string; uploaded_at?: string }[]
  subscription_plan: string
  doctor_count: number
  appointment_count: number
  created_at: string
  owner: {
    id: string | null
    full_name: string | null
    email: string | null
    phone: string | null
    is_active: boolean | null
    is_clinic_approved: boolean | null
    created_at: string | null
  }
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}
const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DOC_LABELS: Record<string, string> = {
  medical_license: 'Medical License',
  business_registration: 'Business Registration',
  kra_pin: 'KRA PIN Certificate',
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg: '#FFFBEB', color: '#D97706', label: 'Pending Review' },
    approved:  { bg: '#ECFDF5', color: '#059669', label: 'Approved' },
    rejected:  { bg: '#FEF2F2', color: '#DC2626', label: 'Rejected' },
    suspended: { bg: '#F9FAFB', color: '#6B7280', label: 'Suspended' },
  }
  const c = cfg[status] ?? cfg.pending
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdminClinicReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [approveNotes, setApproveNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [actionDone, setActionDone] = useState<'approved' | 'rejected' | null>(null)

  const { data: clinic, isLoading, error } = useQuery<ClinicReviewDetail>({
    queryKey: ['admin-clinic-detail', id],
    queryFn: () => api.get(`/admin/clinics/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const approve = useMutation({
    mutationFn: () => api.post(`/admin/clinics/${id}/approve`, { notes: approveNotes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clinic-detail', id] })
      qc.invalidateQueries({ queryKey: ['admin-clinics'] })
      setActionDone('approved')
    },
  })

  const reject = useMutation({
    mutationFn: () => api.post(`/admin/clinics/${id}/reject`, { reason: rejectReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clinic-detail', id] })
      qc.invalidateQueries({ queryKey: ['admin-clinics'] })
      setActionDone('rejected')
    },
  })

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-gray-100" />
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3 h-96 rounded-2xl bg-gray-100" />
          <div className="col-span-2 h-64 rounded-2xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (error || !clinic) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Clinic not found.</p>
        <Link to="/admin/clinics" className="text-sm font-semibold mt-2 inline-block" style={{ color: '#1D4ED8' }}>
          ← Back to Clinics
        </Link>
      </div>
    )
  }

  const isPending = clinic.approval_status === 'pending'
  const canAct = isPending || clinic.approval_status === 'rejected'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/clinics')}
          className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <ChevronLeft className="h-4 w-4" /> Clinics
        </button>
        <div className="h-4 w-px" style={{ backgroundColor: 'var(--color-border)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
          {clinic.name}
        </h1>
        <StatusBadge status={clinic.approval_status} />
        {clinic.registration_reference && (
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
            {clinic.registration_reference}
          </span>
        )}
      </div>

      {/* Success banner */}
      {actionDone && (
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-4"
          style={{ backgroundColor: actionDone === 'approved' ? '#ECFDF5' : '#FEF2F2' }}
        >
          {actionDone === 'approved'
            ? <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#059669' }} />
            : <XCircle className="h-5 w-5 shrink-0" style={{ color: '#DC2626' }} />
          }
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: actionDone === 'approved' ? '#065F46' : '#991B1B' }}>
              {actionDone === 'approved' ? 'Application approved' : 'Application rejected'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: actionDone === 'approved' ? '#059669' : '#DC2626' }}>
              {actionDone === 'approved'
                ? 'The clinic is now live and the admin account has been activated.'
                : 'The clinic admin has been notified with the rejection reason.'}
            </p>
          </div>
          <Link
            to="/admin/clinics"
            className="text-xs font-bold underline"
            style={{ color: actionDone === 'approved' ? '#059669' : '#DC2626' }}
          >
            Back to list
          </Link>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Left: clinic & admin details */}
        <div className="col-span-3 space-y-5">

          {/* Admin account */}
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
              Clinic Admin Account
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow icon={User}  label="Full Name" value={clinic.owner.full_name} />
              <InfoRow icon={Mail}  label="Email"     value={clinic.owner.email} />
              <InfoRow icon={Phone} label="Phone"     value={clinic.owner.phone} />
              <InfoRow icon={Clock} label="Registered" value={clinic.owner.created_at ? format(parseISO(clinic.owner.created_at), 'dd MMM yyyy') : undefined} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={clinic.owner.is_active
                  ? { backgroundColor: '#ECFDF5', color: '#059669' }
                  : { backgroundColor: '#FEF2F2', color: '#DC2626' }
                }
              >
                {clinic.owner.is_active ? 'Account active' : 'Account inactive (pending approval)'}
              </span>
            </div>
          </div>

          {/* Clinic details */}
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
              Clinic Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow icon={Building2} label="Clinic Name"    value={clinic.name} />
              <InfoRow icon={MapPin}    label="County"         value={[clinic.county, clinic.sub_county].filter(Boolean).join(', ')} />
              <InfoRow icon={MapPin}    label="Address"        value={clinic.address} />
              <InfoRow icon={Phone}     label="Clinic Phone"   value={clinic.phone} />
              <InfoRow icon={Mail}      label="Clinic Email"   value={clinic.email} />
              <InfoRow icon={Globe}     label="Website"        value={clinic.website} />
              <InfoRow icon={Hash}      label="License No."    value={clinic.license_number} />
              <InfoRow icon={Hash}      label="Business Reg."  value={clinic.business_registration_number} />
              <InfoRow icon={Calendar}  label="Est. Year"      value={clinic.year_established?.toString()} />
              {clinic.submitted_at && (
                <InfoRow icon={Clock} label="Submitted" value={format(parseISO(clinic.submitted_at), 'dd MMM yyyy, HH:mm')} />
              )}
            </div>

            {clinic.description && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Description</p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{clinic.description}</p>
              </div>
            )}

            {clinic.specialties.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {clinic.specialties.map(s => (
                    <span
                      key={s}
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Operating hours */}
          {Object.keys(clinic.operating_hours).length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
                Operating Hours
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {DAYS_ORDER.map(day => {
                  const h = clinic.operating_hours[day]
                  return (
                    <div key={day} className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                        {DAY_LABELS[day]}
                      </span>
                      {h ? (
                        <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
                          {h.open} – {h.close}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Closed</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
              Submitted Documents
            </h3>
            {clinic.documents.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No documents submitted.</p>
            ) : (
              <div className="space-y-3">
                {clinic.documents.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ backgroundColor: 'var(--color-surface-2)' }}
                  >
                    <FileText className="h-5 w-5 shrink-0" style={{ color: '#1D4ED8' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {DOC_LABELS[doc.type] ?? doc.type}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{doc.filename}</p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
                    >
                      Uploaded
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: action panel */}
        <div className="col-span-2 space-y-4">
          <div
            className="rounded-3xl p-5 space-y-5 sticky top-6"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Review Decision</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                Current status: <StatusBadge status={clinic.approval_status} />
              </p>
            </div>

            {!actionDone && canAct && (
              <>
                {/* Approve */}
                {!showRejectForm && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                        Approval Notes <span className="font-normal" style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span>
                      </label>
                      <textarea
                        value={approveNotes}
                        onChange={e => setApproveNotes(e.target.value)}
                        rows={3}
                        placeholder="Welcome message or internal notes…"
                        className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-500"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                      />
                    </div>
                    <button
                      onClick={() => approve.mutate()}
                      disabled={approve.isPending}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#059669' }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {approve.isPending ? 'Approving…' : 'Approve Application'}
                    </button>
                  </div>
                )}

                <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />

                {/* Reject */}
                {!showRejectForm ? (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all hover:opacity-90"
                    style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject Application
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" style={{ color: '#DC2626' }} />
                      <p className="text-sm font-bold" style={{ color: '#DC2626' }}>Rejection Reason</p>
                    </div>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={4}
                      placeholder="Explain why this application is being rejected. This will be shared with the applicant…"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-red-400"
                      style={{ borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', color: 'var(--color-text-primary)' }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold border transition-colors"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => reject.mutate()}
                        disabled={reject.isPending || !rejectReason.trim()}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#DC2626' }}
                      >
                        {reject.isPending ? 'Rejecting…' : 'Confirm Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Already actioned */}
            {(actionDone || !canAct) && (
              <div className="text-center py-4">
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  {clinic.approval_status === 'approved' && 'This clinic is approved and live on the platform.'}
                  {clinic.approval_status === 'suspended' && 'This clinic is currently suspended.'}
                  {actionDone === 'approved' && 'Application has been approved.'}
                  {actionDone === 'rejected' && 'Application has been rejected.'}
                </p>
              </div>
            )}

            {/* Approve/reject error */}
            {(approve.isError || reject.isError) && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-700 bg-red-50">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {(approve.error as any)?.response?.data?.detail ?? (reject.error as any)?.response?.data?.detail ?? 'Action failed'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
