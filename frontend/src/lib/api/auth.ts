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

export interface ProfileUpdate {
  business_name?: string
  owner_name?: string
  phone?: string
}

export async function updateProfile(data: ProfileUpdate): Promise<AuthUser> {
  return apiRequest<AuthUser>('/api/auth/me/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiRequest('/api/auth/change-password/', {
    method: 'POST',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  })
}

// Pre-login reset. The request endpoint always succeeds (no account enumeration);
// confirm throws ApiError(400) on an invalid/expired link or a rejected password.
export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest('/api/auth/password-reset/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string,
): Promise<void> {
  await apiRequest('/api/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({ uid, token, new_password: newPassword }),
  })
}

export interface OrderSettings {
  delivery_buffer_days: number
  daily_capacity: number
  // Boutique working hours (VS-29.6/29.8). "HH:MM:SS" or null when unset. Feed the
  // WhatsApp Ready pickup window. The pair is validated server-side (open < close).
  opening_time: string | null
  closing_time: string | null
}

export async function getOrderSettings(): Promise<OrderSettings> {
  return apiRequest<OrderSettings>('/api/auth/order-settings/')
}

export async function updateOrderSettings(data: Partial<OrderSettings>): Promise<OrderSettings> {
  return apiRequest<OrderSettings>('/api/auth/order-settings/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export interface NotificationPreferences {
  delivery_reminders: boolean
  payment_reminders: boolean
  daily_summary: boolean
  new_order_confirmations: boolean
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiRequest<NotificationPreferences>('/api/auth/notification-preferences/')
}

export async function updateNotificationPreferences(
  data: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return apiRequest<NotificationPreferences>('/api/auth/notification-preferences/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
