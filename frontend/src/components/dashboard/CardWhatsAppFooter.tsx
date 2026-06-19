'use client'

import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { Order, OrderBoardPage } from '@/lib/api/orders'
import { lastChanged } from '@/lib/orderPayment'
import { useWhatsAppSend } from '@/lib/useWhatsAppSend'

interface Props {
  order: Order
}

function WhatsAppIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.46 9.46 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.45 9.45 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.42 9.42 0 0 1 2.77 6.7c0 5.22-4.25 9.47-9.47 9.47zm8.06-17.53A11.36 11.36 0 0 0 12.05.62C5.8.62.72 5.7.72 11.95c0 2 .52 3.95 1.52 5.67L.62 23.38l5.9-1.55a11.33 11.33 0 0 0 5.42 1.38h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Patch the board React Query cache in place: replace ONLY the matching order's messages_sent
// across the status column's recent + older caches, preserving next_cursor / counts / value and
// every other order untouched (VS-29.3 cache-patch guardrail).
function patchBoardCache(
  queryClient: ReturnType<typeof useQueryClient>,
  order: Order,
  messagesSent: Order['messages_sent'],
) {
  const keys = [['orders-board', order.status], ['orders-board', order.status, 'older']]
  for (const key of keys) {
    queryClient.setQueryData<InfiniteData<OrderBoardPage>>(key, (old) => {
      if (!old) return old
      let changed = false
      const pages = old.pages.map((page) => {
        const idx = page.results.findIndex((o) => o.id === order.id)
        if (idx === -1) return page
        changed = true
        const results = page.results.slice()
        results[idx] = { ...results[idx], messages_sent: messagesSent }
        return { ...page, results } // next_cursor / counts / value preserved exactly
      })
      return changed ? { ...old, pages } : old
    })
  }
}

// VS-29.3 — compact WhatsApp send-status strip on each dashboard order card. Merged to the
// card's bottom edge with a WhatsApp-green hint. On desktop (lg) it's hidden until the card is
// hovered and then shown as an absolute overlay (no layout shift — sibling cards don't move);
// on touch it stays in-flow and always visible. Hidden entirely when the customer has no phone.
// Stops pointer/click propagation so taps never start a drag or open the drawer.
export default function CardWhatsAppFooter({ order }: Props) {
  const queryClient = useQueryClient()
  const { hasPhone, sentAt, pending, error, send } = useWhatsAppSend(
    order,
    (messages_sent) => patchBoardCache(queryClient, order, messages_sent),
  )

  if (!hasPhone) return null

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      className="
        -mx-3.5 -mb-3 mt-3 px-3.5 py-1.5 rounded-b-lg border-t border-emerald-200 bg-emerald-50/70
        lg:absolute lg:inset-x-0 lg:top-full lg:m-0 lg:rounded-b-lg lg:rounded-t-none
        lg:border lg:border-emerald-200 lg:bg-emerald-50 lg:shadow-[0_5px_14px_rgba(0,0,0,0.12)]
        lg:hidden lg:group-hover:block
      "
    >
      {sentAt ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 min-w-0">
            <CheckIcon />
            <span className="truncate">Sent · {lastChanged(sentAt)}</span>
          </span>
          <button
            type="button"
            onClick={send}
            disabled={pending}
            className="shrink-0 text-[10.5px] font-semibold text-[#6B6B67] hover:text-[#1A1A18] transition-colors disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Resend'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className={`flex items-center gap-1.5 w-full text-[11px] font-semibold transition-colors disabled:opacity-60 ${
            error ? 'text-red-600' : 'text-emerald-700 hover:text-emerald-800'
          }`}
        >
          <WhatsAppIcon />
          {error ? 'Couldn’t send — retry' : pending ? 'Sending…' : `Send ${order.status}`}
        </button>
      )}
    </div>
  )
}
