import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  format, getDay, isBefore, isSameDay, isSameMonth, isToday,
  parseISO, startOfDay, startOfMonth, startOfWeek, subMonths,
} from 'date-fns'
import {
  ArrowLeft, ArrowRight, Calendar, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, ExternalLink, MapPin,
  Stethoscope, User2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { api } from '../lib/api'
import type { Appointment, ClinicDetail, DaySlots, Doctor, TimeSlot } from '../types'

type Step = 'doctor' | 'date' | 'time' | 'reason' | 'review' | 'confirmed'

const STEPS: Step[] = ['doctor', 'date', 'time', 'reason', 'review', 'confirmed']
const STEP_LABELS: Record<Step, string> = {
  doctor: 'Doctor', date: 'Date', time: 'Time',
  reason: 'Reason', review: 'Review', confirmed: 'Confirmed',
}

const DAY_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
}
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PYTHON_DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// ── Calendar ────────────────────────────────────────────────────────────────

function MonthCalendar({
  value, onChange, availableDays,
}: {
  value: string | null
  onChange: (d: string) => void
  availableDays: string[]
}) {
  const [viewMonth, setViewMonth] = useState(new Date())
  const today = startOfDay(new Date())
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const disabled = (d: Date) =>
    isBefore(d, today) || !availableDays.includes(DAY_MAP[getDay(d)])

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(m => subMonths(m, 1))}
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-sm font-bold text-gray-900">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth(m => addMonths(m, 1))}
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-bold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const dis = disabled(day)
          const sel = value ? isSameDay(day, parseISO(value)) : false
          const tod = isToday(day)
          const inMonth = isSameMonth(day, viewMonth)
          return (
            <button
              key={day.toISOString()}
              disabled={dis}
              onClick={() => !dis && onChange(format(day, 'yyyy-MM-dd'))}
              className={cn(
                'h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-all',
                !inMonth && 'opacity-20',
                dis && 'cursor-not-allowed text-gray-300',
                sel && 'bg-blue-600 text-white font-bold',
                !sel && tod && !dis && 'border-2 border-blue-500 text-blue-600',
                !sel && !dis && !tod && inMonth && 'hover:bg-blue-50 text-gray-700',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const activeIndex = STEPS.indexOf(current)
  if (current === 'confirmed') return null
  const visibleSteps = STEPS.slice(0, 5)
  return (
    <div className="flex items-center gap-0 mb-6">
      {visibleSteps.map((step, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  done && 'bg-blue-600 text-white',
                  active && 'bg-blue-600 text-white ring-4 ring-blue-100',
                  !done && !active && 'bg-gray-100 text-gray-400',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                'text-[10px] font-semibold hidden sm:block',
                active ? 'text-blue-600' : done ? 'text-gray-400' : 'text-gray-300',
              )}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < visibleSteps.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 mb-4 transition-colors',
                i < activeIndex ? 'bg-blue-600' : 'bg-gray-100',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function BookingFlow() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const preselectedDoctorId = searchParams.get('doctor')

  const [step, setStep] = useState<Step>('doctor')
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [reason, setReason] = useState('')
  const [booking, setBooking] = useState<Appointment | null>(null)

  // Fetch clinic detail
  const { data: clinic, isLoading: clinicLoading } = useQuery<ClinicDetail>({
    queryKey: ['clinic', clinicId],
    queryFn: async () => {
      const { data } = await api.get(`/clinics/${clinicId}`)
      return data
    },
    enabled: !!clinicId,
  })

  // Auto-select doctor if preselected
  useEffect(() => {
    if (clinic && preselectedDoctorId && step === 'doctor') {
      const doc = clinic.doctors?.find(d => d.id === preselectedDoctorId)
      if (doc) {
        setSelectedDoctor(doc)
        setStep('date')
      }
    }
  }, [clinic, preselectedDoctorId])

  // Fetch slots
  const { data: daySlots, isFetching: slotsLoading } = useQuery<DaySlots>({
    queryKey: ['slots', clinicId, selectedDate, selectedDoctor?.id],
    queryFn: async () => {
      const params: Record<string, string> = { date: selectedDate! }
      if (selectedDoctor) params.doctor_id = selectedDoctor.id
      const { data } = await api.get(`/clinics/${clinicId}/slots`, { params })
      return data
    },
    enabled: !!clinicId && !!selectedDate && step === 'time',
  })

  const { mutateAsync: confirmBooking, isPending: booking_ } = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/appointments/', {
        clinic_id: clinicId,
        doctor_id: selectedDoctor?.id ?? null,
        appointment_date: selectedDate,
        appointment_time: selectedSlot!.time + ':00',
        reason: reason.trim(),
        amount_kes: selectedDoctor?.consultation_fee_kes ?? 0,
      })
      return data as Appointment
    },
    onSuccess: (data) => {
      setBooking(data)
      setStep('confirmed')
    },
  })

  const canProceed = () => {
    if (step === 'doctor') return true          // doctor selection is optional
    if (step === 'date') return !!selectedDate
    if (step === 'time') return !!selectedSlot
    if (step === 'reason') return reason.trim().length >= 10
    if (step === 'review') return true
    return false
  }

  const next = () => {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
  }

  const back = () => {
    const i = STEPS.indexOf(step)
    if (i > 0) setStep(STEPS[i - 1])
    else navigate(`/clinics/${clinicId}`)
  }

  // Google Calendar link
  const calendarLink = () => {
    if (!booking || !clinic || !selectedDate || !selectedSlot) return '#'
    const [h, m] = selectedSlot.time.split(':').map(Number)
    const start = new Date(selectedDate)
    start.setHours(h, m, 0)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + (selectedDoctor?.slot_duration_minutes ?? 30))
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `MedAssist Appointment – ${selectedDoctor?.full_name ?? 'Doctor'}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `Booking ref: ${booking.booking_reference}\nReason: ${reason || 'General consultation'}`,
      location: `${clinic.name}, ${clinic.address}`,
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }

  if (clinicLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-1/3" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!clinic) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-gray-500">Clinic not found.</p>
        <button onClick={() => navigate('/clinics')} className="mt-4 text-sm text-blue-600 font-semibold">
          Back to clinics
        </button>
      </div>
    )
  }

  // ── Confirmed screen ─────────────────────────────────────────────────────
  if (step === 'confirmed' && booking) {
    return (
      <div className="max-w-sm mx-auto py-8 animate-fade-in">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">All booked!</h1>
          <p className="text-sm text-gray-500 mt-1">Your appointment is confirmed.</p>
        </div>

        {/* Booking reference */}
        <div
          className="rounded-2xl p-4 text-center mb-4"
          style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
        >
          <p className="text-xs text-blue-500 font-bold uppercase tracking-widest mb-1">Booking Reference</p>
          <p className="text-2xl font-extrabold text-blue-700 tracking-wider">{booking.booking_reference}</p>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-4"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {[
            { label: 'Doctor', value: selectedDoctor?.full_name ?? 'Any available', icon: <User2 className="h-3.5 w-3.5" /> },
            { label: 'Date', value: selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy') : '', icon: <Calendar className="h-3.5 w-3.5" /> },
            { label: 'Time', value: selectedSlot?.time ?? '', icon: <Clock className="h-3.5 w-3.5" /> },
            { label: 'Clinic', value: clinic.name, icon: <MapPin className="h-3.5 w-3.5" /> },
            { label: 'Address', value: clinic.address, icon: <MapPin className="h-3.5 w-3.5 opacity-0" /> },
          ].map(row => (
            <div key={row.label} className="flex items-start gap-3 px-4 py-3">
              <span className="text-gray-400 mt-0.5">{row.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{row.label}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{row.value}</p>
              </div>
            </div>
          ))}
          {selectedDoctor && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Stethoscope className="h-3.5 w-3.5 text-gray-400" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Consultation Fee</p>
                <p className="text-sm font-bold text-gray-900">KES {selectedDoctor.consultation_fee_kes.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a
            href={calendarLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
          >
            <ExternalLink className="h-4 w-4" />
            Add to Google Calendar
          </a>
          <button
            onClick={() => navigate('/appointments')}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#1E40AF' }}
          >
            View My Appointments
          </button>
          <button
            onClick={() => navigate('/clinics')}
            className="w-full rounded-xl py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Back to clinics
          </button>
        </div>
      </div>
    )
  }

  const activeDoctors = clinic.doctors?.filter(d => d.is_active) ?? []

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* Back + clinic name */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={back}
          className="h-8 w-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-gray-400 font-medium">{clinic.name}</p>
          <h1 className="text-lg font-extrabold text-gray-900 leading-none">
            {STEP_LABELS[step]}
          </h1>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Step content */}
      <div
        className="bg-white rounded-2xl p-5 border border-gray-100 mb-6"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)' }}
      >

        {/* STEP 1: Select Doctor */}
        {step === 'doctor' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-3">
              Choose a doctor, or proceed without a preference and we'll assign one.
            </p>
            {activeDoctors.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                No doctors available at this clinic.
              </p>
            )}
            {activeDoctors.map(doc => {
              const initials = doc.full_name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
              const sel = selectedDoctor?.id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoctor(sel ? null : doc)}
                  className={cn(
                    'w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all',
                    sel
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-200',
                  )}
                >
                  <div
                    className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: sel ? '#1E40AF' : '#6B7280' }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold truncate', sel ? 'text-blue-900' : 'text-gray-900')}>
                      {doc.full_name}
                    </p>
                    <p className="text-xs text-blue-600 font-semibold">{doc.specialty}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      KES {doc.consultation_fee_kes.toLocaleString()} · {doc.available_days?.slice(0, 3).map(d => PYTHON_DAY_NAMES[d]?.slice(0, 3) ?? '').join(', ')}
                    </p>
                  </div>
                  {sel && <Check className="h-5 w-5 text-blue-600 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}

        {/* STEP 2: Select Date */}
        {step === 'date' && (
          <MonthCalendar
            value={selectedDate}
            onChange={(d) => { setSelectedDate(d); setSelectedSlot(null) }}
            availableDays={selectedDoctor?.available_days?.map(d => PYTHON_DAY_NAMES[d]) ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']}
          />
        )}

        {/* STEP 3: Select Time */}
        {step === 'time' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700">
                {selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy') : ''}
              </p>
            </div>
            {slotsLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : !daySlots?.slots?.filter(s => s.is_available).length ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Clock className="h-8 w-8 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 font-semibold">No available slots</p>
                <p className="text-xs text-gray-400 mt-1">Try a different date</p>
                <button
                  onClick={() => setStep('date')}
                  className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Change date
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {daySlots.slots.filter(s => s.is_available).map(slot => {
                  const sel = selectedSlot?.time === slot.time
                  return (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedSlot(sel ? null : slot)}
                      className={cn(
                        'rounded-xl border py-2.5 text-sm font-semibold transition-all',
                        sel
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700',
                      )}
                    >
                      {slot.time}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedSlot && (
              <div className="mt-4 p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700 font-semibold">
                {selectedSlot.time}{selectedDoctor ? ` with ${selectedDoctor.full_name}` : ''}{selectedDoctor ? ` · KES ${selectedDoctor.consultation_fee_kes.toLocaleString()}` : ''}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Reason */}
        {step === 'reason' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Briefly describe what you'd like to discuss. This helps the doctor prepare.
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="e.g. Persistent headache for 3 days, mild fever…"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-400 outline-none resize-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <p className={`text-xs ${reason.trim().length > 0 && reason.trim().length < 10 ? 'text-red-500' : 'text-gray-400'}`}>
              {reason.trim().length > 0 && reason.trim().length < 10
                ? `${10 - reason.trim().length} more characters required`
                : 'At least 10 characters. This helps the doctor prepare.'}
            </p>
          </div>
        )}

        {/* STEP 5: Review */}
        {step === 'review' && (
          <div className="space-y-0 divide-y divide-gray-50">
            <p className="text-xs text-gray-500 pb-3">Please review your booking details before confirming.</p>
            {[
              { label: 'Doctor', value: selectedDoctor?.full_name ?? 'Any available doctor' },
              { label: 'Specialty', value: selectedDoctor?.specialty ?? '—' },
              { label: 'Date', value: selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy') : '—' },
              { label: 'Time', value: selectedSlot?.time ?? '—' },
              { label: 'Clinic', value: clinic.name },
              { label: 'Address', value: clinic.address },
              { label: 'Fee', value: selectedDoctor ? `KES ${selectedDoctor.consultation_fee_kes.toLocaleString()}` : '—' },
              ...(reason ? [{ label: 'Reason', value: reason }] : []),
            ].map(row => (
              <div key={row.label} className="flex justify-between gap-4 py-3">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide shrink-0">{row.label}</span>
                <span className="text-sm font-semibold text-gray-800 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step !== 'doctor' && (
          <button
            onClick={back}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}

        {step !== 'review' ? (
          <button
            onClick={next}
            disabled={!canProceed()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1E40AF' }}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => confirmBooking()}
            disabled={booking_}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: '#1E40AF' }}
          >
            {booking_ ? 'Confirming…' : (
              <><CheckCircle2 className="h-4 w-4" /> Confirm Booking</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
