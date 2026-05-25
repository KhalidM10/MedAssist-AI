import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, User, Mail, Phone, Shield, Lock, Unlock,
  LogOut as LogOutIcon, Key, Trash2, UserX, X, Eye,
  ChevronRight, Clock, AlertTriangle, Ban,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { api } from '../../lib/api'
import type { User as AppUser } from '../../types'

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminUser extends AppUser {
  last_login: string | null
  session_count: number
  total_appointments: number
  total_orders: number
  clinic_name: string | null
  warning_count: number
  ban_reason: string | null
  banned_at: string | null
  suspension_reason: string | null
  is_clinic_approved: boolean
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  patient:               { bg: '#EFF6FF', color: '#1E40AF' },
  clinic_admin:          { bg: '#F5F3FF', color: '#6D28D9' },
  clinic_doctor:         { bg: '#D1FAE5', color: '#065F46' },
  clinic_receptionist:   { bg: '#FEF3C7', color: '#92400E' },
  clinic_pharmacist:     { bg: '#FEE2E2', color: '#991B1B' },
  super_admin:           { bg: '#FEE2E2', color: '#991B1B' },
}

const ALL_ROLES = ['patient','clinic_admin','clinic_doctor','clinic_receptionist','clinic_pharmacist','super_admin']

const inputCls = 'w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand'
const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

// ── User detail panel ─────────────────────────────────────────────────────────

function UserPanel({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient()
  const [impersonateReason, setImpersonateReason] = useState('')
  const [showImpersonate, setShowImpersonate] = useState(false)
  const [newRole, setNewRole] = useState(user.role)

  const forceLogout = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/force-logout`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const toggleLock = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/${user.is_active ? 'lock' : 'unlock'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const resetPw = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/reset-password`),
  })

  const changeRole = useMutation({
    mutationFn: (role: string) => api.patch(`/admin/users/${user.id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const deleteUser = useMutation({
    mutationFn: () => api.delete(`/admin/users/${user.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose() },
  })

  const [warnReason, setWarnReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [showWarn, setShowWarn] = useState(false)
  const [showBan, setShowBan] = useState(false)

  const warnUser = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/warn`, { reason: warnReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setShowWarn(false); setWarnReason('') },
  })

  const banUser = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/ban`, { reason: banReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setShowBan(false); setBanReason('') },
  })

  const rs = ROLE_STYLE[user.role] ?? ROLE_STYLE.patient
  const initials = user.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col"
        style={{ background: 'var(--color-surface)' }}>
        {/* Header */}
        <div className="flex items-start justify-between p-5"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: '#1D4ED8' }}>
              {initials}
            </div>
            <div>
              <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{user.full_name}</p>
              <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold capitalize"
                style={{ backgroundColor: rs.bg, color: rs.color }}>
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1.5 transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Profile info */}
          <div className="space-y-2.5">
            {[
              { icon: Mail,  label: user.email },
              { icon: Phone, label: user.phone },
              { icon: User,  label: `County: ${user.county ?? '—'}` },
              { icon: Clock, label: `Last login: ${user.last_login ? formatDistanceToNow(parseISO(user.last_login), { addSuffix: true }) : 'never'}` },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}>
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sessions', val: user.session_count },
              { label: 'Appointments', val: user.total_appointments },
              { label: 'Orders', val: user.total_orders },
            ].map(({ label, val }) => (
              <div key={label} className="rounded p-3 text-center"
                style={{ backgroundColor: 'var(--color-surface-2)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{val}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Change role */}
          <div className="rounded p-4 space-y-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Change Role</p>
            <div className="flex gap-2">
              <select value={newRole} onChange={e => setNewRole(e.target.value as typeof user.role)}
                className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                style={inputStyle}>
                {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
              <button onClick={() => changeRole.mutate(newRole)} disabled={newRole === user.role || changeRole.isPending}
                className="rounded px-3 py-2 text-xs font-bold text-white disabled:opacity-40 transition-colors"
                style={{ backgroundColor: '#1D4ED8' }}>
                Apply
              </button>
            </div>
          </div>

          {/* Active sessions */}
          <div className="rounded p-4" style={{ backgroundColor: 'var(--color-surface-2)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-secondary)' }}>Active Sessions</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{user.session_count}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
              {user.session_count === 1 ? '1 active session' : `${user.session_count} active sessions`}
            </p>
          </div>

          {/* Impersonate */}
          {showImpersonate && (
            <div className="rounded p-4 space-y-3"
              style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="text-xs font-bold" style={{ color: '#92400E' }}>Impersonate — Reason required (logged)</p>
              <textarea value={impersonateReason} onChange={e => setImpersonateReason(e.target.value)}
                rows={2} placeholder="State your reason for impersonation…"
                className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-none"
                style={{ borderColor: '#FDE68A', backgroundColor: 'white' }} />
              <div className="flex gap-2">
                <button onClick={() => setShowImpersonate(false)}
                  className="flex-1 rounded border px-3 py-2 text-xs font-semibold transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  Cancel
                </button>
                <button disabled={!impersonateReason.trim()}
                  className="flex-1 rounded px-3 py-2 text-xs font-bold text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: '#D97706' }}
                  onClick={() => api.post(`/admin/users/${user.id}/impersonate`, { reason: impersonateReason }).then(() => window.open('/dashboard', '_blank'))}>
                  Impersonate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Warning count badge */}
        {user.warning_count > 0 && (
          <div className="mx-5 mb-0 flex items-center gap-2 rounded px-3 py-2 text-xs"
            style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {user.warning_count} warning{user.warning_count !== 1 ? 's' : ''} issued
          </div>
        )}

        {/* Warn & Ban forms */}
        {showWarn && (
          <div className="px-5 pb-4 space-y-2">
            <p className="text-xs font-bold" style={{ color: '#92400E' }}>Issue Warning</p>
            <textarea value={warnReason} onChange={e => setWarnReason(e.target.value)}
              rows={2} placeholder="Reason for warning…"
              className="w-full rounded border px-3 py-2 text-xs resize-none focus:outline-none"
              style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }} />
            <div className="flex gap-2">
              <button onClick={() => setShowWarn(false)} className="flex-1 rounded border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancel</button>
              <button onClick={() => warnUser.mutate()} disabled={!warnReason.trim() || warnUser.isPending}
                className="flex-1 rounded px-2 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: '#D97706' }}>
                Issue Warning
              </button>
            </div>
          </div>
        )}
        {showBan && (
          <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs font-bold pt-3" style={{ color: '#DC2626' }}>Permanent Ban</p>
            <textarea value={banReason} onChange={e => setBanReason(e.target.value)}
              rows={2} placeholder="Reason for permanent ban…"
              className="w-full rounded border px-3 py-2 text-xs resize-none focus:outline-none"
              style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2' }} />
            <div className="flex gap-2">
              <button onClick={() => setShowBan(false)} className="flex-1 rounded border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancel</button>
              <button onClick={() => banUser.mutate()} disabled={!banReason.trim() || banUser.isPending}
                className="flex-1 rounded px-2 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: '#DC2626' }}>
                Ban User
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="p-5 grid grid-cols-2 gap-2.5"
          style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => forceLogout.mutate()}
            className="flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <LogOutIcon className="h-3.5 w-3.5" /> Force Logout
          </button>
          <button onClick={() => toggleLock.mutate()}
            className="flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors"
            style={user.is_active ? { color: '#D97706', borderColor: '#FCD34D' } : { color: '#059669', borderColor: '#6EE7B7' }}>
            {user.is_active ? <><Lock className="h-3.5 w-3.5" /> Lock</> : <><Unlock className="h-3.5 w-3.5" /> Unlock</>}
          </button>
          <button onClick={() => resetPw.mutate()}
            className="flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <Key className="h-3.5 w-3.5" /> Reset Password
          </button>
          <button onClick={() => setShowImpersonate(true)}
            className="flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors"
            style={{ borderColor: '#FCD34D', color: '#92400E' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FFFBEB')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <Eye className="h-3.5 w-3.5" /> Impersonate
          </button>
          <button onClick={() => { setShowWarn(true); setShowBan(false) }}
            className="flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors"
            style={{ borderColor: '#FDE68A', color: '#D97706' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FFFBEB')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <AlertTriangle className="h-3.5 w-3.5" /> Warn User
          </button>
          <button onClick={() => { setShowBan(true); setShowWarn(false) }}
            className="flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors"
            style={{ borderColor: '#FECACA', color: '#DC2626' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <Ban className="h-3.5 w-3.5" /> Permanent Ban
          </button>
          <button onClick={() => deleteUser.mutate()} disabled={deleteUser.isPending}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50"
            style={{ borderColor: '#FECACA', color: '#DC2626' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <Trash2 className="h-3.5 w-3.5" /> Delete Account (GDPR)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [roleFilter, setRoleFilter] = useState('all')

  const { data, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users', search],
    queryFn: () =>
      api.get(`/admin/users${search ? `?q=${encodeURIComponent(search)}` : ''}`).then(r => r.data),
    staleTime: 20_000,
  })

  const users = (data ?? []).filter(u =>
    roleFilter === 'all' || u.role === roleFilter
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
          User Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Search, inspect and manage all platform users
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: 'var(--color-text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className={inputCls} style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          style={inputStyle}>
          <option value="all">All roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
              {['User', 'Role', 'Status', 'Joined', 'Last Login', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-tertiary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-12">
                  <div className="animate-pulse space-y-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && users.map(u => {
              const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE.patient
              return (
                <tr key={u.id} className="transition-colors cursor-pointer"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onClick={() => setSelected(u)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: '#1D4ED8' }}>
                        {u.full_name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{u.full_name}</p>
                        <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded px-2.5 py-1 text-[10px] font-bold capitalize"
                      style={{ backgroundColor: rs.bg, color: rs.color }}>
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {u.is_active
                      ? <span className="text-[10px] font-bold rounded bg-green-50 text-green-700 px-2.5 py-1">Active</span>
                      : <span className="text-[10px] font-bold rounded bg-red-50 text-red-600 px-2.5 py-1">Locked</span>}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {new Date(u.created_at).toLocaleDateString('en-KE')}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {u.last_login ? formatDistanceToNow(parseISO(u.last_login), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!isLoading && users.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <UserX className="h-8 w-8 mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>No users found</p>
          </div>
        )}
      </div>

      {selected && <UserPanel user={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
