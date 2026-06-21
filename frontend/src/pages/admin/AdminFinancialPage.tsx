import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, Users, CreditCard } from 'lucide-react'
import { api } from '../../lib/api'
import { formatKES } from '../../lib/utils'

interface Stats {
  total_clinics: number
  verified_clinics: number
  total_revenue_kes: number
  mrr_kes: number
  appointments_completed: number
}

const PLAN_MRR = { basic: 0, pro: 4_999, enterprise: 14_999 }
const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  enterprise: { bg: '#F5F3FF', color: '#6D28D9' },
  pro:        { bg: '#EFF6FF', color: '#1E40AF' },
  basic:      { bg: '#F1F5F9', color: '#64748B' },
}

interface ClinicPlan { subscription_plan: string; is_active: boolean }

export function AdminFinancialPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['admin-platform-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: clinics = [], isLoading: clinicsLoading } = useQuery<ClinicPlan[]>({
    queryKey: ['admin-clinics'],
    queryFn: () => api.get('/admin/clinics').then(r => r.data),
    staleTime: 60_000,
  })

  const isLoading = statsLoading || clinicsLoading

  const planBreakdown = ['basic', 'pro', 'enterprise'].map(plan => ({
    plan,
    count: clinics.filter(c => c.subscription_plan === plan && c.is_active).length,
    mrr: PLAN_MRR[plan as keyof typeof PLAN_MRR],
  }))

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-xl bg-gray-200" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-gray-200" />)}
        </div>
      </div>
    )
  }

  const s = stats!

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
          Financial Overview
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Subscription revenue and platform earnings
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Recurring Revenue', value: formatKES(s.mrr_kes), icon: TrendingUp, color: 'var(--color-brand)', bg: 'var(--color-brand-light)' },
          { label: 'Total Platform Revenue', value: formatKES(s.total_revenue_kes), icon: DollarSign, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
          { label: 'Active Paying Clinics', value: clinics.filter(c => c.is_active && c.subscription_plan !== 'basic').length, icon: Users, color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
          { label: 'Completed Appointments', value: s.appointments_completed.toLocaleString(), icon: CreditCard, color: 'var(--color-brand)', bg: 'var(--color-brand-light)' },
        ].map(m => (
          <div key={m.label} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-tertiary)' }}>{m.label}</p>
                <p className="text-2xl font-bold mt-1.5 tabular-nums"
                  style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                  {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                </p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: m.bg }}>
                <m.icon className="h-5 w-5" style={{ color: m.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="card p-6">
        <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Subscription Plan Breakdown
        </h2>
        <div className="space-y-4">
          {planBreakdown.map(({ plan, count, mrr }) => {
            const ps = PLAN_STYLE[plan]
            const totalMrr = count * mrr
            return (
              <div key={plan} className="flex items-center gap-4">
                <div className="w-24 shrink-0">
                  <span className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider capitalize"
                    style={{ backgroundColor: ps.bg, color: ps.color }}>
                    {plan}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {count} clinic{count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm font-bold" style={{ color: ps.color }}>
                      {mrr > 0 ? `${formatKES(totalMrr)}/mo` : 'Free'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${planBreakdown.reduce((a, b) => a + b.count, 0) > 0
                          ? (count / planBreakdown.reduce((a, b) => a + b.count, 0)) * 100
                          : 0}%`,
                        backgroundColor: ps.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Historical data note */}
      <div className="card p-6 flex flex-col items-center justify-center py-12 text-center"
        style={{ border: '1px dashed var(--color-border)' }}>
        <TrendingUp className="h-10 w-10 mb-3" style={{ color: 'var(--color-border-strong)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Historical Revenue Charts
        </p>
        <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Connect M-Pesa Daraja webhooks to enable MRR trend charts, churn analytics, and LTV reporting.
        </p>
      </div>
    </div>
  )
}
