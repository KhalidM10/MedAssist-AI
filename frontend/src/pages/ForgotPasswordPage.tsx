import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { PasswordStrengthMeter } from '../components/auth/PasswordStrengthMeter'
import { api } from '../lib/api'

type Step = 'email' | 'sent' | 'reset' | 'success'

const emailSchema = z.object({ email: z.string().email('Enter a valid email') })
type EmailForm = z.infer<typeof emailSchema>

const resetSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Need uppercase')
      .regex(/[0-9]/, 'Need number')
      .regex(/[^A-Za-z0-9]/, 'Need special character'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  })
type ResetForm = z.infer<typeof resetSchema>

const BODY = '"DM Sans", system-ui, sans-serif'
const DISPLAY = '"Playfair Display", Georgia, serif'
const C = {
  canvas:   '#F5F0E8',
  surface:  '#FDFAF5',
  dark:     '#1A1A2E',
  brand:    '#1D4ED8',
  accent:   '#C8A96E',
  rule:     '#D4C9B0',
  text:     '#1A1A2E',
  body:     '#4A4A5A',
  muted:    '#8A8A9A',
  success:  '#059669',
  warning:  '#D97706',
  danger:   '#DC2626',
}

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })
  const newPassword = resetForm.watch('new_password') || ''

  async function onRequestReset(values: EmailForm) {
    await api.post('/auth/forgot-password', null, { params: { email: values.email } })
    setEmail(values.email)
    setStep('sent')
  }

  async function onResetPassword(values: ResetForm) {
    await api.post('/auth/reset-password', null, {
      params: { token: values.token, new_password: values.new_password },
    })
    setStep('success')
  }

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: BODY }}>

      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, textDecoration: 'none' }}>
        <div style={{ width: 30, height: 30, background: C.dark, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
            <path d="M1 11L6 11L8 7L11 16L13 6L15 11L21 11" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.text, fontFamily: BODY, lineHeight: 1 }}>MedAssist AI</p>
          <p style={{ fontSize: 11, color: C.muted, fontFamily: BODY, marginTop: 2 }}>Kenya Health Platform</p>
        </div>
      </Link>

      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.rule}`, borderRadius: 4, padding: '40px 36px' }}>
          <AnimatePresence mode="wait">

            {/* Step 1: Email */}
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 20, height: 1, background: C.accent }} />
                  <span style={{ fontSize: 10, color: C.accent, fontFamily: BODY, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Password Reset</span>
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                  Forgot your password?
                </h1>
                <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, fontFamily: BODY, fontWeight: 300, lineHeight: 1.6 }}>
                  Enter your email and we'll send you a reset link.
                </p>

                <form
                  onSubmit={emailForm.handleSubmit(onRequestReset)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    error={emailForm.formState.errors.email?.message}
                    {...emailForm.register('email')}
                  />
                  {emailForm.formState.errors.root && (
                    <p style={{ fontSize: 12, color: C.danger, fontFamily: BODY }}>
                      {emailForm.formState.errors.root.message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={emailForm.formState.isSubmitting}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 4, border: 'none',
                      background: emailForm.formState.isSubmitting ? C.muted : C.brand,
                      color: 'white', fontSize: 14, fontWeight: 500, fontFamily: BODY,
                      cursor: emailForm.formState.isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {emailForm.formState.isSubmitting ? (
                      <>
                        <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                        Sending…
                      </>
                    ) : 'Send reset link'}
                  </button>
                </form>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, textDecoration: 'none', fontFamily: BODY }}>
                    <ArrowLeft size={13} /> Back to sign in
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Step 2: Sent */}
            {step === 'sent' && (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 4, background: `${C.success}12`, border: `1px solid ${C.success}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 8, letterSpacing: '-0.01em' }}>Check your inbox</h1>
                <p style={{ fontSize: 14, color: C.muted, marginBottom: 4, fontFamily: BODY, fontWeight: 300 }}>We sent a reset link to</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 24, fontFamily: BODY, wordBreak: 'break-all' }}>{email}</p>

                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 4, padding: '12px 14px', marginBottom: 24,
                }}>
                  <p style={{ fontSize: 12, color: C.warning, fontFamily: BODY, lineHeight: 1.6 }}>
                    Didn't receive it? Check your spam folder or wait a minute. The link expires in <strong>1 hour</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('reset')}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 4, marginBottom: 10,
                    border: `1px solid ${C.rule}`, background: 'transparent',
                    color: C.body, fontSize: 14, fontFamily: BODY, cursor: 'pointer',
                  }}
                >
                  I have my reset code
                </button>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  style={{ width: '100%', fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '8px', fontFamily: BODY }}
                >
                  Try a different email
                </button>
              </motion.div>
            )}

            {/* Step 3: Reset form */}
            {step === 'reset' && (
              <motion.div
                key="reset"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 4, background: `${C.brand}10`, border: `1px solid ${C.brand}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <ShieldCheck size={18} style={{ color: C.brand }} />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 8, letterSpacing: '-0.01em' }}>Set new password</h1>
                <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, fontFamily: BODY, fontWeight: 300 }}>
                  Enter the token from your email and your new password.
                </p>

                <form
                  onSubmit={resetForm.handleSubmit(onResetPassword)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <Input
                    label="Reset token"
                    placeholder="Paste token from email"
                    error={resetForm.formState.errors.token?.message}
                    {...resetForm.register('token')}
                  />
                  <div>
                    <Input
                      label="New password"
                      type="password"
                      placeholder="Min. 8 characters"
                      error={resetForm.formState.errors.new_password?.message}
                      {...resetForm.register('new_password')}
                    />
                    <PasswordStrengthMeter password={newPassword} />
                  </div>
                  <Input
                    label="Confirm new password"
                    type="password"
                    placeholder="Repeat password"
                    error={resetForm.formState.errors.confirm_password?.message}
                    {...resetForm.register('confirm_password')}
                  />
                  {resetForm.formState.errors.root && (
                    <p style={{ fontSize: 12, color: C.danger, fontFamily: BODY }}>
                      {resetForm.formState.errors.root.message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={resetForm.formState.isSubmitting}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 4, border: 'none',
                      background: resetForm.formState.isSubmitting ? C.muted : C.brand,
                      color: 'white', fontSize: 14, fontWeight: 500, fontFamily: BODY,
                      cursor: resetForm.formState.isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {resetForm.formState.isSubmitting ? (
                      <>
                        <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                        Resetting…
                      </>
                    ) : (
                      <><ShieldCheck size={14} /> Reset password</>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setStep('sent')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: BODY }}
                  >
                    <ArrowLeft size={13} /> Back
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Success */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 4, background: `${C.success}10`, border: `1px solid ${C.success}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <CheckCircle2 size={24} style={{ color: C.success }} />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 8, letterSpacing: '-0.01em' }}>Password updated.</h1>
                <p style={{ fontSize: 14, color: C.muted, marginBottom: 32, fontFamily: BODY, fontWeight: 300, lineHeight: 1.6 }}>
                  Your password has been changed. You can now sign in with your new credentials.
                </p>
                <Link to="/login" style={{
                  display: 'block', textAlign: 'center', padding: '12px', borderRadius: 4,
                  background: C.brand, color: 'white', textDecoration: 'none',
                  fontSize: 14, fontWeight: 500, fontFamily: BODY,
                }}>
                  Sign in now
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
