'use client'

import { useRouter } from 'next/navigation'
import type { Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.36 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 7.18 7.18l1.27-.82a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

// Persistent identity strip — top zone, shown across all tabs (VS-28 §0.3 hierarchy:
// identity first). Read-only: order number, customer (links to their profile), phone (tap to call).
export default function DrawerIdentity({ order }: { order: Order }) {
  const router = useRouter()
  const closeOrderDetail = useUIStore((s) => s.closeOrderDetail)

  return (
    <div className="px-5 pt-5 pb-3">
      <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-1">
        #{String(order.order_number).padStart(4, '0')}
      </p>
      <div className="flex items-baseline gap-2 pr-8">
        <button
          type="button"
          onClick={() => { closeOrderDetail(); router.push(`/customers/${order.customer}`) }}
          className="text-lg font-bold text-[#1A1A18] leading-tight hover:text-[#C8952A] transition-colors text-left truncate"
        >
          {order.customer_name}
        </button>
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone}`}
            className="inline-flex items-center gap-1 text-[12px] text-[#6B6B67] hover:text-[#C8952A] transition-colors shrink-0"
          >
            <PhoneIcon />
            {order.customer_phone}
          </a>
        )}
      </div>
    </div>
  )
}
