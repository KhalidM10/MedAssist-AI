import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  GitMerge, CheckCircle2, XCircle, Clock, Building2,
  ChevronRight, User, Search, AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChangeRequest {
  id: string
  field_name: string
  current_value: string | null
  requested_value: string
  reason: string | null
  status: string
  created_at: string | null
  reviewed_at: string | null
  clinic_id: string
  clinic_name: string
  clinic_county: string
  requester_name: string | null
  requester_email: string | null
  reviewer_name: string | null
}

type Tab = 'pending' | 'approved' | 'rejected'

const TAB_CONFIG: { key: Tab; label: string; color: string }[] = [
  { key: 'pending',  label: 'Pending',  color: '#D97706' },
  { key: 'approved', label: 'Approved', color: '#059669' },
  { key: 'rejected', label: 'Rejected', color: '#DC2626' },
]

const FIELD_LABELS: Record<string, string> = {
  name:    'Clinic Name',
  address: 'Address',
  county:  'County',
  phone:   'Phone',
  email:   'Email',
  website: 'Website',
  description: 'Description',
}

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Inline reject form ────────────────────────────────────────────────────────

function RejectForm({ reqId, onDone }: { reqId: string; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const qc = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post(`/admin/change-requests/${reqId}/reject`, { reason }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-change-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-change-req-count'] })
      onDone()
    },
  })

  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
      <p className="text-xs font-medium text-red-700">Reason for rejection (required)</p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={2}
        placeholder="Explain why this change cannot be approved…"
        className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
      />
      <div className="flex gap-2">
        <button
          onClick={() => mutate()}
          disabled={!reason.trim() || isPending}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Rejecting…' : 'Confirm Rejection'}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Pending row ───────────────────────────────────────────────────────────────

function PendingRow({ req }: { req: ChangeRequest }) {
  const [showReject, setShowReject] = useState(false)
  const qc = useQueryClient()

  const approveMut = useMutation({
    mutationFn: () => api.post(`/admin/change-requests/${req.id}/approve`, {}).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-change-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-change-req-count'] })
    },
  })

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
              <Clock className="h-3 w-3" /> Pending
            </span>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              {fieldLabel(req.field_name)}
            </span>
          </div>
          <Link
            to={`/admin/clinics/${req.clinic_id}/review`}
            className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            <Building2 className="h-3.5 w-3.5" />
            {req.clinic_name}
            <span className="text-gray-400 font-normal">— {req.clinic_county}</span>
          </Link>
        </div>
        <time className="shrink-0 text-xs text-gray-400">
          {req.created_at ? formatDistanceToNow(parseISO(req.created_at), { addSuffix: true }) : '—'}
        </time>
      </div>

      {/* Value diff */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-red-50 border border-red-100 p-3">
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Current</p>
          <p className="text-gray-700 break-words">{req.current_value || <span className="text-gray-400 italic">empty</span>}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-100 p-3">
          <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1">Requested</p>
          <p className="text-gray-700 break-words font-medium">{req.requested_value}</p>
        </div>
      </div>

      {req.reason && (
        <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
          "{req.reason}"
        </p>
      )}

      {req.requester_name && (
        <p className="flex items-center gap-1 text-xs text-gray-400">
          <User className="h-3 w-3" /> {req.requester_name} · {req.requester_email}
        </p>
      )}

      {!showReject && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => approveMut.mutate()}
            disabled={approveMut.isPending}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {approveMut.isPending ? 'Applying…' : 'Approve Change'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      )}

      {showReject && <RejectForm reqId={req.id} onDone={() => setShowReject(false)} />}

      {approveMut.isError && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {(approveMut.error as any)?.message || 'Failed to approve'}
        </p>
      )}
    </div>
  )
}

// ── Resolved row ──────────────────────────────────────────────────────────────

function ResolvedRow({ req }: { req: ChangeRequest }) {
  const approved = req.status === 'approved'
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                approved
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}
            >
              {approved ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {approved ? 'Approved' : 'Rejected'}
            </span>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              {fieldLabel(req.field_name)}
            </span>
          </div>
          <Link
            to={`/admin/clinics/${req.clinic_id}/review`}
            className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-brand"
          >
            <Building2 className="h-3.5 w-3.5" />
            {req.clinic_name}
            <ChevronRight className="h-3 w-3 text-gray-400" />
          </Link>
        </div>
        <time className="shrink-0 text-xs text-gray-400">
          {req.reviewed_at ? formatDistanceToNow(parseISO(req.reviewed_at), { addSuffix: true }) : '—'}
        </time>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Was</p>
          <p className="text-gray-600 break-words">{req.current_value || <span className="italic">empty</span>}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Requested</p>
          <p className="text-gray-700 break-words">{req.requested_value}</p>
        </div>
      </div>

      {req.reviewer_name && (
        <p className="text-xs text-gray-400">
          Reviewed by <span className="font-medium text-gray-600">{req.reviewer_name}</span>
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminChangeRequestsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')

  const { data = [], isLoading } = useQuery<ChangeRequest[]>({
    queryKey: ['admin-change-requests', tab],
    queryFn: () => api.get('/admin/change-requests', { params: { status: tab } }).then(r => r.data),
    refetchInterval: tab === 'pending' ? 30_000 : false,
  })

  const filtered = data.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      r.clinic_name.toLowerCase().includes(s) ||
      r.field_name.toLowerCase().includes(s) ||
      (r.requested_value?.toLowerCase() ?? '').includes(s)
    )
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GitMerge className="h-6 w-6 text-brand" />
          Change Requests
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Clinic admins requesting updates to locked fields (name, address, etc.)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {TAB_CONFIG.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="rounded-lg px-4 py-1.5 text-sm font-medium transition-all"
            style={
              tab === key
                ? { background: '#fff', color, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                : { color: '#6B7280' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by clinic or field…"
          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <GitMerge className="h-10 w-10 text-gray-300 mb-3" />
          <p className="font-semibold text-gray-500">No {tab} requests</p>
          <p className="text-sm text-gray-400 mt-1">
            {tab === 'pending'
              ? 'All caught up — no requests awaiting review.'
              : `No ${tab} requests to show.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req =>
            tab === 'pending'
              ? <PendingRow key={req.id} req={req} />
              : <ResolvedRow key={req.id} req={req} />
          )}
        </div>
      )}
    </div>
  )
}
