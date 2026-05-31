import { apiRequest } from './client'

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

export async function listInstallments(orderId: string): Promise<Installment[]> {
  return apiRequest(`/api/orders/${orderId}/installments/`)
}

export async function createInstallment(
  orderId: string,
  data: { amount: string; due_date: string; remarks?: string },
): Promise<Installment> {
  return apiRequest(`/api/orders/${orderId}/installments/`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateInstallment(
  orderId: string,
  installmentId: string,
  data: { amount?: string; due_date?: string; remarks?: string },
): Promise<Installment> {
  return apiRequest(`/api/orders/${orderId}/installments/${installmentId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteInstallment(orderId: string, installmentId: string): Promise<void> {
  return apiRequest(`/api/orders/${orderId}/installments/${installmentId}/`, { method: 'DELETE' })
}

export async function markInstallmentPaid(orderId: string, installmentId: string): Promise<Installment> {
  return apiRequest(`/api/orders/${orderId}/installments/${installmentId}/mark-paid/`, { method: 'POST' })
}
