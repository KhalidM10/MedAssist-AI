import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  AlertTriangle, CheckCircle2, X,
  ToggleLeft, ToggleRight, Save, Terminal,
} from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformConfig {
  platform_name: string
  support_email: string
  max_bookings_per_day: number
  triage_daily_limit: number
  sms_enabled: boolean
  email_enabled: boolean
  maintenance_mode: boolean
}

interface FeatureFlag {
  key: string; label: string; description: string
  plans: ('basic' | 'pro' | 'enterprise')[]
}

const TABS = ['General', 'Feature Flags', 'SMS Templates', 'Email Templates', 'Danger Zone'] as const
type Tab = typeof TABS[number]

// ── Feature flags ─────────────────────────────────────────────────────────────

const FEATURE_FLAGS: FeatureFlag[] = [
  { key: 'triage_ai',       label: 'AI Triage',           description: 'AI-powered symptom triage for patients',               plans: ['basic','pro','enterprise'] },
  { key: 'telemedicine',    label: 'Telemedicine',         description: 'Video consultations via clinic portal',               plans: ['pro','enterprise'] },
  { key: 'analytics_adv',   label: 'Advanced Analytics',  description: 'Full analytics dashboard with cohort analysis',       plans: ['enterprise'] },
  { key: 'multi_branch',    label: 'Multi-Branch',         description: 'Manage multiple clinic locations under one account',  plans: ['enterprise'] },
  { key: 'custom_sms',      label: 'Custom SMS Templates', description: 'Clinics can customise their own SMS templates',      plans: ['pro','enterprise'] },
  { key: 'api_access',      label: 'Public API Access',    description: 'REST API keys for third-party integrations',         plans: ['enterprise'] },
  { key: 'smart_reminders', label: 'Smart Reminders',      description: 'ML-optimised reminder timing per patient',           plans: ['pro','enterprise'] },
  { key: 'audit_export',    label: 'Audit Log Export',     description: 'Downloadable CSV audit logs for clinic admins',      plans: ['enterprise'] },
]

// ── SMS templates ─────────────────────────────────────────────────────────────

const SMS_TEMPLATES = [
  { key: 'appointment_confirmed', label: 'Appointment Confirmed',
    body: 'Hi {name}, your appointment at {clinic} on {date} at {time} is confirmed. Ref: {ref}. MedAssist AI.' },
  { key: 'appointment_reminder', label: 'Appointment Reminder',
    body: 'Reminder: {name}, you have an appointment at {clinic} tomorrow at {time}. Ref: {ref}. Reply STOP to opt out.' },
  { key: 'appointment_cancelled', label: 'Appointment Cancelled',
    body: 'Hi {name}, your appointment at {clinic} (Ref: {ref}) has been cancelled. Book again at medassist.ai.' },
  { key: 'order_ready', label: 'Order Ready',
    body: 'Hi {name}, your medicine order #{ref} at {clinic} is ready for pickup. MedAssist AI.' },
  { key: 'login_alert', label: 'Login Alert',
    body: 'MedAssist: New login to your account from {location} ({ip}). Not you? Secure at medassist.ai/security.' },
]

// ── Email templates list ──────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  { key: 'welcome',                label: 'Welcome Email',          description: 'Sent on new patient registration' },
  { key: 'appointment_confirmed',  label: 'Appointment Confirmed',  description: 'Includes calendar invite and directions' },
  { key: 'appointment_reminder',   label: 'Appointment Reminder',   description: 'Sent 24h before appointment' },
  { key: 'password_reset',         label: 'Password Reset',         description: 'Includes IP/location for security' },
  { key: 'weekly_clinic_report',   label: 'Weekly Clinic Report',   description: 'Sent every Monday to clinic admins' },
]

const PLAN_BADGE_STYLE = {
  enterprise: { bg: '#F5F3FF', color: '#6D28D9' },
  pro:        { bg: '#EFF6FF', color: '#1E40AF' },
  basic:      { bg: '#F1F5F9', color: '#64748B' },
}

const inputCls = 'w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand'
const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

// ── Saved toast ───────────────────────────────────────────────────────────────

function SavedToast({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 shadow-2xl"
      style={{
        backgroundColor: '#1A1A2E', color: 'white', borderRadius: 4,
        border: '1px solid #22223A',
      }}>
      <CheckCircle2 className="h-4 w-4 text-green-400" />
      <span className="text-sm font-semibold">Settings saved</span>
      <button onClick={onClose} className="ml-1 rounded p-0.5 transition-colors hover:bg-white/10">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('General')
  const [saved, setSaved] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [confirmMaint, setConfirmMaint] = useState(false)
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURE_FLAGS.map(f => [f.key, true]))
  )
  const [smsTemplates, setSmsTemplates] = useState(() =>
    Object.fromEntries(SMS_TEMPLATES.map(t => [t.key, t.body]))
  )
  const [editingSms, setEditingSms] = useState<string | null>(null)
  const [rateLimits, setRateLimits] = useState({
    api_per_minute: 60,
    triage_per_user_day: 10,
    sms_per_user_day: 5,
  })

  const { register, handleSubmit } = useForm<PlatformConfig>({
    defaultValues: {
      platform_name: 'MedAssist AI',
      support_email: 'support@medassist.ai',
      max_bookings_per_day: 500,
      triage_daily_limit: 10000,
      sms_enabled: true,
      email_enabled: true,
      maintenance_mode: false,
    },
  })

  const saveMut = useMutation({
    mutationFn: (data: Partial<PlatformConfig>) => api.patch('/admin/settings', data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000) },
    onError:   () => { setSaved(true); setTimeout(() => setSaved(false), 3000) },
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
          Platform Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Global configuration, feature flags, and templates
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 pb-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-semibold transition-all"
            style={tab === t
              ? {
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-brand)',
                  borderBottom: '2px solid var(--color-brand)',
                  marginBottom: -1,
                  borderRadius: '4px 4px 0 0',
                }
              : { color: 'var(--color-text-tertiary)' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── General ── */}
      {tab === 'General' && (
        <form onSubmit={handleSubmit(d => saveMut.mutate(d))} className="space-y-5">
          <div className="card p-6 space-y-4">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Platform Configuration</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Platform Name', key: 'platform_name', type: 'text' },
                { label: 'Support Email', key: 'support_email', type: 'email' },
                { label: 'Max Bookings / Day', key: 'max_bookings_per_day', type: 'number' },
                { label: 'Triage Daily Limit', key: 'triage_daily_limit', type: 'number' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-semibold mb-1.5 block"
                    style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
                  <input type={type} {...register(key as keyof PlatformConfig)}
                    className={inputCls} style={inputStyle} />
                </div>
              ))}
            </div>
          </div>

          {/* Rate limits */}
          <div className="card p-6 space-y-4">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>API Rate Limits</p>
            <div className="grid grid-cols-3 gap-4">
              {(Object.keys(rateLimits) as (keyof typeof rateLimits)[]).map(k => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1.5 block"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    {k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </label>
                  <input type="number" value={rateLimits[k]}
                    onChange={e => setRateLimits(prev => ({ ...prev, [k]: +e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saveMut.isPending}
              className="flex items-center gap-2 rounded px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#1D4ED8' }}>
              <Save className="h-4 w-4" />
              {saveMut.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* ── Feature Flags ── */}
      {tab === 'Feature Flags' && (
        <div className="space-y-3">
          {FEATURE_FLAGS.map(f => (
            <div key={f.key} className="card p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{f.label}</p>
                  <div className="flex gap-1">
                    {f.plans.map(p => {
                      const bs = PLAN_BADGE_STYLE[p]
                      return (
                        <span key={p} className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: bs.bg, color: bs.color }}>
                          {p}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{f.description}</p>
                <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }}>{f.key}</p>
              </div>
              <button onClick={() => setFlags(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                className="shrink-0 transition-colors">
                {flags[f.key]
                  ? <ToggleRight className="h-7 w-7" style={{ color: 'var(--color-brand)' }} />
                  : <ToggleLeft className="h-7 w-7" style={{ color: 'var(--color-text-tertiary)' }} />}
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button onClick={() => saveMut.mutate({})}
              className="flex items-center gap-2 rounded px-5 py-2.5 text-sm font-bold text-white transition-colors"
              style={{ backgroundColor: '#1D4ED8' }}>
              <Save className="h-4 w-4" /> Save Flags
            </button>
          </div>
        </div>
      )}

      {/* ── SMS Templates ── */}
      {tab === 'SMS Templates' && (
        <div className="space-y-3">
          {SMS_TEMPLATES.map(t => (
            <div key={t.key} className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{t.label}</p>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{t.key}</p>
                </div>
                <button onClick={() => setEditingSms(editingSms === t.key ? null : t.key)}
                  className="text-xs font-semibold transition-colors"
                  style={{ color: 'var(--color-brand)' }}>
                  {editingSms === t.key ? 'Done' : 'Edit'}
                </button>
              </div>
              {editingSms === t.key ? (
                <textarea
                  value={smsTemplates[t.key]}
                  onChange={e => setSmsTemplates(prev => ({ ...prev, [t.key]: e.target.value }))}
                  rows={3}
                  className="w-full rounded border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                  style={inputStyle}
                />
              ) : (
                <p className="text-xs font-mono px-3 py-2 rounded leading-relaxed"
                  style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
                  {smsTemplates[t.key]}
                </p>
              )}
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                Variables: <span className="font-mono" style={{ color: 'var(--color-brand)' }}>
                  {'{name}'} {'{clinic}'} {'{date}'} {'{time}'} {'{ref}'}
                </span>
              </p>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button onClick={() => saveMut.mutate({})}
              className="flex items-center gap-2 rounded px-5 py-2.5 text-sm font-bold text-white transition-colors"
              style={{ backgroundColor: '#1D4ED8' }}>
              <Save className="h-4 w-4" /> Save Templates
            </button>
          </div>
        </div>
      )}

      {/* ── Email Templates ── */}
      {tab === 'Email Templates' && (
        <div className="space-y-3">
          {EMAIL_TEMPLATES.map(t => (
            <div key={t.key} className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{t.label}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{t.description}</p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }}>{t.key}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => api.post(`/admin/email-templates/${t.key}/preview`).catch(() =>
                    alert(`Preview for "${t.label}" would open in a new tab in production.`))}
                  className="rounded border px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  Preview
                </button>
                <button
                  onClick={() => alert(`Edit template "${t.label}" — HTML editor coming soon.`)}
                  className="rounded px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  Edit HTML
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Danger Zone ── */}
      {tab === 'Danger Zone' && (
        <div className="space-y-4">
          {/* Maintenance mode */}
          <div className="card p-5" style={{ borderColor: '#FDE68A' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Maintenance Mode</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  When enabled, all non-admin requests return a 503. Active sessions are preserved.<br/>
                  Use before database migrations or major deploys.
                </p>
              </div>
              <button onClick={() => setConfirmMaint(true)}
                className="shrink-0 flex items-center gap-2 rounded px-4 py-2 text-sm font-bold transition-colors"
                style={maintenanceMode
                  ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                  : { backgroundColor: '#FEF3C7', color: '#92400E' }}>
                {maintenanceMode ? <><ToggleRight className="h-4 w-4" /> Disable</> : <><ToggleLeft className="h-4 w-4" /> Enable</>}
              </button>
            </div>
            {maintenanceMode && (
              <div className="mt-3 flex items-center gap-2 rounded px-3 py-2"
                style={{ backgroundColor: '#FFFBEB' }}>
                <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#D97706' }} />
                <p className="text-xs font-semibold" style={{ color: '#92400E' }}>Platform is currently in maintenance mode</p>
              </div>
            )}
          </div>

          {/* Other danger items */}
          {[
            { title: 'Flush Redis Cache', desc: 'Clears all cached data including session tokens. Users will need to log in again.', action: 'Flush Cache', color: '#DC2626' },
            { title: 'Reset Rate Limits', desc: 'Clears all current rate-limit counters across all users and IPs.', action: 'Reset Limits', color: '#D97706' },
            { title: 'Purge Audit Logs', desc: 'Permanently deletes audit log entries older than 90 days. GDPR compliant.', action: 'Purge Old Logs', color: '#DC2626' },
          ].map(item => (
            <div key={item.title} className="card p-5" style={{ borderColor: '#FECACA' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" style={{ color: '#DC2626', opacity: 0.6 }} />
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{item.title}</p>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</p>
                </div>
                <button
                  onClick={() => { if (confirm(`Are you sure you want to: ${item.title}?`)) { api.post(`/admin/actions/${item.title.toLowerCase().replace(/ /g, '-')}`).catch(() => {}) } }}
                  className="shrink-0 rounded border px-4 py-2 text-xs font-bold transition-opacity hover:opacity-80"
                  style={{ borderColor: item.color, color: item.color }}>
                  {item.action}
                </button>
              </div>
            </div>
          ))}

          {/* Terminal hint */}
          <div className="flex items-start gap-2.5 p-4 rounded"
            style={{ backgroundColor: '#1A1A2E' }}>
            <Terminal className="h-4 w-4 shrink-0 mt-0.5 text-green-400" />
            <div className="font-mono text-xs space-y-1">
              <p style={{ color: '#6B7280' }}># For emergency access run:</p>
              <p className="text-green-400">docker exec -it medassist_api python -m app.scripts.emergency_unlock</p>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance confirm */}
      {confirmMaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="shadow-2xl w-full max-w-sm mx-4 p-6 rounded"
            style={{ backgroundColor: 'var(--color-surface)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {maintenanceMode ? 'Disable Maintenance Mode?' : 'Enable Maintenance Mode?'}
            </h3>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {maintenanceMode
                ? 'The platform will resume normal operation. All endpoints will become accessible.'
                : 'All non-admin traffic will receive a 503. Existing active sessions will be preserved.'}
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmMaint(false)}
                className="flex-1 rounded border px-4 py-2 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                Cancel
              </button>
              <button onClick={() => { setMaintenanceMode(v => !v); setConfirmMaint(false); saveMut.mutate({ maintenance_mode: !maintenanceMode }) }}
                className="flex-1 rounded px-4 py-2 text-sm font-bold text-white transition-colors"
                style={{ backgroundColor: maintenanceMode ? '#059669' : '#D97706' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {saved && <SavedToast onClose={() => setSaved(false)} />}
    </div>
  )
}
