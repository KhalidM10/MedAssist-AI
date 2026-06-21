import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Package, Search, ChevronDown, CheckCircle2, Truck, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { formatKES, cn } from '../../lib/utils'

interface ClinicOrder {
  id: string
  order_number: string
  patient_name: string
  items: { name: string; qty: number; unit_price: number; total: number }[]
  total_kes: number
  status: string
  delivery_method: string
  payment_method: string
  created_at: string
}

const STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string; icon: React.ElementType
}> = {
  pending:    { label: 'Pending',    bg: 'var(--color-warning-light)', text: 'var(--color-warning)', icon: Clock },
  processing: { label: 'Processing', bg: 'var(--color-brand-light)',   text: 'var(--color-brand)',   icon: Package },
  ready:      { label: 'Ready',      bg: 'var(--color-success-light)', text: 'var(--color-success)', icon: CheckCircle2 },
  delivered:  { label: 'Delivered',  bg: 'var(--color-surface-2)',     text: 'var(--color-text-secondary)', icon: Truck },
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'processing',
  processing: 'ready',
  ready: 'delivered',
}

function OrderStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function OrderCard({ order, onAdvance, advancing }: {
  order: ClinicOrder
  onAdvance: (id: string, status: string) => void
  advancing: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const nextStatus = NEXT_STATUS[order.status]

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div
          className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-brand-light)' }}
        >
          <Package className="h-5 w-5" style={{ color: 'var(--color-brand)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{order.order_number}</p>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {order.patient_name} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            · {order.delivery_method === 'delivery' ? 'Delivery' : 'Pickup'}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatKES(order.total_kes)}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {format(parseISO(order.created_at), 'd MMM, h:mm a')}
          </p>
        </div>

        <ChevronDown className={cn('h-4 w-4 text-gray-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="px-5 py-4 space-y-4">
            {/* Items */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Items</p>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {item.name} <span style={{ color: 'var(--color-text-tertiary)' }}>×{item.qty}</span>
                    </span>
                    <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatKES(item.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <span className="font-bold" style={{ color: 'var(--color-text-secondary)' }}>Total</span>
                  <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatKES(order.total_kes)}</span>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="flex gap-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <div>
                <span>Payment: </span>
                <span className="font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>{order.payment_method}</span>
              </div>
              <div>
                <span>Method: </span>
                <span className="font-semibold capitalize" style={{ color: 'var(--color-text-secondary)' }}>{order.delivery_method}</span>
              </div>
            </div>

            {/* Advance action */}
            {nextStatus && (
              <button
                onClick={() => onAdvance(order.id, nextStatus)}
                disabled={advancing}
                className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-brand)' }}
              >
                {advancing ? 'Updating…' : `Mark as ${STATUS_CONFIG[nextStatus]?.label}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ClinicOrdersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: orders = [], isLoading } = useQuery<ClinicOrder[]>({
    queryKey: ['clinic-orders'],
    queryFn: () => api.get('/dashboard/orders').then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, null, { params: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clinic-orders'] }),
  })

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.patient_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const countByStatus = {
    pending:    orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    ready:      orders.filter(o => o.status === 'ready').length,
    delivered:  orders.filter(o => o.status === 'delivered').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Medicine orders from your patients</p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { key: 'pending',    label: 'Pending',    color: 'var(--color-warning)',        bg: 'var(--color-warning-light)' },
          { key: 'processing', label: 'Processing', color: 'var(--color-brand)',          bg: 'var(--color-brand-light)' },
          { key: 'ready',      label: 'Ready',      color: 'var(--color-success)',        bg: 'var(--color-success-light)' },
          { key: 'delivered',  label: 'Delivered',  color: 'var(--color-text-secondary)', bg: 'var(--color-surface-2)' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(prev => prev === s.key ? 'all' : s.key)}
            className="card p-4 text-left transition-all"
            style={{
              backgroundColor: s.bg,
              ...(statusFilter === s.key ? { outline: `2px solid ${s.color}`, outlineOffset: '2px' } : {}),
            }}
          >
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>
              {isLoading ? '–' : countByStatus[s.key as keyof typeof countByStatus]}
            </p>
            <p className="text-xs font-semibold mt-1" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order number or patient…"
            className="w-full rounded-xl bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-all"
            style={{ border: '1px solid var(--color-border)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-light)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <Package className="h-7 w-7" style={{ color: 'var(--color-border-strong)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {search || statusFilter !== 'all' ? 'No orders match this filter' : 'No orders yet'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {search ? 'Try a different search term.' : statusFilter !== 'all' ? 'Try clearing the filter.' : 'Patient medicine orders will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onAdvance={(id, status) => advanceMutation.mutate({ id, status })}
              advancing={advanceMutation.isPending && advanceMutation.variables?.id === order.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
