import { apiRequest } from './client'

export interface Customer {
  id: string
  name: string
  phone: string
  address: string
  created_at: string
  total_orders?: number
  outstanding_balance?: number
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

export async function deleteCustomer(id: string): Promise<void> {
  await apiRequest<void>(`/api/customers/${id}/`, { method: 'DELETE' })
}
