'use client'

import type { SearchOrder } from '@/lib/api/search'
import { useUIStore } from '@/stores/useUIStore'

const STATUS_COLORS: Record<string, string> = {
  'Booked':           'bg-blue-50 text-blue-700',
  'Started':          'bg-violet-50 text-violet-700',
  'Ready':            'bg-emerald-50 text-emerald-700',
  'Partial Delivery': 'bg-amber-50 text-amber-700',
  'Delivered':        'bg-gray-100 text-gray-600',
}

export default function OrderRow({ order, onSelect }: { order: SearchOrder; onSelect?: () => void }) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)
  return (
    <button
      type="button"
      onClick={() => { openOrderDetail(order.id); onSelect?.() }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F3] transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-[#F0F0EE] flex items-center justify-center text-[#6B6B67] text-xs font-semibold flex-shrink-0">
        #{String(order.order_number).padStart(4, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{order.customer_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {order.status}
          </span>
          {order.delivery_date && (
            <span className="text-[10px] text-[#A0A09C]">
              {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
