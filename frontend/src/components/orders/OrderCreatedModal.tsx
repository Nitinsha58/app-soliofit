'use client'

import { useEffect } from 'react'
import type { Order } from '@/lib/api/orders'
import { useWhatsAppSend } from '@/lib/useWhatsAppSend'

interface Props {
  order: Order
  /** Open the new order's detail drawer (every exit lands here). */
  onGoToOrder: () => void
}

function CheckCircleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.46 9.46 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.45 9.45 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.42 9.42 0 0 1 2.77 6.7c0 5.22-4.25 9.47-9.47 9.47zm8.06-17.53A11.36 11.36 0 0 0 12.05.62C5.8.62.72 5.7.72 11.95c0 2 .52 3.95 1.52 5.67L.62 23.38l5.9-1.55a11.33 11.33 0 0 0 5.42 1.38h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// VS-29.4 — shown right after an order is created. One dominant quick action: send the customer
// the Booked WhatsApp confirmation. Every exit (send → success, "Go to order", X, backdrop) opens
// the new order's detail drawer. On a send failure the modal stays open with a recoverable error
// and "Go to order" still works, so the user is never stuck.
export default function OrderCreatedModal({ order, onGoToOrder }: Props) {
  const { hasPhone, pending, error, send } = useWhatsAppSend(order, () => {})

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onGoToOrder()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onGoToOrder])

  async function handleSend() {
    const ok = await send()
    if (ok) onGoToOrder() // auto-redirect once recorded; on failure stay open (error shown)
  }

  const orderNum = `#${String(order.order_number).padStart(4, '0')}`

  return (
    <div
      onClick={onGoToOrder}
      className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center lg:p-4 bg-black/40"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl lg:rounded-2xl shadow-xl w-full lg:max-w-sm flex flex-col"
      >
        {/* Close — also lands on the order (consistent post-create flow) */}
        <div className="flex justify-end px-3 pt-3">
          <button
            onClick={onGoToOrder}
            aria-label="Go to order"
            className="text-[#A0A09C] hover:text-[#1A1A18] transition-colors p-1"
          >
            <XIcon />
          </button>
        </div>

        <div className="px-6 pb-6 -mt-1 flex flex-col items-center text-center">
          <span className="text-emerald-500"><CheckCircleIcon /></span>
          <h2 className="mt-3 text-base font-semibold text-[#1A1A18]">Order {orderNum} created</h2>
          <p className="mt-1 text-sm text-[#6B6B67]">
            {hasPhone
              ? <>Let {order.customer_name} know their order is booked.</>
              : <>{order.customer_name}&rsquo;s order is booked.</>}
          </p>

          <div className="mt-5 w-full space-y-2">
            {hasPhone && (
              <>
                <button
                  onClick={handleSend}
                  disabled={pending}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  <WhatsAppIcon />
                  {pending ? 'Sending…' : 'Send booked message'}
                </button>
                {error && (
                  <p className="text-xs text-red-600">
                    Couldn&rsquo;t record the send — tap to try again, or go to the order.
                  </p>
                )}
              </>
            )}
            <button
              onClick={onGoToOrder}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#6B6B67] hover:text-[#1A1A18] hover:bg-[#FAFAF8] border border-[#E5E5E2] transition-colors"
            >
              Go to order
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
