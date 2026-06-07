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

function fmtMoney(s: string | number): string {
  return Number(s).toLocaleString('en-IN')
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// Single workload cue: Light 0–2 green / Busy 3–5 amber / Overloaded 6+ red.
function workloadDot(workload: number): string {
  if (workload >= 6) return 'bg-red-500'
  if (workload >= 3) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function TruckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="13" height="11" rx="1" /><path d="M14 9h4l3 3v5h-7" />
      <circle cx="6" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" />
    </svg>
  )
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
  const [viewDate, setViewDate]     = useState<Date>(() => new Date())
  const [selectedDate, setSelected] = useState<string | null>(null)

  const year       = viewDate.getFullYear()
  const monthIndex = viewDate.getMonth()           // 0–11
  const todayStr   = toDateStr(new Date())

  const { data: load = {}, isFetching } = useQuery({
    queryKey: ['calendar', year, monthIndex + 1],
    queryFn: () => fetchCalendar(year, monthIndex + 1),
    staleTime: 30_000,
  })

  // Monday-start grid covering exactly the weeks the month spans (5 or 6 rows).
  const monthStart   = new Date(year, monthIndex, 1)
  const daysInMonth  = new Date(year, monthIndex + 1, 0).getDate()
  const firstWeekday = (monthStart.getDay() + 6) % 7   // Mon=0 … Sun=6
  const weeks        = Math.ceil((firstWeekday + daysInMonth) / 7)
  const gridStart    = addDays(monthStart, -firstWeekday)
  const cells        = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))

  // Slim summary: today's deliveries + amount to collect, and month overdue total.
  const todayCell      = load[todayStr]
  const deliveriesToday = todayCell?.deliveries ?? 0
  const toCollectToday  = todayCell?.payment_amount ?? '0'
  const overdueMonth    = Object.values(load).reduce((sum, c) => sum + c.late, 0)

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

      {/* ── Slim summary line ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-[#ECEEF3] text-[11px] text-[#475569] flex-shrink-0 flex-wrap">
        <span><strong className="text-[#1A1A18] font-bold tabular-nums">{deliveriesToday}</strong> deliveries due today</span>
        <span className="text-[#C8CDD9]">·</span>
        <span><strong className="text-[#1A1A18] font-bold tabular-nums">₹{fmtMoney(toCollectToday)}</strong> to collect</span>
        <span className="text-[#C8CDD9]">·</span>
        <span className={overdueMonth > 0 ? 'text-red-600 font-semibold' : ''}>
          <span className="tabular-nums">{overdueMonth}</span> overdue
        </span>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-3 min-h-0">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5 flex-shrink-0">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[11px] font-bold text-[#6B6B67]">{w}</div>
          ))}
        </div>

        {/* Day cells — fill the available height, like a standard calendar */}
        <div
          className="grid grid-cols-7 gap-1.5 flex-1 min-h-0"
          style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
        >
          {cells.map((cell) => {
            const dateStr  = toDateStr(cell)
            const inMonth  = cell.getMonth() === monthIndex
            const isToday  = dateStr === todayStr
            const info     = load[dateStr]

            // Adjacent-month days: shown muted (not blank) for a continuous grid.
            if (!inMonth) {
              return (
                <div key={dateStr} className="rounded-md border border-[#ECEEF3] bg-[#F7F8FA] p-1.5">
                  <span className="text-[12px] font-medium tabular-nums text-[#C2C6D0]">{cell.getDate()}</span>
                </div>
              )
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelected(dateStr)}
                className={`rounded-md border p-1.5 flex flex-col text-left transition-colors bg-white hover:border-[#C8952A] ${
                  isToday ? 'border-[#C8952A]' : 'border-[#E0E3EB]'
                }`}
              >
                {/* Top row: date (today = filled circle) + workload dot */}
                <div className="flex items-start justify-between">
                  {isToday ? (
                    <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full bg-[#C8952A] text-white text-[12px] font-bold tabular-nums -mt-0.5 -ml-0.5">
                      {cell.getDate()}
                    </span>
                  ) : (
                    <span className="text-[12px] font-semibold tabular-nums text-[#1A1A18]">{cell.getDate()}</span>
                  )}
                  {info && info.workload > 0 && (
                    <span className={`w-2 h-2 rounded-full ${workloadDot(info.workload)}`} aria-label="Workload" />
                  )}
                </div>

                {/* Late flag — highest priority, the only red text in a cell */}
                {info && info.late > 0 && (
                  <span className="mt-1 inline-block w-fit text-[10px] font-bold text-red-700 bg-red-50 rounded px-1 py-0.5">
                    {info.late} late
                  </span>
                )}

                {/* Event chips — neutral, icon-differentiated, anchored bottom */}
                {info && (info.deliveries > 0 || info.payments > 0) && (
                  <div className="mt-auto flex items-center gap-1 flex-wrap pt-1">
                    {info.deliveries > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#475569] bg-[#EEF0F4] rounded px-1 py-0.5">
                        <TruckIcon />{info.deliveries}
                      </span>
                    )}
                    {info.payments > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#475569] bg-[#EEF0F4] rounded px-1 py-0.5">
                        ₹{info.payments}
                      </span>
                    )}
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
