import { apiRequest } from './client'

export interface DashboardSummary {
  orders_due_today: number
  upcoming_orders: number
  delayed_orders: number
  pending_payments_total: string
  overdue_installments: number
}

export interface NotificationCounts {
  delivery_due_today: number
  delayed_delivery: number
  installment_due_today: number
  overdue_installment: number
  total: number
}

export interface OrderAlert {
  id: string
  order_number: number
  customer_name: string
  delivery_date: string
  status: string
}

export interface InstallmentAlert {
  id: string
  amount: string
  due_date: string
  order_id: string
  order_number: number
  customer_name: string
}

export interface Notifications {
  delivery_due_today: OrderAlert[]
  delayed_delivery: OrderAlert[]
  installment_due_today: InstallmentAlert[]
  overdue_installment: InstallmentAlert[]
}

export const fetchDashboardSummary = () =>
  apiRequest<DashboardSummary>('/api/dashboard/summary/')

export const fetchNotificationCounts = () =>
  apiRequest<NotificationCounts>('/api/notifications/count/')

export const fetchNotifications = () =>
  apiRequest<Notifications>('/api/notifications/')
