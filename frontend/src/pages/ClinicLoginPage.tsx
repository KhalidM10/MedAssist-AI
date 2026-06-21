import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { useAuthStore } from '../store/auth'
import { CLINIC_ROLES } from '../types'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  totp_code: z.string().optional(),
  backup_code: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const BODY = '"DM Sans", system-ui, sans-serif'
const DISPLAY = '"Playfair Display", Georgia, serif'
const MONO = '"JetBrains Mono", monospace'
const C = {
  canvas:   '#F5F0E8',
  surface:  '#FDFAF5',
  dark:     '#1A1A2E',
  dark2:    '#22223A',
  brand:    '#1D4ED8',
  accent:   '#C8A96E',
  rule:     '#D4C9B0',
  text:     '#1A1A2E',
  body:     '#4A4A5A',
  muted:    '#8A8A9A',
  danger:   '#DC2626',
  dangerBg: '#FEF2F2',
}

const CAPABILITIES = [
  { num: '01', title: 'Patient Management', desc: 'Full history, records, and triage context for every patient.' },
  { num: '02', title: 'Appointment Flow', desc: 'Schedule, reschedule, and track from a single view.' },
  { num: '03', title: 'Clinic Analytics', desc: 'Revenue, capacity, completion rates, and seasonal trends.' },
]

export function ClinicLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [serverError, setServerError] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError('')
    try {
      await login(values.email, values.password, values.totp_code, values.backup_code)
      const user = useAuthStore.getState().user
      if (!user || !CLINIC_ROLES.includes(user.role)) {
        setServerError('This portal is for clinic staff only. Please use the patient login.')
        useAuthStore.getState().logout()
        return
      }
      navigate(user.role === 'super_admin' ? '/admin' : '/clinic-dashboard', { replace: true })
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.headers?.['x-2fa-required']) {
        setRequires2FA(true)
        return
      }
      setServerError(err?.response?.data?.detail || 'Login failed. Please try again.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: BODY }}>

      {/* ── Left: dark editorial panel ── */}
      <div
        className="hidden lg:flex"
        style={{
          width: 440, flexShrink: 0, flexDirection: 'column', justifyContent: 'space-between',
          padding: '52px 48px', background: C.dark, position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle, ${C.rule}10 1px, transparent 1px)`,
          backgroundSize: '36px 36px', opacity: 0.8,
        }} />
        {/* Gold accent line top */}
        <div style={{ position: 'absolute', top: 0, left: 48, right: 48, height: 2, background: C.accent, opacity: 0.4 }} />

        {/* Top: logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, background: C.dark2, borderRadius: 4, border: `1px solid ${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
                <path d="M1 11L6 11L8 7L11 16L13 6L15 11L21 11" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.canvas, fontFamily: BODY, lineHeight: 1 }}>MedAssist AI</p>
              <p style={{ fontSize: 10, color: C.accent, fontFamily: BODY, marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Clinic Portal</p>
            </div>
          </Link>
        </div>

        {/* Middle: editorial content */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 20, height: 1, background: C.accent }} />
            <span style={{ fontSize: 10, color: C.accent, fontFamily: BODY, letterSpacing: '0.12em', textTransform: 'uppercase' }}>For Clinic Staff</span>
          </div>

          <h2 style={{
            fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 700,
            fontFamily: DISPLAY, color: C.canvas, lineHeight: 1.15,
            letterSpacing: '-0.02em', marginBottom: 16,
          }}>
            Clinic management,<br />
            <em style={{ color: C.accent }}>reimagined.</em>
          </h2>

          <p style={{ fontSize: 14, color: `${C.canvas}66`, lineHeight: 1.7, fontFamily: BODY, fontWeight: 300, marginBottom: 44 }}>
            Everything your team needs — from scheduling to analytics — in one secure platform.
          </p>

          {/* Capabilities — typographic numbered list */}
          <div style={{ borderTop: `1px solid ${C.dark2}`, paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {CAPABILITIES.map(({ num, title, desc }) => (
              <div key={num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, color: C.accent, fontFamily: MONO, fontWeight: 400, paddingTop: 1, flexShrink: 0 }}>{num}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.canvas, marginBottom: 2, fontFamily: BODY }}>{title}</p>
                  <p style={{ fontSize: 12, color: `${C.canvas}44`, lineHeight: 1.55, fontFamily: BODY, fontWeight: 300 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: footer note */}
        <p style={{ position: 'relative', zIndex: 1, fontSize: 11, color: `${C.canvas}25`, fontFamily: BODY }}>
          © 2026 MedAssist AI · Kenya Health Platform
        </p>
      </div>

      {/* ── Right: form panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 40px', background: C.canvas,
      }}>
        <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>

          {/* Mobile logo */}
          <Link to="/" className="flex lg:hidden" style={{ display: 'none', alignItems: 'center', gap: 10, marginBottom: 40, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, background: C.dark, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
                <path d="M1 11L6 11L8 7L11 16L13 6L15 11L21 11" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.text, fontFamily: BODY, lineHeight: 1 }}>MedAssist AI</p>
              <p style={{ fontSize: 11, color: C.muted, fontFamily: BODY, marginTop: 2 }}>Clinic Portal</p>
            </div>
          </Link>

          {/* Staff portal indicator */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent }} />
            <span style={{ fontSize: 11, color: C.accent, fontFamily: BODY, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Staff Portal</span>
          </div>

          <h1 style={{
            fontSize: 32, fontWeight: 700, fontFamily: DISPLAY,
            color: C.text, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.02em',
          }}>
            Sign in to your clinic.
          </h1>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 32, fontFamily: BODY, fontWeight: 300 }}>
            Use your work email to access the clinic portal
          </p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Work email"
              type="email"
              placeholder="doctor@clinic.com"
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />

            <div style={{ position: 'relative' }}>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.password?.message}
                autoComplete="current-password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 12, top: 30, background: 'none',
                  border: 'none', cursor: 'pointer', color: C.muted, padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <AnimatePresence>
              {requires2FA && (
                <motion.div
                  key="2fa"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: `${C.brand}0A`, border: `1px solid ${C.brand}30`,
                    borderRadius: 4, padding: '10px 12px',
                  }}>
                    <ShieldCheck size={15} style={{ color: C.brand, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: C.body, fontFamily: BODY, lineHeight: 1.5 }}>
                      Two-factor authentication required. Enter your code to continue.
                    </p>
                  </div>
                  <Input
                    label="Authenticator code"
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    error={errors.totp_code?.message}
                    {...register('totp_code')}
                  />
                  <Input
                    label="Or backup code"
                    placeholder="XXXXXXXX"
                    error={errors.backup_code?.message}
                    {...register('backup_code')}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {serverError && (
              <div style={{
                borderRadius: 4, background: C.dangerBg, border: `1px solid ${C.danger}30`,
                padding: '10px 12px', fontSize: 13, color: C.danger, fontFamily: BODY,
              }}>
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%', padding: '12px', borderRadius: 4, border: 'none',
                background: isSubmitting ? C.muted : C.brand, color: 'white',
                fontSize: 14, fontWeight: 500, fontFamily: BODY,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 4,
              }}
            >
              {isSubmitting ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                  Signing in…
                </>
              ) : 'Sign in to portal'}
            </button>
          </form>

          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: C.muted, fontFamily: BODY }}>
            Not clinic staff?{' '}
            <Link to="/login" style={{ color: C.brand, textDecoration: 'none', fontWeight: 500 }}>
              Patient login
            </Link>
          </p>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: C.rule }} />
            <span style={{ fontSize: 11, color: C.muted, fontFamily: BODY, letterSpacing: '0.06em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: C.rule }} />
          </div>

          <Link to="/forgot-password" style={{
            display: 'block', textAlign: 'center', fontSize: 13,
            color: C.muted, fontFamily: BODY, textDecoration: 'none',
          }}>
            Forgot your password?
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1023px) {
          .flex.lg\\:hidden { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
