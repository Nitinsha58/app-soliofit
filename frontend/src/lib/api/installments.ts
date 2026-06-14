import { apiRequest } from './client'
import type { Order } from './orders'

export interface Installment {
  id: string
  amount: string
  due_date: string
  paid_date: string | null
  remarks: string
  status: 'Pending' | 'Paid' | 'Delayed'
  days_overdue: number
  created_at: string
}

export interface ScheduleInstallmentInput {
  amount: string
  due_date: string
  remarks?: string
}

export async function listInstallments(orderId: string): Promise<Installment[]> {
  return apiRequest(`/api/orders/${orderId}/installments/`)
}

// VS-27.5 — atomic bill + unpaid-schedule replace (ADR-0009). Replaces the deprecated
// single-row create/update/delete endpoints: the whole unpaid plan and the bill are sent
// together and committed in one transaction; paid rows are preserved server-side. Server
// enforces total >= Σ(paid) and Σ(paid) + Σ(installments) == total. Returns the updated order.
export async function replaceSchedule(
  orderId: string,
  data: { total_amount: string; installments: ScheduleInstallmentInput[] },
): Promise<Order> {
  return apiRequest(`/api/orders/${orderId}/billing/`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function markInstallmentPaid(orderId: string, installmentId: string): Promise<Installment> {
  return apiRequest(`/api/orders/${orderId}/installments/${installmentId}/mark-paid/`, { method: 'POST' })
}

// VS-29 — revert a paid installment back to unpaid (clears paid_date server-side).
export async function markInstallmentUnpaid(orderId: string, installmentId: string): Promise<Installment> {
  return apiRequest(`/api/orders/${orderId}/installments/${installmentId}/mark-unpaid/`, { method: 'POST' })
}
