'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary } from '@/lib/api/dashboard'

export type RailFilter = 'delayed' | 'today' | 'upcoming'

interface Props {
  activeFilter: RailFilter | null
  onFilterChange: (f: RailFilter | null) => void
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default function AttentionRail({ activeFilter, onFilterChange }: Props) {
  const { data } = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchDashboardSummary })

  const pills: { key: RailFilter; label: string; count: number; tone: 'red' | 'amber' | 'neutral'; icon: React.ReactNode }[] = [
    { key: 'delayed',  label: 'Delayed',  count: data?.delayed_orders ?? 0,    tone: 'red',     icon: <ClockIcon /> },
    { key: 'today',    label: 'Today',    count: data?.orders_due_today ?? 0,  tone: 'amber',   icon: <CalendarIcon /> },
    { key: 'upcoming', label: 'Upcoming', count: data?.upcoming_orders ?? 0,   tone: 'neutral', icon: <CalendarIcon /> },
  ]

  const toneClass = (tone: string, active: boolean) =>
    active
      ? 'bg-[#C8952A] border-[#C8952A] text-white'
      : tone === 'red'
      ? 'bg-white border-[#E5E5E2] text-red-600'
      : tone === 'amber'
      ? 'bg-white border-[#E5E5E2] text-amber-600'
      : 'bg-white border-[#E5E5E2] text-[#6B6B67]'

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
      {pills.map(({ key, label, count, tone, icon }) => {
        const active = activeFilter === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(active ? null : key)}
            className={`flex-shrink-0 flex items-center gap-1.5 h-[38px] px-3 rounded-lg border text-[13px] font-semibold transition-colors ${toneClass(tone, active)}`}
          >
            {icon}
            <span>{label}</span>
            <span className="tabular-nums">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
