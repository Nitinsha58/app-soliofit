import type { Order } from '@/lib/api/orders'

interface Props {
  orders: Order[]
}

function pad(n: number) { return String(n).padStart(2, '0') }

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function SummaryStrip({ orders }: Props) {
  const today = new Date()
  const todayStr = localDateStr(today)
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  const nextWeekStr = localDateStr(nextWeek)

  const active   = orders.filter(o => o.status !== 'Delivered').length
  const dueToday = orders.filter(o => o.delivery_date === todayStr && o.status !== 'Delivered').length
  const thisWeek = orders.filter(o => o.delivery_date >= todayStr && o.delivery_date <= nextWeekStr && o.status !== 'Delivered').length
  const overdue  = orders.filter(o => o.delivery_date < todayStr && o.status !== 'Delivered').length

  const cards = [
    { label: 'Active',     count: active,   urgent: false },
    { label: 'Due Today',  count: dueToday, urgent: dueToday > 0 },
    { label: 'This Week',  count: thisWeek, urgent: false },
    { label: 'Overdue',    count: overdue,  urgent: overdue > 0 },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {cards.map(({ label, count, urgent }) => (
        <div key={label} className="bg-white rounded-xl border border-[#E5E5E2] px-4 py-3">
          <p className="text-[11px] text-[#A0A09C] font-medium uppercase tracking-wide leading-none">
            {label}
          </p>
          <p className={`text-2xl font-bold tabular-nums mt-2 leading-none ${
            urgent ? (label === 'Overdue' ? 'text-red-600' : 'text-amber-600') : 'text-[#1A1A18]'
          }`}>
            {count}
          </p>
        </div>
      ))}
    </div>
  )
}
