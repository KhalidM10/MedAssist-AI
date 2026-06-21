import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Calendar, BarChart2, CreditCard,
  LogOut, Users, Package, ShieldCheck, Stethoscope,
  Star, Bell, Settings, Store, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/auth'
import { usePermissions } from '../../contexts/PermissionContext'
import { useWs } from '../../contexts/WebSocketContext'
import { api } from '../../lib/api'

/* ── Nav structure ── */
interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  end?: boolean
  permission?: [string, string]
  roles?: string[]
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/clinic-dashboard',               label: 'Overview',      icon: LayoutDashboard, end: true },
      { href: '/clinic-dashboard/appointments',  label: 'Appointments',  icon: Calendar,        permission: ['appointments', 'read'] },
      { href: '/clinic-dashboard/patients',      label: 'Patients',      icon: Users,           permission: ['patients', 'read'] },
      { href: '/clinic-dashboard/doctors',       label: 'Doctors',       icon: Stethoscope },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/clinic-dashboard/orders',        label: 'Orders',        icon: Package,  permission: ['orders', 'read:clinic'] },
      { href: '/clinic-dashboard/products',      label: 'Products',      icon: Store },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/clinic-dashboard/analytics',     label: 'Analytics',     icon: BarChart2,  permission: ['analytics', 'read:basic'] },
      { href: '/clinic-dashboard/reviews',       label: 'Reviews',       icon: Star },
      { href: '/clinic-dashboard/audit',         label: 'Audit Logs',    icon: ShieldCheck, permission: ['audit', 'read:own_clinic'] },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/clinic-dashboard/subscription',  label: 'Subscription',  icon: CreditCard, roles: ['clinic_admin', 'super_admin'] },
      { href: '/clinic-dashboard/settings',      label: 'Settings',      icon: Settings,   roles: ['clinic_admin', 'super_admin'] },
    ],
  },
]

const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  basic:      { label: 'Basic',      color: 'var(--sidebar-text)',   bg: 'var(--sidebar-surface)' },
  pro:        { label: 'Pro',        color: '#C8A96E',               bg: 'rgba(200,169,110,0.12)' },
  enterprise: { label: 'Enterprise', color: '#C8A96E',               bg: 'rgba(200,169,110,0.08)' },
}

/* ── Sub-components ── */
function Avatar({ name }: { name?: string }) {
  const initials = name
    ? name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold select-none"
      style={{
        background: 'rgba(255,255,255,0.08)',
        color: '#E2E8F0',
        border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {initials}
    </div>
  )
}

/* ── Layout ── */
export function ClinicLayout() {
  const { user, logout } = useAuthStore()
  const { can } = usePermissions()
  const { unreadCount } = useWs()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const { data: stats } = useQuery<{ clinic_name: string | null; subscription_plan?: string }>({
    queryKey: ['clinic-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    staleTime: 120_000,
  })

  const clinicName = stats?.clinic_name ?? 'Clinic Portal'
  const plan = (stats as any)?.subscription_plan ?? 'basic'
  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.basic

  function visible(item: NavItem) {
    if (item.roles && user && !item.roles.includes(user.role)) return false
    if (item.permission && !can(item.permission[0], item.permission[1])) return false
    return true
  }

  const rawPage = pathname.replace('/clinic-dashboard', '').replace(/^\//, '') || 'overview'
  const pageLabel = rawPage.charAt(0).toUpperCase() + rawPage.slice(1).replace(/-/g, ' ')

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-canvas)' }}>

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'group/sidebar relative flex flex-col shrink-0 select-none transition-[width] duration-300 ease-in-out overflow-hidden',
          collapsed ? 'w-16' : 'w-[248px]',
        )}
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo header */}
        <div
          className="flex h-16 shrink-0 items-center px-5"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          {/* ECG icon */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
            style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.25)' }}
          >
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path
                d="M1 11 L6 11 L8 7 L11 16 L13 6 L15 11 L21 11"
                stroke="#C8A96E"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {!collapsed && (
            <div className="ml-3 min-w-0 flex-1">
              <p
                className="text-[13.5px] font-semibold leading-none text-white tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                MedAssist AI
              </p>
              <p className="mt-[3px] truncate text-[11px]" style={{ color: 'var(--sidebar-text)' }}>
                {clinicName}
              </p>
            </div>
          )}

          {/* Collapse toggle — anchored to right edge so it's reachable when collapsed */}
          <button
            onClick={() => setCollapsed(v => !v)}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-150',
              'opacity-0 group-hover/sidebar:opacity-100',
            )}
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Plan badge */}
        {!collapsed && (
          <div className="px-4 pt-3 pb-0.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: badge.bg, color: badge.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: badge.color }} />
              {badge.label}
            </span>
          </div>
        )}

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {SECTIONS.map((section, si) => {
            const visibleItems = section.items.filter(visible)
            if (!visibleItems.length) return null
            return (
              <div key={si}>
                {section.label && !collapsed && (
                  <p
                    className="px-5 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--sidebar-text)', opacity: 0.5, fontFamily: 'var(--font-body)' }}
                  >
                    {section.label}
                  </p>
                )}
                {section.label && collapsed && si > 0 && (
                  <div className="my-2 mx-3 h-px" style={{ backgroundColor: 'var(--sidebar-border)' }} />
                )}
                <div className="px-2 space-y-[1px]">
                  {visibleItems.map(({ href, label, icon: Icon, end }) => (
                    <NavLink
                      key={href}
                      to={href}
                      end={end}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-3 transition-all duration-150',
                          'h-9',
                          isActive
                            ? 'text-white'
                            : 'hover:text-white/80',
                        )
                      }
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                        color: isActive ? '#FFFFFF' : 'var(--sidebar-text)',
                      })}
                      onMouseEnter={e => {
                        const link = e.currentTarget
                        if (!link.classList.contains('active')) {
                          link.style.backgroundColor = 'var(--sidebar-hover)'
                        }
                      }}
                      onMouseLeave={e => {
                        const link = e.currentTarget
                        if (!link.classList.contains('active')) {
                          link.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className="h-4 w-4 shrink-0"
                            style={{ color: isActive ? '#FFFFFF' : 'var(--sidebar-text)' }}
                          />
                          {!collapsed && (
                            <span
                              className="flex-1 truncate text-[13.5px]"
                              style={{
                                fontFamily: 'var(--font-body)',
                                fontWeight: isActive ? 500 : 400,
                                color: isActive ? '#FFFFFF' : 'var(--sidebar-text)',
                              }}
                            >
                              {label}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User profile */}
        <div
          className="shrink-0 p-3"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          {!collapsed ? (
            <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
              <Avatar name={user?.full_name} />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[12.5px] font-medium leading-tight"
                  style={{ color: '#E2E8F0', fontFamily: 'var(--font-body)' }}
                >
                  {user?.full_name}
                </p>
                <p
                  className="mt-[2px] truncate text-[11px] capitalize"
                  style={{ color: '#64748B', fontFamily: 'var(--font-body)' }}
                >
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150"
                style={{ color: '#64748B' }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)'
                  e.currentTarget.style.color = '#F87171'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#64748B'
                }}
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Avatar name={user?.full_name} />
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150"
                style={{ color: '#64748B' }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)'
                  e.currentTarget.style.color = '#F87171'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#64748B'
                }}
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content area ── */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header
          className="flex h-16 shrink-0 items-center justify-between px-8"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <span
              className="text-[13px]"
              style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
            >
              Clinic
            </span>
            <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--color-border-strong)' }} />
            <span
              className="text-[13px] font-medium capitalize"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
            >
              {pageLabel}
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/notifications')}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute right-1 top-1 h-[7px] w-[7px] rounded-full border-2 border-white"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                />
              )}
            </button>
            <div className="h-5 w-px mx-1" style={{ backgroundColor: 'var(--color-border)' }} />
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold select-none"
              style={{
                background: 'var(--color-brand-light)',
                color: 'var(--color-brand)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {user?.full_name?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() ?? '?'}
            </div>
            <span
              className="hidden sm:block text-[13px] font-medium"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
            >
              {user?.full_name?.split(' ')[0]}
            </span>
          </div>
        </header>

        {/* Page */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
