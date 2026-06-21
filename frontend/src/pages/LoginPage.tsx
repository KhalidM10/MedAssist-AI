import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

const PANEL_STATS = [
  { value: '2,400+', label: 'Triage sessions completed' },
  { value: '18', label: 'Clinics onboarded in Nairobi' },
  { value: '4.8/5', label: 'Patient satisfaction rating' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuthStore()
  const [mode, setMode] = useState<'patient' | 'clinic'>('patient')
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
      const next = searchParams.get('next')
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        navigate(next, { replace: true })
      } else if (user?.role === 'super_admin') {
        navigate('/admin', { replace: true })
      } else if (user && CLINIC_ROLES.includes(user.role)) {
        navigate('/clinic-dashboard', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
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

      {/* ── Left: form panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 40px', background: C.canvas, minHeight: '100vh',
        maxWidth: 520,
      }}>
        <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, background: C.dark, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <path d="M1 11L6 11L8 7L11 16L13 6L15 11L21 11" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.text, fontFamily: BODY, lineHeight: 1 }}>MedAssist AI</p>
              <p style={{ fontSize: 11, color: C.muted, fontFamily: BODY, marginTop: 2 }}>Kenya Health Platform</p>
            </div>
          </Link>

          {/* Mode toggle — editorial tab style */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 36, borderBottom: `1px solid ${C.rule}` }}>
            {(['patient', 'clinic'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  padding: '10px 0', marginRight: 28, background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: mode === m ? 500 : 400,
                  color: mode === m ? C.text : C.muted, fontFamily: BODY,
                  borderBottom: mode === m ? `2px solid ${C.brand}` : '2px solid transparent',
                  marginBottom: -1, transition: 'all 0.2s',
                }}
              >
                {m === 'patient' ? 'Patient' : 'Clinic Staff'}
              </button>
            ))}
          </div>

          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h1 style={{
              fontSize: 32, fontWeight: 700, fontFamily: DISPLAY,
              color: C.text, lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.02em',
            }}>
              {mode === 'patient' ? 'Welcome back.' : 'Staff portal.'}
            </h1>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32, fontFamily: BODY, fontWeight: 300 }}>
              {mode === 'patient'
                ? 'Sign in to manage your health'
                : 'Access your clinic dashboard'}
            </p>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <div style={{ position: 'relative' }}>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.password?.message}
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
                      Enter your authenticator code or a backup code to continue.
                    </p>
                  </div>
                  <Input
                    label="6-digit authenticator code"
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

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: C.muted, fontFamily: BODY, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%', padding: '12px', borderRadius: 4, border: 'none',
                background: isSubmitting ? C.muted : C.brand, color: 'white',
                fontSize: 14, fontWeight: 500, fontFamily: BODY, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {isSubmitting ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                  Signing in…
                </>
              ) : (
                requires2FA ? 'Verify & sign in' : 'Sign in'
              )}
            </button>
          </form>

          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: C.muted, fontFamily: BODY }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: C.brand, textDecoration: 'none', fontWeight: 500 }}>
              Create account
            </Link>
          </p>

          {mode === 'clinic' && (
            <p style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: C.muted, fontFamily: BODY }}>
              Admin access?{' '}
              <Link to="/clinic-login" style={{ color: C.brand, textDecoration: 'none' }}>
                Use clinic login
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ── Right: editorial dark panel ── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: 1, flexDirection: 'column', justifyContent: 'center',
          padding: '80px 72px', background: C.dark, position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle, ${C.rule}10 1px, transparent 1px)`,
          backgroundSize: '36px 36px', opacity: 0.8,
        }} />

        {/* Gold rule accent top */}
        <div style={{ position: 'absolute', top: 0, left: 72, right: 72, height: 2, background: C.accent, opacity: 0.4 }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{ width: 20, height: 1, background: C.accent }} />
            <span style={{ fontSize: 11, color: C.accent, fontFamily: BODY, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Kenya-First Health Tech
            </span>
          </div>

          {/* Editorial statement */}
          <h2 style={{
            fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700,
            fontFamily: DISPLAY, color: C.canvas, lineHeight: 1.15,
            letterSpacing: '-0.02em', marginBottom: 20,
          }}>
            Your health,<br />
            <em style={{ color: C.accent }}>guided by AI.</em>
          </h2>

          <p style={{ fontSize: 15, color: `${C.canvas}80`, lineHeight: 1.7, fontFamily: BODY, fontWeight: 300, marginBottom: 52 }}>
            AI-powered triage, verified clinic bookings, and seamless M-Pesa payments — designed for every Kenyan, wherever they are.
          </p>

          {/* Stats — typographic, no cards */}
          <div style={{ borderTop: `1px solid ${C.dark2}`, paddingTop: 36, display: 'flex', flexDirection: 'column', gap: 28 }}>
            {PANEL_STATS.map(({ value, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span style={{ fontSize: 28, fontWeight: 700, fontFamily: DISPLAY, color: C.canvas, lineHeight: 1, letterSpacing: '-0.02em', minWidth: 80 }}>{value}</span>
                <span style={{ fontSize: 13, color: `${C.canvas}55`, fontFamily: BODY, fontWeight: 300 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ECG decorative line */}
          <div style={{ marginTop: 52, opacity: 0.2 }}>
            <svg width="220" height="32" viewBox="0 0 220 32" fill="none">
              <path d="M0 16 L40 16 L52 4 L64 28 L76 2 L88 16 L220 16" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
