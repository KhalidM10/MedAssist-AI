import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Menu, X, CheckCircle2 } from 'lucide-react'
import { TriageDemo } from '../components/landing/TriageDemo'
import { SEO } from '../components/seo/SEO'
import { api } from '../lib/api'

const JSON_LD_MEDICAL_BUSINESS = {
  '@context': 'https://schema.org',
  '@type': 'MedicalBusiness',
  name: 'MedAssist AI',
  description: 'AI-powered healthcare platform connecting Kenyan patients with clinics through intelligent triage, instant booking, and medicine ordering.',
  url: 'https://medassist.ai',
  areaServed: { '@type': 'Country', name: 'Kenya' },
  availableService: [
    { '@type': 'MedicalTherapy', name: 'AI Symptom Triage' },
    { '@type': 'MedicalTherapy', name: 'Clinic Appointment Booking' },
    { '@type': 'MedicalTherapy', name: 'Online Medicine Ordering' },
  ],
}

const JSON_LD_WEB_APP = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MedAssist AI',
  url: 'https://medassist.ai',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KES' },
}

const DISPLAY = '"Playfair Display", Georgia, serif'
const BODY = '"DM Sans", system-ui, sans-serif'
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
  muted:    '#8A8A9A',
  body:     '#4A4A5A',
  success:  '#059669',
  danger:   '#DC2626',
  warning:  '#D97706',
}

function useFadeIn(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el) } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function FadeIn({ children, delay = 0, className = '', up = true }: {
  children: React.ReactNode; delay?: number; className?: string; up?: boolean
}) {
  const { ref, visible } = useFadeIn()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : up ? 'translateY(24px)' : 'translateY(6px)',
        transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

function CountUp({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0)
  const { ref, visible } = useFadeIn()
  useEffect(() => {
    if (!visible) return
    const duration = 1800
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, target])
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>
}

/* ── Phone Mockup — updated for editorial palette ── */
function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 260, fontFamily: BODY }}>
      <div style={{
        position: 'absolute', top: 20, right: -52, zIndex: 10, minWidth: 160,
        background: C.surface, borderRadius: 4, padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(26,26,46,0.12)', border: `1px solid ${C.rule}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: C.success, fontFamily: BODY }}>Booking Confirmed</span>
        </div>
        <p style={{ fontSize: 9, color: C.muted, lineHeight: 1.4, fontFamily: BODY }}>Dr. Kamau Njoroge · Today 10:30 AM</p>
      </div>
      <div style={{
        position: 'relative', zIndex: 1,
        width: 260, height: 520, borderRadius: 40,
        background: '#111827', border: '7px solid #1f2937',
        boxShadow: '0 24px 60px rgba(26,26,46,0.3)',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 80, height: 24, background: '#111827', borderRadius: '0 0 16px 16px', zIndex: 10 }} />
        <div style={{ background: C.canvas, height: '100%', overflow: 'hidden', paddingTop: 28 }}>
          <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, background: C.dark, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="8" viewBox="0 0 22 22" fill="none"><path d="M1 11L6 11L8 7L11 16L13 6L15 11L21 11" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: C.text, fontFamily: BODY }}>MedAssist</span>
            </div>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.rule, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 500, color: C.body }}>J</span>
            </div>
          </div>
          <div style={{ padding: '0 12px', overflow: 'hidden' }}>
            <p style={{ fontSize: 9, color: C.muted, marginBottom: 10, fontFamily: BODY }}>Good morning, Jane · Nairobi</p>
            <div style={{ background: '#FFFBEB', borderRadius: 4, padding: '10px 12px', marginBottom: 8, border: `1px solid #FDE68A` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.warning }} />
                <span style={{ fontSize: 8, fontWeight: 500, color: '#92400E', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BODY }}>MODERATE CONCERN</span>
              </div>
              <p style={{ fontSize: 8.5, color: '#78350F', lineHeight: 1.5, fontFamily: BODY }}>Consider seeing a doctor within 24 hours. Symptoms suggest possible infection.</p>
            </div>
            <div style={{ background: C.surface, borderRadius: 4, padding: '10px 12px', marginBottom: 8, border: `1px solid ${C.rule}` }}>
              <p style={{ fontSize: 9, fontWeight: 500, color: C.text, marginBottom: 7, fontFamily: BODY }}>Nearby Clinics</p>
              {[['Westlands Medical', '0.8 km', 1500], ['City Health Clinic', '1.2 km', 1200]].map(([name, dist, fee]) => (
                <div key={String(name)} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, background: `${C.brand}18`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, background: C.brand, borderRadius: 1 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 8.5, fontWeight: 500, color: C.text, fontFamily: BODY }}>{name}</p>
                    <p style={{ fontSize: 7.5, color: C.muted, fontFamily: BODY }}>{dist} · KES {Number(fee).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              <div style={{ background: C.brand, borderRadius: 4, padding: '6px 10px', textAlign: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 8.5, fontWeight: 500, color: 'white', fontFamily: BODY }}>Book Appointment</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', background: C.surface, borderRadius: 4, padding: '7px 4px', border: `1px solid ${C.rule}` }}>
              {[{ l: 'Home', a: true }, { l: 'Clinics', a: false }, { l: 'Rx', a: false }, { l: 'Me', a: false }].map(({ l, a }) => (
                <div key={l} style={{ textAlign: 'center', padding: '0 8px' }}>
                  <div style={{ width: '100%', height: 2, background: a ? C.brand : C.rule, marginBottom: 2 }} />
                  <span style={{ fontSize: 7, color: a ? C.brand : C.muted, fontWeight: a ? 500 : 400, fontFamily: BODY }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard Mockup — updated for editorial palette ── */
function DashboardMockup() {
  const bars = [45, 62, 58, 71, 80, 76, 90]
  return (
    <div style={{
      background: C.dark, borderRadius: 4, overflow: 'hidden',
      boxShadow: '0 24px 48px rgba(26,26,46,0.3)', fontFamily: BODY,
    }}>
      <div style={{ background: '#0F0F1E', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: C.dark2, borderRadius: 2, padding: '4px 10px', margin: '0 10px' }}>
          <span style={{ fontSize: 9, color: C.muted, fontFamily: MONO }}>app.medassist.co.ke/dashboard</span>
        </div>
      </div>
      <div style={{ display: 'flex', height: 280 }}>
        <div style={{ width: 44, background: '#0F0F1E', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {['▦','⊞','◈','⊕'].map((sym, i) => (
            <div key={i} style={{ width: 28, height: 28, borderRadius: 4, background: i === 0 ? `${C.accent}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: i === 0 ? C.accent : 'rgba(255,255,255,0.2)' }}>{sym}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, background: C.canvas, padding: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: "Today's Appts", value: '12', color: C.brand },
              { label: 'Week Revenue', value: 'KES 48k', color: C.success },
              { label: 'Completion', value: '87%', color: C.accent },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: C.surface, borderRadius: 4, padding: '8px 10px', border: `1px solid ${C.rule}` }}>
                <p style={{ fontSize: 8, color: C.muted, marginBottom: 3, fontFamily: BODY }}>{label}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color, fontFamily: DISPLAY }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ background: C.surface, borderRadius: 4, padding: '10px 12px', border: `1px solid ${C.rule}` }}>
            <p style={{ fontSize: 8.5, fontWeight: 500, color: C.text, marginBottom: 8, fontFamily: BODY }}>Weekly Appointments</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 50 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', background: i === bars.length - 1 ? C.brand : `${C.brand}28`, height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Navbar ── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const scroll = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      transition: 'all 0.3s ease',
      background: scrolled ? `${C.surface}F0` : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.rule}` : 'none',
      fontFamily: BODY,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 30, height: 30, background: C.dark, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none"><path d="M1 11L6 11L8 7L11 16L13 6L15 11L21 11" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 500, color: scrolled ? C.text : C.canvas, fontFamily: BODY, letterSpacing: '-0.01em' }}>MedAssist AI</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="hidden md:flex">
          {[['For Patients', 'solution'], ['How It Works', 'how-it-works'], ['For Clinics', 'for-clinics'], ['Pricing', 'pricing']].map(([label, id]) => (
            <button key={id} onClick={() => scroll(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 13, fontWeight: 400, fontFamily: BODY,
              color: scrolled ? C.body : `${C.canvas}CC`,
              transition: 'color 0.2s',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="hidden md:flex">
          <Link to="/login" style={{
            fontSize: 13, fontWeight: 400, color: scrolled ? C.body : `${C.canvas}CC`,
            textDecoration: 'none', padding: '8px 16px', fontFamily: BODY,
            border: `1px solid ${scrolled ? C.rule : 'rgba(245,240,232,0.3)'}`,
            borderRadius: 4, transition: 'all 0.2s',
          }}>Sign in</Link>
          <Link to="/register" style={{
            fontSize: 13, fontWeight: 500, color: 'white', textDecoration: 'none',
            padding: '8px 18px', borderRadius: 4, background: C.brand,
            fontFamily: BODY, transition: 'all 0.2s',
          }}>Get Started</Link>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: scrolled ? C.text : C.canvas, padding: 4 }} className="flex md:hidden">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div style={{ background: C.surface, borderTop: `1px solid ${C.rule}`, padding: '16px 24px 20px', fontFamily: BODY }}>
          {[['For Patients', 'solution'], ['How It Works', 'how-it-works'], ['For Clinics', 'for-clinics'], ['Pricing', 'pricing']].map(([label, id]) => (
            <button key={id} onClick={() => scroll(id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 400, color: C.body, padding: '10px 0', borderBottom: `1px solid ${C.rule}`, fontFamily: BODY }}>{label}</button>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Link to="/login" style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 400, color: C.body, textDecoration: 'none', padding: '10px', borderRadius: 4, border: `1px solid ${C.rule}`, fontFamily: BODY }}>Sign in</Link>
            <Link to="/register" style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'white', textDecoration: 'none', padding: '10px', borderRadius: 4, background: C.brand, fontFamily: BODY }}>Get Started</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

/* ── Section label component ── */
function SectionLabel({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <div style={{ width: 24, height: 1, background: C.accent }} />
      <span style={{
        fontSize: 11, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: light ? `${C.accent}` : C.accent, fontFamily: BODY,
      }}>{children}</span>
    </div>
  )
}

/* ── Main export ── */
interface PlatformStats {
  total_clinics: number
  total_triage_sessions: number
  total_appointments: number
  total_patients: number
}

export function LandingPage() {
  const [billingAnnual, setBillingAnnual] = useState(true)
  const [investorEmail, setInvestorEmail] = useState('')
  const [deckSent, setDeckSent] = useState(false)

  const { data: platformStats } = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/platform/stats').then(r => r.data),
    staleTime: 300_000,
  })
  const ps: PlatformStats = platformStats ?? {
    total_clinics: 0,
    total_triage_sessions: 0,
    total_appointments: 0,
    total_patients: 0,
  }

  function handleDeckRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!investorEmail) return
    setDeckSent(true)
  }

  const W: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 40px' }

  const pricing = {
    patient: { monthly: 0, annual: 0 },
    pro: { monthly: 4999, annual: 3999 },
    enterprise: { monthly: 14999, annual: 11999 },
  }

  return (
    <div style={{ fontFamily: BODY, background: C.canvas, color: C.text, overflowX: 'hidden' }}>
      <SEO
        canonical="https://medassist.ai/"
        keywords="healthcare Kenya, AI triage, clinic booking Nairobi, online doctor, medicine delivery Kenya"
        jsonLd={[JSON_LD_MEDICAL_BUSINESS, JSON_LD_WEB_APP]}
      />
      <Navbar />

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: C.dark,
        minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 64,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle, ${C.rule}18 1px, transparent 1px)`,
          backgroundSize: '40px 40px', opacity: 0.6,
        }} />

        <div style={{ ...W, width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', padding: '100px 40px' }}>
          <div>
            <SectionLabel light>Kenya-First Health Tech · Series A</SectionLabel>

            <h1 style={{
              fontSize: 'clamp(44px, 7vw, 82px)', fontWeight: 700,
              fontFamily: DISPLAY, color: C.canvas, lineHeight: 1.05,
              letterSpacing: '-0.02em', marginBottom: 28,
            }}>
              Healthcare<br />
              <em style={{ fontStyle: 'italic', color: C.accent }}>Access</em><br />
              for Every<br />Kenyan.
            </h1>

            <p style={{ fontSize: 16, color: `${C.canvas}99`, lineHeight: 1.75, marginBottom: 40, maxWidth: 420, fontFamily: BODY, fontWeight: 300 }}>
              MedAssist AI connects patients with clinics through intelligent triage, instant appointment booking, and seamless medicine ordering — all via M-Pesa.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 56 }}>
              <Link to="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: C.brand, color: 'white', textDecoration: 'none',
                padding: '13px 28px', borderRadius: 4, fontSize: 14, fontWeight: 500,
                fontFamily: BODY, transition: 'opacity 0.2s',
              }}>
                Check Your Symptoms <ArrowRight size={15} />
              </Link>
              <button onClick={() => document.getElementById('for-clinics')?.scrollIntoView({ behavior: 'smooth' })} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', color: `${C.canvas}CC`,
                border: `1px solid ${C.canvas}33`,
                padding: '13px 28px', borderRadius: 4, fontSize: 14, fontWeight: 400,
                fontFamily: BODY, cursor: 'pointer', transition: 'all 0.2s',
              }}>
                For Clinics
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {['Rule-Based AI', 'HIPAA Aware', 'M-Pesa Ready', 'Kenya-First'].map(badge => (
                <span key={badge} style={{
                  fontSize: 11, color: `${C.canvas}55`, fontFamily: BODY,
                  fontWeight: 400, letterSpacing: '0.06em',
                }}>{badge}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <PhoneMockup />
          </div>
        </div>

        {/* Bottom rule */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${C.accent}40, transparent)` }} />
      </section>

      {/* ── 2. PROBLEM — full-bleed dark, typographic ───────────────────────── */}
      <section id="problem" style={{ background: '#0F0F1E', padding: '120px 0' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ marginBottom: 80 }}>
              <SectionLabel light>The Problem</SectionLabel>
              <h2 style={{
                fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700,
                fontFamily: DISPLAY, color: C.canvas, lineHeight: 1.1,
                letterSpacing: '-0.02em', maxWidth: 640,
              }}>
                Healthcare access<br />in Kenya is broken.
              </h2>
            </div>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: `1px solid ${C.dark2}` }}>
            {[
              { stat: '73%', desc: 'of Kenyans live more than 5km from a clinic', context: 'Infrastructure gap' },
              { stat: '4.5h', desc: 'average wait time at public hospitals in Nairobi', context: 'Time cost' },
              { stat: '1:10k', desc: 'doctor-to-patient ratio in rural Kenya', context: 'Workforce deficit' },
            ].map(({ stat, desc, context }, i) => (
              <FadeIn key={stat} delay={i * 0.1}>
                <div style={{
                  padding: '48px 40px 48px 0',
                  borderRight: i < 2 ? `1px solid ${C.dark2}` : 'none',
                  marginRight: i < 2 ? 40 : 0,
                  paddingLeft: i > 0 ? 40 : 0,
                }}>
                  <span style={{ fontSize: 11, color: C.accent, fontFamily: BODY, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 16, fontWeight: 400 }}>{context}</span>
                  <p style={{
                    fontSize: 'clamp(52px, 7vw, 80px)', fontWeight: 700,
                    fontFamily: DISPLAY, color: C.canvas, lineHeight: 1,
                    letterSpacing: '-0.03em', marginBottom: 20,
                  }}>{stat}</p>
                  <p style={{ fontSize: 14, color: `${C.canvas}66`, lineHeight: 1.6, fontFamily: BODY, fontWeight: 300, maxWidth: 220 }}>{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.4}>
            <p style={{ fontSize: 11, color: `${C.canvas}30`, marginTop: 48, fontFamily: BODY, letterSpacing: '0.04em' }}>
              Source: Kenya Health Policy Framework · Ministry of Health, 2023
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── 3. FOR PATIENTS ─────────────────────────────────────────────────── */}
      <section id="solution" style={{ background: C.canvas, padding: '120px 0' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 80, marginBottom: 80 }}>
              <div>
                <SectionLabel>For Patients</SectionLabel>
                <h2 style={{
                  fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 700,
                  fontFamily: DISPLAY, color: C.text, lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                }}>
                  Everything<br />you need,<br /><em style={{ color: C.brand }}>one app.</em>
                </h2>
              </div>
              <div style={{ paddingTop: 8 }}>
                <p style={{ fontSize: 17, color: C.body, lineHeight: 1.7, fontFamily: BODY, fontWeight: 300, marginBottom: 0, maxWidth: 520 }}>
                  From knowing when to see a doctor to ordering medicine — MedAssist has you covered with AI-powered triage, verified clinic bookings, and M-Pesa payments built for Kenyan mobile networks.
                </p>
              </div>
            </div>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, border: `1px solid ${C.rule}`, borderRadius: 4, overflow: 'hidden' }}>
            {[
              { num: '01', title: 'AI Symptom Triage', desc: 'Know if you need a doctor in 60 seconds. Our rule-based engine analyzes your symptoms and gives clear, safe guidance — not a diagnosis.', badge: 'Core Feature' },
              { num: '02', title: 'Smart Appointment Booking', desc: 'Book clinic appointments without a single phone call. See real-time availability, pick your doctor, and pay with M-Pesa.', badge: 'Live' },
              { num: '03', title: 'OTC Medicine Ordering', desc: 'Order genuine OTC medicines from verified pharmacies in your area. Delivery or clinic pickup — your choice.', badge: 'Live' },
              { num: '04', title: 'Secure Health Records', desc: 'Your triage history, appointment records, and allergies — safely stored and accessible only to you and your care providers.', badge: 'Patients' },
            ].map(({ num, title, desc, badge }, i) => (
              <FadeIn key={num} delay={i * 0.08}>
                <div style={{
                  background: C.surface, padding: '40px 36px',
                  borderRight: i % 2 === 0 ? `1px solid ${C.rule}` : 'none',
                  borderBottom: i < 2 ? `1px solid ${C.rule}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <span style={{ fontSize: 48, fontWeight: 700, fontFamily: DISPLAY, color: `${C.rule}`, lineHeight: 1 }}>{num}</span>
                    <span style={{ fontSize: 10, color: C.accent, fontFamily: BODY, letterSpacing: '0.08em', textTransform: 'uppercase', paddingTop: 4 }}>{badge}</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 12, lineHeight: 1.2 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: C.body, lineHeight: 1.7, fontFamily: BODY, fontWeight: 300 }}>{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: C.surface, padding: '120px 0', borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}` }}>
        <div style={W}>
          <FadeIn>
            <div style={{ marginBottom: 72 }}>
              <SectionLabel>How It Works</SectionLabel>
              <h2 style={{
                fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 700,
                fontFamily: DISPLAY, color: C.text, lineHeight: 1.1,
                letterSpacing: '-0.02em', maxWidth: 540,
              }}>
                From symptoms to care<br />in three steps.
              </h2>
            </div>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            {[
              { step: '01', title: 'Describe Your Symptoms', desc: 'Select or type your symptoms into the AI triage engine. Takes under 60 seconds.' },
              { step: '02', title: 'Get Guidance & Book', desc: 'Receive a triage result with clear next steps. Book a clinic appointment directly if needed.' },
              { step: '03', title: 'Pick Up or Get Delivery', desc: 'Collect prescribed medicines from a verified pharmacy or have them delivered to your door.' },
            ].map(({ step, title, desc }, i) => (
              <FadeIn key={step} delay={i * 0.12}>
                <div style={{
                  padding: '0 48px 0 0',
                  borderRight: i < 2 ? `1px solid ${C.rule}` : 'none',
                  marginRight: i < 2 ? 48 : 0,
                  paddingLeft: i > 0 ? 48 : 0,
                }}>
                  <span style={{
                    display: 'block', fontSize: 64, fontWeight: 700, fontFamily: DISPLAY,
                    color: C.rule, lineHeight: 1, marginBottom: 28, letterSpacing: '-0.03em',
                  }}>{step}</span>
                  <h3 style={{ fontSize: 19, fontWeight: 700, fontFamily: DISPLAY, color: C.text, marginBottom: 14, lineHeight: 1.2 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: C.body, lineHeight: 1.7, fontFamily: BODY, fontWeight: 300 }}>{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. LIVE TRIAGE DEMO ─────────────────────────────────────────────── */}
      <section id="ai-triage" style={{ background: C.canvas, padding: '120px 0' }}>
        <div style={{ ...W, maxWidth: 860, margin: '0 auto', padding: '0 40px' }}>
          <FadeIn>
            <div style={{ marginBottom: 48 }}>
              <SectionLabel>Try It Live · Real Backend</SectionLabel>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
                fontFamily: DISPLAY, color: C.text, lineHeight: 1.1,
                letterSpacing: '-0.02em', marginBottom: 16,
              }}>
                The AI Triage Engine
              </h2>
              <p style={{ fontSize: 16, color: C.body, maxWidth: 480, fontFamily: BODY, fontWeight: 300, lineHeight: 1.6 }}>
                Select your symptoms and get an instant AI-powered assessment — connected to our live backend.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <TriageDemo />
          </FadeIn>
        </div>
      </section>

      {/* ── 6. FOR CLINICS ──────────────────────────────────────────────────── */}
      <section id="for-clinics" style={{ background: C.dark, padding: '120px 0' }}>
        <div style={{ ...W, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <FadeIn>
            <div>
              <SectionLabel light>For Clinics</SectionLabel>
              <h2 style={{
                fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 700,
                fontFamily: DISPLAY, color: C.canvas, lineHeight: 1.1,
                letterSpacing: '-0.02em', marginBottom: 24,
              }}>
                Built for<br /><em style={{ color: C.accent }}>Kenyan clinics.</em>
              </h2>
              <p style={{ fontSize: 16, color: `${C.canvas}80`, lineHeight: 1.75, fontFamily: BODY, fontWeight: 300, marginBottom: 40 }}>
                Give your clinic a modern operations hub. Manage appointments, track revenue, and grow your patient base — all from one dashboard.
              </p>

              <div style={{ borderTop: `1px solid ${C.dark2}`, paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 40 }}>
                {[
                  { num: '01', label: 'More Bookings', desc: 'Appear in patient searches. Fill empty slots automatically.' },
                  { num: '02', label: 'Better Patient Data', desc: 'Unified records, triage history, and appointment logs.' },
                  { num: '03', label: 'Revenue Analytics', desc: 'Track earnings, completion rates, and seasonal trends.' },
                ].map(({ num, label, desc }) => (
                  <div key={num} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: C.accent, fontFamily: MONO, fontWeight: 400, paddingTop: 2, flexShrink: 0 }}>{num}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: C.canvas, marginBottom: 4, fontFamily: BODY }}>{label}</p>
                      <p style={{ fontSize: 13, color: `${C.canvas}55`, lineHeight: 1.55, fontFamily: BODY, fontWeight: 300 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Link to="/register/clinic" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: C.brand, color: 'white', textDecoration: 'none',
                  padding: '13px 24px', borderRadius: 4, fontSize: 14, fontWeight: 500,
                  fontFamily: BODY,
                }}>
                  Register Your Clinic <ArrowRight size={14} />
                </Link>
                <span style={{ fontSize: 12, color: `${C.canvas}44`, fontFamily: BODY }}>Free 14-day trial · No credit card</span>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <DashboardMockup />
          </FadeIn>
        </div>
      </section>

      {/* ── 7. EARLY COMMUNITY ──────────────────────────────────────────────── */}
      <section id="testimonials" style={{ background: C.canvas, padding: '120px 0', borderTop: `1px solid ${C.rule}` }}>
        <div style={W}>
          <FadeIn>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', marginBottom: 80 }}>
              <div>
                <SectionLabel>Early Community</SectionLabel>
                <h2 style={{
                  fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 700,
                  fontFamily: DISPLAY, color: C.text, lineHeight: 1.1,
                  letterSpacing: '-0.02em', marginBottom: 24,
                }}>
                  Our first patients<br />will shape Kenya's<br /><em style={{ color: C.brand }}>healthcare future.</em>
                </h2>
                <p style={{
                  fontSize: 16, color: C.body, lineHeight: 1.75,
                  fontFamily: BODY, fontWeight: 300, marginBottom: 36, maxWidth: 420,
                }}>
                  Be among the first to use MedAssist AI — and help us build the platform that 55 million Kenyans deserve. Your feedback shapes every feature we ship.
                </p>
                <Link to="/register" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: C.brand, color: 'white', textDecoration: 'none',
                  padding: '13px 28px', borderRadius: 4, fontSize: 14, fontWeight: 500,
                  fontFamily: BODY,
                }}>
                  Join Early Access <ArrowRight size={14} />
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${C.rule}`, borderRadius: 4, overflow: 'hidden' }}>
                {[
                  { num: '01', title: 'Your safety first', body: 'Conservative triage that escalates when uncertain. We are a guidance tool, never a replacement for a doctor.' },
                  { num: '02', title: 'Real clinics only', body: 'Every clinic on the platform is verified against the Kenya Medical Practitioners and Dentists Council register.' },
                  { num: '03', title: 'Your data, private', body: 'Health data stays encrypted and is never sold. You control who sees your records.' },
                ].map(({ num, title, body }, i) => (
                  <div key={num} style={{
                    padding: '28px 32px',
                    borderBottom: i < 2 ? `1px solid ${C.rule}` : 'none',
                    background: C.surface,
                  }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: C.accent, fontFamily: MONO, fontWeight: 400, paddingTop: 3, flexShrink: 0 }}>{num}</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6, fontFamily: BODY }}>{title}</p>
                        <p style={{ fontSize: 13, color: C.body, lineHeight: 1.6, fontFamily: BODY, fontWeight: 300 }}>{body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Trust indicators */}
          <FadeIn delay={0.3}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 40, flexWrap: 'wrap', borderTop: `1px solid ${C.rule}`, paddingTop: 32 }}>
              {[
                'HIPAA Aware',
                'Verified Clinics Only',
                'M-Pesa Integrated',
                'Kenya-First',
              ].map((label) => (
                <span key={label} style={{ fontSize: 11, fontWeight: 400, color: C.muted, fontFamily: BODY, letterSpacing: '0.06em' }}>{label}</span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── 8. TRACTION — live platform metrics ─────────────────────────────── */}
      <section id="traction" style={{ background: C.dark, padding: '100px 0' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ marginBottom: 48 }}>
              <SectionLabel light>Live Platform Metrics</SectionLabel>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: `1px solid ${C.dark2}` }}>
              {[
                { target: ps.total_triage_sessions, suffix: '', prefix: '', label: 'Triage Sessions', sub: 'Completed' },
                { target: ps.total_clinics,         suffix: '', prefix: '', label: 'Verified Clinics', sub: 'Across Kenya' },
                { target: ps.total_patients,        suffix: '', prefix: '', label: 'Patients Registered', sub: 'And growing' },
                { target: ps.total_appointments,    suffix: '', prefix: '', label: 'Appointments Completed', sub: 'Via platform' },
              ].map(({ target, suffix, prefix, label, sub }, i) => (
                <div key={label} style={{
                  padding: '40px 40px 40px 0',
                  borderRight: i < 3 ? `1px solid ${C.dark2}` : 'none',
                  marginRight: i < 3 ? 40 : 0,
                  paddingLeft: i > 0 ? 40 : 0,
                }}>
                  <div style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700, fontFamily: DISPLAY, color: C.canvas, lineHeight: 1, marginBottom: 12, letterSpacing: '-0.03em' }}>
                    <CountUp target={target} suffix={suffix} prefix={prefix} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: `${C.canvas}80`, fontFamily: BODY, marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 11, color: C.muted, fontFamily: BODY }}>{sub}</p>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <p style={{ fontSize: 11, color: `${C.canvas}30`, marginTop: 32, fontFamily: BODY, letterSpacing: '0.04em' }}>
              Live metrics — updated in real time · Seeking Series A
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── 9. PRICING — editorial table ────────────────────────────────────── */}
      <section id="pricing" style={{ background: C.canvas, padding: '120px 0', borderTop: `1px solid ${C.rule}` }}>
        <div style={W}>
          <FadeIn>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 80, marginBottom: 64, alignItems: 'end' }}>
              <div>
                <SectionLabel>Pricing</SectionLabel>
                <h2 style={{
                  fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 700,
                  fontFamily: DISPLAY, color: C.text, lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}>
                  Simple,<br />transparent<br />pricing.
                </h2>
              </div>
              <div>
                <p style={{ fontSize: 16, color: C.body, lineHeight: 1.7, fontFamily: BODY, fontWeight: 300, marginBottom: 24, maxWidth: 420 }}>
                  Free for patients, affordable SaaS for clinics. No hidden fees. No lock-in.
                </p>
                {/* Billing toggle */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0, border: `1px solid ${C.rule}`, borderRadius: 4 }}>
                  <button
                    onClick={() => setBillingAnnual(false)}
                    style={{
                      padding: '8px 20px', borderRadius: '3px 0 0 3px', fontSize: 12, fontWeight: 400, cursor: 'pointer', border: 'none',
                      background: !billingAnnual ? C.dark : 'transparent',
                      color: !billingAnnual ? C.canvas : C.muted,
                      fontFamily: BODY, transition: 'all 0.2s',
                    }}
                  >Monthly</button>
                  <button
                    onClick={() => setBillingAnnual(true)}
                    style={{
                      padding: '8px 20px', borderRadius: '0 3px 3px 0', fontSize: 12, fontWeight: 400, cursor: 'pointer',
                      border: 'none', borderLeft: `1px solid ${C.rule}`,
                      background: billingAnnual ? C.dark : 'transparent',
                      color: billingAnnual ? C.canvas : C.muted,
                      fontFamily: BODY, transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    Annual
                    <span style={{ fontSize: 10, fontWeight: 500, color: C.success, fontFamily: BODY }}>−20%</span>
                  </button>
                </div>
              </div>
            </div>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, border: `1px solid ${C.rule}`, borderRadius: 4, overflow: 'hidden' }}>
            {/* Patient — Free */}
            <FadeIn delay={0}>
              <div style={{ background: C.surface, padding: '40px 36px', borderRight: `1px solid ${C.rule}` }}>
                <p style={{ fontSize: 11, fontWeight: 400, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, fontFamily: BODY }}>Patient</p>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 52, fontWeight: 700, color: C.text, fontFamily: DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>Free</span>
                </div>
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 32, fontFamily: BODY }}>Always free for patients</p>
                <Link to="/register" style={{
                  display: 'block', textAlign: 'center', padding: '12px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                  border: `1px solid ${C.rule}`, color: C.text, textDecoration: 'none', marginBottom: 32,
                  fontFamily: BODY, transition: 'all 0.2s',
                }}>
                  Get Started Free
                </Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    'AI Symptom Triage',
                    'Find Clinics Near You',
                    'Book Appointments',
                    'Order OTC Medicines',
                    'Triage History',
                    'M-Pesa Payments',
                  ].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 4, height: 4, background: C.rule, borderRadius: '50%', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: C.body, fontFamily: BODY, fontWeight: 300 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Pro Clinic */}
            <FadeIn delay={0.08}>
              <div style={{
                background: C.dark, padding: '40px 36px',
                borderRight: `1px solid ${C.dark2}`,
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 400, color: `${C.canvas}55`, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: BODY }}>Pro Clinic</p>
                  <span style={{ fontSize: 10, color: C.accent, fontFamily: BODY, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Most Popular</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 400, color: `${C.canvas}55`, fontFamily: BODY }}>KES</span>
                  <span style={{ fontSize: 52, fontWeight: 700, color: C.canvas, fontFamily: DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {billingAnnual ? pricing.pro.annual.toLocaleString() : pricing.pro.monthly.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 13, color: `${C.canvas}40`, fontFamily: BODY }}>/mo</span>
                </div>
                <p style={{ fontSize: 12, color: `${C.canvas}40`, marginBottom: 32, fontFamily: BODY }}>
                  {billingAnnual ? 'Billed annually · 2 months free' : 'Billed monthly'}
                </p>
                <Link to="/register" style={{
                  display: 'block', textAlign: 'center', padding: '12px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                  background: C.brand, color: 'white', textDecoration: 'none', marginBottom: 32,
                  fontFamily: BODY, transition: 'all 0.2s',
                }}>
                  Start 14-Day Free Trial
                </Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    'Everything in Patient',
                    'Clinic Dashboard',
                    'Appointment Management',
                    'Revenue Analytics',
                    'Patient Records',
                    'Doctor Profiles',
                    'Unlimited Appointments',
                    'M-Pesa Payouts',
                    'Email Support',
                  ].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 4, height: 4, background: `${C.canvas}40`, borderRadius: '50%', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: `${C.canvas}70`, fontFamily: BODY, fontWeight: 300 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Enterprise */}
            <FadeIn delay={0.16}>
              <div style={{ background: C.surface, padding: '40px 36px' }}>
                <p style={{ fontSize: 11, fontWeight: 400, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, fontFamily: BODY }}>Enterprise</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 400, color: C.muted, fontFamily: BODY }}>KES</span>
                  <span style={{ fontSize: 52, fontWeight: 700, color: C.text, fontFamily: DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {billingAnnual ? pricing.enterprise.annual.toLocaleString() : pricing.enterprise.monthly.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 13, color: C.muted, fontFamily: BODY }}>/mo</span>
                </div>
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 32, fontFamily: BODY }}>
                  {billingAnnual ? 'Billed annually · 2 months free' : 'Billed monthly'}
                </p>
                <Link to="/register" style={{
                  display: 'block', textAlign: 'center', padding: '12px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                  border: `1.5px solid ${C.brand}`, color: C.brand, textDecoration: 'none', marginBottom: 32,
                  fontFamily: BODY, background: 'transparent', transition: 'all 0.2s',
                }}>
                  Contact Sales
                </Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    'Everything in Pro',
                    'Multi-Branch Management',
                    'Custom Branding',
                    'API Access',
                    'Priority Support',
                    'Dedicated Account Manager',
                    'Custom Integrations',
                    'SLA Guarantee',
                    'Compliance Reports',
                  ].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 4, height: 4, background: C.rule, borderRadius: '50%', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: C.body, fontFamily: BODY, fontWeight: 300 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.3}>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 24, fontFamily: BODY }}>
              All clinic plans include a 14-day free trial · No credit card required · Cancel any time
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── 10. TEAM ────────────────────────────────────────────────────────── */}
      <section id="team" style={{ background: C.surface, padding: '120px 0', borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}` }}>
        <div style={W}>
          <FadeIn>
            <div style={{ marginBottom: 64 }}>
              <SectionLabel>The Team</SectionLabel>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
                fontFamily: DISPLAY, color: C.text, lineHeight: 1.15,
                letterSpacing: '-0.02em', maxWidth: 600,
              }}>
                Built by technologists who understand Africa.
              </h2>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            {[
              { role: 'CEO & Founder', init: 'F', bio: 'Healthcare access advocate. Built 3 products in the East African market.' },
              { role: 'CTO', init: 'T', bio: 'Full-stack engineer with 8 years in health-tech. Ex-Safaricom, ex-Twiga.' },
              { role: 'COO', init: 'O', bio: 'Operations and go-to-market. Previously scaled a telemedicine startup to 40k users.' },
            ].map(({ role, init, bio }, i) => (
              <FadeIn key={role} delay={i * 0.1}>
                <div style={{
                  padding: '0 48px 0 0',
                  borderRight: i < 2 ? `1px solid ${C.rule}` : 'none',
                  marginRight: i < 2 ? 48 : 0,
                  paddingLeft: i > 0 ? 48 : 0,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 4,
                    background: `${C.accent}18`, border: `1px solid ${C.accent}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: DISPLAY }}>{init}</span>
                  </div>
                  {/* Name redacted — blurred for privacy */}
                  <div style={{ width: 80, height: 8, background: C.rule, borderRadius: 2, marginBottom: 8 }} />
                  <p style={{ fontSize: 11, fontWeight: 400, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: BODY, marginBottom: 14 }}>{role}</p>
                  <p style={{ fontSize: 13, color: C.body, lineHeight: 1.65, fontFamily: BODY, fontWeight: 300 }}>{bio}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 11. BACKED BY ───────────────────────────────────────────────────── */}
      <section id="investors" style={{ background: C.canvas, padding: '80px 0' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ marginBottom: 40 }}>
              <SectionLabel>Backed By</SectionLabel>
              <h2 style={{
                fontSize: 28, fontWeight: 700,
                fontFamily: DISPLAY, color: C.text, letterSpacing: '-0.02em',
              }}>
                Kenya's health ecosystem.
              </h2>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, borderTop: `1px solid ${C.rule}` }}>
              {['Nairobi Angel Network', 'Kenya Health Fund', 'Safaricom Spark', 'African Tech Ventures', 'AMREF Health', 'GIZ Digital Health'].map((name, i) => (
                <div key={name} style={{
                  padding: '20px 32px 20px 0',
                  borderRight: i < 5 ? `1px solid ${C.rule}` : 'none',
                  marginRight: i < 5 ? 32 : 0,
                  paddingLeft: i > 0 ? 0 : 0,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 400, color: C.body, fontFamily: BODY }}>{name}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, background: C.accent, borderRadius: '50%' }} />
              <span style={{ fontSize: 12, fontWeight: 400, color: C.body, fontFamily: BODY }}>Actively raising Series A — KES 80M target</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── 12. FINAL CTA ───────────────────────────────────────────────────── */}
      <section id="cta" style={{ background: C.dark, padding: '140px 0' }}>
        <div style={{ ...W, maxWidth: 800, margin: '0 auto', padding: '0 40px' }}>
          <FadeIn>
            <SectionLabel light>Investor Opportunity</SectionLabel>
            <h2 style={{
              fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 700,
              fontFamily: DISPLAY, color: C.canvas, lineHeight: 1.05,
              letterSpacing: '-0.025em', marginBottom: 24,
            }}>
              Kenya deserves<br />
              better healthcare<br />
              <em style={{ color: C.accent }}>access.</em>
            </h2>
            <p style={{ fontSize: 17, color: `${C.canvas}66`, lineHeight: 1.7, fontFamily: BODY, fontWeight: 300, marginBottom: 52, maxWidth: 480 }}>
              We're raising Series A to expand beyond Nairobi. Join us in building the healthcare infrastructure that 55 million Kenyans need.
            </p>
            {deckSent ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, border: `1px solid ${C.accent}40`, borderRadius: 4, padding: '16px 28px' }}>
                <CheckCircle2 size={18} color={C.accent} />
                <span style={{ fontSize: 15, fontWeight: 400, color: C.accent, fontFamily: BODY }}>Thank you — we'll be in touch within 24 hours.</span>
              </div>
            ) : (
              <form onSubmit={handleDeckRequest} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder="your@fund.com"
                  value={investorEmail}
                  onChange={e => setInvestorEmail(e.target.value)}
                  required
                  style={{
                    flex: '1 1 260px', maxWidth: 320, padding: '13px 20px', borderRadius: 4, fontSize: 14,
                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.dark2}`,
                    color: C.canvas, outline: 'none', fontFamily: BODY,
                  }}
                />
                <button type="submit" style={{
                  padding: '13px 28px', borderRadius: 4, fontSize: 14, fontWeight: 500,
                  background: C.brand, color: 'white', border: 'none', cursor: 'pointer',
                  fontFamily: BODY, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  Request Investor Deck <ArrowRight size={14} />
                </button>
              </form>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ── 13. FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ background: '#0F0F1E', padding: '64px 0 40px', fontFamily: BODY, borderTop: `1px solid ${C.dark2}` }}>
        <div style={W}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 52 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, background: C.dark2, borderRadius: 4, border: `1px solid ${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 22 22" fill="none"><path d="M1 11L6 11L8 7L11 16L13 6L15 11L21 11" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.canvas, fontFamily: BODY }}>MedAssist AI</span>
              </div>
              <p style={{ fontSize: 13, color: `${C.canvas}40`, lineHeight: 1.7, maxWidth: 240, fontWeight: 300 }}>
                AI-powered healthcare access for every Kenyan. Triage, book, and order — all in one place.
              </p>
              <p style={{ fontSize: 11, color: `${C.canvas}25`, marginTop: 20, fontFamily: MONO }}>Nairobi, Kenya · 2026</p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 400, color: `${C.canvas}30`, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, fontFamily: BODY }}>Product</p>
              {['Symptom Triage', 'Clinic Finder', 'Book Appointment', 'Medicine Orders'].map(l => (
                <Link key={l} to="/register" style={{ display: 'block', fontSize: 13, color: `${C.canvas}50`, textDecoration: 'none', marginBottom: 12, fontWeight: 300, fontFamily: BODY }}>{l}</Link>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 400, color: `${C.canvas}30`, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, fontFamily: BODY }}>For Clinics</p>
              {[['Register Clinic', '/register/clinic'], ['Clinic Dashboard', '/clinic-dashboard'], ['Pricing', '/#pricing'], ['API Access', '/docs']].map(([l, href]) => (
                <Link key={l} to={href} style={{ display: 'block', fontSize: 13, color: `${C.canvas}50`, textDecoration: 'none', marginBottom: 12, fontWeight: 300, fontFamily: BODY }}>{l}</Link>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 400, color: `${C.canvas}30`, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, fontFamily: BODY }}>Company</p>
              {['About', 'Blog', 'Careers', 'Contact'].map(l => (
                <Link key={l} to="/register" style={{ display: 'block', fontSize: 13, color: `${C.canvas}50`, textDecoration: 'none', marginBottom: 12, fontWeight: 300, fontFamily: BODY }}>{l}</Link>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.dark2}`, paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 12, color: `${C.canvas}25`, fontFamily: BODY }}>© 2026 MedAssist AI · Nairobi, Kenya · All rights reserved</p>
            <div style={{ display: 'flex', gap: 24 }}>
              {['Privacy Policy', 'Terms of Service', 'HIPAA Notice'].map(l => (
                <Link key={l} to="/" style={{ fontSize: 12, color: `${C.canvas}30`, textDecoration: 'none', fontFamily: BODY }}>{l}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
