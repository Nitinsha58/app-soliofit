import { apiRequest } from './client'
import type { AuthUser } from '@/stores/useAuthStore'

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiRequest<{ user: AuthUser }>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return data.user
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout/', { method: 'POST' })
}

export async function getMe(): Promise<AuthUser> {
  return apiRequest<AuthUser>('/api/auth/me/')
}
