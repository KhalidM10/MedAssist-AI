import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { PasswordStrengthMeter } from '../components/auth/PasswordStrengthMeter'
import { useAuthStore } from '../store/auth'

const KENYAN_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos',
  'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a",
  'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia',
  'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
]

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const schema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().regex(/^\+254\d{9}$/, 'Format: +254XXXXXXXXX'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Include at least one special character'),
    confirm_password: z.string(),
    county: z.string().optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    date_of_birth: z.string().optional(),
    blood_type: z.string().optional(),
    allergies: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  })

type FormValues = z.infer<typeof schema>

const STEPS = [
  { num: '01', label: 'Account', description: 'Name, email & password' },
  { num: '02', label: 'Location', description: 'County & demographics' },
  { num: '03', label: 'Health', description: 'Medical profile' },
]

const STEP_FIELDS: (keyof FormValues)[][] = [
  ['full_name', 'email', 'phone', 'password', 'confirm_password'],
  ['county', 'gender', 'date_of_birth'],
  ['blood_type', 'allergies', 'emergency_contact_name', 'emergency_contact_phone'],
]

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
  danger:   '#DC2626',
  dangerBg: '#FEF2F2',
}

const selectStyle: React.CSSProperties = {
  height: 40, width: '100%', borderRadius: 4,
  border: `1px solid ${C.rule}`, backgroundColor: C.surface,
  padding: '0 12px', fontSize: 14, color: C.text, fontFamily: BODY,
  outline: 'none', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A9A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: C.muted, fontFamily: BODY,
  display: 'block', marginBottom: 6,
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser } = useAuthStore()
  const [step, setStep] = useState(0)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange' })

  const password = watch('password') || ''

  async function nextStep() {
    const valid = await trigger(STEP_FIELDS[step] as any)
    if (valid) setStep((s) => s + 1)
  }

  async function onSubmit(values: FormValues) {
    setServerError('')
    try {
      await registerUser({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        county: values.county || undefined,
      })
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setServerError(err?.response?.data?.detail || 'Registration failed. Please try again.')
      setStep(0)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: BODY }}>

      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, textDecoration: 'none' }}>
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

      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Step progress — editorial numbered style */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
            {STEPS.map((s, i) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: i < step ? 'none' : i === step ? `1.5px solid ${C.brand}` : `1px solid ${C.rule}`,
                    background: i < step ? C.brand : i === step ? `${C.brand}0A` : 'transparent',
                    transition: 'all 0.2s',
                  }}>
                    {i < step
                      ? <Check size={13} color="white" />
                      : <span style={{ fontSize: 12, fontWeight: 500, color: i === step ? C.brand : C.muted, fontFamily: BODY }}>{i + 1}</span>
                    }
                  </div>
                  <div className="hidden sm:block">
                    <p style={{ fontSize: 12, fontWeight: i <= step ? 500 : 400, color: i <= step ? C.text : C.muted, fontFamily: BODY, lineHeight: 1.2 }}>{s.label}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: i < step ? C.brand : C.rule, margin: '0 12px', transition: 'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: C.rule, borderRadius: 1, overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', background: C.brand, borderRadius: 1 }}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: C.surface, border: `1px solid ${C.rule}`, borderRadius: 4, overflow: 'hidden',
        }}>
          {/* Form area */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ padding: '36px 36px 28px', minHeight: 380 }}>
              <AnimatePresence mode="wait">

                {/* Step 1: Account */}
                {step === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 4, letterSpacing: '-0.01em' }}>Create your account</h2>
                      <p style={{ fontSize: 13, color: C.muted, fontFamily: BODY, fontWeight: 300 }}>Your credentials for signing in</p>
                    </div>
                    <Input
                      label="Full name"
                      placeholder="Jane Wanjiku"
                      error={errors.full_name?.message}
                      {...register('full_name')}
                    />
                    <Input
                      label="Email address"
                      type="email"
                      placeholder="you@example.com"
                      error={errors.email?.message}
                      {...register('email')}
                    />
                    <Input
                      label="Phone number"
                      type="tel"
                      placeholder="+254712345678"
                      hint="Kenya number (+254XXXXXXXXX)"
                      error={errors.phone?.message}
                      {...register('phone')}
                    />
                    <div>
                      <Input
                        label="Password"
                        type="password"
                        placeholder="Min. 8 characters"
                        error={errors.password?.message}
                        {...register('password')}
                      />
                      <PasswordStrengthMeter password={password} />
                    </div>
                    <Input
                      label="Confirm password"
                      type="password"
                      placeholder="Repeat password"
                      error={errors.confirm_password?.message}
                      {...register('confirm_password')}
                    />
                  </motion.div>
                )}

                {/* Step 2: Location */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 4, letterSpacing: '-0.01em' }}>Your location</h2>
                      <p style={{ fontSize: 13, color: C.muted, fontFamily: BODY, fontWeight: 300 }}>Helps us find nearby clinics and services</p>
                    </div>
                    <div>
                      <label style={labelStyle}>County</label>
                      <select style={selectStyle} {...register('county')}>
                        <option value="">Select county (optional)</option>
                        {KENYAN_COUNTIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Gender <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                      <select style={selectStyle} {...register('gender')}>
                        <option value="">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <Input
                      label="Date of birth"
                      type="date"
                      hint="Optional — used for age-appropriate care"
                      {...register('date_of_birth')}
                    />
                  </motion.div>
                )}

                {/* Step 3: Health */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 4, letterSpacing: '-0.01em' }}>Health profile</h2>
                      <p style={{ fontSize: 13, color: C.muted, fontFamily: BODY, fontWeight: 300 }}>All fields optional — helps your doctor</p>
                    </div>
                    <div>
                      <label style={labelStyle}>Blood type</label>
                      <select style={selectStyle} {...register('blood_type')}>
                        <option value="">Unknown</option>
                        {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Known allergies</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Penicillin, peanuts"
                        style={{
                          width: '100%', borderRadius: 4, border: `1px solid ${C.rule}`,
                          background: C.surface, padding: '8px 12px', fontSize: 14,
                          color: C.text, fontFamily: BODY, resize: 'none', outline: 'none',
                          lineHeight: 1.5,
                        }}
                        {...register('allergies')}
                      />
                    </div>
                    <Input
                      label="Emergency contact name"
                      placeholder="John Wanjiku"
                      {...register('emergency_contact_name')}
                    />
                    <Input
                      label="Emergency contact phone"
                      type="tel"
                      placeholder="+254712345678"
                      {...register('emergency_contact_phone')}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {serverError && (
              <div style={{
                margin: '0 36px 20px', borderRadius: 4,
                background: C.dangerBg, border: `1px solid ${C.danger}30`,
                padding: '10px 12px', fontSize: 13, color: C.danger, fontFamily: BODY,
              }}>
                {serverError}
              </div>
            )}

            {/* Navigation */}
            <div style={{
              padding: '20px 36px 32px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              borderTop: `1px solid ${C.rule}`,
            }}>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: `1px solid ${C.rule}`, borderRadius: 4,
                    padding: '10px 18px', fontSize: 13, fontWeight: 400,
                    color: C.body, fontFamily: BODY, cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={14} /> Back
                </button>
              ) : (
                <div />
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: C.brand, border: 'none', borderRadius: 4,
                    padding: '10px 22px', fontSize: 13, fontWeight: 500,
                    color: 'white', fontFamily: BODY, cursor: 'pointer',
                  }}
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: isSubmitting ? C.muted : C.brand, border: 'none', borderRadius: 4,
                    padding: '10px 22px', fontSize: 13, fontWeight: 500,
                    color: 'white', fontFamily: BODY, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                      Creating…
                    </>
                  ) : (
                    <><Check size={14} /> Create account</>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: C.muted, fontFamily: BODY }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: C.brand, textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { font-family: ${BODY}; }
      `}</style>
    </div>
  )
}
