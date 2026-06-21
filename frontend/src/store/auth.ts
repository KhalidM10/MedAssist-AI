import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { api } from '../lib/api'

interface AuthState {
  user: User | null
  permissions: string[]
  isAuthenticated: boolean
  login: (email: string, password: string, totp_code?: string, backup_code?: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  refreshPermissions: () => Promise<void>
  logout: () => void
  clearSession: () => void
}

interface RegisterData {
  email: string
  phone: string
  password: string
  full_name: string
  county?: string
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: [],
      isAuthenticated: false,

      login: async (email, password, totp_code?, backup_code?) => {
        const { data } = await api.post('/auth/login', {
          email,
          password,
          ...(totp_code ? { totp_code } : {}),
          ...(backup_code ? { backup_code } : {}),
        })
        set({
          user: data.user,
          permissions: data.permissions ?? [],
          isAuthenticated: true,
        })
      },

      register: async (registerData) => {
        const { data } = await api.post('/auth/register', registerData)
        set({
          user: data.user,
          permissions: data.permissions ?? [],
          isAuthenticated: true,
        })
      },

      refreshPermissions: async () => {
        try {
          const { data } = await api.get('/auth/me')
          set({ user: data.user, permissions: data.permissions ?? [] })
        } catch {
          // Silently ignore — stale permissions are fine until next login
        }
      },

      logout: () => {
        api.post('/auth/logout').catch(() => {})
        set({ user: null, permissions: [], isAuthenticated: false })
      },

      clearSession: () => {
        set({ user: null, permissions: [], isAuthenticated: false })
      },
    }),
    {
      name: 'medassist-auth',
      partialize: (state) => ({
        user: state.user,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
