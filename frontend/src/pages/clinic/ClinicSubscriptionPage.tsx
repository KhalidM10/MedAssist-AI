import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Zap, Building2, Sparkles, X } from 'lucide-react'
import { api } from '../../lib/api'

interface SubscriptionInfo {
  plan: 'basic' | 'pro' | 'enterprise'
  price_kes: number
  started_at: string | null
  expires_at: string | null
  clinic_name: string
}

interface Plan {
  id: 'basic' | 'pro' | 'enterprise'
  name: string
  price: number
  icon: React.ElementType
  accent: string
  tagline: string
  features: string[]
  cta: string
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 3500,
    icon: Building2,
    accent: '#6B7280',
    tagline: 'For small clinics getting started',
    features: [
      'Up to 50 appointments/month',
      'Basic appointment management',
      'Patient records',
      'Email support',
      'Clinic profile listing',
      'M-Pesa payment integration',
    ],
    cta: 'Select Basic',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 8500,
    icon: Zap,
    accent: '#1D4ED8',
    tagline: 'For growing clinics — most popular',
    features: [
      'Unlimited appointments',
      'Advanced analytics dashboard',
      'OTC medicine marketplace',
      'Priority support (24h response)',
      'Custom booking page',
      'SMS appointment reminders',
      'Doctor management portal',
      'Revenue & trend reports',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 18000,
    icon: Sparkles,
    accent: '#7C3AED',
    tagline: 'For hospital groups and chains',
    features: [
      'Everything in Pro',
      'Multi-branch management',
      'Dedicated account manager',
      'SLA guarantee (99.9% uptime)',
      'Custom EHR integrations',
      'White-label booking widget',
      'Bulk SMS & WhatsApp alerts',
      'NHIF integration support',
      'Quarterly business reviews',
    ],
    cta: 'Contact sales',
  },
]

export function ClinicSubscriptionPage() {
  const queryClient = useQueryClient()
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const { data: sub, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ['clinic-subscription'],
    queryFn: () => api.get('/dashboard/subscription').then(r => r.data),
  })

  const upgradeMutation = useMutation({
    mutationFn: (vars: { plan: string; mpesa_phone: string }) =>
      api.post('/dashboard/subscription/upgrade', vars).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clinic-subscription'] })
      setCheckoutPlan(null)
      setPhone('')
      setSuccessMsg(data.message)
      setTimeout(() => setSuccessMsg(''), 6000)
    },
  })

  function openCheckout(plan: Plan) {
    if (plan.cta === 'Contact sales') {
      window.open('mailto:sales@medassist.co.ke?subject=Enterprise Plan Inquiry', '_blank')
      return
    }
    setCheckoutPlan(plan)
    setPhone('')
    setPhoneError('')
    upgradeMutation.reset()
  }

  function handleUpgrade() {
    const cleaned = phone.replace(/\s/g, '')
    if (!/^\+?2547\d{8}$|^07\d{8}$|^7\d{8}$/.test(cleaned)) {
      setPhoneError('Enter a valid Safaricom number (e.g. 0712 345 678)')
      return
    }
    setPhoneError('')
    upgradeMutation.mutate({ plan: checkoutPlan!.id, mpesa_phone: cleaned })
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Subscription</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          {sub?.clinic_name ? `Managing plan for ${sub.clinic_name}` : 'Manage your clinic plan'}
        </p>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="rounded-2xl px-5 py-4 mb-6 flex items-center gap-3" style={{ backgroundColor: 'var(--color-success-light)', border: '1px solid var(--color-border)' }}>
          <Check className="h-5 w-5 shrink-0" style={{ color: 'var(--color-success)' }} />
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-success)' }}>Plan upgraded successfully</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-success)' }}>{successMsg}</p>
          </div>
        </div>
      )}

      {/* Current plan summary */}
      {!isLoading && sub && (
        <div className="card p-5 mb-8 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Current plan</p>
            <p className="text-2xl font-bold mt-1 capitalize" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{sub.plan}</p>
            {sub.expires_at && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                Renews {new Date(sub.expires_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Monthly cost</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
              KES {sub.price_kes.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const Icon = plan.icon
          const isPopular = plan.id === 'pro'
          const isCurrent = sub?.plan === plan.id

          return (
            <div
              key={plan.id}
              className="rounded-2xl flex flex-col overflow-hidden relative"
              style={{
                backgroundColor: 'white',
                border: isCurrent
                  ? `2px solid ${plan.accent}`
                  : isPopular
                  ? `2px solid ${plan.accent}`
                  : '1px solid #eceae4',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isCurrent && (
                <div className="text-center text-[11px] font-bold py-1.5 tracking-wide uppercase" style={{ backgroundColor: plan.accent, color: 'white' }}>
                  Current plan
                </div>
              )}
              {!isCurrent && isPopular && (
                <div className="text-center text-[11px] font-bold py-1.5 tracking-wide uppercase" style={{ backgroundColor: plan.accent, color: 'white' }}>
                  Most popular
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${plan.accent}18` }}>
                    <Icon className="h-5 w-5" style={{ color: plan.accent }} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{plan.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{plan.tagline}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                      KES {plan.price.toLocaleString()}
                    </span>
                    <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>/month</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Billed monthly · Cancel anytime</p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${plan.accent}18` }}>
                        <Check className="h-2.5 w-2.5" style={{ color: plan.accent }} />
                      </div>
                      <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => openCheckout(plan)}
                  disabled={isCurrent || isLoading}
                  className="w-full py-3 rounded-xl text-[13px] font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isCurrent ? `${plan.accent}18` : isPopular ? plan.accent : 'transparent',
                    color: isCurrent ? plan.accent : isPopular ? 'white' : plan.accent,
                    border: isPopular || isCurrent ? 'none' : `1.5px solid ${plan.accent}`,
                  }}
                >
                  {isCurrent ? 'Active' : plan.cta}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* M-Pesa checkout modal */}
      {checkoutPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setCheckoutPlan(null) }}
        >
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'white' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[16px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Upgrade to {checkoutPlan.name}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  KES {checkoutPlan.price.toLocaleString()}/month via M-Pesa
                </p>
              </div>
              <button onClick={() => setCheckoutPlan(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                M-Pesa phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
                placeholder="0712 345 678"
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
                style={{
                  border: phoneError ? '1.5px solid #DC2626' : '1.5px solid #d4cfc7',
                  color: 'var(--color-text-primary)',
                }}
              />
              {phoneError && (
                <p className="text-[11px] mt-1" style={{ color: '#DC2626' }}>{phoneError}</p>
              )}
            </div>

            {upgradeMutation.isError && (
              <div className="mb-4 px-3 py-2 rounded-xl text-[12px]" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                {(upgradeMutation.error as any)?.response?.data?.detail || 'Something went wrong. Please try again.'}
              </div>
            )}

            <button
              onClick={handleUpgrade}
              disabled={upgradeMutation.isPending}
              className="w-full py-3 rounded-xl text-[13px] font-bold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: checkoutPlan.accent, color: 'white' }}
            >
              {upgradeMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Sending STK push…
                </span>
              ) : (
                `Pay KES ${checkoutPlan.price.toLocaleString()} via M-Pesa`
              )}
            </button>

            <p className="text-[11px] text-center mt-3" style={{ color: 'var(--color-text-tertiary)' }}>
              You will receive an M-Pesa prompt on your phone. Enter your PIN to confirm.
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-center mt-8" style={{ color: 'var(--color-text-tertiary)' }}>
        All plans include M-Pesa integration · Prices are exclusive of VAT ·
        Contact <span style={{ color: 'var(--color-brand)' }}>support@medassist.co.ke</span> for custom pricing
      </p>
    </div>
  )
}
