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
      className={`w-full text-left bg-white rounded-md cursor-pointer transition-shadow hover:shadow-[0_2px_8px_rgba(10,15,30,0.13)] ${
        order.priority
          ? 'border-l-[3px] border-l-[#C8952A] border-t border-t-[#E5E5E2] border-r border-r-[#E5E5E2] border-b border-b-[#E5E5E2]'
          : 'border border-[#D4D8E4]'
      }`}
      style={{ padding: '8px 10px', boxShadow: '0 1px 2px rgba(10,15,30,0.07)' }}
    >
      {/* Customer name */}
      <p className="text-[13px] font-extrabold text-[#0A0F1E] truncate leading-snug">
        {order.customer_name}
      </p>

      {/* Order# + status + delayed */}
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span className="text-[10px] font-medium text-[#94A3B8] tabular-nums">
          #{String(order.order_number).padStart(4, '0')}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${STATUS_COLORS[order.status]}`}>
          {order.status}
        </span>
        {order.has_delayed_installment && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-red-50 text-red-600">
            Delayed
          </span>
        )}
      </div>

      {/* Bill amount */}
      <p className="text-[12px] font-bold text-[#1A1A18] tabular-nums mt-1.5 leading-none">
        ₹{Number(order.total_amount).toLocaleString('en-IN')}
      </p>
    </button>
  )
}
