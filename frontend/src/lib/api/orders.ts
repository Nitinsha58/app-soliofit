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
  has_delayed_installment: boolean
  amount_paid: string
  remaining: string
  payment_state: 'completed' | 'overdue' | 'partial' | 'pending' | 'unbilled'
}

export const ORDER_STATUSES: Order['status'][] = [
  'Booked', 'Started', 'Ready', 'Partial Delivery', 'Delivered',
]

export async function listOrders(params?: {
  customerId?: string
  deliveryDateFrom?: string
  deliveryDateTo?: string
}): Promise<Order[]> {
  const qs = new URLSearchParams()
  if (params?.customerId) qs.set('customer', params.customerId)
  if (params?.deliveryDateFrom) qs.set('delivery_date_from', params.deliveryDateFrom)
  if (params?.deliveryDateTo) qs.set('delivery_date_to', params.deliveryDateTo)
  const queryString = qs.toString() ? `?${qs.toString()}` : ''
  return apiRequest<Order[]>(`/api/orders/${queryString}`)
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
  data: Partial<Pick<Order, 'delivery_date' | 'total_amount' | 'priority' | 'remarks' | 'status'>>,
  signal?: AbortSignal
): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    signal,
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
