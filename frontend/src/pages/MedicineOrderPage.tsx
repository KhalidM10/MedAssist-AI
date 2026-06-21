import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Search, ShoppingCart, CheckCircle2, ChevronLeft,
  Minus, Plus, Package, Truck, Smartphone, AlertCircle,
  Clock, MapPin, Banknote,
} from 'lucide-react'
import { format, addMinutes } from 'date-fns'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { CartDrawer } from '../components/CartDrawer'
import type { Product, CartItem, MedOrder } from '../types'

type PageView = 'browse' | 'checkout' | 'confirmed'

const CATEGORIES = [
  { key: '',            label: 'All' },
  { key: 'pain_relief', label: 'Pain Relief' },
  { key: 'vitamins',    label: 'Vitamins' },
  { key: 'cold_flu',    label: 'Cold & Flu' },
  { key: 'digestive',   label: 'Digestive' },
  { key: 'skin_care',   label: 'Skin Care' },
  { key: 'baby_care',   label: 'Baby & Child' },
  { key: 'first_aid',   label: 'First Aid' },
]

const DELIVERY_FEE = 200

// ── Checkout schema ────────────────────────────────────────────────────────
const checkoutSchema = z.object({
  delivery_method: z.enum(['pickup', 'delivery']),
  delivery_address: z.string().optional(),
  payment_method: z.enum(['mpesa', 'cash']),
  mpesa_phone: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.delivery_method === 'delivery' && !data.delivery_address?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Delivery address is required', path: ['delivery_address'] })
  }
  if (data.payment_method === 'mpesa' && (!data.mpesa_phone || data.mpesa_phone.length < 9)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid M-Pesa number', path: ['mpesa_phone'] })
  }
})

type CheckoutForm = z.infer<typeof checkoutSchema>

// ── Product card ───────────────────────────────────────────────────────────
function ProductCard({
  product,
  cartQty,
  onAdd,
  onUpdateQty,
}: {
  product: Product
  cartQty: number
  onAdd: () => void
  onUpdateQty: (delta: number) => void
}) {
  const catLabel = CATEGORIES.find(c => c.key === product.category)?.label ?? product.category

  return (
    <div className="card p-4 flex flex-col gap-3 hover:shadow-md transition-all">
      {/* Category badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-bold rounded-full px-2.5 py-1 leading-none"
          style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
        >
          {catLabel}
        </span>
        {product.stock_quantity <= 10 && product.stock_quantity > 0 && (
          <span className="text-[10px] font-semibold" style={{ color: 'var(--color-warning)' }}>
            Only {product.stock_quantity} left
          </span>
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1">
        <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{product.name}</p>
        {product.description && (
          <p className="text-[11px] mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {product.description}
          </p>
        )}
      </div>

      {/* Price + source */}
      <div>
        <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
          KES {product.price_kes.toLocaleString()}
        </p>
        {product.clinic_name && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{product.clinic_name}</p>
        )}
      </div>

      {/* Cart control */}
      {cartQty === 0 ? (
        <button
          onClick={onAdd}
          className="w-full rounded-xl py-2 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          Add to cart
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-brand)' }}>
          <button
            onClick={() => onUpdateQty(-1)}
            className="flex-1 py-2 flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-bold px-3" style={{ color: 'var(--color-text-primary)' }}>{cartQty}</span>
          <button
            onClick={() => onUpdateQty(1)}
            className="flex-1 py-2 flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Order status tracker ───────────────────────────────────────────────────
function StatusTracker({ status }: { status: string }) {
  const steps = [
    { key: 'pending',    label: 'Order Placed',  icon: CheckCircle2 },
    { key: 'processing', label: 'Processing',    icon: Package },
    { key: 'ready',      label: 'Ready',         icon: Clock },
    { key: 'delivered',  label: 'Delivered',     icon: Truck },
  ]
  const idx = steps.findIndex(s => s.key === status)

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => {
        const done = i <= idx
        const Icon = step.icon
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundColor: done ? 'var(--color-brand)' : 'var(--color-surface-2)',
                  color: done ? 'white' : 'var(--color-text-tertiary)',
                }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className="text-[10px] font-semibold text-center leading-tight"
                style={{ color: done ? 'var(--color-brand)' : 'var(--color-text-tertiary)' }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 mb-4 transition-all"
                style={{ backgroundColor: i < idx ? 'var(--color-brand)' : 'var(--color-border)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export function MedicineOrderPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [pageView, setPageView] = useState<PageView>('browse')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState<MedOrder | null>(null)
  const [pickupClinicName, setPickupClinicName] = useState<string | null>(null)
  const [confirmedReadyTime, setConfirmedReadyTime] = useState<string>('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', category, debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (category) params.category = category
      if (debouncedSearch) params.search = debouncedSearch
      const { data } = await api.get('/orders/products', { params })
      return data
    },
  })

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const cartSubtotal = cart.reduce((sum, i) => sum + i.priceKes * i.quantity, 0)

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        priceKes: product.price_kes,
        quantity: 1,
        clinicName: product.clinic_name,
      }]
    })
  }, [])

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
        .filter(i => i.quantity > 0)
    )
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      delivery_method: 'pickup',
      payment_method: 'mpesa',
      mpesa_phone: user?.phone ?? '',
    },
  })

  const deliveryMethod = watch('delivery_method')
  const paymentMethod = watch('payment_method')
  const totalWithDelivery = cartSubtotal + (deliveryMethod === 'delivery' ? DELIVERY_FEE : 0)

  const { mutateAsync: placeOrder, isPending: isPlacing } = useMutation({
    mutationFn: async (formData: CheckoutForm) => {
      const payload = {
        items: cart.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_method: formData.delivery_method,
        delivery_address: formData.delivery_method === 'delivery' ? formData.delivery_address : null,
        payment_method: formData.payment_method,
      }
      const { data } = await api.post('/orders/', payload)
      return data as MedOrder
    },
    onSuccess: (order) => {
      setConfirmedReadyTime(format(addMinutes(new Date(), 30), 'h:mm a'))
      setPickupClinicName(cart[0]?.clinicName ?? null)
      setConfirmedOrder(order)
      setCart([])
      setPageView('confirmed')
    },
  })

  function onSubmitCheckout(formData: CheckoutForm) {
    placeOrder(formData)
  }

  // ── Browse view ──────────────────────────────────────────────────────────
  if (pageView === 'browse') {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Medicines</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>OTC products from verified clinics and pharmacies</p>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            No prescription medicines
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-xl bg-white pl-10 pr-4 py-2.5 text-sm outline-none transition-all"
            style={{ border: '1px solid var(--color-border)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-light)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
              style={
                category === cat.key
                  ? { backgroundColor: 'var(--color-brand)', color: 'white' }
                  : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-48 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <Package className="h-7 w-7" style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No products found</p>
            {debouncedSearch && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Try a different search term</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(product => {
              const cartItem = cart.find(i => i.productId === product.id)
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQty={cartItem?.quantity ?? 0}
                  onAdd={() => addToCart(product)}
                  onUpdateQty={(delta) => updateQty(product.id, delta)}
                />
              )
            })}
          </div>
        )}

        {/* Floating cart button */}
        {cartCount > 0 && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.97]"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: '0 8px 24px rgba(30,64,175,0.35)' }}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <span className="opacity-70">·</span>
            <span>KES {cartSubtotal.toLocaleString()}</span>
          </button>
        )}

        <CartDrawer
          isOpen={drawerOpen}
          items={cart}
          onClose={() => setDrawerOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onCheckout={() => {
            setPickupClinicName(cart[0]?.clinicName ?? null)
            setDrawerOpen(false)
            setPageView('checkout')
          }}
        />

        {cartCount > 0 && <div className="h-20" />}
      </div>
    )
  }

  // ── Checkout view ─────────────────────────────────────────────────────────
  if (pageView === 'checkout') {
    return (
      <div className="space-y-5 animate-fade-in">
        <button
          onClick={() => setPageView('browse')}
          className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to store
        </button>

        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Checkout</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{cart.length} product type{cart.length !== 1 ? 's' : ''}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmitCheckout)} className="space-y-4">
          {/* Order summary */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Order Summary</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {cart.map(item => (
                <div key={item.productId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: 'var(--color-brand)' }}
                    >
                      {item.name[0]}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    KES {(item.priceKes * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>KES {cartSubtotal.toLocaleString()}</span>
                </div>
                {deliveryMethod === 'delivery' && (
                  <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span>Delivery fee</span>
                    <span>KES {DELIVERY_FEE.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <span>Total</span>
                  <span>KES {totalWithDelivery.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery method */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Delivery</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" value="pickup" {...register('delivery_method')} className="accent-blue-700" />
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <Package className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Clinic Pickup</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>Collect directly from the pharmacy</p>
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" value="delivery" {...register('delivery_method')} className="accent-blue-700" />
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <Truck className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Home Delivery</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>+KES 200 · 2–4 hours</p>
                  </div>
                </div>
              </label>

              {deliveryMethod === 'delivery' && (
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Delivery Address</label>
                  <textarea
                    {...register('delivery_address')}
                    rows={2}
                    placeholder="Street, building, apartment number…"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm resize-none outline-none transition-all"
                    style={{ border: `1px solid ${errors.delivery_address ? 'var(--color-danger)' : 'var(--color-border)'}` }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-light)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.delivery_address ? 'var(--color-danger)' : 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  {errors.delivery_address && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.delivery_address.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Payment</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" value="mpesa" {...register('payment_method')} className="accent-blue-700" />
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-success-light)' }}>
                    <Smartphone className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>M-Pesa</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>STK push to your phone</p>
                  </div>
                </div>
              </label>

              <label className={`flex items-center gap-3 ${deliveryMethod === 'delivery' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  value="cash"
                  {...register('payment_method')}
                  disabled={deliveryMethod === 'delivery'}
                  className="accent-blue-700"
                />
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                    <Banknote className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cash on Pickup</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {deliveryMethod === 'delivery' ? 'Not available for delivery' : 'Pay at the pharmacy counter'}
                    </p>
                  </div>
                </div>
              </label>

              {paymentMethod === 'mpesa' && (
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>M-Pesa Phone Number</label>
                  <input
                    type="tel"
                    {...register('mpesa_phone')}
                    placeholder="+254 7XX XXX XXX"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                    style={{ border: `1px solid ${errors.mpesa_phone ? 'var(--color-danger)' : 'var(--color-border)'}` }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-brand-light)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.mpesa_phone ? 'var(--color-danger)' : 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  {errors.mpesa_phone && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.mpesa_phone.message}</p>
                  )}
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    You will receive an M-Pesa payment prompt after placing your order.
                  </p>
                </div>
              )}

              {paymentMethod === 'cash' && (
                <div
                  className="rounded-xl p-3 text-[12px]"
                  style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-light)' }}
                >
                  Bring exact cash of <strong>KES {totalWithDelivery.toLocaleString()}</strong> to the pharmacy counter when collecting your order.
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPlacing}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-brand)' }}
          >
            {isPlacing ? 'Placing order…' : `Place Order — KES ${totalWithDelivery.toLocaleString()}`}
          </button>

          <p className="text-[11px] text-center pb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            M-Pesa payment will be requested on your phone after confirmation
          </p>
        </form>
      </div>
    )
  }

  // ── Confirmed view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Success hero */}
      <div className="card p-6 text-center">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'var(--color-brand-light)' }}
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--color-brand)' }} />
        </div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Order Placed</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Your order has been received and is being processed.</p>

        {confirmedOrder && (
          <div
            className="mt-4 rounded-xl px-4 py-3 inline-block"
            style={{ backgroundColor: 'var(--color-brand-light)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-brand)' }}>Order Reference</p>
            <p className="text-lg font-bold tracking-wide mt-0.5" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {confirmedOrder.order_reference}
            </p>
          </div>
        )}
      </div>

      {/* Estimated ready time + pickup info */}
      {confirmedOrder && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" style={{ color: 'var(--color-brand)' }} />
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Ready by</p>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{confirmedReadyTime}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Estimated ~30 min</p>
          </div>

          {confirmedOrder.delivery_method === 'pickup' && pickupClinicName ? (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4" style={{ color: 'var(--color-brand)' }} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Pickup at</p>
              </div>
              <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{pickupClinicName}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Show order reference at counter</p>
            </div>
          ) : (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4" style={{ color: 'var(--color-brand)' }} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Delivery</p>
              </div>
              <p className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Home Delivery</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>2–4 hours to your address</p>
            </div>
          )}
        </div>
      )}

      {/* Status tracker */}
      {confirmedOrder && (
        <div className="card p-5">
          <p className="text-[13px] font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>Order Status</p>
          <StatusTracker status={confirmedOrder.status} />
        </div>
      )}

      {/* Order details */}
      {confirmedOrder && confirmedOrder.items_detail.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Items Ordered</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {confirmedOrder.items_detail.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.product_name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>× {item.quantity}</p>
                </div>
                <span className="text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  KES {item.total_kes.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="pt-3 flex justify-between text-sm font-bold" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              <span>Total Paid</span>
              <span>KES {confirmedOrder.total_amount_kes.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pb-8">
        <button
          onClick={() => { setPageView('browse'); setConfirmedOrder(null) }}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          Continue Shopping
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-white border border-gray-200 hover:border-gray-300 transition-all"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
