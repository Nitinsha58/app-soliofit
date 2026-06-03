import { apiRequest } from './client'

export interface PaymentSummary {
  total_receivable: string
  received_today: string
  pending_count: number
  overdue_count: number
}

export type DateRange = 'today' | 'this_week' | 'this_month' | 'all_time'

export interface NextInstallment {
  id: string
  amount: string
  due_date: string
}

export interface PaymentOrder {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  delivery_date: string
  total_amount: string
  paid_total: string
  remaining: string
  overdue_count: number
  overdue_amount: string
  next_installment: NextInstallment | null
}

export interface PaymentOrders {
  pending: PaymentOrder[]
  partial: PaymentOrder[]
  overdue: PaymentOrder[]
  completed: PaymentOrder[]
}

export const fetchPaymentSummary = () =>
  apiRequest<PaymentSummary>('/api/payments/summary/')

export const fetchPaymentOrders = (range: DateRange) =>
  apiRequest<PaymentOrders>(`/api/payments/orders/?range=${range}`)
