'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listOrders, type Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import ScheduleCard from '@/components/orders/ScheduleView/ScheduleCard'

// ── Date helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStart(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = date.getDay() // 0=Sun … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow // shift to Monday
  date.setDate(date.getDate() + diff)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getTodayStr(): string {
  return toDateStr(new Date())
}

// ── Priority sort ────────────────────────────────────────────────────────────

function priorityTier(order: Order, colDateStr: string, todayStr: string): number {
  if (colDateStr < todayStr && order.status !== 'Delivered') return 1
  if (colDateStr === todayStr && order.has_delayed_installment) return 2
  if (colDateStr === todayStr) return 3
  if (order.priority) return 4
  if (order.status === 'Started') return 5
  if (order.status === 'Booked') return 6
  if (order.status === 'Ready' || order.status === 'Partial Delivery') return 7
  return 8 // Delivered
}

function sortByPriority(orders: Order[], colDateStr: string, todayStr: string): Order[] {
  return [...orders].sort((a, b) => {
    const ta = priorityTier(a, colDateStr, todayStr)
    const tb = priorityTier(b, colDateStr, todayStr)
    if (ta !== tb) return ta - tb
    return a.created_at < b.created_at ? -1 : 1
  })
}

// ── Day column ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DayColumnProps {
  date: Date
  orders: Order[]
  todayStr: string
  onOrderClick: (id: string) => void
}

function DayColumn({ date, orders, todayStr, onOrderClick }: DayColumnProps) {
  const dateStr = toDateStr(date)
  const isToday = dateStr === todayStr
  const isPast = dateStr < todayStr
  const dayIndex = (date.getDay() + 6) % 7 // Mon=0 … Sun=6
  const sorted = sortByPriority(orders, dateStr, todayStr)

  return (
    <div className="flex flex-col min-w-[160px] w-full">
      {/* Column header */}
      <div className={`px-2 py-2 mb-2 rounded-lg text-center ${isToday ? 'bg-[#FBF3E3]' : ''}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${
          isToday ? 'text-[#C8952A]' : isPast ? 'text-[#B0B0AC]' : 'text-[#6B6B67]'
        }`}>
          {DAY_NAMES[dayIndex]}
        </p>
        <p className={`text-lg font-bold leading-tight ${
          isToday ? 'text-[#C8952A]' : isPast ? 'text-[#B0B0AC]' : 'text-[#1A1A18]'
        }`}>
          {date.getDate()}
        </p>
        {isToday && (
          <span className="text-[9px] font-bold text-[#C8952A] uppercase tracking-widest">Today</span>
        )}
        {sorted.length > 0 && (
          <span className="text-[10px] font-medium text-[#A0A09C] mt-0.5 block">
            {sorted.length} {sorted.length === 1 ? 'order' : 'orders'}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-[#E5E5E2] text-lg">—</span>
          </div>
        ) : (
          sorted.map((order) => (
            <ScheduleCard
              key={order.id}
              order={order}
              onClick={() => onOrderClick(order.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersSchedulePage() {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))

  const weekEnd = addDays(weekStart, 6)
  const fromStr = toDateStr(weekStart)
  const toStr   = toDateStr(weekEnd)
  const todayStr = getTodayStr()

  const { data: orders = [], isFetching } = useQuery({
    queryKey: ['orders-schedule', fromStr, toStr],
    queryFn: () => listOrders({ deliveryDateFrom: fromStr, deliveryDateTo: toStr }),
    staleTime: 30_000,
  })

  // Group orders by delivery_date
  const byDate = new Map<string, Order[]>()
  for (const order of orders) {
    const existing = byDate.get(order.delivery_date) ?? []
    existing.push(order)
    byDate.set(order.delivery_date, existing)
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Week label: "2 Jun – 8 Jun 2026"
  const weekLabel = (() => {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    const from = weekStart.toLocaleDateString('en-IN', opts)
    const to   = weekEnd.toLocaleDateString('en-IN', { ...opts, year: 'numeric' })
    return `${from} – ${to}`
  })()

  function goToToday() {
    setWeekStart(getWeekStart(new Date()))
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#FAFAF8] border-b border-[#E5E5E2] px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#1A1A18]">Orders</h1>
            {isFetching && (
              <div className="w-3.5 h-3.5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B6B67] hidden sm:block">{weekLabel}</span>

            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
              className="w-7 h-7 rounded-lg border border-[#E5E5E2] bg-white flex items-center justify-center text-[#6B6B67] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
              aria-label="Previous week"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-1 rounded-lg border border-[#E5E5E2] bg-white text-xs font-medium text-[#6B6B67] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
              className="w-7 h-7 rounded-lg border border-[#E5E5E2] bg-white flex items-center justify-center text-[#6B6B67] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
              aria-label="Next week"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile week label */}
        <p className="text-xs text-[#A0A09C] mt-0.5 sm:hidden text-center">{weekLabel}</p>
      </div>

      {/* 7-column grid */}
      <div className="overflow-x-auto">
        <div
          className="flex gap-3 px-4 sm:px-6 py-4 min-w-max sm:min-w-0 sm:grid sm:grid-cols-7"
          style={{ minWidth: '1120px' }}
        >
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
