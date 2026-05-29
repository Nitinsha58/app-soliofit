'use client'

import type { Customer } from '@/lib/api/customers'

interface Props {
  customer: Customer
  onDelete: (id: string) => void
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export default function CustomerCard({ customer, onDelete }: Props) {
  const initials = customer.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E2] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#FBF3E3] flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-[#C8952A]">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#1A1A18] truncate">{customer.name}</h3>
          <p className="text-sm text-[#6B6B67] mt-0.5">{customer.phone}</p>
        </div>

        <button
          onClick={() => onDelete(customer.id)}
          className="text-[#A0A09C] hover:text-[#B91C1C] transition-colors p-1 -mr-1 flex-shrink-0"
          aria-label="Delete customer"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-[#E5E5E2] flex items-center gap-4 text-xs text-[#A0A09C] font-variant-numeric tabular-nums">
        <span>{customer.total_orders ?? 0} orders</span>
        <span>₹{customer.outstanding_balance ?? 0} outstanding</span>
      </div>
    </div>
  )
}
