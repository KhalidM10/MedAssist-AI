import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert, Search, Download, AlertTriangle,
  Filter,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditItem {
  event_id: string
  created_at: string
  action: string
  user_email: string | null
  user_role: string | null
  clinic_name: string | null
  resource_type: string
  resource_id: string | null
  ip_address: string
  country: string | null
  city: string | null
  status: string
  failure_reason: string | null
  risk_score: number
  flags: string[] | null
  api_endpoint: string | null
  http_method: string | null
}

interface AuditPage {
  items: AuditItem[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const RISK_BADGE = (score: number) => {
  if (score >= 70) return { bg: '#FEE2E2', color: '#DC2626', label: 'High' }
  if (score >= 40) return { bg: '#FEF3C7', color: '#D97706', label: 'Med' }
  return { bg: '#D1FAE5', color: '#059669', label: 'Low' }
}

function downloadCSV(items: AuditItem[]) {
  const header = 'timestamp,action,user_email,user_role,resource_type,resource_id,ip,country,city,status,risk_score,failure_reason'
  const rows = items.map(e =>
    [
      e.created_at, e.action, e.user_email ?? '', e.user_role ?? '',
      e.resource_type, e.resource_id ?? '', e.ip_address,
      e.country ?? '', e.city ?? '', e.status, e.risk_score, `"${e.failure_reason ?? ''}"`,
    ].join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `audit_${Date.now()}.csv`; a.click()
  URL.revokeObjectURL(url)
}

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function AdminAuditPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskOnly, setRiskOnly] = useState(false)

  const { data, isLoading } = useQuery<AuditPage>({
    queryKey: ['admin-audit'],
    queryFn: () => api.get('/audit-logs?page_size=200').then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const items = data?.items ?? []

  const filtered = useMemo(() =>
    items.filter(e => {
      if (riskOnly && e.risk_score < 70) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const match =
          (e.user_email ?? '').toLowerCase().includes(s) ||
          e.action.toLowerCase().includes(s) ||
          (e.failure_reason ?? '').toLowerCase().includes(s) ||
          e.resource_type.toLowerCase().includes(s)
        if (!match) return false
      }
      return true
    }),
  [items, riskOnly, statusFilter, search])

  const highRisk = items.filter(e => e.risk_score >= 70)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
            Platform Audit Log
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            All security events across all clinics · {data?.total ?? 0} total
          </p>
        </div>
        <button onClick={() => downloadCSV(filtered)}
          className="flex items-center gap-2 rounded border px-4 py-2 text-sm font-semibold transition-colors"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* High-risk banner */}
      {highRisk.length > 0 && (
        <div className="rounded p-4 flex items-start gap-3"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#991B1B' }}>{highRisk.length} high-risk events</p>
            <div className="mt-2 space-y-1">
              {highRisk.slice(0, 3).map(e => (
                <p key={e.event_id} className="text-xs" style={{ color: '#DC2626' }}>
                  <span className="font-mono">[{new Date(e.created_at).toLocaleTimeString('en-KE')}]</span>
                  {' '}{e.action}{e.failure_reason ? ': ' + e.failure_reason : ''}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: 'var(--color-text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action, user or resource…"
            className="w-full rounded border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          style={inputStyle}>
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="blocked">Blocked</option>
        </select>
        <button onClick={() => setRiskOnly(v => !v)}
          className="flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold transition-all"
          style={riskOnly
            ? { backgroundColor: '#FEE2E2', color: '#DC2626' }
            : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
          <ShieldAlert className="h-3.5 w-3.5" /> High-risk only
        </button>
      </div>

      {/* Event table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                {['Time', 'Action', 'User', 'Resource', 'IP', 'Location', 'Status', 'Risk'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--color-text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <div className="animate-pulse space-y-3">
                      {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filtered.map(e => {
                const rb = RISK_BADGE(e.risk_score)
                return (
                  <tr key={e.event_id} className="transition-colors"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={ev => (ev.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                    onMouseLeave={ev => (ev.currentTarget.style.backgroundColor = 'transparent')}>
                    <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap"
                      style={{ color: 'var(--color-text-tertiary)' }}>
                      {formatDistanceToNow(parseISO(e.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="rounded text-[11px] font-mono px-2 py-0.5"
                        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono max-w-[160px] truncate"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      {e.user_email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono max-w-[140px] truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>
                      {e.resource_type}{e.resource_id ? `#${e.resource_id.slice(0, 8)}` : ''}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono whitespace-nowrap"
                      style={{ color: 'var(--color-text-tertiary)' }}>{e.ip_address}</td>
                    <td className="px-4 py-3 text-[12px]"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      {[e.city, e.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold capitalize"
                        style={{
                          backgroundColor: e.status === 'success' ? '#D1FAE5' : e.status === 'blocked' ? '#FEE2E2' : '#FEF3C7',
                          color: e.status === 'success' ? '#065F46' : e.status === 'blocked' ? '#DC2626' : '#92400E',
                        }}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: rb.bg, color: rb.color }}>
                        {rb.label} {e.risk_score}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center py-12">
              <Filter className="h-8 w-8 mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                {items.length === 0 ? 'No audit events recorded yet' : 'No events match filters'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
