'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPaymentSummary } from '@/lib/api/payments_dashboard'

function fmtAmount(s: string) {
  const n = parseFloat(s) || 0
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000) return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export default function PaymentSummaryStrip() {
  const { data, isLoading } = useQuery({
    queryKey: ['payments-summary'],
    queryFn: fetchPaymentSummary,
  })

  const cards = [
    {
      label: 'Total Receivable',
      value: isLoading ? '–' : fmtAmount(data?.total_receivable ?? '0'),
      urgent: parseFloat(data?.total_receivable ?? '0') > 0,
      urgentColor: 'text-[#1A1A18]',
    },
    {
      label: 'Received Today',
      value: isLoading ? '–' : fmtAmount(data?.received_today ?? '0'),
      urgent: parseFloat(data?.received_today ?? '0') > 0,
      urgentColor: 'text-emerald-600',
    },
    {
      label: 'Pending Orders',
      value: isLoading ? '–' : String(data?.pending_count ?? 0),
      urgent: (data?.pending_count ?? 0) > 0,
      urgentColor: 'text-amber-600',
    },
    {
      label: 'Overdue Orders',
      value: isLoading ? '–' : String(data?.overdue_count ?? 0),
      urgent: (data?.overdue_count ?? 0) > 0,
      urgentColor: 'text-red-600',
    },
  ]

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 mb-6 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
      {cards.map(({ label, value, urgent, urgentColor }) => (
        <div
          key={label}
          className="flex-shrink-0 min-w-[130px] lg:min-w-0 bg-white rounded-xl border border-[#E5E5E2] px-3.5 py-3"
        >
          <p className="text-[10px] text-[#A0A09C] font-medium uppercase tracking-wide leading-snug">
            {label}
          </p>
          <p
            className={`text-xl font-bold tabular-nums mt-1.5 leading-none ${
              urgent
                ? urgentColor
                : isLoading
                ? 'text-[#C8C8C4]'
                : 'text-[#1A1A18]'
            }`}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}
