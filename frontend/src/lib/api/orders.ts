import { apiRequest } from './client'

export interface Order {
  id: string
  order_number: number
  customer: string
  customer_name: string
  customer_phone: string
  status: 'Booked' | 'Started' | 'Ready' | 'Partial Delivery' | 'Delivered'
  delivery_date: string
  total_amount: string
  priority: boolean
  remarks: string
  created_at: string
  updated_at: string
}

export async function listOrders(): Promise<Order[]> {
  return apiRequest<Order[]>('/api/orders/')
}

export async function createOrder(data: {
  customer: string
  delivery_date: string
  total_amount: number
  priority: boolean
  remarks: string
}): Promise<Order> {
  return apiRequest<Order>('/api/orders/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getDeliveryLoad(from: string, to: string): Promise<Record<string, number>> {
  return apiRequest<Record<string, number>>(
    `/api/orders/delivery-load/?from=${from}&to=${to}`
  )
}
