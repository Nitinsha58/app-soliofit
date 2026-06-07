'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
import { listOrders, type Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import ScheduleCard from '@/components/orders/ScheduleView/ScheduleCard'

// ── Layout constants ──────────────────────────────────────────────────────────

const COLUMN_WIDTH  = 200
const COLUMN_GAP    = 10
const COLUMN_STEP   = COLUMN_WIDTH + COLUMN_GAP   // 210
const MAX_WEEKS     = 9
const INIT_PREV_WEEKS = 1                          // weeks preloaded to the left on init

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function strToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
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

function initLoadedWeeks(): string[] {
  const curr = getWeekStart(new Date())
  return [
    toDateStr(addDays(curr, -7 * INIT_PREV_WEEKS)),
    toDateStr(curr),
    toDateStr(addDays(curr, 7)),
  ]
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
    <div className="flex-shrink-0 flex flex-col" style={{ width: `${COLUMN_WIDTH}px` }}>
      {/* Header — fixed height, uniform across all columns */}
      <div className={`flex items-center h-8 px-2.5 rounded-sm text-[11px] font-bold tracking-[0.01em] mb-2 flex-shrink-0 ${
        isToday
          ? 'bg-[#FDF3E3] border-l-2 border-l-[#C8952A] border-t border-t-[#F0D9A8] border-r border-r-[#F0D9A8] border-b border-b-[#F0D9A8] text-[#C8952A]'
          : 'bg-[#E8EAF0] border border-[#CDD2E0] text-[#1E293B]'
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

  const [loadedWeeks, setLoadedWeeks] = useState<string[]>(initLoadedWeeks)
  const [scrollLabel, setScrollLabel] = useState(() => {
    const curr = getWeekStart(new Date())
    return `${MONTH_ABBR[curr.getMonth()]} ${curr.getFullYear()}`
  })

  const boardRef              = useRef<HTMLDivElement>(null)
  const leftSentinelRef       = useRef<HTMLDivElement>(null)
  const rightSentinelRef      = useRef<HTMLDivElement>(null)
  const observerActiveRef     = useRef(false)
  const prevFirstDayRef       = useRef<string | null>(null)
  const pendingScrollTodayRef = useRef(false)
  const scrollRafRef          = useRef<number | null>(null)

  const todayStr = toDateStr(new Date())

  // One query per loaded week
  const weekQueries = useQueries({
    queries: loadedWeeks.map(weekStart => ({
      queryKey: ['orders-schedule', weekStart] as const,
      queryFn:  () => listOrders({
        deliveryDateFrom: weekStart,
        deliveryDateTo:   toDateStr(addDays(strToDate(weekStart), 6)),
      }),
      staleTime: 30_000,
    })),
  })

  const isFetching  = weekQueries.some(q => q.isFetching)
  const totalOrders = weekQueries.reduce((sum, q) => sum + (q.data?.length ?? 0), 0)

  // Flatten all loaded weeks into sorted day list (weeks are non-overlapping)
  const days = loadedWeeks.flatMap(ws =>
    Array.from({ length: 7 }, (_, i) => addDays(strToDate(ws), i))
  )

  // Build date → orders map from all successful query results
  const byDate = new Map<string, Order[]>()
  for (const result of weekQueries) {
    if (result.data) {
      for (const order of result.data) {
        const bucket = byDate.get(order.delivery_date) ?? []
        bucket.push(order)
        byDate.set(order.delivery_date, bucket)
      }
    }
  }

  // ── Initial scroll: show current week, preloaded prev week is offscreen left ─

  useEffect(() => {
    if (!boardRef.current) return
    boardRef.current.scrollLeft = INIT_PREV_WEEKS * 7 * COLUMN_STEP
    // Activate IO sentinels after the initial scroll settles
    requestAnimationFrame(() => {
      observerActiveRef.current = true
    })
  }, [])

  // ── Scroll-position fix after DOM mutations (prepend / trim-left / today reset) ─

  useLayoutEffect(() => {
    if (!boardRef.current) return
    const firstDay = days.length > 0 ? toDateStr(days[0]) : null

    if (pendingScrollTodayRef.current) {
      boardRef.current.scrollLeft = INIT_PREV_WEEKS * 7 * COLUMN_STEP
      pendingScrollTodayRef.current = false
      prevFirstDayRef.current = firstDay
      return
    }

    if (prevFirstDayRef.current && firstDay && firstDay !== prevFirstDayRef.current) {
      const prevMs = strToDate(prevFirstDayRef.current).getTime()
      const currMs = strToDate(firstDay).getTime()
      // Positive diff → days prepended (earlier start) → increase scrollLeft to stay in place
      // Negative diff → days trimmed from left (later start) → decrease scrollLeft
      const daysDiff = Math.round((prevMs - currMs) / 86_400_000)
      boardRef.current.scrollLeft += daysDiff * COLUMN_STEP
    }

    prevFirstDayRef.current = firstDay
  })

  // ── IntersectionObserver: load adjacent weeks as user scrolls ─────────────

  useEffect(() => {
    const board = boardRef.current
    const left  = leftSentinelRef.current
    const right = rightSentinelRef.current
    if (!board || !left || !right) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!observerActiveRef.current) return
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === left) {
            setLoadedWeeks(prev => {
              const newWeek = toDateStr(addDays(strToDate(prev[0]), -7))
              if (prev.includes(newWeek)) return prev
              const next = [newWeek, ...prev]
              // At cap: trim from right (user is scrolling left — future weeks are off-screen)
              return next.length > MAX_WEEKS ? next.slice(0, MAX_WEEKS) : next
            })
          } else if (entry.target === right) {
            setLoadedWeeks(prev => {
              const newWeek = toDateStr(addDays(strToDate(prev[prev.length - 1]), 7))
              if (prev.includes(newWeek)) return prev
              const next = [...prev, newWeek]
              // At cap: trim from left — scroll correction is handled by useLayoutEffect
              return next.length > MAX_WEEKS ? next.slice(next.length - MAX_WEEKS) : next
            })
          }
        }
      },
      { root: board, rootMargin: '0px 300px 0px 300px', threshold: 0 },
    )

    observer.observe(left)
    observer.observe(right)
    return () => observer.disconnect()
  }, [])

  // ── Scroll label: month/year of the center-visible column ────────────────

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      if (!boardRef.current) return
      const centerX  = boardRef.current.scrollLeft + boardRef.current.clientWidth / 2
      const colIndex = Math.min(Math.max(Math.floor(centerX / COLUMN_STEP), 0), days.length - 1)
      const center   = days[colIndex]
      if (center) {
        setScrollLabel(`${MONTH_ABBR[center.getMonth()]} ${center.getFullYear()}`)
      }
    })
  }, [days])

  // ── Today button ──────────────────────────────────────────────────────────

  const scrollToToday = useCallback(() => {
    const colIndex = days.findIndex(d => toDateStr(d) === todayStr)
    if (colIndex >= 0 && boardRef.current) {
      boardRef.current.scrollLeft = colIndex * COLUMN_STEP
    } else {
      // Today has scrolled out of the loaded range; reset to initial state
      setLoadedWeeks(initLoadedWeeks())
      pendingScrollTodayRef.current = true
    }
  }, [days, todayStr])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-[#F0F1F4] lg:h-dvh"
      style={{ height: 'calc(100dvh - 56px)' }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#D4D8E4] flex-shrink-0">

        <span className="text-[13px] font-semibold text-[#0A0F1E] flex-shrink-0 min-w-[72px]">
          {scrollLabel}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={scrollToToday}
          className="flex items-center px-2.5 py-1 border border-[#BCC2D0] rounded bg-[#F0F0EE] text-[12px] font-semibold text-[#2D3748] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors flex-shrink-0"
        >
          Today
        </button>

        {/* Contextual jump: delivery schedule → month workload */}
        <Link
          href="/calendar"
          aria-label="Open calendar"
          title="Calendar"
          className="w-[26px] h-[26px] flex items-center justify-center border border-[#BCC2D0] rounded bg-white text-[#2D3748] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </Link>

        {isFetching && (
          <div className="w-3.5 h-3.5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}

        <div className="flex items-center gap-1 bg-[rgba(200,149,42,0.10)] border border-[rgba(200,149,42,0.18)] rounded px-2 py-1 flex-shrink-0">
          <span className="text-[13px] font-extrabold text-[#C8952A] leading-none tabular-nums">{totalOrders}</span>
          <span className="text-[11px] font-bold text-[#6B6B67] hidden sm:inline"> ord</span>
        </div>
      </div>

      {/* ── Board body ───────────────────────────────────────────────────── */}
      <div
        ref={boardRef}
        className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-3"
        onScroll={handleScroll}
      >
        <div
          className="flex h-full"
          style={{ gap: `${COLUMN_GAP}px`, minWidth: 'max-content' }}
        >
          {/* Left sentinel — triggers prev-week load when near viewport */}
          <div ref={leftSentinelRef} className="w-0 flex-shrink-0 self-stretch" />

          {days.map((day) => {
            const dateStr = toDateStr(day)
            return (
              <DayColumn
                key={dateStr}
                date={day}
                orders={byDate.get(dateStr) ?? []}
                todayStr={todayStr}
                onOrderClick={openOrderDetail}
              />
            )
          })}

          {/* Right sentinel — triggers next-week load when near viewport */}
          <div ref={rightSentinelRef} className="w-0 flex-shrink-0 self-stretch" />
        </div>
      </div>
    </div>
  )
}
