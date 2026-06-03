'use client'

import type { PaymentOrder } from '@/lib/api/payments_dashboard'
import { useUIStore } from '@/stores/useUIStore'

interface Props {
  order: PaymentOrder
}

function fmt(s: string) {
  const n = parseFloat(s) || 0
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000) return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function fmtFull(s: string) {
  const n = parseFloat(s) || 0
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function PaymentCard({ order }: Props) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)

  const total = parseFloat(order.total_amount) || 0
  const paid = parseFloat(order.paid_total) || 0
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0

  return (
    <button
      type="button"
      onClick={() => openOrderDetail(order.id)}
      className="w-full text-left bg-white rounded-xl border border-[#E5E5E2] px-3.5 py-3 hover:border-[#C8952A]/50 hover:shadow-sm transition-all"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1A1A18] truncate">{order.customer_name}</p>
          <p className="text-xs text-[#A0A09C] mt-0.5">{order.customer_phone}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold text-[#6B6B67]">#{order.order_number}</p>
          <p className="text-[11px] text-[#A0A09C] mt-0.5">{fmtDate(order.delivery_date)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#F0F0EE] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? '#34D399' : pct >= 50 ? '#C8952A' : '#F87171',
          }}
        />
      </div>

      {/* Paid / remaining */}
      <div className="flex items-center gap-1.5 text-xs mb-1.5">
        <span className="text-[#6B6B67]">Paid <span className="font-semibold text-[#1A1A18]">{fmtFull(order.paid_total)}</span></span>
        <span className="text-[#D5D5D2]">·</span>
        <span className="text-[#6B6B67]">Remaining <span className="font-semibold text-[#1A1A18]">{fmtFull(order.remaining)}</span></span>
      </div>

      {/* Next installment */}
      {order.next_installment && (
        <p className="text-[11px] text-[#A0A09C]">
          Next{' '}
          <span className="font-medium text-[#6B6B67]">{fmtFull(order.next_installment.amount)}</span>
          {' on '}
          <span className="font-medium text-[#6B6B67]">{fmtDate(order.next_installment.due_date)}</span>
        </p>
      )}

      {/* Overdue badge */}
      {order.overdue_count > 0 && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {order.overdue_count} overdue · {fmt(order.overdue_amount)}
          </span>
        </div>
      )}
    </button>
  )
}
