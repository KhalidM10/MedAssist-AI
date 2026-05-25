import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import {
  ChevronDown, MapPin, Search, X,
} from 'lucide-react'
import { api } from '../lib/api'
import type { Clinic, PaginatedClinics } from '../types'

// ── CSS constants (Recharts-pattern: no CSS vars in SVG/inline calc) ──────────
const C_BRAND = '#1D4ED8'

// ── Filter dropdown ───────────────────────────────────────────────────────────

interface DropdownProps {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}

function FilterDropdown({ label, value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const isActive = value !== options[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 py-1 text-sm transition-colors"
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          color: isActive ? C_BRAND : 'var(--color-text-secondary)',
        }}
      >
        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{label}:</span>
        &nbsp;{value}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none', color: 'var(--color-text-tertiary)' }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 z-50 mt-1 min-w-[180px] py-1"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: opt === value ? 500 : 400,
                color: opt === value ? C_BRAND : 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-canvas)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="overflow-hidden" style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 4,
    }}>
      <div className="skeleton" style={{ aspectRatio: '16/9', width: '100%' }} />
      <div className="p-5 space-y-3">
        <div className="h-3 skeleton rounded w-2/3" />
        <div className="flex gap-2">
          <div className="h-4 skeleton rounded w-16" />
          <div className="h-4 skeleton rounded w-20" />
        </div>
        <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        <div className="flex justify-between">
          <div className="h-3 skeleton rounded w-24" />
          <div className="h-3 skeleton rounded w-16" />
        </div>
      </div>
    </div>
  )
}

// ── Clinic card ───────────────────────────────────────────────────────────────

function ClinicCard({ clinic }: { clinic: Clinic }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  const coverUrl = clinic.cover_image_url || null
  const initial = clinic.name[0].toUpperCase()

  const isToday = clinic.next_available === 'Today'

  return (
    <div
      className="overflow-hidden cursor-pointer flex flex-col"
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${hovered ? C_BRAND : 'var(--color-border)'}`,
        borderRadius: 4,
        boxShadow: hovered ? '0 4px 16px rgba(29,78,216,0.08)' : 'none',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/clinics/${clinic.slug || clinic.id}`)}
    >
      {/* Cover image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={clinic.name}
            className="w-full h-full object-cover"
            style={{ transition: 'transform 300ms', transform: hovered ? 'scale(1.03)' : 'scale(1)' }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-brand-light)' }}
          >
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 48,
              fontWeight: 700,
              color: C_BRAND,
              opacity: 0.3,
            }}>{initial}</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)' }}
        />
        {/* Clinic name over image */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.2,
            textShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}>{clinic.name}</p>
        </div>
        {/* Verified badge */}
        {clinic.is_verified && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5"
            style={{
              backgroundColor: 'white',
              color: C_BRAND,
              borderRadius: 2,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-body)',
            }}
          >
            ✓ Verified
          </div>
        )}
        {/* Open/Closed badge */}
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5"
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 2,
            backdropFilter: 'blur(4px)',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: clinic.is_open_now ? '#34D399' : '#F87171' }}
          />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'white', fontFamily: 'var(--font-body)' }}>
            {clinic.is_open_now ? 'Open Now' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 pt-4 pb-2 flex-1">
        {/* Address */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <MapPin className="h-3 w-3 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          <span
            className="truncate"
            style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
          >
            {clinic.address}
          </span>
        </div>

        {/* Specialty tags */}
        {clinic.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {clinic.specialties.slice(0, 3).map(s => (
              <span
                key={s}
                style={{
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 2,
                  padding: '2px 6px',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {s}
              </span>
            ))}
            {clinic.specialties.length > 3 && (
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
                +{clinic.specialties.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="my-3.5" style={{ height: 1, backgroundColor: 'var(--color-border)' }} />

        {/* Bottom row */}
        <div className="flex items-end justify-between gap-2">
          <div>
            {/* Rating */}
            <div className="flex items-baseline gap-1">
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--color-accent)' }}>
                ★ {clinic.rating > 0 ? clinic.rating.toFixed(1) : '—'}
              </span>
              {clinic.total_reviews > 0 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
                  ({clinic.total_reviews})
                </span>
              )}
            </div>
            {/* Next available */}
            {clinic.next_available && (
              <p style={{
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                color: isToday ? C_BRAND : 'var(--color-text-tertiary)',
                marginTop: 2,
              }}>
                Next: {clinic.next_available}
                {clinic.next_available_slot && ` ${clinic.next_available_slot.time}`}
              </p>
            )}
          </div>
          <div className="text-right">
            {clinic.distance_km != null && (
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
                {clinic.distance_km} km
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          backgroundColor: 'var(--color-canvas)',
          borderTop: '1px solid var(--color-border)',
          marginTop: 8,
        }}
      >
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: C_BRAND,
          fontFamily: 'var(--font-body)',
          transition: 'letter-spacing 150ms',
          letterSpacing: hovered ? '0.01em' : '0',
        }}>
          View Clinic {hovered ? '→' : '→'}
        </span>

        <button
          onClick={e => { e.stopPropagation(); navigate(`/book/${clinic.id}`) }}
          className="text-xs px-3.5 py-1.5 transition-colors"
          style={{
            border: `1px solid ${C_BRAND}`,
            color: C_BRAND,
            borderRadius: 2,
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            backgroundColor: 'transparent',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = C_BRAND
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = C_BRAND
          }}
        >
          Book Now
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATIC_COUNTIES = [
  'All Counties', 'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru',
  'Kiambu', 'Uasin Gishu', 'Machakos', 'Kakamega', 'Meru', 'Nyeri',
]

const STATIC_SPECIALTIES = [
  'All Specialties', 'General Practice', 'Pediatrics', 'Internal Medicine',
  'Obstetrics & Gynaecology', 'Dermatology', 'Orthopaedics', 'Family Medicine',
]

export function ClinicsPage() {
  const [search, setSearch] = useState('')
  const [county, setCounty] = useState('All Counties')
  const [specialty, setSpecialty] = useState('All Specialties')
  const [availableToday, setAvailableToday] = useState(false)
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [county, specialty, availableToday])

  // Fetch filters
  const { data: filters } = useQuery({
    queryKey: ['clinic-filters'],
    queryFn: () => api.get('/clinics/filters').then(r => r.data).catch(() => null),
    staleTime: 300_000,
  })

  const counties = filters?.counties?.length
    ? ['All Counties', ...filters.counties]
    : STATIC_COUNTIES

  const specialties = filters?.specialties?.length
    ? ['All Specialties', ...filters.specialties]
    : STATIC_SPECIALTIES

  const params: Record<string, string | number | boolean> = { page, limit: 12 }
  if (county !== 'All Counties') params.county = county
  if (specialty !== 'All Specialties') params.specialty = specialty
  if (availableToday) params.available_today = true
  if (debouncedSearch) params.search = debouncedSearch

  const { data, isLoading } = useQuery<PaginatedClinics>({
    queryKey: ['clinics', county, specialty, availableToday, debouncedSearch, page],
    queryFn: () => api.get('/clinics/', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const clinics = data?.clinics ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 0

  const mapClinics = clinics.filter(c => c.latitude != null && c.longitude != null)
  const mapCenter: [number, number] = mapClinics.length > 0
    ? [mapClinics[0].latitude!, mapClinics[0].longitude!]
    : [-1.2921, 36.8219]

  const activeFilters = [
    county !== 'All Counties' && county,
    specialty !== 'All Specialties' && specialty,
    availableToday && 'Available today',
  ].filter(Boolean) as string[]

  return (
    <div className="animate-fade-in">

      {/* Page header */}
      <div className="pb-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <p
          className="mb-2"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Home → Find a Clinic
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
            lineHeight: 1.1,
          }}
        >
          Find a Clinic Near You
        </h1>
        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 300,
            lineHeight: 1.7,
            color: 'var(--color-text-secondary)',
            maxWidth: 480,
          }}
        >
          Verified clinics across Kenya — book instantly, no phone calls.
        </p>
      </div>

      {/* Sticky filter bar */}
      <div
        className="sticky z-20 -mx-6 px-6"
        style={{
          top: 64,
          backgroundColor: 'white',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-6 py-4 overflow-x-auto">
          {/* Search input */}
          <div
            className="relative flex items-center shrink-0"
            style={{ width: 280, borderBottom: '1.5px solid var(--color-border)' }}
          >
            <Search className="h-3.5 w-3.5 shrink-0 mr-2" style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clinics, doctors, specialties…"
              className="w-full py-1.5 text-sm bg-transparent outline-none"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
              </button>
            )}
          </div>

          {/* Separator */}
          <div className="h-5 w-px shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />

          {/* Filter dropdowns */}
          <FilterDropdown label="County" value={county} options={counties} onChange={setCounty} />
          <FilterDropdown label="Specialty" value={specialty} options={specialties} onChange={setSpecialty} />

          {/* Available today toggle */}
          <button
            onClick={() => setAvailableToday(v => !v)}
            className="flex items-center gap-1.5 py-1 text-sm whitespace-nowrap transition-colors"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: availableToday ? 500 : 400,
              color: availableToday ? C_BRAND : 'var(--color-text-secondary)',
            }}
          >
            <span
              className="h-3.5 w-3.5 rounded-sm flex items-center justify-center border transition-colors"
              style={{
                borderColor: availableToday ? C_BRAND : 'var(--color-border)',
                backgroundColor: availableToday ? C_BRAND : 'transparent',
              }}
            >
              {availableToday && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
            </span>
            Available today
          </button>

          {/* Right side */}
          <div className="flex items-center gap-4 ml-auto shrink-0">
            {!isLoading && (
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
                {total > 0 ? `${total} clinic${total !== 1 ? 's' : ''}` : 'No results'}
              </span>
            )}

            {/* View toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('grid')}
                className="text-xs"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: view === 'grid' ? 600 : 400,
                  color: view === 'grid' ? C_BRAND : 'var(--color-text-tertiary)',
                  textDecoration: view === 'grid' ? 'underline' : 'none',
                  textUnderlineOffset: 3,
                }}
              >
                List
              </button>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>◉</span>
              <button
                onClick={() => setView('map')}
                className="text-xs"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: view === 'map' ? 600 : 400,
                  color: view === 'map' ? C_BRAND : 'var(--color-text-tertiary)',
                  textDecoration: view === 'map' ? 'underline' : 'none',
                  textUnderlineOffset: 3,
                }}
              >
                Map
              </button>
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 pb-3">
            {activeFilters.map(f => (
              <span
                key={f}
                className="flex items-center gap-1.5 px-2.5 py-0.5 text-xs"
                style={{
                  backgroundColor: 'var(--color-brand-light)',
                  color: C_BRAND,
                  borderRadius: 2,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {f}
                <button
                  onClick={() => {
                    if (f === county) setCounty('All Counties')
                    else if (f === specialty) setSpecialty('All Specialties')
                    else setAvailableToday(false)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => { setCounty('All Counties'); setSpecialty('All Specialties'); setAvailableToday(false); setSearch('') }}
              style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
            >
              Clear all →
            </button>
          </div>
        )}
      </div>

      {/* Map view */}
      {view === 'map' && (
        <div className="mt-5 overflow-hidden" style={{ height: 400, borderRadius: 0 }}>
          {mapClinics.length > 0 ? (
            <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapClinics.map(clinic => (
                <CircleMarker
                  key={clinic.id}
                  center={[clinic.latitude!, clinic.longitude!]}
                  radius={14}
                  pathOptions={{
                    color: C_BRAND,
                    fillColor: C_BRAND,
                    fillOpacity: 0.9,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: 'var(--font-body)' }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)' }}>{clinic.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{clinic.address}</p>
                      {clinic.specialties.length > 0 && (
                        <p style={{ fontSize: 11, color: C_BRAND, marginTop: 4 }}>
                          {clinic.specialties.slice(0, 2).join(' · ')}
                        </p>
                      )}
                      {clinic.next_available && (
                        <p style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
                          Next: {clinic.next_available}
                        </p>
                      )}
                      <button
                        onClick={() => navigate(`/clinics/${clinic.slug || clinic.id}`)}
                        style={{ fontSize: 11, color: C_BRAND, fontWeight: 600, marginTop: 8, display: 'block' }}
                      >
                        View clinic →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          ) : (
            <div
              className="flex items-center justify-center h-full"
              style={{ backgroundColor: 'var(--color-canvas)' }}
            >
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
                No clinics with location data
              </p>
            </div>
          )}
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && (
        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : clinics.length === 0 ? (
            total === 0 && !debouncedSearch && county === 'All Counties' && specialty === 'All Specialties' && !availableToday ? (
              // Platform has no clinics yet — invite clinics to register
              <div className="flex flex-col items-center py-24 text-center">
                <div
                  className="h-16 w-16 rounded-xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'var(--color-brand-light)' }}
                >
                  <MapPin className="h-8 w-8" style={{ color: C_BRAND }} />
                </div>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  marginBottom: 12,
                }}>
                  No clinics available yet.
                </p>
                <p style={{
                  fontSize: 15,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  lineHeight: 1.65,
                  maxWidth: 400,
                  marginBottom: 28,
                }}>
                  We are onboarding verified clinics across Kenya. Check back soon or register your clinic to be among the first.
                </p>
                <Link
                  to="/register/clinic"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: C_BRAND,
                    color: 'white',
                    textDecoration: 'none',
                    padding: '11px 24px',
                    borderRadius: 4,
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Register Your Clinic →
                </Link>
              </div>
            ) : (
              // Filters produced no results
              <div className="flex flex-col items-center py-20 text-center">
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                }}>
                  No clinics found in this area.
                </p>
                <p className="mt-2" style={{ fontSize: 14, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
                  Try adjusting your search or filters.
                </p>
                <button
                  onClick={() => { setCounty('All Counties'); setSpecialty('All Specialties'); setAvailableToday(false); setSearch('') }}
                  className="mt-4"
                  style={{ fontSize: 13, color: C_BRAND, fontFamily: 'var(--font-body)' }}
                >
                  Clear all filters →
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {clinics.map((clinic, i) => (
                <div
                  key={clinic.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 0.04}s`, opacity: 0 }}
                >
                  <ClinicCard clinic={clinic} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-12 pb-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              fontSize: 13,
              color: page === 1 ? 'var(--color-text-tertiary)' : C_BRAND,
              fontFamily: 'var(--font-body)',
              opacity: page === 1 ? 0.4 : 1,
            }}
          >
            ← Prev
          </button>

          <div className="flex items-center gap-3">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  fontFamily: p === page ? 'var(--font-display)' : 'var(--font-body)',
                  fontWeight: p === page ? 700 : 400,
                  fontSize: 14,
                  color: p === page ? C_BRAND : 'var(--color-text-secondary)',
                  textDecoration: p === page ? 'underline' : 'none',
                  textUnderlineOffset: 3,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              fontSize: 13,
              color: page === totalPages ? 'var(--color-text-tertiary)' : C_BRAND,
              fontFamily: 'var(--font-body)',
              opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
