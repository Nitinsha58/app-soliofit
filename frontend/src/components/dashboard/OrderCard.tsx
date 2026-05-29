'use client'

import type { Order } from '@/lib/api/orders'

interface Props {
  order: Order
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function OrderCard({ order }: Props) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isOverdue = order.delivery_date < todayStr && order.status !== 'Delivered'
  const isToday = order.delivery_date === todayStr

  return (
    <div
      className={`bg-white rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow cursor-pointer ${
        order.priority ? 'border-l-2 border-l-[#C8952A] border-t-[#E5E5E2] border-r-[#E5E5E2] border-b-[#E5E5E2]' : 'border-[#E5E5E2]'
      }`}
    >
      {order.priority && (
        <div className="flex items-center gap-1 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C8952A]" />
          <span className="text-[10px] font-semibold text-[#C8952A] uppercase tracking-wide">Priority</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1A1A18] truncate">{order.customer_name}</p>
          <p className="text-[11px] text-[#A0A09C] mt-0.5 tabular-nums">
            #{String(order.order_number).padStart(4, '0')}
          </p>
        </div>
        <span
          className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
            isOverdue
              ? 'bg-red-50 text-red-700'
              : isToday
              ? 'bg-amber-50 text-amber-700'
              : 'bg-[#F5F5F3] text-[#6B6B67]'
          }`}
        >
          {isOverdue && '⚠ '}{formatDate(order.delivery_date)}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#E5E5E2]">
        <span className="text-xs text-[#A0A09C]">Total</span>
        <span className="text-sm font-semibold text-[#1A1A18] tabular-nums">
          ₹{Number(order.total_amount).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  )
}
