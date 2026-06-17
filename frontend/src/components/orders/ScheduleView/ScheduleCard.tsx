'use client'

import type { Order } from '@/lib/api/orders'
import { inr, paidColorClass, paymentMeta } from '@/lib/orderPayment'
import { STATUS_PILL } from '@/lib/orderStatus'

interface Props {
  order: Order
  onClick: () => void
}

export default function ScheduleCard({ order, onClick }: Props) {
  const billed = paymentMeta(order.payment_state) !== null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-white rounded-lg px-3 py-2.5 cursor-pointer transition-shadow hover:shadow-[0_3px_10px_rgba(0,0,0,0.09)] ${
        order.priority
          ? 'border-l-[3px] border-l-[#C8952A] border-t border-t-[#E5E5E2] border-r border-r-[#E5E5E2] border-b border-b-[#E5E5E2]'
          : 'border border-[#E5E5E2]'
      }`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
    >
      {/* Row 1: name + status pill */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#1A1A18] truncate leading-snug flex-1 min-w-0">
          {order.customer_name}
        </p>
        <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm mt-0.5 ${STATUS_PILL[order.status]}`}>
          {order.status}
        </span>
      </div>

      {/* Divider */}
      <div className="mt-2 pt-2 border-t border-[#EBEBEA]" />

      {/* Row 2: order# + amount */}
      <div className="flex items-center justify-between gap-2 mt-0">
        <span className="text-[11px] font-medium text-[#B0B0AC] tabular-nums flex-shrink-0">
          #{String(order.order_number).padStart(4, '0')}
        </span>
        {billed ? (
          <span className="text-[12px] tabular-nums leading-none">
            <span className={`font-bold ${paidColorClass(order.payment_state)}`}>₹{inr(order.amount_paid)}</span>
            <span className="font-medium text-[#B0B0AC]"> / ₹{inr(order.total_amount)}</span>
          </span>
        ) : (
          <span className="text-[13px] font-bold text-[#1A1A18] tabular-nums leading-none">
            ₹{inr(order.total_amount)}
          </span>
        )}
      </div>
    </button>
  )
}
