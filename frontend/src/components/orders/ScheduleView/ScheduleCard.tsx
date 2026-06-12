'use client'

import type { Order } from '@/lib/api/orders'
import { paymentMeta, inr } from '@/lib/orderPayment'
import { STATUS_PILL } from '@/lib/orderStatus'

interface Props {
  order: Order
  onClick: () => void
}

export default function ScheduleCard({ order, onClick }: Props) {
  const pay = paymentMeta(order.payment_state)
  const remaining = Number(order.remaining)
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
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${STATUS_PILL[order.status]}`}>
          {order.status}
        </span>
        {pay && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${pay.pillClass}`}>
            {pay.label}
          </span>
        )}
      </div>

      {/* Amount: paid / total (+ remaining), or plain bill when unbilled */}
      {pay ? (
        <p className="text-[12px] tabular-nums mt-1.5 leading-none">
          <span className="font-bold text-[#1A1A18]">₹{inr(order.amount_paid)}</span>
          <span className="font-semibold text-[#94A3B8]"> / ₹{inr(order.total_amount)}</span>
          {remaining > 0 && (
            <span className="font-medium text-[#64748B]"> · ₹{inr(order.remaining)} due</span>
          )}
        </p>
      ) : (
        <p className="text-[12px] font-bold text-[#1A1A18] tabular-nums mt-1.5 leading-none">
          ₹{inr(order.total_amount)}
        </p>
      )}
    </button>
  )
}
