'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary } from '@/lib/api/dashboard'

export type ActiveFilter = 'today' | 'upcoming' | 'delayed' | null

interface Props {
  activeFilter: ActiveFilter
  onFilterChange: (f: ActiveFilter) => void
}

function fmtCount(n: number) {
  return n.toLocaleString('en-IN')
}

function fmtAmount(s: string) {
  const n = parseFloat(s) || 0
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000) return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export default function SummaryStrip({ activeFilter, onFilterChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
  })

  const cards: {
    label: string
    value: string
    filterKey: ActiveFilter
    urgent: boolean
    urgentColor: string
  }[] = [
    {
      label: 'Orders Due Today',
      value: isLoading ? '–' : fmtCount(data?.orders_due_today ?? 0),
      filterKey: 'today',
      urgent: (data?.orders_due_today ?? 0) > 0,
      urgentColor: 'text-amber-600',
    },
    {
      label: 'Upcoming Orders',
      value: isLoading ? '–' : fmtCount(data?.upcoming_orders ?? 0),
      filterKey: 'upcoming',
      urgent: false,
      urgentColor: '',
    },
    {
      label: 'Delayed Orders',
      value: isLoading ? '–' : fmtCount(data?.delayed_orders ?? 0),
      filterKey: 'delayed',
      urgent: (data?.delayed_orders ?? 0) > 0,
      urgentColor: 'text-red-600',
    },
    {
      label: 'Pending Payments',
      value: isLoading ? '–' : fmtAmount(data?.pending_payments_total ?? '0'),
      filterKey: null,
      urgent: parseFloat(data?.pending_payments_total ?? '0') > 0,
      urgentColor: 'text-amber-600',
    },
    {
      label: 'Overdue Installments',
      value: isLoading ? '–' : fmtCount(data?.overdue_installments ?? 0),
      filterKey: null,
      urgent: (data?.overdue_installments ?? 0) > 0,
      urgentColor: 'text-red-600',
    },
  ]

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 mb-6 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
      {cards.map(({ label, value, filterKey, urgent, urgentColor }) => {
        const isSelected = filterKey !== null && activeFilter === filterKey
        const clickable = filterKey !== null
        return (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (!clickable) return
              onFilterChange(isSelected ? null : filterKey)
            }}
            className={`flex-shrink-0 min-w-[130px] lg:min-w-0 text-left rounded-xl border px-3.5 py-3 transition-all ${
              clickable
                ? 'cursor-pointer hover:border-[#C8952A]/50 hover:shadow-sm'
                : 'cursor-default'
            } ${
              isSelected
                ? 'border-[#C8952A] bg-[#FBF3E3]'
                : 'bg-white border-[#E5E5E2]'
            }`}
          >
            <p className="text-[10px] text-[#A0A09C] font-medium uppercase tracking-wide leading-snug flex items-center gap-1">
              {label}
              {isSelected && <span className="text-[#C8952A] font-bold">×</span>}
            </p>
            <p
              className={`text-xl font-bold tabular-nums mt-1.5 leading-none ${
                isSelected
                  ? 'text-[#C8952A]'
                  : urgent
                  ? urgentColor
                  : isLoading
                  ? 'text-[#C8C8C4]'
                  : 'text-[#1A1A18]'
              }`}
            >
              {value}
            </p>
          </button>
        )
      })}
    </div>
  )
}
