'use client'

import type { Order } from '@/lib/api/orders'
import StatusPriorityPills from './StatusPriorityPills'
import AttentionSummaryCard from './AttentionSummaryCard'
import PrimaryAction from './PrimaryAction'
import OverviewWorkCard from './OverviewWorkCard'
import OverviewPaymentCard from './OverviewPaymentCard'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
  onViewPlan: () => void
  onViewWork: () => void
  onMoreDetails: () => void
}

function NoteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// Overview = the command screen (VS-28). §0.3 hierarchy: status → urgency → primary action →
// money snapshot → note → secondary (More Details). Read-only; deeper edits live in their tabs.
export default function OverviewTab({ order, onOrderChange, onUpdated, onViewPlan, onViewWork, onMoreDetails }: Props) {
  return (
    <div className="px-5 py-4 space-y-4">
      <StatusPriorityPills order={order} onOrderChange={onOrderChange} onUpdated={onUpdated} />

      <AttentionSummaryCard order={order} />

      <PrimaryAction order={order} onOrderChange={onOrderChange} onUpdated={onUpdated} />

      {/* Main work content sits above the business summary (§0.3 hierarchy) */}
      <OverviewWorkCard orderId={order.id} onViewWork={onViewWork} />

      <OverviewPaymentCard order={order} onViewPlan={onViewPlan} />

      {/* Order note preview — read-only summary; full edit lives in More Details */}
      <button
        type="button"
        onClick={onMoreDetails}
        className="w-full flex items-start gap-2.5 rounded-xl border border-[#E5E5E2] bg-white p-3.5 text-left hover:bg-[#FAFAF8] transition-colors"
      >
        <span className="text-[#A0A09C] mt-0.5 shrink-0"><NoteIcon /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide mb-0.5">Order note</p>
          <p className={`text-xs leading-relaxed line-clamp-2 ${order.remarks ? 'text-[#6B6B67]' : 'text-[#C8C8C4]'}`}>
            {order.remarks || 'No note added'}
          </p>
        </div>
      </button>

      {/* Secondary details — pushed screen (progressive disclosure, §0.4) */}
      <button
        type="button"
        onClick={onMoreDetails}
        className="w-full flex items-center justify-between rounded-xl border border-[#E5E5E2] bg-white px-3.5 py-3 text-left hover:bg-[#FAFAF8] transition-colors"
      >
        <span className="text-sm font-medium text-[#1A1A18]">More details</span>
        <span className="text-[#A0A09C]"><ChevronIcon /></span>
      </button>
    </div>
  )
}
