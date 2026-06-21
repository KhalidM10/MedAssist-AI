import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Star, MessageSquare, TrendingUp, Filter, CornerDownRight, Send, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { cn } from '../../lib/utils'

interface Review {
  id: string
  patient_name: string
  rating: number
  title: string | null
  body: string | null
  created_at: string
  is_verified: boolean
  doctor_name: string | null
  response: string | null
  response_at: string | null
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('shrink-0', i < rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200')}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  )
}

function RatingDistribution({ reviews }: { reviews: Review[] }) {
  const counts = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: reviews.filter(rv => rv.rating === r).length,
  }))
  const max = Math.max(...counts.map(c => c.count), 1)

  return (
    <div className="space-y-2">
      {counts.map(({ rating, count }) => (
        <div key={rating} className="flex items-center gap-3">
          <div className="flex items-center gap-1 w-8 shrink-0">
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>{rating}</span>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </div>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs w-4 text-right" style={{ color: 'var(--color-text-tertiary)' }}>{count}</span>
        </div>
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const qc = useQueryClient()
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const replied = !!review.response

  const replyMutation = useMutation({
    mutationFn: () =>
      api.post(`/dashboard/reviews/${review.id}/reply`, { reply: replyText.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic-reviews'] })
      setReplyOpen(false)
      setReplyText('')
    },
  })

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
          >
            {review.patient_name[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{review.patient_name}</p>
              {review.is_verified && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                  Verified
                </span>
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {format(parseISO(review.created_at), 'd MMM yyyy')}
              {review.doctor_name && ` · ${review.doctor_name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StarRating rating={review.rating} />
          {replied && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
              Replied
            </span>
          )}
        </div>
      </div>

      {review.title && (
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{review.title}</p>
      )}

      {review.body && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{review.body}</p>
      )}

      {review.response && (
        <div className="rounded-xl p-3 space-y-1" style={{ backgroundColor: 'var(--color-brand-light)', border: '1px solid var(--color-border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-brand)' }}>Clinic response</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{review.response}</p>
        </div>
      )}

      {!replied && (
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={() => setReplyOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ color: replyOpen ? 'var(--color-brand)' : 'var(--color-text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Reply
          </button>
        </div>
      )}

      {replyOpen && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-start gap-2">
            <CornerDownRight className="h-3.5 w-3.5 mt-3 shrink-0" style={{ color: 'var(--color-border-strong)' }} />
            <div className="flex-1 space-y-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                placeholder="Write a reply to this review…"
                className="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none transition-all"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-light)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setReplyOpen(false); setReplyText('') }}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                >
                  Cancel
                </button>
                <button
                  onClick={() => replyMutation.mutate()}
                  disabled={replyText.trim().length < 5 || replyMutation.isPending}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-40"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  {replyMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                  Post Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ClinicReviewsPage() {
  const { user } = useAuthStore()

  const [filterRating, setFilterRating] = useState<number | null>(null)

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ['clinic-reviews'],
    queryFn: () => api.get('/dashboard/reviews').then(r => r.data),
    enabled: !!user?.clinic_id,
    staleTime: 60_000,
  })

  const filtered = filterRating === null ? reviews : reviews.filter(r => r.rating === filterRating)

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0
  const replyRate = reviews.length > 0
    ? Math.round((reviews.filter(r => !!r.response).length / reviews.length) * 100)
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Reviews</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {reviews.length} review{reviews.length !== 1 ? 's' : ''}{reviews.length > 0 ? ` · ${avgRating.toFixed(1)} average` : ''}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-32 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--color-warning-light)' }}
          >
            <Star className="h-7 w-7" style={{ color: 'var(--color-warning)' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>No reviews yet</p>
          <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Patient reviews will appear here once they submit feedback after their appointments.
          </p>
        </div>
      ) : (
        <>
          {/* Summary panel */}
          <div className="card p-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center justify-center gap-2" style={{ borderRight: '1px solid var(--color-border)' }}>
              <p className="text-5xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{avgRating.toFixed(1)}</p>
              <StarRating rating={Math.round(avgRating)} size={20} />
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{reviews.length} total reviews</p>
            </div>
            <div className="sm:col-span-2">
              <RatingDistribution reviews={reviews} />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Avg Rating', val: avgRating.toFixed(1), suffix: '/ 5', color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
              { label: 'Reply Rate', val: `${replyRate}%`, suffix: '', color: 'var(--color-success)', bg: 'var(--color-success-light)' },
              { label: 'This Month', val: reviews.filter(r => r.created_at > new Date(Date.now() - 30 * 86400000).toISOString()).length.toString(), suffix: ' reviews', color: 'var(--color-brand)', bg: 'var(--color-brand-light)' },
            ].map(s => (
              <div key={s.label} className="card p-4" style={{ backgroundColor: s.bg }}>
                <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>
                  {s.val}<span className="text-sm font-normal" style={{ color: 'var(--color-text-tertiary)' }}>{s.suffix}</span>
                </p>
                <p className="text-xs font-semibold mt-1" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rating filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" style={{ color: 'var(--color-border-strong)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Filter:</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[null, 5, 4, 3, 2, 1].map(r => (
                <button
                  key={r ?? 'all'}
                  onClick={() => setFilterRating(r)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    filterRating === r
                      ? 'text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                  style={filterRating === r ? { backgroundColor: 'var(--color-brand)' } : {}}
                >
                  {r === null ? 'All stars' : `${r}★`}
                </button>
              ))}
            </div>
          </div>

          {/* Review list */}
          {filtered.length === 0 ? (
            <div className="card flex flex-col items-center py-16 text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No reviews match this filter</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Try a different star rating.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: 'var(--color-brand-light)', border: '1px solid var(--color-border)' }}>
        <TrendingUp className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-brand)' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>Patient feedback</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand)' }}>
            Reviews are submitted by verified patients after their appointments. Reply publicly to show your clinic's commitment to patient care.
          </p>
        </div>
      </div>
    </div>
  )
}
