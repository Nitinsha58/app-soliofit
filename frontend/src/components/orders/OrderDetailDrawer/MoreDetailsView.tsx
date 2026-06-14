'use client'

import type { Order } from '@/lib/api/orders'
import OrderInfoSection from './OrderInfoSection'
import ActivityFeed from './ActivityFeed'
import DangerZone from './DangerZone'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
  onBack: () => void
  onClose: () => void
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

// VS-28.1 interim More Details — pushed screen grouping secondary/admin content (order details +
// remarks, activity, danger zone). The bill is read-only here (payments live in the Money tab, so
// the embedded PaymentSchedule is suppressed). VS-28.4 refines the grouping + customer details.
export default function MoreDetailsView({ order, onOrderChange, onUpdated, onBack, onClose }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 pt-5 pb-3 border-b border-[#E5E5E2] shrink-0">
        <button
          onClick={onBack}
          className="text-[#6B6B67] hover:text-[#1A1A18] transition-colors p-1 -ml-1"
          aria-label="Back to overview"
        >
          <BackIcon />
        </button>
        <h2 className="text-sm font-semibold text-[#1A1A18]">More details</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <OrderInfoSection
          order={order}
          onOrderChange={onOrderChange}
          onUpdated={onUpdated}
          showPayments={false}
        />
        <ActivityFeed orderId={order.id} />
        <DangerZone order={order} onUpdated={onUpdated} onClose={onClose} />
      </div>
    </div>
  )
}
