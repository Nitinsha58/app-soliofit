'use client'

import type { Order } from '@/lib/api/orders'

function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// Read-only payment snapshot for Overview (VS-28 decision 5: never the editor inline). All
// figures are the order's derived money fields; the full plan editor lives in the Money tab.
export default function OverviewPaymentCard({
  order,
  onViewPlan,
}: {
  order: Order
  onViewPlan: () => void
}) {
  const bill = parseFloat(order.total_amount) || 0
  const paid = parseFloat(order.amount_paid) || 0
  const outstanding = parseFloat(order.remaining) || 0
  const progress = bill > 0 ? Math.min(100, (paid / bill) * 100) : 0
  const settled = bill > 0 && outstanding <= 0.005

  return (
    <div className="rounded-xl border border-[#E5E5E2] bg-white p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest">Payment snapshot</p>
        <button
          type="button"
          onClick={onViewPlan}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#A87820] hover:text-[#C8952A] transition-colors"
        >
          View plan <ChevronIcon />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Bill</p>
          <p className="text-sm font-semibold text-[#1A1A18] tabular-nums">{fmt(bill)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Paid</p>
          <p className="text-sm font-semibold text-green-700 tabular-nums">{fmt(paid)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Outstanding</p>
          <p className={`text-sm font-semibold tabular-nums ${settled ? 'text-green-700' : 'text-[#C8952A]'}`}>
            {fmt(Math.max(0, outstanding))}
          </p>
        </div>
      </div>

      {bill > 0 && (
        <div className="h-1 bg-[#EDEDE9] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
