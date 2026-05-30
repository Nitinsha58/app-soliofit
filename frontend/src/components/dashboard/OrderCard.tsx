'use client'

import type { Order } from '@/lib/api/orders'

interface Props {
  order: Order
  onClick?: () => void
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function OrderCard({ order, onClick }: Props) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isOverdue = order.delivery_date < todayStr && order.status !== 'Delivered'
  const isToday = order.delivery_date === todayStr

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.09)] transition-shadow cursor-pointer px-3.5 py-3 ${
        order.priority
          ? 'border-l-[3px] border-l-[#C8952A] border-t border-t-[#E5E5E2] border-r border-r-[#E5E5E2] border-b border-b-[#E5E5E2]'
          : 'border border-[#E5E5E2]'
      }`}
    >
      {/* Customer + date */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1A1A18] truncate leading-snug">{order.customer_name}</p>
          {order.customer_phone && (
            <p className="text-[11px] text-[#A0A09C] mt-0.5 truncate">{order.customer_phone}</p>
          )}
        </div>
        <span
          className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${
            isOverdue
              ? 'bg-red-50 text-red-600'
              : isToday
              ? 'bg-amber-50 text-amber-600'
              : 'bg-[#F0F0EE] text-[#6B6B67]'
          }`}
        >
          {isOverdue ? '⚠ ' : ''}{formatDate(order.delivery_date)}
        </span>
      </div>

      {/* Order number + priority + amount */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#EBEBEA]">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#B0B0AC] tabular-nums font-medium">
            #{String(order.order_number).padStart(4, '0')}
          </span>
          {order.priority && (
            <span className="text-[9px] font-bold text-[#C8952A] uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded">
              Priority
            </span>
          )}
        </div>
        <span className="text-[15px] font-bold text-[#1A1A18] tabular-nums leading-none">
          ₹{Number(order.total_amount).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  )
}
