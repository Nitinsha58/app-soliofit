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

// Per-status accent colour, shared by the board columns and the "From <status>"
// move-provenance tag so a card's origin reads in its source column's colour.
export const STATUS_ACCENT: Record<Order['status'], string> = {
  Booked: '#60A5FA',
  Started: '#A78BFA',
  Ready: '#34D399',
  'Partial Delivery': '#FBBF24',
  Delivered: '#9CA3AF',
}

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

// VS-20 board action (ADR-0006): one status column, keyset-paged. `counts` is the
// full per-status totals map (same in every column's response), independent of the
// loaded page. Active columns sort by (delivery_date, created_at, id) asc; Delivered
// by (delivered_at, id) desc with a recent-window default and an `older` continuation.
export interface OrderBoardPage {
  results: Order[]
  next_cursor: string | null
  counts: Record<Order['status'], number>
  // Summed bill (total_amount) per status column — the column's total order value.
  value: Record<Order['status'], string>
}

export async function listOrderColumn(params: {
  status: Order['status']
  cursor?: string | null
  limit?: number
  older?: boolean
}): Promise<OrderBoardPage> {
  const qs = new URLSearchParams({ status: params.status })
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.older) qs.set('older', 'true')
  return apiRequest<OrderBoardPage>(`/api/orders/board/?${qs.toString()}`)
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

// `status` is intentionally excluded — it is a domain event changed only via
// updateOrderStatus() (the /status/ action). The generic PATCH rejects it.
export async function updateOrder(
  id: string,
  data: Partial<Pick<Order, 'delivery_date' | 'total_amount' | 'priority' | 'remarks'>>,
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

// Soft-deletes the order (cascades to its installments/media + S3 cleanup, server-side).
export async function deleteOrder(id: string): Promise<void> {
  await apiRequest<void>(`/api/orders/${id}/`, { method: 'DELETE' })
}

export async function getDeliveryLoad(from: string, to: string): Promise<Record<string, number>> {
  return apiRequest<Record<string, number>>(
    `/api/orders/delivery-load/?from=${from}&to=${to}`
  )
}
