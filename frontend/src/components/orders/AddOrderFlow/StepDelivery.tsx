'use client'

import { useState, useEffect } from 'react'
import { getDeliveryLoad } from '@/lib/api/orders'

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

function loadColor(count: number): string {
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

export default function StepDelivery({ value, onChange, onNext, onBack }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [load, setLoad] = useState<Record<string, number>>({})

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  useEffect(() => {
    const from = `${viewYear}-${pad(viewMonth + 1)}-01`
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const to = `${viewYear}-${pad(viewMonth + 1)}-${pad(daysInMonth)}`
    getDeliveryLoad(from, to).then(setLoad).catch(() => {})
  }, [viewYear, viewMonth])

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
                relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs font-medium transition-colors
                ${isSelected ? 'bg-[#C8952A] text-white' : ''}
                ${!isSelected && !isPast ? 'hover:bg-gray-100 text-[#1A1A18] cursor-pointer' : ''}
                ${isPast ? 'text-[#C8C8C4] cursor-not-allowed' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-[#C8952A] ring-inset' : ''}
              `}
            >
              <span>{day}</span>
              {count > 0 && !isSelected && !isPast && (
                <span className={`text-[8px] font-semibold leading-none mt-0.5 ${loadColor(count)}`}>
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
