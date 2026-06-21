import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, CheckCircle, Download, Filter,
  RefreshCw, Search, ShieldAlert, XCircle,
  Clock, Globe, Monitor, Smartphone, Tablet, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { api } from '../../lib/api'
import { usePermissions } from '../../contexts/PermissionContext'
import { cn } from '../../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  event_id: string
  created_at: string
  user_email: string | null
  user_role: string | null
  clinic_name: string | null
  action: string
  resource_type: string
  resource_id: string | null
  old_values: unknown
  new_values: unknown
  changed_fields: string[] | null
  ip_address: string
  country: string | null
  city: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  http_method: string | null
  api_endpoint: string | null
  duration_ms: number | null
  status: 'success' | 'failure' | 'blocked'
  failure_reason: string | null
  risk_score: number
  flags: string[] | null
  request_id: string
  session_id: string | null
}

interface AuditPage {
  items: AuditLog[]
  total: number
  page: number
  page_size: number
  pages: number
}

interface AuditStats {
  total: number
  success: number
  failure: number
  blocked: number
  high_risk: number
  top_actions: { action: string; count: number }[]
  top_users: { email: string; count: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-KE', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    success: { bg: 'var(--color-success-light)', color: 'var(--color-success)', icon: CheckCircle },
    failure: { bg: 'var(--color-danger-light)',  color: 'var(--color-danger)',  icon: XCircle },
    blocked: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', icon: AlertTriangle },
  }[status] ?? { bg: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)', icon: Clock }
  const Icon = cfg.icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}

function RiskBadge({ score }: { score: number }) {
  if (score < 30) return null
  const style = score >= 70
    ? { backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-light)' }
    : { backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-light)' }
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={style}>
      {score >= 70 ? '⚠ HIGH' : score}
    </span>
  )
}

function DeviceIcon({ type }: { type: string | null }) {
  const cls = 'h-3.5 w-3.5'
  const style = { color: 'var(--color-text-tertiary)' }
  if (type === 'mobile') return <Smartphone className={cls} style={style} />
  if (type === 'tablet') return <Tablet className={cls} style={style} />
  return <Monitor className={cls} style={style} />
}

function ActionBadge({ action }: { action: string }) {
  const parts = action.split('.')
  const resource = parts[0]
  const styles: Record<string, { bg: string; color: string }> = {
    auth:        { bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
    appointment: { bg: 'var(--color-brand-light)',   color: 'var(--color-brand)' },
    patient:     { bg: 'var(--color-success-light)', color: 'var(--color-success)' },
    order:       { bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
    permission:  { bg: 'var(--color-danger-light)',  color: 'var(--color-danger)' },
    users:       { bg: 'var(--color-brand-light)',   color: 'var(--color-brand)' },
    clinic:      { bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  }
  const s = styles[resource] ?? { bg: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-mono font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
      {action}
    </span>
  )
}

// ── Event detail modal ────────────────────────────────────────────────────────

function EventModal({ event, onClose }: { event: AuditLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Audit Event</h2>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{event.event_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={event.status} />
            <RiskBadge score={event.risk_score} />
            <button onClick={onClose} className="ml-2 rounded-lg p-1.5 hover:bg-gray-100">
              <XCircle className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* WHO */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Who</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="User" value={event.user_email} />
              <Field label="Role" value={event.user_role?.replace(/_/g, ' ')} />
              <Field label="Clinic" value={event.clinic_name} />
              {event.acting_as && <Field label="Acting As" value={event.acting_as} />}
            </div>
          </section>

          {/* WHAT */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>What</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Action</p>
                <ActionBadge action={event.action} />
              </div>
              <Field label="Resource Type" value={event.resource_type} />
              <Field label="Resource ID" value={event.resource_id} mono />
              {event.changed_fields && event.changed_fields.length > 0 && (
                <div className="col-span-2">
                  <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Changed Fields</p>
                  <div className="flex flex-wrap gap-1">
                    {event.changed_fields.map(f => (
                      <span key={f} className="rounded px-1.5 py-0.5 text-[11px] font-mono" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Old / New values */}
            {(event.old_values || event.new_values) && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {event.old_values && (
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Before</p>
                    <pre className="rounded-lg p-3 text-[11px] font-mono overflow-auto max-h-40 whitespace-pre-wrap" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                      {JSON.stringify(event.old_values, null, 2)}
                    </pre>
                  </div>
                )}
                {event.new_values && (
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-tertiary)' }}>After</p>
                    <pre className="rounded-lg p-3 text-[11px] font-mono overflow-auto max-h-40 whitespace-pre-wrap" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                      {JSON.stringify(event.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* WHERE */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Where</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IP Address" value={event.ip_address} mono />
              <Field label="Location" value={[event.city, event.country].filter(Boolean).join(', ') || '—'} />
              <Field label="Device" value={event.device_type} />
              <Field label="Browser / OS" value={[event.browser, event.os].filter(Boolean).join(' · ') || '—'} />
            </div>
          </section>

          {/* HOW */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>How</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Request ID" value={String(event.request_id)} mono />
              <Field label="Duration" value={event.duration_ms != null ? `${event.duration_ms}ms` : '—'} />
              <Field label="Method" value={event.http_method} mono />
              <Field label="Endpoint" value={event.api_endpoint} mono />
              <Field label="Timestamp" value={formatTime(event.created_at)} />
            </div>
          </section>

          {/* Outcome */}
          {(event.failure_reason || (event.flags && event.flags.length > 0)) && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Flags</h3>
              {event.failure_reason && (
                <p className="text-sm mb-2" style={{ color: 'var(--color-danger)' }}>{event.failure_reason}</p>
              )}
              {event.flags && event.flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {event.flags.map(f => (
                    <span
                      key={f}
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={f === 'HIGH_RISK'
                        ? { backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }
                        : { backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }
                      }
                    >
                      {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
      <p className={cn('text-[12px] truncate', mono && 'font-mono')} style={{ color: 'var(--color-text-primary)' }}>{value || '—'}</p>
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color, fontFamily: 'var(--font-display)' }}>{value.toLocaleString()}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ClinicAuditPage() {
  const { isSuperAdmin } = usePermissions()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const buildParams = useCallback(() => {
    const p: Record<string, string> = { page: String(page), page_size: '50' }
    if (search) p.user_email = search
    if (statusFilter) p.status = statusFilter
    if (actionFilter) p.action = actionFilter
    if (riskFilter) p.risk_min = riskFilter
    if (dateFrom) p.date_from = new Date(dateFrom).toISOString()
    if (dateTo) p.date_to = new Date(dateTo).toISOString()
    return p
  }, [page, search, statusFilter, actionFilter, riskFilter, dateFrom, dateTo])

  const { data, isLoading, refetch, isFetching } = useQuery<AuditPage>({
    queryKey: ['audit-logs', page, search, statusFilter, actionFilter, riskFilter, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get('/audit-logs', { params: buildParams() })
      return data
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const { data } = await api.get('/audit-logs/stats', { params: { hours: 24 } })
      return data
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const { data: highRisk } = useQuery<AuditPage>({
    queryKey: ['audit-high-risk'],
    queryFn: async () => {
      const { data } = await api.get('/audit-logs/high-risk', { params: { hours: 24, page_size: 10 } })
      return data
    },
    enabled: isSuperAdmin,
    refetchInterval: 60_000,
  })

  function handleExport() {
    const params = new URLSearchParams(buildParams() as Record<string, string>)
    const token = localStorage.getItem('access_token')
    window.open(`/api/v1/audit-logs/export/csv?${params.toString()}&token=${token}`, '_blank')
  }

  function resetFilters() {
    setSearch('')
    setStatusFilter('')
    setActionFilter('')
    setRiskFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Audit Logs</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Complete tamper-proof activity trail</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--color-brand)' }}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total (24h)" value={stats.total} color="var(--color-text-primary)" />
          <StatCard label="Success" value={stats.success} color="var(--color-success)" />
          <StatCard label="Failed" value={stats.failure} color="var(--color-danger)" />
          <StatCard label="Blocked" value={stats.blocked} color="var(--color-warning)" />
          <StatCard label="High Risk" value={stats.high_risk} color="var(--color-danger)" />
        </div>
      )}

      {/* High risk alert — super admin only */}
      {isSuperAdmin && highRisk && highRisk.total > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-5 w-5" style={{ color: 'var(--color-danger)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>{highRisk.total} High-Risk Events (last 24h)</h3>
          </div>
          <div className="space-y-1.5">
            {highRisk.items.slice(0, 5).map(event => (
              <button
                key={event.event_id}
                onClick={() => setSelected(event)}
                className="w-full flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-left transition-colors"
                style={{ border: '1px solid var(--color-border)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-danger-light)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}
              >
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>{event.risk_score}</span>
                <span className="text-[12px] font-mono flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>{event.action}</span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{event.user_email}</span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{relativeTime(event.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Filters</span>
          <button onClick={resetFilters} className="ml-auto text-[11px] hover:underline" style={{ color: 'var(--color-text-tertiary)' }}>Reset</button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Email or IP…"
              className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-2 text-[12px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand-light"
            />
          </div>
          <input
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1) }}
            placeholder="Action…"
            className="rounded-lg border border-gray-200 px-3 py-2 text-[12px] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand-light"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-[12px] focus:outline-none focus:border-brand bg-white"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="blocked">Blocked</option>
          </select>
          <select
            value={riskFilter}
            onChange={e => { setRiskFilter(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-[12px] focus:outline-none focus:border-brand bg-white"
          >
            <option value="">Any risk</option>
            <option value="30">Medium+ (≥30)</option>
            <option value="70">High (≥70)</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-[12px] focus:outline-none focus:border-brand"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-[12px] focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <th className="px-4 py-3 text-left font-semibold w-40" style={{ color: 'var(--color-text-tertiary)' }}>Time</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>User</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Action</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Resource</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Location</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Status</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 rounded" style={{ width: `${60 + j * 10}%`, backgroundColor: 'var(--color-surface-2)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                    No audit events found for the selected filters.
                  </td>
                </tr>
              ) : (
                data?.items.map(event => (
                  <tr
                    key={event.event_id}
                    onClick={() => setSelected(event)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: event.risk_score >= 70 ? 'var(--color-danger-light)' : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = event.risk_score >= 70 ? 'var(--color-danger-light)' : 'var(--color-surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = event.risk_score >= 70 ? 'var(--color-danger-light)' : 'transparent')}
                  >
                    <td className="px-4 py-3">
                      <p style={{ color: 'var(--color-text-primary)' }}>{relativeTime(event.created_at)}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{formatTime(event.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate max-w-[160px]" style={{ color: 'var(--color-text-primary)' }}>{event.user_email ?? '—'}</p>
                      <p className="text-[10px] capitalize" style={{ color: 'var(--color-text-tertiary)' }}>{event.user_role?.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={event.action} />
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                      <p>{event.resource_type}</p>
                      {event.resource_id && (
                        <p className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--color-text-tertiary)' }}>{event.resource_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <DeviceIcon type={event.device_type} />
                        <div>
                          <p style={{ color: 'var(--color-text-secondary)' }}>{event.ip_address}</p>
                          <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                            {event.city || event.country
                              ? <><Globe className="h-2.5 w-2.5" />{[event.city, event.country].filter(Boolean).join(', ')}</>
                              : '—'
                            }
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge score={event.risk_score} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {((data.page - 1) * data.page_size) + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total.toLocaleString()} events
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                const start = Math.max(1, data.page - 2)
                const n = start + i
                if (n > data.pages) return null
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className="rounded-lg border px-3 py-1.5 text-[12px] transition-colors hover:bg-gray-50"
                    style={n === data.page
                      ? { backgroundColor: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: 'white' }
                      : { borderColor: '#E5E7EB' }
                    }
                  >
                    {n}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={data.page >= data.pages}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
