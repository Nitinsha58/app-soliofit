import { apiRequest } from './client'

export interface Order {
  id: string
  order_number: number
  customer: string
  customer_name: string
  customer_phone: string
  customer_address: string
  status: 'Booked' | 'Started' | 'Ready' | 'Partial Delivery' | 'Delivered'
  delivery_date: string
  total_amount: string
  priority: boolean
  remarks: string
  created_at: string
  updated_at: string
}

export const ORDER_STATUSES: Order['status'][] = [
  'Booked', 'Started', 'Ready', 'Partial Delivery', 'Delivered',
]

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

export async function getOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${id}/`)
}

export async function updateOrder(
  id: string,
  data: Partial<Pick<Order, 'delivery_date' | 'total_amount' | 'priority' | 'remarks' | 'status'>>
): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function updateOrderStatus(
  id: string,
  status: Order['status']
): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${id}/status/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getDeliveryLoad(from: string, to: string): Promise<Record<string, number>> {
  return apiRequest<Record<string, number>>(
    `/api/orders/delivery-load/?from=${from}&to=${to}`
  )
}
