import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  business_name: string
  owner_name: string
  phone: string
  created_at: string
  // Boutique working hours surfaced read-only on /me (VS-29.6). "HH:MM:SS" or null.
  // useWhatsAppSend derives the Ready pickup window from these.
  opening_time?: string | null
  closing_time?: string | null
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))
