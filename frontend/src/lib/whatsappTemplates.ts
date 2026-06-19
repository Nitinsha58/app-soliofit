import type { Order } from './api/orders'
import { inr } from './orderPayment'

// VS-29.7 — finalized WhatsApp message templates (vault §10, warm "ji"-tone English). This
// module is the seam future in-panel Template Management replaces; for now the copy lives here.
// Each status maps to a stable `template_key` (persisted in OrderMessageLog for audit + future
// template management) and a builder that fills placeholders from the order.
//
// Three product rules from §10 baked in here:
//  • {item} resolves to "order" until structured order-item capture exists (one-line swap).
//  • payment_context is an *insertable fragment*, never sent alone — it is spliced into
//    Booked / Ready / Delivered only, and omitted entirely for unbilled orders.
//  • Partial Delivery has NO template for now — buildMessage() returns null, and every send
//    surface hides its action for that status (revisit once the Partial Delivery model is fixed).

const COUNTRY_CODE = '91' // India (ADR-0010 §2). Single source of truth for the dial code.

const FALLBACK_SHOP = 'our boutique'

// Interim {item}. When structured order-item capture lands this becomes the real garment
// label (e.g. "lavender suit") with no template change (§10).
const ITEM = 'order'

// Pickup-window fallback used by the Ready template until VS-29.8 derives the real window
// from the boutique's working hours.
const PICKUP_FALLBACK = 'during our working hours'

interface BuildCtx {
  customer: string
  item: string
  shop: string
  deliveryDate: string
  pickupWindow: string
  payment: string // resolved payment_context line, or '' when omitted
}

interface StatusTemplate {
  templateKey: string
  build: (ctx: BuildCtx) => string
}

// Friendly delivery date for the Booked "Ready by" line, e.g. "25 Jun 2026".
// Falls back to the raw value if it isn't a parseable date.
function formatDeliveryDate(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Joins template lines, dropping any that resolve to empty (e.g. an omitted payment line)
// so the message never carries a blank line.
function lines(...parts: string[]): string {
  return parts.filter((p) => p && p.trim()).join('\n')
}

const STATUS_TEMPLATES: Partial<Record<Order['status'], StatusTemplate>> = {
  'Booked': {
    templateKey: 'status_booked',
    build: ({ customer, item, shop, deliveryDate, payment }) =>
      lines(
        `Hi ${customer} ji,`,
        `Your ${item} is booked with ${shop}.`,
        deliveryDate ? `Ready by: ${deliveryDate}` : '',
        payment,
        `We'll keep you posted as it comes along.`,
        `— ${shop}`,
      ),
  },
  'Started': {
    templateKey: 'status_started',
    build: ({ customer, item, shop }) =>
      lines(
        `Hi ${customer} ji,`,
        `Good news — your ${item} is now on the tailor's table at ${shop}.`,
        `We'll message you the moment it's ready for pickup.`,
        `— ${shop}`,
      ),
  },
  'Ready': {
    templateKey: 'status_ready',
    build: ({ customer, item, shop, pickupWindow, payment }) =>
      lines(
        `Hi ${customer} ji,`,
        `Your ${item} is ready! You can collect it at ${shop}, ${pickupWindow}.`,
        payment,
        `— ${shop}`,
      ),
  },
  'Delivered': {
    templateKey: 'status_delivered',
    build: ({ customer, item, shop, payment }) =>
      lines(
        `Hi ${customer} ji,`,
        `Thank you for choosing ${shop} — we hope your ${item} fits beautifully.`,
        `If it needs even a small adjustment, just message us; we're happy to help.`,
        payment,
        `— ${shop}`,
      ),
  },
  // 'Partial Delivery' — intentionally absent. No template for now (§10); buildMessage()
  // returns null so all send surfaces hide the WhatsApp action for that status.
}

/**
 * Status-aware payment_context fragment (vault §10 state table). Inserted only into
 * Booked / Ready / Delivered; returns '' (omitted) for unbilled orders, fully-settled
 * Delivered, and any status without a money line. `paid > 0` is the partial vs full-pending
 * discriminator. This is never a standalone message — it is spliced into a status template.
 */
function paymentContext(order: Order): string {
  const state = order.payment_state
  if (state === 'unbilled') return ''

  const total = inr(order.total_amount)
  const paid = inr(order.amount_paid)
  const remaining = inr(order.remaining)
  const paidNum = Number(order.amount_paid) || 0

  switch (order.status) {
    case 'Booked':
      return state === 'completed'
        ? `Total: ₹${total}, paid in full. Thank you!`
        : `Total: ₹${total} — ₹${paid} paid, ₹${remaining} balance.`
    case 'Ready':
      if (state === 'completed') return `Payment's all settled — nothing to carry but your outfit.`
      return paidNum > 0
        ? `₹${paid} received, ₹${remaining} to clear at pickup (UPI or cash).`
        : `Bill is ₹${total}, payable at pickup (UPI or cash).`
    case 'Delivered':
      // Omit when fully settled; otherwise a gentle open-balance line.
      return state === 'completed'
        ? ''
        : `A balance of ₹${remaining} is still open — pay whenever it's convenient.`
    default:
      return ''
  }
}

/**
 * Build the WhatsApp message for an order's CURRENT status, with the status-aware payment
 * line spliced in when applicable. Returns the message text + the template_key to record
 * server-side, or **null** when there is no template for the status (Partial Delivery) — in
 * which case the send surfaces hide their action entirely.
 *
 * `pickupWindow` (Ready only) falls back to "during our working hours" until VS-29.8 derives
 * the real window from the boutique's working hours.
 */
export function buildMessage(
  order: Order,
  shopName?: string | null,
  pickupWindow?: string | null,
): { text: string; templateKey: string } | null {
  const tpl = STATUS_TEMPLATES[order.status]
  if (!tpl) return null

  const shop = (shopName || '').trim() || FALLBACK_SHOP
  const text = tpl.build({
    customer: order.customer_name,
    item: ITEM,
    shop,
    deliveryDate: formatDeliveryDate(order.delivery_date),
    pickupWindow: (pickupWindow || '').trim() || PICKUP_FALLBACK,
    payment: paymentContext(order),
  })
  return { text, templateKey: tpl.templateKey }
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

/**
 * Full wa.me click-to-chat URL for an order's current-status message, or **null** when the
 * status has no template (Partial Delivery).
 */
export function whatsappUrl(
  order: Order,
  shopName?: string | null,
  pickupWindow?: string | null,
): string | null {
  const msg = buildMessage(order, shopName, pickupWindow)
  if (!msg) return null
  const phone = normalizePhone(order.customer_phone)
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg.text)}`
}
