'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPaymentOrders, type DateRange, type PaymentOrder, type PaymentOrders } from '@/lib/api/payments_dashboard'
import PaymentCard from './PaymentCard'

const RANGES: { value: DateRange; label: string }[] = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_week', label: 'This Week' },
  { value: 'today', label: 'Today' },
]

const COLUMNS: { key: keyof PaymentOrders; label: string; accent: string; emptyLabel: string }[] = [
  { key: 'pending',   label: 'Pending',   accent: '#60A5FA', emptyLabel: 'No pending payments' },
  { key: 'partial',   label: 'Partial',   accent: '#FBBF24', emptyLabel: 'No partial payments' },
  { key: 'overdue',   label: 'Overdue',   accent: '#F87171', emptyLabel: 'No overdue payments' },
  { key: 'completed', label: 'Completed', accent: '#34D399', emptyLabel: 'No completed payments' },
]

interface ColumnProps {
  label: string
  accent: string
  orders: PaymentOrder[]
  emptyLabel: string
}

function PaymentColumn({ label, accent, orders, emptyLabel }: ColumnProps) {
  return (
    <div
      className="flex flex-col w-72 flex-shrink-0 rounded-xl bg-[#F7F7F5] overflow-hidden"
      style={{ boxShadow: 'inset 0 0 0 1px #E5E5E2' }}
    >
      <div style={{ borderTop: `3px solid ${accent}` }} className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#6B6B67] tracking-tight">{label}</span>
          <span
            className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full"
            style={{ color: accent, backgroundColor: `${accent}22` }}
          >
            {orders.length}
          </span>
        </div>
      </div>
      <div className="flex-1 px-2.5 pb-3 space-y-2 overflow-y-auto max-h-[600px]">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center py-7 rounded-lg border border-dashed border-[#DCDCD8]">
            <p className="text-xs text-[#C8C8C4]">{emptyLabel}</p>
          </div>
        ) : (
          orders.map((order) => <PaymentCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  )
}

export default function PaymentKanban() {
  const [range, setRange] = useState<DateRange>('all_time')

  const { data, isLoading } = useQuery({
    queryKey: ['payment-orders', range],
    queryFn: () => fetchPaymentOrders(range),
  })

  return (
    <div>
      {/* Date range filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {RANGES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setRange(value)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              range === value
                ? 'bg-[#C8952A] text-white'
                : 'bg-white border border-[#E5E5E2] text-[#6B6B67] hover:border-[#C8952A]/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-4 -mx-6 px-6">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(({ key, label, accent, emptyLabel }) => (
              <PaymentColumn
                key={key}
                label={label}
                accent={accent}
                orders={data?.[key] ?? []}
                emptyLabel={emptyLabel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
