'use client'

import { useState } from 'react'
import type { Order } from './api/orders'
import { sendOrderMessage } from './api/orders'
import { buildMessage, whatsappUrl } from './whatsappTemplates'
import { useAuthStore } from '@/stores/useAuthStore'

type MessagesSent = Order['messages_sent']

/**
 * Shared WhatsApp send logic for both the Order Detail action (VS-29.2) and the dashboard
 * card footer (VS-29.3) so the two surfaces can't drift. Opens the wa.me draft first, then
 * records the send (ADR-0010 §5 — "sent" = send-initiated). The optimistic flip is keyed by
 * status so a status change can't mislabel the new status as sent. On POST failure it reverts
 * and surfaces a recoverable error; the action stays clickable.
 *
 * `onSent` persists the server's fresh messages_sent wherever the caller keeps the order
 * (drawer local state, or the board React Query cache).
 */
export function useWhatsAppSend(order: Order, onSent: (messagesSent: MessagesSent) => void) {
  const businessName = useAuthStore((s) => s.user?.business_name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const [optimistic, setOptimistic] = useState<{ status: Order['status']; at: string } | null>(null)

  const hasPhone = Boolean((order.customer_phone || '').replace(/\D/g, ''))
  // No template for the current status (Partial Delivery, §10) ⇒ there is nothing to send,
  // so the surfaces (WhatsAppAction, CardWhatsAppFooter) render nothing for this order.
  const hasTemplate = buildMessage(order, businessName) !== null
  const optimisticSentAt = optimistic?.status === order.status ? optimistic.at : null
  const sentAt = optimisticSentAt ?? order.messages_sent?.[order.status] ?? null

  // Resolves true when the send was recorded, false on failure — lets callers (e.g. the
  // post-create modal) redirect only on success. Existing callers can ignore the return.
  async function send(): Promise<boolean> {
    const msg = buildMessage(order, businessName)
    // Guard: no template (e.g. Partial Delivery). Do NOT open WhatsApp or optimistically
    // mark sent — there is no message to record.
    if (!msg) return false
    const url = whatsappUrl(order, businessName)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    const prev = optimistic
    const status = order.status
    setOptimistic({ status, at: new Date().toISOString() })
    setPending(true)
    setError(false)
    try {
      const { templateKey } = msg
      const fresh = await sendOrderMessage(order.id, {
        order_status: status,
        template_key: templateKey,
        metadata: { phone: (order.customer_phone || '').replace(/\D/g, '') },
      })
      onSent(fresh.messages_sent)
      return true
    } catch {
      setOptimistic(prev) // revert — falls back to server state (unsent ⇒ Send returns)
      setError(true)
      return false
    } finally {
      setPending(false)
    }
  }

  return { hasPhone, hasTemplate, sentAt, pending, error, send }
}
