import type { Order } from './api/orders'
import { inr } from './orderPayment'

// VS-29.2 — predefined, swappable WhatsApp message templates (ADR-0010 §3). This module is
// the seam future in-panel template management replaces; for now the copy lives here.
// Each status maps to a `template_key` (persisted in OrderMessageLog for audit + future
// template management) and a builder that fills placeholders from the order.

const COUNTRY_CODE = '91' // India (ADR-0010 §2). Single source of truth for the dial code.

const FALLBACK_SHOP = 'our boutique'

interface StatusTemplate {
  templateKey: string
  build: (ctx: { customer: string; order: string; shop: string }) => string
}

const STATUS_TEMPLATES: Record<Order['status'], StatusTemplate> = {
  'Booked': {
    templateKey: 'status_booked',
    build: ({ customer, order, shop }) =>
      `Hi ${customer}, we've received your order ${order} at ${shop}. We'll keep you posted. Thank you!`,
  },
  'Started': {
    templateKey: 'status_started',
    build: ({ customer, order, shop }) =>
      `Hi ${customer}, work has started on your order ${order} at ${shop}. We'll let you know when it's ready.`,
  },
  'Ready': {
    templateKey: 'status_ready',
    build: ({ customer, order, shop }) =>
      `Hi ${customer}, good news — your order ${order} is ready for pickup at ${shop}.`,
  },
  'Partial Delivery': {
    templateKey: 'status_partial_delivery',
    build: ({ customer, order, shop }) =>
      `Hi ${customer}, part of your order ${order} has been delivered; the rest is still in progress at ${shop}.`,
  },
  'Delivered': {
    templateKey: 'status_delivered',
    build: ({ customer, order, shop }) =>
      `Hi ${customer}, your order ${order} has been delivered. Thank you for choosing ${shop}!`,
  },
}

// Payment line appended when money is outstanding. `completed` / `unbilled` get nothing.
// "Partial" = something already paid; "full pending" = nothing paid yet. `overdue` follows the
// same paid/unpaid split (ADR-0010 §3) — the wording stays gentle (this is a manual nudge,
// not a dunning system).
function paymentLine(order: Order): string {
  const state = order.payment_state
  if (state === 'completed' || state === 'unbilled') return ''
  const paid = Number(order.amount_paid) || 0
  const total = inr(order.total_amount)
  if (paid > 0) {
    return ` You've paid ₹${inr(order.amount_paid)} of ₹${total}; ₹${inr(order.remaining)} is still pending.`
  }
  return ` Your bill of ₹${total} is pending — kindly arrange payment at your convenience.`
}

/**
 * Build the WhatsApp message for an order's CURRENT status, with a payment line appended
 * when outstanding. Returns the message text + the template_key to record server-side.
 */
export function buildMessage(order: Order, shopName?: string | null): { text: string; templateKey: string } {
  const tpl = STATUS_TEMPLATES[order.status]
  const shop = (shopName || '').trim() || FALLBACK_SHOP
  const orderNum = `#${String(order.order_number).padStart(4, '0')}`
  const base = tpl.build({ customer: order.customer_name, order: orderNum, shop })
  return { text: base + paymentLine(order), templateKey: tpl.templateKey }
}

/**
 * Normalize a stored phone (local, no country code) to a wa.me-valid international form.
 * Strips non-digits; an existing 12-digit `91…` is kept as-is; a 10-digit number is prefixed
 * with the country code. Anything else is returned digits-only as a best-effort fallback.
 * (ADR-0010 §2.)
 */
export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) return digits
  if (digits.length === 10) return COUNTRY_CODE + digits
  return digits
}

/** Full wa.me click-to-chat URL for an order's current-status message. */
export function whatsappUrl(order: Order, shopName?: string | null): string {
  const { text } = buildMessage(order, shopName)
  const phone = normalizePhone(order.customer_phone)
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}
