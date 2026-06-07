'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCalendar } from '@/lib/api/calendar'
import { listOrders } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import ScheduleCard from '@/components/orders/ScheduleView/ScheduleCard'

// ── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// 1–5 green, 6–12 amber, 13+ red. 0 → no badge.
function loadBadge(count: number): string {
  if (count >= 13) return 'bg-red-100 text-red-700'
  if (count >= 6)  return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

// ── Day-orders drill-down panel ──────────────────────────────────────────────

function DayPanel({ date, onClose }: { date: string; onClose: () => void }) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['calendar-day', date],
    queryFn: () => listOrders({ deliveryDateFrom: date, deliveryDateTo: date }),
  })

  const [y, m, d] = date.split('-').map(Number)
  const heading = new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute bg-white shadow-xl flex flex-col
                      inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl
                      lg:inset-y-0 lg:right-0 lg:left-auto lg:bottom-auto lg:w-[380px] lg:max-h-none lg:rounded-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E2] flex-shrink-0">
          <div>
            <p className="text-[13px] font-bold text-[#0A0F1E]">{heading}</p>
            <p className="text-[11px] text-[#6B6B67]">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#6B6B67] hover:bg-[#F0F0EE]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-[#6B6B67]">No orders on this date</p>
            </div>
          ) : (
            orders.map((order) => (
              <ScheduleCard key={order.id} order={order} onClick={() => openOrderDetail(order.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [viewDate, setViewDate]       = useState<Date>(() => new Date())
  const [selectedDate, setSelected]   = useState<string | null>(null)

  const year       = viewDate.getFullYear()
  const monthIndex = viewDate.getMonth()           // 0–11
  const todayStr   = toDateStr(new Date())

  const { data: load = {}, isFetching } = useQuery({
    queryKey: ['calendar', year, monthIndex + 1],
    queryFn: () => fetchCalendar(year, monthIndex + 1),
    staleTime: 30_000,
  })

  // Monday-start 6×7 grid covering the month.
  const monthStart   = new Date(year, monthIndex, 1)
  const firstWeekday = (monthStart.getDay() + 6) % 7   // Mon=0 … Sun=6
  const gridStart    = addDays(monthStart, -firstWeekday)
  const cells        = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const goPrev  = () => setViewDate(new Date(year, monthIndex - 1, 1))
  const goNext  = () => setViewDate(new Date(year, monthIndex + 1, 1))
  const goToday = () => setViewDate(new Date())

  return (
    <div className="flex flex-col bg-[#F0F1F4] lg:h-dvh" style={{ height: 'calc(100dvh - 56px)' }}>
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#D4D8E4] flex-shrink-0">
        <h1 className="text-[15px] font-bold text-[#0A0F1E] min-w-[150px]">
          {MONTH_NAMES[monthIndex]} {year}
        </h1>

        {isFetching && (
          <div className="w-3.5 h-3.5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button" aria-label="Previous month" onClick={goPrev}
            className="w-[26px] h-[26px] flex items-center justify-center border border-[#BCC2D0] rounded bg-white text-[#2D3748] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            type="button" onClick={goToday}
            className="flex items-center px-2.5 py-1 border border-[#BCC2D0] rounded bg-[#F0F0EE] text-[12px] font-semibold text-[#2D3748] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            Today
          </button>
          <button
            type="button" aria-label="Next month" onClick={goNext}
            className="w-[26px] h-[26px] flex items-center justify-center border border-[#BCC2D0] rounded bg-white text-[#2D3748] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[11px] font-bold text-[#6B6B67] py-1">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell) => {
            const dateStr     = toDateStr(cell)
            const inMonth     = cell.getMonth() === monthIndex
            const isToday     = dateStr === todayStr
            const info        = load[dateStr]
            const count       = info?.count ?? 0
            const hasOverdue  = info?.has_overdue ?? false

            if (!inMonth) {
              return <div key={dateStr} className="min-h-[72px] rounded-md bg-transparent" />
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelected(dateStr)}
                className={`min-h-[72px] rounded-md border p-1.5 flex flex-col text-left transition-colors bg-white hover:border-[#C8952A] ${
                  isToday ? 'border-[#C8952A] border-2' : 'border-[#E0E3EB]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[12px] font-semibold tabular-nums ${isToday ? 'text-[#C8952A]' : 'text-[#1A1A18]'}`}>
                    {cell.getDate()}
                  </span>
                  {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-label="Has overdue deliveries" />}
                </div>
                {count > 0 && (
                  <div className="mt-auto">
                    <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${loadBadge(count)}`}>
                      {count}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && <DayPanel date={selectedDate} onClose={() => setSelected(null)} />}
    </div>
  )
}
