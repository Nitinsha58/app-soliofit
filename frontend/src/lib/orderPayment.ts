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

// Colour applied to the *paid* amount on a card (the "/ total" stays neutral):
// green = fully paid, orange = partial, red = nothing collected (pending) or
// overdue. Unbilled (no bill) stays neutral.
const PAID_COLOR: Record<PaymentState, string> = {
  completed: 'text-emerald-600',
  partial:   'text-amber-600',
  overdue:   'text-red-600',
  pending:   'text-red-600',
  unbilled:  'text-[#1A1A18]',
}

export function paidColorClass(state: PaymentState): string {
  return PAID_COLOR[state]
}

/** Compact ₹ for column headers: 12345 → ₹12.3K, 250000 → ₹2.5L, 0 → ₹0. */
export function compactInr(value: string | number): string {
  const n = Number(value) || 0
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1) + 'L'
  if (n >= 1_000) return '₹' + (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function inr(value: string | number): string {
  return Number(value).toLocaleString('en-IN')
}

/**
 * Last-changed stamp for a card: 12-hour clock time with AM/PM. Shows just the
 * time when the change was today (e.g. "3:45 PM"), otherwise prefixes a short
 * date ("12 Jun, 3:45 PM"). AM/PM forced uppercase via en-US.
 */
export function lastChanged(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (d.toDateString() === new Date().toDateString()) return time
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${date}, ${time}`
}
