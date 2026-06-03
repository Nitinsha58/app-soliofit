import { apiRequest } from './client'

export interface Customer {
  id: string
  name: string
  phone: string
  address: string
  created_at: string
  total_orders?: number
  outstanding_balance?: string
}

export interface CustomerDetail {
  id: string
  name: string
  phone: string
  address: string
  created_at: string
  total_orders: number
  total_spent: string
  outstanding_balance: string
}

export interface CustomerInstallment {
  id: string
  amount: string
  due_date: string
  paid_date: string | null
  status: 'Pending' | 'Paid' | 'Delayed'
  remarks: string
  days_overdue: number
}

export interface CustomerPaymentGroup {
  order_id: string
  order_number: number
  delivery_date: string
  total_amount: string
  installments: CustomerInstallment[]
}

export interface CustomerPhoto {
  id: string
  public_url: string
  photo_type: 'garment' | 'notes'
  order_id: string
  order_number: number
}

export interface CustomerVoiceNote {
  id: string
  public_url: string
  duration_seconds: number
  created_at: string
  order_id: string
  order_number: number
}

export interface CustomerMedia {
  photos: CustomerPhoto[]
  voice_notes: CustomerVoiceNote[]
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CustomersResult {
  customers: Customer[]
  total: number
}

export async function listCustomers(search?: string): Promise<CustomersResult> {
  const params = search ? `?search=${encodeURIComponent(search)}` : ''
  const data = await apiRequest<PaginatedResponse<Customer>>(`/api/customers/${params}`)
  return { customers: data.results, total: data.count }
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  return apiRequest<CustomerDetail>(`/api/customers/${id}/`)
}

export async function createCustomer(data: {
  name: string
  phone: string
  address: string
}): Promise<Customer> {
  return apiRequest<Customer>('/api/customers/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCustomer(
  id: string,
  data: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>,
): Promise<Customer> {
  return apiRequest<Customer>(`/api/customers/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiRequest<void>(`/api/customers/${id}/`, { method: 'DELETE' })
}

export async function getCustomerPayments(id: string): Promise<CustomerPaymentGroup[]> {
  return apiRequest<CustomerPaymentGroup[]>(`/api/customers/${id}/payments/`)
}

export async function getCustomerMedia(id: string): Promise<CustomerMedia> {
  return apiRequest<CustomerMedia>(`/api/customers/${id}/media/`)
}
