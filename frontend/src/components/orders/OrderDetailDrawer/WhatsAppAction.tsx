'use client'

import type { Order } from '@/lib/api/orders'
import { lastChanged } from '@/lib/orderPayment'
import { useWhatsAppSend } from '@/lib/useWhatsAppSend'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.46 9.46 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.45 9.45 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.42 9.42 0 0 1 2.77 6.7c0 5.22-4.25 9.47-9.47 9.47zm8.06-17.53A11.36 11.36 0 0 0 12.05.62C5.8.62.72 5.7.72 11.95c0 2 .52 3.95 1.52 5.67L.62 23.38l5.9-1.55a11.33 11.33 0 0 0 5.42 1.38h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// VS-29.2 — WhatsApp "Send <status>" action, rendered just below the stage-aware PrimaryAction
// on the Overview. Secondary outline weight (§0.7 — never out-weighs the gold/emerald primary).
// "Sent" = send-initiated (optimistic, ADR-0010 §5); Resend is always available.
export default function WhatsAppAction({ order, onOrderChange }: Props) {
  // Persist the server's fresh messages_sent into the drawer's local order copy.
  const { hasPhone, sentAt, pending, error, send } = useWhatsAppSend(
    order,
    (messages_sent) => onOrderChange({ messages_sent }),
  )

  // No phone → disabled. Nothing to send to.
  if (!hasPhone) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#E5E5E2] bg-[#FAFAF8] text-sm font-medium text-[#C8C8C4] cursor-not-allowed"
      >
        <WhatsAppIcon /> No phone number
      </button>
    )
  }

  if (sentAt) {
    return (
      <div className="flex items-center justify-between gap-2 w-full py-2.5 px-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
        <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 min-w-0">
          <CheckIcon />
          <span className="truncate">{order.status} sent · {lastChanged(sentAt)}</span>
        </span>
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="shrink-0 text-xs font-semibold text-[#6B6B67] hover:text-[#1A1A18] transition-colors disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Resend'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-emerald-300 bg-white text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60"
      >
        <WhatsAppIcon />
        {pending ? 'Sending…' : `Send ${order.status}`}
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-red-600">
          Couldn&rsquo;t record the send — tap to try again.
        </p>
      )}
    </div>
  )
}
