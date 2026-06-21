import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { Activity, TrendingUp } from 'lucide-react'
import { api } from '../../lib/api'

const C_BRAND   = '#1D4ED8'
const C_SUCCESS = '#059669'
const C_WARNING = '#D97706'
const C_DANGER  = '#DC2626'
const C_PURPLE  = '#6D28D9'
const C_GRID    = '#EDE8DF'

const SEVERITY_COLORS: Record<string, string> = {
  mild:     C_SUCCESS,
  moderate: C_WARNING,
  urgent:   C_DANGER,
  emergency: C_PURPLE,
}

const BRAND_PALETTE = ['#1D4ED8','#2563EB','#3B82F6','#60A5FA','#93C5FD','#BFDBFE','#DBEAFE','#EFF6FF','#E0F2FE','#F0F9FF']

const AXIS_TICK = { fontSize: 11, fill: '#9CA3AF' }

const CHART_STYLE = {
  borderRadius: '12px', border: '1px solid #E5E7EB',
  fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

interface TriageStats {
  total: number
  top_symptoms: { symptom: string; count: number }[]
  severity_breakdown: { name: string; value: number }[]
  county_breakdown: { county: string; sessions: number }[]
  monthly_trend: { month: string; sessions: number }[]
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] gap-2">
      <TrendingUp className="h-8 w-8" style={{ color: 'var(--color-border)' }} />
      <p className="text-xs text-center max-w-[220px]" style={{ color: 'var(--color-text-tertiary)' }}>{message}</p>
    </div>
  )
}

export function AdminTriagePage() {
  const { data, isLoading } = useQuery<TriageStats>({
    queryKey: ['admin-triage-stats'],
    queryFn: () => api.get('/admin/triage-stats').then(r => r.data),
    staleTime: 120_000,
  })

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-xl bg-gray-200" />
        <div className="grid grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-72 rounded-2xl bg-gray-200" />)}
        </div>
      </div>
    )
  }

  const d = data ?? { total: 0, top_symptoms: [], severity_breakdown: [], county_breakdown: [], monthly_trend: [] }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
          Triage Analytics
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Platform-wide AI triage session data · {d.total.toLocaleString()} total sessions
        </p>
      </div>

      {d.total === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <Activity className="h-12 w-12 mb-4" style={{ color: 'var(--color-border-strong)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>No triage data yet</p>
          <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Analytics will appear here once patients start using the AI triage feature.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Symptoms */}
          <div className="card p-6">
            <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Top Symptoms</h2>
            <p className="text-[12px] mb-5" style={{ color: 'var(--color-text-tertiary)' }}>Most reported across all triage sessions</p>
            {d.top_symptoms.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={d.top_symptoms.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="symptom" tick={{ ...AXIS_TICK, textAnchor: 'end' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {d.top_symptoms.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={BRAND_PALETTE[i] ?? '#EFF6FF'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No symptom data yet." />
            )}
          </div>

          {/* Severity Breakdown */}
          <div className="card p-6">
            <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Severity Distribution</h2>
            <p className="text-[12px] mb-5" style={{ color: 'var(--color-text-tertiary)' }}>Breakdown by triage severity level</p>
            {d.severity_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={d.severity_breakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {d.severity_breakdown.map((entry, i) => (
                      <Cell key={i} fill={SEVERITY_COLORS[entry.name.toLowerCase()] ?? C_BRAND} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={CHART_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No severity data yet." />
            )}
          </div>

          {/* County Breakdown */}
          <div className="card p-6">
            <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Sessions by County</h2>
            <p className="text-[12px] mb-5" style={{ color: 'var(--color-text-tertiary)' }}>Top counties by triage volume</p>
            {d.county_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.county_breakdown.slice(0, 8)} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />
                  <XAxis dataKey="county" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Bar dataKey="sessions" fill={C_BRAND} radius={[6, 6, 0, 0]}>
                    {d.county_breakdown.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={BRAND_PALETTE[i] ?? C_BRAND} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No county data yet." />
            )}
          </div>

          {/* Monthly Trend */}
          <div className="card p-6">
            <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Monthly Trend</h2>
            <p className="text-[12px] mb-5" style={{ color: 'var(--color-text-tertiary)' }}>Triage sessions over last 6 months</p>
            {d.monthly_trend.some(m => m.sessions > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.monthly_trend} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Bar dataKey="sessions" fill={C_SUCCESS} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No monthly data yet." />
            )}
          </div>

        </div>
      )}
    </div>
  )
}
