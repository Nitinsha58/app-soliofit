import { apiRequest } from './client'

export interface SearchCustomer {
  id: string
  name: string
  phone: string
  order_count: number
}

export interface SearchOrder {
  id: string
  order_number: number
  customer_name: string
  status: string
  delivery_date: string | null
}

export interface SearchResults {
  customers: SearchCustomer[]
  orders: SearchOrder[]
}

export async function fetchSearch(q: string): Promise<SearchResults> {
  return apiRequest<SearchResults>(`/api/search/?q=${encodeURIComponent(q)}`)
}
