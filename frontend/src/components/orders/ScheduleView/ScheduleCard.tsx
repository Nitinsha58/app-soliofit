'use client'

import type { Order } from '@/lib/api/orders'

interface Props {
  order: Order
  onClick: () => void
}

const STATUS_COLORS: Record<Order['status'], string> = {
  'Booked':           'bg-blue-50 text-blue-700',
  'Started':          'bg-violet-50 text-violet-700',
  'Ready':            'bg-emerald-50 text-emerald-700',
  'Partial Delivery': 'bg-amber-50 text-amber-700',
  'Delivered':        'bg-gray-100 text-gray-500',
}

export default function ScheduleCard({ order, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_3px_8px_rgba(0,0,0,0.09)] transition-shadow px-3 py-2.5 ${
        order.priority
          ? 'border-l-[3px] border-l-[#C8952A] border-t border-t-[#E5E5E2] border-r border-r-[#E5E5E2] border-b border-b-[#E5E5E2]'
          : 'border border-[#E5E5E2]'
      }`}
    >
      {/* Customer name */}
      <p className="text-[13px] font-semibold text-[#1A1A18] truncate leading-snug">
        {order.customer_name}
      </p>

      {/* Order number + badges */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="text-[10px] text-[#B0B0AC] font-medium tabular-nums">
          #{String(order.order_number).padStart(4, '0')}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
          {order.status}
        </span>
        {order.has_delayed_installment && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
            Delayed
          </span>
        )}
      </div>

      {/* Bill amount */}
      <p className="text-[13px] font-bold text-[#1A1A18] tabular-nums mt-1.5">
        ₹{Number(order.total_amount).toLocaleString('en-IN')}
      </p>
    </button>
  )
}
