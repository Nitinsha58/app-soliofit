'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCalendar } from '@/lib/api/calendar'
import { listOrders } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import ScheduleCard from '@/components/orders/ScheduleView/ScheduleCard'
import NotificationBell from '@/components/dashboard/NotificationBell'

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

function TruckIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="13" height="11" rx="1" /><path d="M14 9h4l3 3v5h-7" />
      <circle cx="6" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" />
    </svg>
  )
}

function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" />
    </svg>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ icon, boxClass, value, label }: {
  icon: React.ReactNode; boxClass: string; value: string; label: string
}) {
  return (
    // Mobile: stack (icon on top) so the amount gets the card's full width and
    // never truncates at 375px. sm+: icon-left horizontal row.
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 rounded-lg border border-[#ECEEF3] px-2 sm:px-2.5 py-2 min-w-0">
      <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${boxClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] sm:text-[15px] font-extrabold text-[#0A0F1E] leading-tight tabular-nums whitespace-nowrap sm:truncate">{value}</p>
        <p className="text-[10px] text-[#6B6B67] leading-tight">{label}</p>
      </div>
    </div>
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

  // Summary cards: today's deliveries + amount to collect, month overdue total.
  const todayCell       = load[todayStr]
  const deliveriesToday = todayCell?.deliveries ?? 0
  const toCollectToday  = todayCell?.payment_amount ?? '0'
  const overdueMonth    = Object.values(load).reduce((sum, c) => sum + c.late, 0)

  const goPrev  = () => setViewDate(new Date(year, monthIndex - 1, 1))
  const goNext  = () => setViewDate(new Date(year, monthIndex + 1, 1))
  const goToday = () => setViewDate(new Date())

  return (
    <div className="flex flex-col bg-[#F0F1F4] lg:h-dvh" style={{ height: 'calc(100dvh - 56px)' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-[#E5E5E2] flex-shrink-0">
        <h1 className="text-[18px] font-extrabold text-[#0A0F1E] tracking-tight">
          {MONTH_NAMES[monthIndex]} {year}
        </h1>
        {isFetching && (
          <div className="w-3.5 h-3.5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button" aria-label="Previous month" onClick={goPrev}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#6B6B67] hover:bg-[#F0F0EE] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            type="button" aria-label="Next month" onClick={goNext}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#6B6B67] hover:bg-[#F0F0EE] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <button
          type="button" onClick={goToday}
          className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[13px] font-semibold hover:bg-emerald-100 transition-colors flex-shrink-0"
        >
          Today
        </button>

        {/* Bell — mobile only (desktop sidebar carries it), matching the reference */}
        <div className="lg:hidden flex-shrink-0">
          <NotificationBell dropdownSide="right" />
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2.5 bg-white border-b border-[#ECEEF3] flex-shrink-0">
        <SummaryCard
          icon={<TruckIcon size={16} />} boxClass="bg-emerald-50 text-emerald-600"
          value={String(deliveriesToday)} label="Deliveries due today"
        />
        <SummaryCard
          icon={<span className="text-[15px] font-bold">₹</span>} boxClass="bg-violet-50 text-violet-600"
          value={`₹${fmtMoney(toCollectToday)}`} label="To collect"
        />
        <SummaryCard
          icon={<AlertIcon size={16} />} boxClass="bg-red-50 text-red-600"
          value={String(overdueMonth)} label="Overdue orders"
        />
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[11px] font-bold text-[#6B6B67]">{w}</div>
          ))}
        </div>

        {/* Day cells — proportionate height (not viewport-fill) */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell) => {
            const dateStr  = toDateStr(cell)
            const inMonth  = cell.getMonth() === monthIndex
            const isToday  = dateStr === todayStr
            const isSunday = cell.getDay() === 0
            const info     = load[dateStr]

            // Adjacent-month days: shown muted (not blank) for a continuous grid.
            if (!inMonth) {
              return (
                <div key={dateStr} className="min-h-[84px] rounded-md border border-[#ECEEF3] bg-[#F7F8FA] p-1.5">
                  <span className="text-[12px] font-medium tabular-nums text-[#C2C6D0]">{cell.getDate()}</span>
                </div>
              )
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelected(dateStr)}
                className={`min-h-[84px] rounded-md border p-1.5 flex flex-col text-left transition-colors bg-white hover:border-[#C8952A] ${
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
                    <span className={`text-[12px] font-semibold tabular-nums ${isSunday ? 'text-red-500' : 'text-[#1A1A18]'}`}>
                      {cell.getDate()}
                    </span>
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

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 bg-white border-t border-[#ECEEF3] flex-shrink-0 text-[11px] text-[#6B6B67] flex-wrap">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Light</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Busy</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Overloaded</span>
        <span className="inline-flex items-center gap-1"><span className="text-red-700 font-bold bg-red-50 rounded px-1">late</span>overdue delivery</span>
      </div>

      {selectedDate && <DayPanel date={selectedDate} onClose={() => setSelected(null)} />}
    </div>
  )
}
