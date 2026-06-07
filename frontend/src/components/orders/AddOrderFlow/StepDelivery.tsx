'use client'

import { useState, useEffect } from 'react'
import { getDeliveryLoad } from '@/lib/api/orders'
import { getOrderSettings } from '@/lib/api/auth'

const HIGH_LOAD = 13 // matches the red cell threshold below — triggers the soft confirm

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  value: string
  onChange: (date: string) => void
  onNext: () => void
  onBack: () => void
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function cellBg(count: number): string {
  if (count === 0) return ''
  if (count <= 5) return 'bg-emerald-50'
  if (count <= 12) return 'bg-amber-50'
  return 'bg-red-50'
}

function countColor(count: number): string {
  if (count <= 5) return 'text-emerald-600'
  if (count <= 12) return 'text-amber-600'
  return 'text-red-600'
}

function loadBgWhenSelected(count: number): string {
  if (count === 0) return 'text-[#6B6B67]'
  if (count <= 5) return 'text-emerald-700'
  if (count <= 12) return 'text-amber-700'
  return 'text-red-700'
}

function loadLabel(count: number, dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  if (count === 0) return `${label} — no other orders`
  if (count <= 5) return `${label} — ${count} order${count === 1 ? '' : 's'}`
  if (count <= 12) return `${label} — ${count} orders, moderate load`
  return `${label} — ${count} orders ⚠ High load`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function StepDelivery({ value, onChange, onNext, onBack }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [load, setLoad] = useState<Record<string, number>>({})
  const [capacity, setCapacity] = useState(6)
  const [bufferDays, setBufferDays] = useState(0)
  const [suggested, setSuggested] = useState<{ date: string; count: number } | null>(null)

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  useEffect(() => {
    const from = `${viewYear}-${pad(viewMonth + 1)}-01`
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const to = `${viewYear}-${pad(viewMonth + 1)}-${pad(daysInMonth)}`
    getDeliveryLoad(from, to).then(setLoad).catch(() => {})
  }, [viewYear, viewMonth])

  // O4: recommend the nearest date ≥ today + buffer with spare capacity
  // (load < daily_capacity). Scans a 6-week forward window from the buffer start.
  useEffect(() => {
    let cancelled = false
    getOrderSettings()
      .then(({ daily_capacity, delivery_buffer_days }) => {
        if (cancelled) return
        setCapacity(daily_capacity)
        setBufferDays(delivery_buffer_days)
        const start = addDays(today, delivery_buffer_days)
        const startStr = toDateStr(start.getFullYear(), start.getMonth(), start.getDate())
        const end = addDays(start, 42)
        const endStr = toDateStr(end.getFullYear(), end.getMonth(), end.getDate())
        getDeliveryLoad(startStr, endStr)
          .then((window) => {
            if (cancelled) return
            for (let i = 0; i <= 42; i++) {
              const d = addDays(start, i)
              const ds = toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
              const count = window[ds] ?? 0
              if (count < daily_capacity) {
                setSuggested({ date: ds, count })
                return
              }
            }
            setSuggested(null)
          })
          .catch(() => {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function selectDate(dateStr: string) {
    const [y, m] = dateStr.split('-').map(Number)
    setViewYear(y)
    setViewMonth(m - 1)
    onChange(dateStr)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  function getCalendarDays(): (number | null)[] {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
    const startOffset = (firstDayOfWeek + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }

  const days = getCalendarDays()
  const selectedLoad = value ? (load[value] ?? 0) : null

  return (
    <div>
      <p className="text-xs text-[#6B6B67] mb-4">Select a delivery date</p>

      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-[#6B6B67]">
          <ChevronLeft />
        </button>
        <span className="text-sm font-semibold text-[#1A1A18]">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-[#6B6B67]">
          <ChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-[#A0A09C] py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const dateStr = toDateStr(viewYear, viewMonth, day)
          const count = load[dateStr] ?? 0
          const isSelected = dateStr === value
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr

          return (
            <button
              key={dateStr}
              onClick={() => !isPast && onChange(dateStr)}
              disabled={isPast}
              className={`
                relative flex flex-col items-center justify-center rounded-lg py-2 text-xs font-medium transition-all
                ${isSelected ? 'bg-[#C8952A] text-white' : ''}
                ${!isSelected && !isPast ? `cursor-pointer hover:brightness-95 text-[#1A1A18] ${cellBg(count)}` : ''}
                ${isPast ? 'text-[#C8C8C4] cursor-not-allowed' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-[#C8952A] ring-inset' : ''}
              `}
            >
              <span className="leading-none">{day}</span>
              {count > 0 && !isSelected && !isPast && (
                <span className={`text-[9px] font-bold leading-none mt-0.5 ${countColor(count)}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {value && selectedLoad !== null && (
        <p className={`mt-3 text-xs text-center font-medium ${loadBgWhenSelected(selectedLoad)}`}>
          {loadLabel(selectedLoad, value)}
        </p>
      )}

      {/* O4 recommendation — nearest date with spare capacity */}
      {suggested && suggested.date !== value && (
        <button
          type="button"
          onClick={() => selectDate(suggested.date)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium py-2 hover:bg-emerald-100 transition-colors"
        >
          <span>💡</span>
          Suggested: {new Date(suggested.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' '}— {suggested.count} of {capacity} capacity{bufferDays > 0 ? `, ${bufferDays}+ days out` : ''}
        </button>
      )}

      {/* O4 soft confirm — heavy-load day selected (non-blocking) */}
      {value && selectedLoad !== null && selectedLoad >= HIGH_LOAD && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
          <p className="font-medium">This day is heavily loaded ({selectedLoad} orders).</p>
          {suggested && suggested.date !== value && (
            <button
              type="button"
              onClick={() => selectDate(suggested.date)}
              className="mt-1 underline font-medium hover:text-amber-900"
            >
              Use the suggested date instead
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!value}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
