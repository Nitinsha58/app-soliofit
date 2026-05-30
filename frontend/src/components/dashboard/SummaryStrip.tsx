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
  const plus7 = new Date(today)
  plus7.setDate(today.getDate() + 7)
  const plus7Str = localDateStr(plus7)

  const dueToday  = orders.filter(o => o.delivery_date === todayStr && o.status !== 'Delivered').length
  const upcoming  = orders.filter(o => o.delivery_date > todayStr && o.delivery_date <= plus7Str && o.status !== 'Delivered').length
  const delayed   = orders.filter(o => o.delivery_date < todayStr && o.status !== 'Delivered').length

  const cards = [
    { label: 'Orders Due Today',    value: String(dueToday),  urgent: dueToday > 0,  urgentColor: 'text-amber-600' },
    { label: 'Upcoming Orders',     value: String(upcoming),  urgent: false,         urgentColor: '' },
    { label: 'Delayed Orders',      value: String(delayed),   urgent: delayed > 0,   urgentColor: 'text-red-600' },
    { label: 'Pending Payments',    value: '—',               urgent: false,         urgentColor: '' },
    { label: 'Overdue Installments',value: '—',               urgent: false,         urgentColor: '' },
  ]

  return (
    <div className="grid grid-cols-5 gap-2.5 mb-6">
      {cards.map(({ label, value, urgent, urgentColor }) => (
        <div key={label} className="bg-white rounded-xl border border-[#E5E5E2] px-3.5 py-3">
          <p className="text-[10px] text-[#A0A09C] font-medium uppercase tracking-wide leading-snug">
            {label}
          </p>
          <p className={`text-xl font-bold tabular-nums mt-1.5 leading-none ${
            urgent ? urgentColor : value === '—' ? 'text-[#C8C8C4]' : 'text-[#1A1A18]'
          }`}>
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}
