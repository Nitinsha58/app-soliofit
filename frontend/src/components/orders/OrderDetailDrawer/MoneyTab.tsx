'use client'

import type { Order } from '@/lib/api/orders'
import PaymentSchedule from './PaymentSchedule'

// VS-28.3 — Money tab. One "Payment Plan" card (parallels WorkTab's Work Instructions). The card
// only frames the VS-27.5 PaymentSchedule editor — the strict billing invariant, edit-mode math,
// mark-paid, paid-row locking, and the atomic PUT /billing/ save all live in PaymentSchedule and
// are untouched here. 28.3 is a presentation pass, not a billing change.
export default function MoneyTab({
  order,
  onOrderChange,
  onUpdated,
}: {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
}) {
  return (
    <div className="px-4 lg:px-5 py-4">
      <div className="rounded-xl border border-[#E5E5E2] bg-white p-3 lg:p-4">
        <h3 className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3">
          Payment Plan
        </h3>
        <PaymentSchedule order={order} onOrderChange={onOrderChange} onUpdated={onUpdated} />
      </div>
    </div>
  )
}
