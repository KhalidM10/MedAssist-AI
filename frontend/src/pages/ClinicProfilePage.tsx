import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  ExternalLink, Mail, MapPin, Phone, Shield,
} from 'lucide-react'
import { api } from '../lib/api'
import type { ClinicDetail, ClinicReview, Doctor } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────
const C_BRAND   = '#1D4ED8'
const C_ACCENT  = '#C8A96E'
const C_SUCCESS = '#059669'

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']  // index = weekday()
const DAY_FULL = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// ── Mini calendar ─────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  availableDates: string[]
  selected: string | null
  onSelect: (d: string) => void
  month: { year: number; month: number }
  onMonthChange: (delta: number) => void
}

function MiniCalendar({ availableDates, selected, onSelect, month, onMonthChange }: MiniCalendarProps) {
  const { year, month: mon } = month
  const available = new Set(availableDates)
  const firstDay = new Date(year, mon - 1, 1)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const startDow = (firstDay.getDay() + 6) % 7   // 0=Mon

  const today = new Date().toISOString().slice(0, 10)

  const monthLabel = firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(-1)}
          className="p-1 rounded transition-colors"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {monthLabel}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          className="p-1 rounded transition-colors"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isAvail = available.has(dateStr)
          const isPast = dateStr < today
          const isSelected = dateStr === selected
          const isTodayDate = dateStr === today

          return (
            <button
              key={dateStr}
              disabled={!isAvail || isPast}
              onClick={() => isAvail && !isPast && onSelect(dateStr)}
              className="flex items-center justify-center rounded transition-colors"
              style={{
                height: 30,
                fontSize: 11,
                fontFamily: 'var(--font-body)',
                fontWeight: isTodayDate ? 600 : 400,
                backgroundColor: isSelected ? C_BRAND : 'transparent',
                color: isSelected ? 'white'
                  : isPast ? 'var(--color-text-tertiary)'
                  : isAvail ? 'var(--color-text-primary)'
                  : 'var(--color-text-tertiary)',
                opacity: isPast || (!isAvail && !isPast) ? 0.35 : 1,
                cursor: isAvail && !isPast ? 'pointer' : 'not-allowed',
                textDecoration: isPast || !isAvail ? 'line-through' : isTodayDate && !isSelected ? 'underline' : 'none',
                textUnderlineOffset: 2,
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Doctor card (profile) ─────────────────────────────────────────────────────

function DoctorCard({ doctor, clinicId }: { doctor: Doctor; clinicId: string }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const initials = doctor.full_name
    .split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()

  const isToday = doctor.next_available?.date === new Date().toISOString().slice(0, 10)

  return (
    <div
      className="flex gap-5 p-6"
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        marginBottom: 12,
      }}
    >
      {/* Photo / initials */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full text-sm font-bold text-white"
        style={{
          width: 72, height: 72,
          border: '2px solid var(--color-border)',
          backgroundColor: doctor.photo_url ? 'transparent' : C_BRAND,
          overflow: 'hidden',
          background: doctor.photo_url ? undefined : `${C_BRAND}22`,
        }}
      >
        {doctor.photo_url ? (
          <img src={doctor.photo_url} alt={doctor.full_name} className="w-full h-full object-cover" />
        ) : (
          <span style={{ color: C_BRAND, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
            {initials}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {doctor.full_name}
        </p>
        <p style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C_BRAND, fontFamily: 'var(--font-body)', fontWeight: 500, marginTop: 2 }}>
          {doctor.specialty}{doctor.sub_specialty ? ` · ${doctor.sub_specialty}` : ''}
        </p>
        {doctor.qualification && (
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 4 }}>
            {doctor.qualification}
          </p>
        )}

        {doctor.bio && (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 300, lineHeight: 1.7, marginTop: 8 }}
            className={expanded ? '' : 'line-clamp-2'}
          >
            {doctor.bio}
          </p>
        )}
        {doctor.bio && doctor.bio.length > 120 && (
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ fontSize: 12, color: C_BRAND, fontFamily: 'var(--font-body)', marginTop: 4 }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Rating */}
        {doctor.total_reviews > 0 && (
          <div className="flex items-baseline gap-1 mt-3">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: C_ACCENT }}>
              ★ {doctor.rating.toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
              ({doctor.total_reviews} reviews)
            </span>
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="shrink-0 text-right flex flex-col items-end justify-between">
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            KES {doctor.consultation_fee_kes.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
            per consultation
          </p>
        </div>

        {doctor.next_available && (
          <div className="mt-2 text-right">
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>Next available</p>
            <p style={{
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              color: isToday ? C_BRAND : 'var(--color-text-secondary)',
            }}>
              {isToday ? 'Today' : doctor.next_available.date} {doctor.next_available.time}
            </p>
          </div>
        )}

        <button
          onClick={() => navigate(`/book/${clinicId}?doctor=${doctor.id}`)}
          className="flex items-center gap-1.5 mt-3 text-sm font-semibold transition-colors"
          style={{ color: C_BRAND, fontFamily: 'var(--font-body)' }}
          onMouseEnter={e => (e.currentTarget.style.paddingLeft = '4px')}
          onMouseLeave={e => (e.currentTarget.style.paddingLeft = '0')}
        >
          Book with Dr. {doctor.full_name.split(' ').pop()} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: ClinicReview }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < review.rating)
  const date = new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="py-5" style={{ borderTop: '1px solid var(--color-border)' }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-0.5">
          {stars.map((filled, i) => (
            <span key={i} style={{ fontSize: 13, color: filled ? C_ACCENT : 'var(--color-border)' }}>★</span>
          ))}
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
          {date}
        </span>
      </div>

      {review.title && (
        <p className="mt-2" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {review.title}
        </p>
      )}

      {review.body && (
        <p className="mt-1" style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 300, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
          {review.body}
        </p>
      )}

      {/* Attribution */}
      <div className="flex items-center gap-3 mt-3">
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          — {review.patient_name}
        </span>
        {review.is_verified && (
          <span style={{ fontSize: 10, letterSpacing: '0.05em', color: C_SUCCESS, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            ✓ Verified
          </span>
        )}
        {review.doctor_name && (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
            Saw {review.doctor_name}
          </span>
        )}
      </div>

      {/* Clinic response */}
      {review.response && (
        <div className="mt-3 pl-4" style={{ borderLeft: '2px solid var(--color-border)' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            Response from clinic:
          </p>
          <p style={{ fontSize: 13, fontStyle: 'italic', fontWeight: 300, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', marginTop: 4 }}>
            {review.response}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Booking sidebar ───────────────────────────────────────────────────────────

function BookingSidebar({ clinic }: { clinic: ClinicDetail }) {
  const navigate = useNavigate()
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  const monthStr = `${calMonth.year}-${String(calMonth.month).padStart(2, '0')}`

  const { data: availabilityData } = useQuery({
    queryKey: ['clinic-availability', clinic.id, selectedDoctor?.id, monthStr],
    queryFn: () =>
      api.get(`/clinics/${clinic.slug || clinic.id}/availability`, {
        params: { month: monthStr, doctor_id: selectedDoctor?.id },
      }).then(r => r.data),
    enabled: !!selectedDoctor,
    staleTime: 60_000,
  })

  const { data: slotsData } = useQuery({
    queryKey: ['clinic-slots', clinic.id, selectedDoctor?.id, selectedDate],
    queryFn: () =>
      api.get(`/clinics/${clinic.slug || clinic.id}/slots`, {
        params: { date: selectedDate, doctor_id: selectedDoctor?.id },
      }).then(r => r.data),
    enabled: !!selectedDoctor && !!selectedDate,
    staleTime: 30_000,
  })

  const availableDates: string[] = availabilityData?.available_dates ?? []
  const slots = slotsData?.slots ?? []

  function changeMonth(delta: number) {
    setCalMonth(prev => {
      let m = prev.month + delta
      let y = prev.year
      if (m < 1) { m = 12; y-- }
      if (m > 12) { m = 1; y++ }
      return { year: y, month: m }
    })
    setSelectedDate(null)
    setSelectedTime(null)
  }

  function handleDoctorChange(doc: Doctor) {
    setSelectedDoctor(doc)
    setSelectedDate(null)
    setSelectedTime(null)
  }

  return (
    <div className="sticky" style={{ top: 80 }}>
      {/* Booking card */}
      <div className="p-7" style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
      }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Book an Appointment
        </p>
        <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '12px 0 20px' }} />

        {/* Doctor selector */}
        <div className="mb-5">
          <label style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', fontWeight: 500, display: 'block', marginBottom: 8 }}>
            Select Doctor
          </label>
          <div className="space-y-2">
            {clinic.doctors.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleDoctorChange(doc)}
                className="w-full flex items-center gap-3 p-3 text-left transition-colors rounded"
                style={{
                  border: `1px solid ${selectedDoctor?.id === doc.id ? C_BRAND : 'var(--color-border)'}`,
                  backgroundColor: selectedDoctor?.id === doc.id ? 'var(--color-brand-light)' : 'transparent',
                }}
                onMouseEnter={e => { if (selectedDoctor?.id !== doc.id) e.currentTarget.style.backgroundColor = 'var(--color-canvas)' }}
                onMouseLeave={e => { if (selectedDoctor?.id !== doc.id) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <div
                  className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: selectedDoctor?.id === doc.id ? C_BRAND : 'var(--color-surface-2)', color: selectedDoctor?.id === doc.id ? 'white' : 'var(--color-text-secondary)' }}
                >
                  {doc.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.full_name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
                    {doc.specialty}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        {selectedDoctor && (
          <div className="mb-5">
            <label style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', fontWeight: 500, display: 'block', marginBottom: 12 }}>
              Choose Date
            </label>
            <MiniCalendar
              availableDates={availableDates}
              selected={selectedDate}
              onSelect={d => { setSelectedDate(d); setSelectedTime(null) }}
              month={calMonth}
              onMonthChange={changeMonth}
            />
          </div>
        )}

        {/* Time slots */}
        {selectedDate && slots.length > 0 && (
          <div className="mb-5">
            <label style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', fontWeight: 500, display: 'block', marginBottom: 10 }}>
              Available Times
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {slots.map(slot => (
                <button
                  key={slot.time}
                  disabled={!slot.is_available}
                  onClick={() => slot.is_available && setSelectedTime(slot.time)}
                  className="py-2 text-center rounded transition-colors"
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    border: `1px solid ${selectedTime === slot.time ? C_BRAND : 'var(--color-border)'}`,
                    backgroundColor: selectedTime === slot.time ? 'var(--color-brand-light)' : 'transparent',
                    color: !slot.is_available ? 'var(--color-text-tertiary)'
                      : selectedTime === slot.time ? C_BRAND
                      : 'var(--color-text-secondary)',
                    opacity: slot.is_available ? 1 : 0.4,
                    textDecoration: !slot.is_available ? 'line-through' : 'none',
                    cursor: slot.is_available ? 'pointer' : 'not-allowed',
                  }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Continue button */}
        {selectedTime && (
          <button
            onClick={() =>
              navigate(`/book/${clinic.id}?doctor=${selectedDoctor?.id}&date=${selectedDate}&time=${selectedTime}`)
            }
            className="w-full py-3 text-sm font-bold text-white transition-opacity rounded"
            style={{ backgroundColor: C_BRAND, fontFamily: 'var(--font-body)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Continue to Booking →
          </button>
        )}

        {!selectedDoctor && (
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', textAlign: 'center', marginTop: 4 }}>
            Select a doctor to see available dates
          </p>
        )}
      </div>

      {/* Contact card */}
      <div className="mt-5 p-6" style={{
        backgroundColor: 'var(--color-canvas)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
      }}>
        {[
          { icon: Phone, label: 'Call Clinic', href: `tel:${clinic.phone}` },
          ...(clinic.email ? [{ icon: Mail, label: 'Email Clinic', href: `mailto:${clinic.email}` }] : []),
          { icon: MapPin, label: 'Get Directions', href: `https://maps.google.com/?q=${encodeURIComponent(clinic.address + ', Kenya')}`, external: true },
          ...(clinic.website ? [{ icon: ExternalLink, label: 'Visit Website', href: clinic.website, external: true }] : []),
        ].map(({ icon: Icon, label, href, external }) => (
          <a
            key={label}
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="flex items-center gap-3 py-2.5 group"
            style={{ color: C_BRAND, textDecoration: 'none' }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span style={{ fontSize: 13, fontFamily: 'var(--font-body)', transition: 'letter-spacing 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.letterSpacing = '0.01em')}
              onMouseLeave={e => (e.currentTarget.style.letterSpacing = '0')}
            >
              {label} →
            </span>
          </a>
        ))}
      </div>

      {/* Mini map */}
      {clinic.latitude && clinic.longitude && (
        <div className="mt-5 overflow-hidden" style={{ height: 200, border: '1px solid var(--color-border)', borderRadius: 4 }}>
          <MapContainer
            center={[clinic.latitude, clinic.longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker
              center={[clinic.latitude, clinic.longitude]}
              radius={10}
              pathOptions={{ color: C_BRAND, fillColor: C_BRAND, fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>{clinic.name}</Popup>
            </CircleMarker>
          </MapContainer>
        </div>
      )}
    </div>
  )
}

// ── Operating hours ────────────────────────────────────────────────────────────

function OperatingHours({ hours }: { hours: Record<string, { open: string; close: string }> }) {
  const todayIdx = (new Date().getDay() + 6) % 7   // 0=Mon
  return (
    <div className="space-y-1">
      {DAY_FULL.map((day, i) => {
        const slot = hours[day]
        const isToday = i === todayIdx
        return (
          <div
            key={day}
            className="flex items-center justify-between py-1.5 px-3 rounded"
            style={{ backgroundColor: isToday ? 'var(--color-brand-light)' : 'transparent' }}
          >
            <span style={{
              fontSize: 13,
              fontWeight: isToday ? 600 : 400,
              color: isToday ? C_BRAND : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}>
              {DAY_ABBR[i]}
              {isToday && <span style={{ fontSize: 10, marginLeft: 6, color: C_BRAND }}>Today</span>}
            </span>
            {slot ? (
              <span style={{ fontSize: 12, color: isToday ? C_BRAND : 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
                {slot.open} – {slot.close}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>Closed</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div>
      <div className="skeleton -mx-6" style={{ height: 280 }} />
      <div className="mt-6 space-y-4">
        <div className="h-6 skeleton rounded w-2/3" />
        <div className="h-4 skeleton rounded w-1/2" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map(i => <div key={i} className="h-32 skeleton rounded" />)}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ClinicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showAllReviews, setShowAllReviews] = useState(false)

  const { data: clinic, isLoading } = useQuery<ClinicDetail>({
    queryKey: ['clinic', id],
    queryFn: () => api.get(`/clinics/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 120_000,
  })

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const todayHours = clinic?.operating_hours?.[todayName]
  const hoursLabel = useMemo(() => {
    if (!clinic) return ''
    if (!todayHours) return 'Closed today'
    return clinic.is_open_now ? `Open · Closes ${todayHours.close}` : `Closed · Opens ${todayHours.open}`
  }, [clinic, todayHours])

  if (isLoading) return <ProfileSkeleton />

  if (!clinic) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
          Clinic not found.
        </p>
        <button
          onClick={() => navigate('/clinics')}
          className="mt-4 flex items-center gap-1.5"
          style={{ fontSize: 14, color: C_BRAND, fontFamily: 'var(--font-body)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to clinics
        </button>
      </div>
    )
  }

  const displayedReviews = showAllReviews ? clinic.reviews : clinic.reviews.slice(0, 4)

  return (
    <div className="animate-fade-in">

      {/* Hero — full bleed within content area */}
      <div className="relative -mx-6 overflow-hidden" style={{ height: 300 }}>
        {clinic.cover_image_url ? (
          <img
            src={clinic.cover_image_url}
            alt={clinic.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: 'var(--color-brand-light)' }} />
        )}
        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}
        />

        {/* Breadcrumb top-left */}
        <button
          onClick={() => navigate('/clinics')}
          className="absolute flex items-center gap-1.5"
          style={{ top: 20, left: 24, color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'var(--font-body)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Clinics
        </button>

        {/* Clinic name + tags on image */}
        <div className="absolute bottom-0 left-0 px-6 pb-6">
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {clinic.name}
          </h1>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {clinic.specialties.slice(0, 3).map(s => (
              <span key={s} style={{
                fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-body)',
              }}>{s}</span>
            ))}
            {clinic.is_verified && (
              <span className="flex items-center gap-1 px-2 py-0.5" style={{
                backgroundColor: C_BRAND,
                color: 'white',
                borderRadius: 2,
                fontSize: 11,
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
              }}>
                <Shield className="h-3 w-3" /> Verified Clinic
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div
        className="-mx-6 px-6 flex items-center gap-6 flex-wrap"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '16px 24px',
        }}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>{clinic.address}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <a href={`tel:${clinic.phone}`} style={{ fontSize: 13, color: C_BRAND, fontFamily: 'var(--font-body)' }}>{clinic.phone}</a>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, color: clinic.is_open_now ? C_SUCCESS : 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', fontWeight: clinic.is_open_now ? 500 : 400 }}>
            {hoursLabel}
          </span>
        </div>
        {clinic.total_reviews > 0 && (
          <div className="flex items-center gap-1">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: C_ACCENT }}>★ {clinic.rating.toFixed(1)}</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
              · {clinic.total_reviews} reviews
            </span>
          </div>
        )}
        <div className="ml-auto">
          <button
            onClick={() => navigate(`/book/${clinic.id}`)}
            className="px-5 py-2.5 font-bold text-sm text-white rounded transition-opacity"
            style={{ backgroundColor: C_BRAND, fontFamily: 'var(--font-body)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Book Appointment
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-16 mt-10 items-start">

        {/* ── Left main column ── */}
        <div style={{ flex: '0 0 63%', minWidth: 0 }}>

          {/* About */}
          {clinic.description && (
            <section className="mb-10">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                About This Clinic
              </h2>
              <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '10px 0 16px' }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 300, lineHeight: 1.8, color: 'var(--color-text-secondary)' }}>
                {clinic.description}
              </p>
            </section>
          )}

          {/* Hours + Specialties grid */}
          {(Object.keys(clinic.operating_hours).length > 0 || clinic.specialties.length > 0) && (
            <section className="mb-10">
              <div className="grid grid-cols-2 gap-8">
                {Object.keys(clinic.operating_hours).length > 0 && (
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 500, marginBottom: 12 }}>
                      Operating Hours
                    </h3>
                    <OperatingHours hours={clinic.operating_hours} />
                  </div>
                )}
                {clinic.specialties.length > 0 && (
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 500, marginBottom: 12 }}>
                      Specialties
                    </h3>
                    <ul className="space-y-2">
                      {clinic.specialties.map(s => (
                        <li key={s} style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                          · {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Doctors */}
          {clinic.doctors.length > 0 && (
            <section className="mb-10">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Our Doctors
              </h2>
              <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '10px 0 20px' }} />
              {clinic.doctors.map(doc => (
                <DoctorCard key={doc.id} doctor={doc} clinicId={clinic.id} />
              ))}
            </section>
          )}

          {/* Reviews */}
          <section>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Patient Reviews
            </h2>
            <div style={{ height: 1, backgroundColor: 'var(--color-border)', margin: '10px 0 20px' }} />

            {clinic.total_reviews > 0 && (
              <div className="flex items-start gap-10 mb-8">
                {/* Big rating number */}
                <div className="text-center shrink-0">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 900, lineHeight: 1, color: C_ACCENT }}>
                    {clinic.rating.toFixed(1)}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 4 }}>out of 5</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
                    {clinic.total_reviews} review{clinic.total_reviews !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Rating bars */}
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map(star => (
                    <div key={star} className="flex items-center gap-3">
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)', width: 20, textAlign: 'right' }}>
                        {star}★
                      </span>
                      <div className="flex-1 rounded overflow-hidden" style={{ height: 6, backgroundColor: 'var(--color-border)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${clinic.rating_breakdown?.[star] ?? 0}%`,
                            backgroundColor: C_BRAND,
                            borderRadius: 3,
                            transition: 'width 600ms ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)', width: 28 }}>
                        {clinic.rating_breakdown?.[star] ?? 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clinic.reviews.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14, color: 'var(--color-text-tertiary)' }}>
                No reviews yet. Be the first to leave a review after your appointment.
              </p>
            ) : (
              <>
                {displayedReviews.map(r => <ReviewCard key={r.id} review={r} />)}
                {clinic.reviews.length > 4 && (
                  <button
                    onClick={() => setShowAllReviews(v => !v)}
                    className="mt-4 block mx-auto"
                    style={{ fontSize: 13, color: C_BRAND, fontFamily: 'var(--font-body)' }}
                  >
                    {showAllReviews
                      ? 'Show fewer reviews ↑'
                      : `Load more reviews → (${clinic.reviews.length - 4} more)`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ flex: '0 0 35%', minWidth: 0 }}>
          {clinic.doctors.length > 0
            ? <BookingSidebar clinic={clinic} />
            : (
              <div className="p-7 text-center" style={{ border: '1px solid var(--color-border)', borderRadius: 4, backgroundColor: 'var(--color-canvas)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-tertiary)' }}>
                  No doctors listed yet. Call to book.
                </p>
                <a href={`tel:${clinic.phone}`}
                  className="mt-3 inline-block"
                  style={{ fontSize: 14, color: C_BRAND, fontFamily: 'var(--font-body)' }}
                >
                  {clinic.phone}
                </a>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
