import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { api } from '../../lib/api'

interface Analytics {
  weekly_trend: { label: string; appointments: number; revenue: number }[]
  monthly_revenue: { month: string; revenue: number }[]
  top_symptoms: { symptom: string; count: number }[]
  completion_rate: number
}

function SectionCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{sub}</p>
      </div>
      {children}
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] gap-2">
      <TrendingUp className="h-8 w-8" style={{ color: 'var(--color-border)' }} />
      <p className="text-xs text-center max-w-[200px]" style={{ color: 'var(--color-text-tertiary)' }}>{message}</p>
    </div>
  )
}

const C_BRAND   = '#1D4ED8'
const C_SUCCESS = '#059669'

const CHART_TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid #E5E7EB',
  fontSize: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
}

const AXIS_TICK = { fontSize: 11, fill: '#9CA3AF' }

export function ClinicAnalyticsPage() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ['clinic-analytics'],
    queryFn: () => api.get('/dashboard/analytics').then(r => r.data),
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

  const {
    weekly_trend = [],
    monthly_revenue = [],
    top_symptoms = [],
    completion_rate = 0,
  } = analytics ?? {}

  const hasWeeklyData  = weekly_trend.some(d => d.appointments > 0)
  const hasMonthlyData = monthly_revenue.some(d => d.revenue > 0)

  const formatRev = (v: number) => `KES ${v.toLocaleString()}`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Analytics</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Performance insights based on real activity</p>
      </div>

      {/* Completion rate banner */}
      <div className="card p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Overall completion rate</p>
          <p className="text-3xl font-bold mt-0.5" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{completion_rate}%</p>
        </div>
        <div className="w-48 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${completion_rate}%`, backgroundColor: C_SUCCESS }}
          />
        </div>
      </div>

      {/* 2-column chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly Revenue */}
        <SectionCard title="Monthly Revenue" sub="Last 6 months (KES)">
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly_revenue} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [formatRev(v as number), 'Revenue']} />
                <Bar dataKey="revenue" fill={C_BRAND} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Revenue data will appear here once appointments are completed." />
          )}
        </SectionCard>

        {/* Weekly Appointment Trend */}
        <SectionCard title="Weekly Appointments" sub="Last 8 weeks">
          {hasWeeklyData ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weekly_trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="appointments"
                  stroke={C_BRAND}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: C_BRAND }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Appointment trends will appear here as patients book with your clinic." />
          )}
        </SectionCard>

        {/* Top Symptoms */}
        <SectionCard title="Top Symptoms" sub="From triage sessions in your county">
          {top_symptoms.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={top_symptoms.slice(0, 8)}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="symptom" tick={{ ...AXIS_TICK, textAnchor: 'end' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {top_symptoms.slice(0, 8).map((_, i) => {
                    const palette = ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF']
                    return <Cell key={i} fill={palette[i] ?? '#EFF6FF'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Symptom data will appear here once patients complete triage sessions in your county." />
          )}
        </SectionCard>

        {/* Completion rate detail */}
        <SectionCard title="Appointment Outcomes" sub="Breakdown of all appointments">
          {analytics && (weekly_trend.reduce((s, d) => s + d.appointments, 0) > 0) ? (
            <div className="space-y-3 pt-2">
              {[
                { label: 'Completion rate', value: `${completion_rate}%`, color: C_SUCCESS, pct: completion_rate },
                { label: 'Cancellation rate', value: `${Math.max(0, 100 - completion_rate).toFixed(1)}%`, color: '#DC2626', pct: Math.max(0, 100 - completion_rate) },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                    <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart message="Outcome breakdown will appear here once appointments have been processed." />
          )}
        </SectionCard>

      </div>
    </div>
  )
}
