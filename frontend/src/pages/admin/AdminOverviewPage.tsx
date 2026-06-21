import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Users, Building2, Activity, Calendar, DollarSign,
  TrendingUp, Wifi, AlertTriangle, CheckCircle2,
  ShieldAlert, UserPlus, Store, Stethoscope,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatKES } from '../../lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
  total_users: number
  total_clinics: number
  verified_clinics: number
  pending_clinics: number
  suspended_clinics: number
  triage_today: number
  triage_week: number
  triage_total: number
  appointments_completed: number
  appointments_total: number
  cancellation_rate: number
  total_revenue_kes: number
  mrr_kes: number
  active_sessions: number
  weekly_activity: { label: string; users: number; triage: number }[]
}

interface AuditItem {
  event_id: string
  created_at: string
  action: string
  user_email: string | null
  user_role: string | null
  ip_address: string
  risk_score: number
  resource_type: string
  resource_id: string | null
  failure_reason: string | null
  status: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  low:    { bg: 'var(--color-success-light)', text: 'var(--color-success)', dot: 'var(--color-success)' },
  medium: { bg: 'var(--color-warning-light)', text: 'var(--color-warning)', dot: 'var(--color-warning)' },
  high:   { bg: 'var(--color-danger-light)',  text: 'var(--color-danger)',  dot: 'var(--color-danger)' },
}

const EVENT_ICON: Record<string, React.ElementType> = {
  login:        Wifi,
  register:     UserPlus,
  booking:      Calendar,
  failed_login: AlertTriangle,
  role_change:  ShieldAlert,
  impersonate:  ShieldAlert,
  triage:       Activity,
  order:        Store,
  verify:       CheckCircle2,
  suspend:      AlertTriangle,
}

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function mapActionToType(action: string): string {
  const a = action.toLowerCase()
  if (a.includes('fail') || a.includes('block')) return 'failed_login'
  if (a.includes('login') || a.includes('auth')) return 'login'
  if (a.includes('register') || a.includes('signup')) return 'register'
  if (a.includes('appointment') || a.includes('booking')) return 'booking'
  if (a.includes('role')) return 'role_change'
  if (a.includes('impersonate')) return 'impersonate'
  if (a.includes('triage')) return 'triage'
  if (a.includes('order')) return 'order'
  if (a.includes('verify')) return 'verify'
  if (a.includes('suspend')) return 'suspend'
  return 'login'
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Metric({
  label, value, sub, icon: Icon, variant = 'brand',
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; variant?: 'brand' | 'success' | 'danger' | 'warning'
}) {
  const COLOR = {
    brand:   { icon: 'var(--color-brand)',   bg: 'var(--color-brand-light)' },
    success: { icon: 'var(--color-success)', bg: 'var(--color-success-light)' },
    danger:  { icon: 'var(--color-danger)',  bg: 'var(--color-danger-light)' },
    warning: { icon: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
  }[variant]

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
          >
            {label}
          </p>
          <p
            className="text-[24px] font-bold mt-1.5 tracking-tight tabular-nums"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {value}
          </p>
          {sub && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
              {sub}
            </p>
          )}
        </div>
        <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: COLOR.bg }}>
          <Icon className="h-5 w-5" style={{ color: COLOR.icon }} />
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['admin-platform-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const { data: auditPage } = useQuery<{ items: AuditItem[]; total: number }>({
    queryKey: ['admin-live-feed'],
    queryFn: () => api.get('/audit-logs?page_size=30').then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 15_000,
  })

  const events = auditPage?.items ?? []

  if (statsLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-xl bg-gray-200" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-200" />)}
        </div>
      </div>
    )
  }

  const s = stats!

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1
          className="text-[20px] font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Platform Overview
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
          Live platform health and key metrics
        </p>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Total Users"         value={s.total_users.toLocaleString()} icon={Users}    variant="brand" />
        <Metric label="Total Clinics"       value={s.total_clinics}               icon={Building2} variant="brand"
          sub={`${s.verified_clinics} verified · ${s.pending_clinics} pending`} />
        <Metric label="Triage Sessions"     value={s.triage_total.toLocaleString()} icon={Activity} variant="success"
          sub={`${s.triage_today.toLocaleString()} today`} />
        <Metric label="Active Sessions Now" value={s.active_sessions}              icon={Wifi}      variant="warning" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Appointments"      value={s.appointments_total.toLocaleString()} icon={Calendar}     variant="brand"
          sub={`${(100 - s.cancellation_rate).toFixed(1)}% completion rate`} />
        <Metric label="Cancellation Rate" value={`${s.cancellation_rate}%`}             icon={AlertTriangle} variant="danger" />
        <Metric label="Total Revenue"     value={formatKES(s.total_revenue_kes)}        icon={DollarSign}    variant="success" />
        <Metric label="Platform MRR"      value={formatKES(s.mrr_kes)}                 icon={TrendingUp}    variant="brand" />
      </div>

      {/* Chart + live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Weekly activity */}
        <div className="lg:col-span-3 card p-5">
          <p
            className="text-[13.5px] font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
          >
            Weekly Activity (last 7 days)
          </p>
          {s.weekly_activity.some(d => d.users > 0 || d.triage > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={s.weekly_activity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1D4ED8" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gTriage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: '#D1D5DB' }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Area type="monotone" dataKey="users"  stroke="#1D4ED8" strokeWidth={2} fill="url(#gUsers)"  name="New Users"/>
                <Area type="monotone" dataKey="triage" stroke="#059669" strokeWidth={2} fill="url(#gTriage)" name="Triage"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No activity data yet</p>
            </div>
          )}
        </div>

        {/* Recent audit events */}
        <div className="lg:col-span-2 card flex flex-col overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-success)' }} />
              <p
                className="text-[13.5px] font-semibold"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
              >
                Recent Events
              </p>
            </div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}
            >
              refreshes every 15s
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[320px]">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No audit events yet</p>
              </div>
            ) : (
              events.map(ev => {
                const risk = riskLevel(ev.risk_score)
                const { bg, text, dot } = RISK_STYLE[risk]
                const type = mapActionToType(ev.action)
                const Icon = EVENT_ICON[type] ?? Activity
                const actor = ev.user_email ?? ev.ip_address
                const description = ev.failure_reason
                  ? `${ev.action}: ${ev.failure_reason}`
                  : `${ev.action}${ev.resource_type ? ' · ' + ev.resource_type : ''}`

                return (
                  <div
                    key={ev.event_id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: bg }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[12px] font-semibold truncate"
                        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
                      >
                        {description}
                      </p>
                      <p
                        className="text-[10px] truncate"
                        style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}
                      >
                        {actor}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="text-[9px]"
                        style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}
                      >
                        {new Date(ev.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Clinic status overview */}
      <div className="card p-5">
        <p
          className="text-[13.5px] font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
        >
          Clinic Status Breakdown
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Verified',  count: s.verified_clinics,  color: 'var(--color-success)', bg: 'var(--color-success-light)' },
            { label: 'Pending',   count: s.pending_clinics,   color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
            { label: 'Suspended', count: s.suspended_clinics, color: 'var(--color-danger)',  bg: 'var(--color-danger-light)' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: bg }}>
              <Stethoscope className="h-5 w-5 shrink-0" style={{ color }} />
              <div>
                <p
                  className="text-[20px] font-bold tabular-nums"
                  style={{ color, fontFamily: 'var(--font-display)' }}
                >
                  {count}
                </p>
                <p className="text-[11px] font-semibold" style={{ color, fontFamily: 'var(--font-body)' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
