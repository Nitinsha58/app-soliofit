'use client'

import { useEffect, useState } from 'react'

export interface QuickDateInputProps {
  value: string                 // 'YYYY-MM-DD', '', or malformed → defensive fallback
  onChange: (iso: string) => void
  deliveryDate?: string         // default-base fallback when value is empty/invalid
  disabled?: boolean            // read-only render (paid/locked rows — VS-27.5)
  ariaLabel?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Parts { y: number; m: number; d: number }   // m is 1-12

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function daysInMonth(year: number, month: number): number {
  // month is 1-12; day 0 of the next month is the last day of this one.
  return new Date(year, month, 0).getDate()
}

// Parse 'YYYY-MM-DD' into parts, or null if it is not a real calendar date.
function parseISO(s: string | undefined): Parts | null {
  if (!s) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

function todayParts(): Parts {
  const t = new Date()
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
}

function toISO(p: Parts): string {
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

// Defensive base: value → deliveryDate → today. Never yields an invalid date.
function resolveBase(value: string, deliveryDate?: string): Parts {
  return parseISO(value) ?? parseISO(deliveryDate) ?? todayParts()
}

const SELECT_CLS =
  'px-2 py-2 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none ' +
  'focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A] disabled:opacity-50'

export default function QuickDateInput({
  value,
  onChange,
  deliveryDate,
  disabled = false,
  ariaLabel = 'Due date',
}: QuickDateInputProps) {
  const base = resolveBase(value, deliveryDate)
  const [showYear, setShowYear] = useState(false)

  // If the incoming value isn't a valid ISO date, sync the parent to the resolved base so
  // the displayed date is authoritative and we never hold/emit an Invalid Date. Runs only
  // when value/deliveryDate change; once value is valid it no longer fires (no loop).
  useEffect(() => {
    if (!disabled && !parseISO(value)) {
      onChange(toISO(resolveBase(value, deliveryDate)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, deliveryDate, disabled])

  // Emit a new date, clamping the day to the target month/year's last valid day
  // (e.g. 31 Jan → switch to Feb → 28/29).
  function emit(next: Parts) {
    onChange(toISO({ ...next, d: Math.min(next.d, daysInMonth(next.y, next.m)) }))
  }

  const { y, m, d } = base

  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-[#6B6B67] tabular-nums" aria-label={ariaLabel}>
        {d} {MONTHS[m - 1]} {y}
      </span>
    )
  }

  const dayOptions = Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1)

  return (
    <div className="inline-flex items-center gap-1.5" aria-label={ariaLabel}>
      <select
        value={d}
        onChange={(e) => emit({ y, m, d: Number(e.target.value) })}
        className={SELECT_CLS}
        aria-label="Day"
      >
        {dayOptions.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <select
        value={m}
        onChange={(e) => emit({ y, m: Number(e.target.value), d })}
        className={SELECT_CLS}
        aria-label="Month"
      >
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>{label}</option>
        ))}
      </select>

      {/* Year stays quiet — a muted chip that reveals a compact stepper on tap. */}
      {showYear ? (
        <span
          className="inline-flex items-center gap-1.5 text-sm text-[#6B6B67]"
          // Collapse back to the quiet chip once focus leaves the stepper, while
          // still allowing repeated ‹/› taps to step multiple years.
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowYear(false)
          }}
        >
          <button
            type="button"
            onClick={() => emit({ y: y - 1, m, d })}
            className="w-5 h-5 flex items-center justify-center rounded text-[#A0A09C] hover:text-[#C8952A] hover:bg-[#FBF3E3] transition-colors"
            aria-label="Previous year"
          >
            ‹
          </button>
          <span className="tabular-nums font-medium text-[#1A1A18]">{y}</span>
          <button
            type="button"
            onClick={() => emit({ y: y + 1, m, d })}
            className="w-5 h-5 flex items-center justify-center rounded text-[#A0A09C] hover:text-[#C8952A] hover:bg-[#FBF3E3] transition-colors"
            aria-label="Next year"
          >
            ›
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setShowYear(true)}
          className="text-xs text-[#A0A09C] hover:text-[#C8952A] transition-colors tabular-nums px-0.5"
          aria-label={`Year ${y}, tap to change`}
        >
          · {y}
        </button>
      )}
    </div>
  )
}
