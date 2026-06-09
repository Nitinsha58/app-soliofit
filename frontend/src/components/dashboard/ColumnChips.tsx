'use client'

import type { Order } from '@/lib/api/orders'

export interface Chip { status: Order['status']; label: string; accent: string }

interface Props {
  chips: Chip[]
  counts: Record<Order['status'], number>
  selected: Order['status']
  onSelect: (s: Order['status']) => void
}

export default function ColumnChips({ chips, counts, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
      {chips.map(({ status, label }) => {
        const active = status === selected
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(status)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-semibold transition-colors ${
              active ? 'bg-[#C8952A] border-[#C8952A] text-white' : 'bg-white border-[#E5E5E2] text-[#6B6B67]'
            }`}
          >
            <span>{label}</span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-white text-[#C8952A]' : 'bg-[#F0F0EE] text-[#6B6B67]'}`}>
              {counts[status] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
