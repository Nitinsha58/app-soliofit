import type { Order } from './api/orders'

export type PaymentState = Order['payment_state']

interface PaymentMeta {
  label: string
  pillClass: string
}

// Labels + pill colours mirror the VS-11 payments dashboard taxonomy
// (completed / overdue / partial / pending). `unbilled` has no pill.
const META: Record<Exclude<PaymentState, 'unbilled'>, PaymentMeta> = {
  completed: { label: 'Paid',    pillClass: 'bg-emerald-50 text-emerald-700' },
  overdue:   { label: 'Overdue', pillClass: 'bg-red-50 text-red-600' },
  partial:   { label: 'Partial', pillClass: 'bg-amber-50 text-amber-700' },
  pending:   { label: 'Unpaid',  pillClass: 'bg-[#F0F0EE] text-[#6B6B67]' },
}

/** UI metadata for an order's payment state, or null when there is no bill. */
export function paymentMeta(state: PaymentState): PaymentMeta | null {
  return state === 'unbilled' ? null : META[state]
}

export function inr(value: string | number): string {
  return Number(value).toLocaleString('en-IN')
}
