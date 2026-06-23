import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Store, Search, Package, Rocket, Filter } from 'lucide-react'
import { api } from '../../lib/api'
import { formatKES, cn } from '../../lib/utils'
import type { Product } from '../../types'

const CATEGORIES = ['all', 'antibiotic', 'analgesic', 'vitamin', 'antimalaria', 'antifungal', 'antihistamine', 'other']

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  antibiotic:     { bg: 'var(--color-danger-light)',  text: 'var(--color-danger)' },
  analgesic:      { bg: 'var(--color-brand-light)',   text: 'var(--color-brand)' },
  vitamin:        { bg: 'var(--color-success-light)', text: 'var(--color-success)' },
  antimalaria:    { bg: 'var(--color-warning-light)', text: 'var(--color-warning)' },
  antifungal:     { bg: 'var(--color-brand-light)',   text: 'var(--color-brand)' },
  antihistamine:  { bg: 'var(--color-brand-light)',   text: 'var(--color-brand)' },
  other:          { bg: 'var(--color-surface-2)',     text: 'var(--color-text-secondary)' },
}

function StockBar({ qty, max = 100 }: { qty: number; max?: number }) {
  const pct = Math.min(100, (qty / max) * 100)
  const color = pct > 50 ? 'var(--color-success)' : pct > 20 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const catStyle = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.other
  const isLowStock = product.stock_quantity < 20
  const isOutOfStock = product.stock_quantity === 0

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: catStyle.bg }}
        >
          <Package className="h-5 w-5" style={{ color: catStyle.text }} />
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
          style={catStyle}
        >
          {product.category}
        </span>
      </div>

      {/* Name & description */}
      <div>
        <p className="text-sm font-bold leading-snug" style={{ color: 'var(--color-text-primary)' }}>{product.name}</p>
        {product.description && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>{product.description}</p>
        )}
      </div>

      {/* Price */}
      <p className="text-base font-bold" style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)' }}>
        {formatKES(product.price_kes)}
      </p>

      {/* Stock */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Stock</span>
          <span
            className="text-xs font-bold"
            style={{ color: isOutOfStock ? 'var(--color-danger)' : isLowStock ? 'var(--color-warning)' : 'var(--color-success)' }}
          >
            {isOutOfStock ? 'Out of stock' : `${product.stock_quantity} units`}
          </span>
        </div>
        <StockBar qty={product.stock_quantity} max={100} />
      </div>

      {/* Flags */}
      <div className="flex items-center gap-2">
        {product.requires_prescription && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
            Rx Required
          </span>
        )}
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-bold"
          style={product.is_active
            ? { backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }
            : { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }
          }
        >
          {product.is_active ? 'Listed' : 'Unlisted'}
        </span>
      </div>
    </div>
  )
}

export function ClinicProductsPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['clinic-products'],
    queryFn: () => api.get('/dashboard/products').then(r => r.data),
    staleTime: 120_000,
  })

  const filtered = products.filter(p => {
    const matchCat = category === 'all' || p.category === category
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const totalValue = products.reduce((sum, p) => sum + p.price_kes * p.stock_quantity, 0)
  const lowStockCount = products.filter(p => p.stock_quantity < 20 && p.stock_quantity > 0).length
  const outOfStockCount = products.filter(p => p.stock_quantity === 0).length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Products</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {products.length} products · {formatKES(totalValue)} inventory value
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold" style={{ color: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)', border: '1px solid var(--color-border)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Launching next sprint
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', val: products.length,   color: 'var(--color-brand)',   bg: 'var(--color-brand-light)' },
          { label: 'Low Stock',      val: lowStockCount,     color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
          { label: 'Out of Stock',   val: outOfStockCount,   color: 'var(--color-danger)',  bg: 'var(--color-danger-light)' },
        ].map(s => (
          <div
            key={s.label}
            className="card p-4"
            style={{ backgroundColor: s.bg }}
          >
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.val}</p>
            <p className="text-xs font-semibold mt-1" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-56 rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all capitalize',
                category === cat
                  ? 'text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
              style={category === cat ? { backgroundColor: 'var(--color-brand)' } : {}}
            >
              {cat === 'all' ? 'All categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <Store className="h-7 w-7" style={{ color: 'var(--color-border-strong)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {search || category !== 'all' ? 'No matching products' : 'No products listed'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {search || category !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Add products to enable medicine ordering for your patients.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Announcement banner */}
      <div className="card p-5 flex items-start gap-4" style={{ backgroundColor: 'var(--color-brand-light)', border: '1px solid var(--color-border)' }}>
        <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}>
          <Rocket className="h-5 w-5" style={{ color: 'var(--color-brand)' }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold" style={{ color: 'var(--color-brand)' }}>Full Product Management — Launching Next Sprint</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}>Soon</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-brand)' }}>
            Add, edit, restock, and deactivate products directly from your dashboard. Until then, contact{' '}
            <a href="mailto:support@medassist.co.ke" className="font-semibold underline underline-offset-2 transition-colors" style={{ color: 'var(--color-brand)' }}>
              support@medassist.co.ke
            </a>{' '}
            to update your product catalog.
          </p>
        </div>
      </div>
    </div>
  )
}
