'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listOrders, type Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import ScheduleCard from '@/components/orders/ScheduleView/ScheduleCard'

// ── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStart(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow  = date.getDay()
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow))
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function dayHeaderLabel(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_ABBR[d.getMonth()]} · ${DAY_ABBR[d.getDay()]}`
}

// ── Priority sort ─────────────────────────────────────────────────────────────

function priorityTier(order: Order, colDateStr: string, todayStr: string): number {
  if (colDateStr < todayStr && order.status !== 'Delivered') return 1
  if (colDateStr === todayStr && order.has_delayed_installment) return 2
  if (colDateStr === todayStr) return 3
  if (order.priority) return 4
  if (order.status === 'Started') return 5
  if (order.status === 'Booked') return 6
  if (order.status === 'Ready' || order.status === 'Partial Delivery') return 7
  return 8
}

function sortByPriority(orders: Order[], colDateStr: string, todayStr: string): Order[] {
  return [...orders].sort((a, b) => {
    const ta = priorityTier(a, colDateStr, todayStr)
    const tb = priorityTier(b, colDateStr, todayStr)
    if (ta !== tb) return ta - tb
    return a.created_at < b.created_at ? -1 : 1
  })
}

// ── Day column ────────────────────────────────────────────────────────────────

interface DayColumnProps {
  date: Date
  orders: Order[]
  todayStr: string
  onOrderClick: (id: string) => void
}

function DayColumn({ date, orders, todayStr, onOrderClick }: DayColumnProps) {
  const dateStr = toDateStr(date)
  const isToday = dateStr === todayStr
  const sorted  = sortByPriority(orders, dateStr, todayStr)

  return (
    <div className="flex-shrink-0 flex flex-col" style={{ width: '200px' }}>
      {/* Header — fixed height, uniform across all columns */}
      <div className={`flex items-center h-8 px-2.5 rounded-sm text-[11px] font-bold tracking-[0.01em] mb-2 flex-shrink-0 ${
        isToday
          ? 'bg-[#C8952A] text-white'
          : 'bg-[#D6DAE6] border border-[#BCC2D0] text-[#1E293B]'
      }`}>
        {dayHeaderLabel(date)}
      </div>

      {/* Cards — independently scrollable */}
      <div
        className="flex flex-col gap-1.5 overflow-y-auto pb-3"
        style={{ maxHeight: 'calc(100dvh - 110px)' }}
      >
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-5">
            <span className="text-[#C8CDD9] text-base select-none">—</span>
          </div>
        ) : sorted.map((order) => (
          <ScheduleCard
            key={order.id}
            order={order}
            onClick={() => onOrderClick(order.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersSchedulePage() {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))

  const weekEnd  = addDays(weekStart, 6)
  const fromStr  = toDateStr(weekStart)
  const toStr    = toDateStr(weekEnd)
  const todayStr = toDateStr(new Date())

  const { data: orders = [], isFetching } = useQuery({
    queryKey: ['orders-schedule', fromStr, toStr],
    queryFn: () => listOrders({ deliveryDateFrom: fromStr, deliveryDateTo: toStr }),
    staleTime: 30_000,
  })

  // Group by delivery_date
  const byDate = new Map<string, Order[]>()
  for (const order of orders) {
    const bucket = byDate.get(order.delivery_date) ?? []
    bucket.push(order)
    byDate.set(order.delivery_date, bucket)
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const weekLabel = (() => {
    const s = `${weekStart.getDate()} ${MONTH_ABBR[weekStart.getMonth()]}`
    const e = `${weekEnd.getDate()} ${MONTH_ABBR[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    return `${s} – ${e}`
  })()

  return (
    // Board shell: full viewport height minus MobileNav on mobile, full height on desktop
    <div
      className="flex flex-col bg-[#EAEBEE] lg:h-dvh"
      style={{ height: 'calc(100dvh - 56px)' }}
    >
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#D4D8E4] flex-shrink-0 flex-wrap">

        {/* Week nav */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="w-[26px] h-[26px] flex items-center justify-center border border-[#BCC2D0] rounded bg-white text-[#2D3748] hover:bg-[#F0F0EE] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <span className="text-[13px] font-semibold text-[#0A0F1E] whitespace-nowrap" style={{ minWidth: '126px', textAlign: 'center' }}>
            {weekLabel}
          </span>

          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-[26px] h-[26px] flex items-center justify-center border border-[#BCC2D0] rounded bg-white text-[#2D3748] hover:bg-[#F0F0EE] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div className="w-px h-[22px] bg-[#D4D8E4] flex-shrink-0" />

        <button
          type="button"
          onClick={() => setWeekStart(getWeekStart(new Date()))}
          className="flex items-center px-2.5 py-1 border border-[#BCC2D0] rounded bg-[#F0F0EE] text-[12px] font-semibold text-[#2D3748] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors flex-shrink-0"
        >
          Today
        </button>

        {isFetching && (
          <div className="w-3.5 h-3.5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}

        {/* Count badge */}
        <div className="ml-auto flex items-center gap-1.5 bg-[rgba(200,149,42,0.10)] border border-[rgba(200,149,42,0.18)] rounded px-2.5 py-1 flex-shrink-0">
          <span className="text-[14px] font-extrabold text-[#C8952A] leading-none">{orders.length}</span>
          <span className="text-[12px] font-bold text-[#6B6B67]">orders</span>
        </div>
      </div>

      {/* ── Board body ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-3">
        <div className="flex gap-2.5 h-full" style={{ minWidth: 'max-content' }}>
          {days.map((day) => (
            <DayColumn
              key={toDateStr(day)}
              date={day}
              orders={byDate.get(toDateStr(day)) ?? []}
              todayStr={todayStr}
              onOrderClick={openOrderDetail}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
