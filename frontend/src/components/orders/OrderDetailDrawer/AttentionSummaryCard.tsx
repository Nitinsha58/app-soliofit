'use client'

import type { Order } from '@/lib/api/orders'

function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function RupeeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10" />
    </svg>
  )
}

// Urgency = delivery proximity (delivery is the job's deadline). Color = status only.
function urgency(order: Order): { label: string; tone: string } {
  if (order.status === 'Delivered') return { label: 'Delivered', tone: 'text-[#6B6B67]' }
  const [y, m, d] = order.delivery_date.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { label: `${-days}d overdue`, tone: 'text-red-500' }
  if (days === 0) return { label: 'Due today', tone: 'text-[#C8952A]' }
  if (days <= 3) return { label: `In ${days} day${days > 1 ? 's' : ''}`, tone: 'text-[#C8952A]' }
  return { label: `In ${days} days`, tone: 'text-[#6B6B67]' }
}

// Outstanding state from the derived payment fields. Color = status only.
function payment(order: Order): { amount: string; label: string; tone: string } {
  const remaining = parseFloat(order.remaining) || 0
  switch (order.payment_state) {
    case 'completed': return { amount: 'Paid in full', label: '', tone: 'text-green-700' }
    case 'overdue':   return { amount: fmt(remaining), label: 'overdue', tone: 'text-red-500' }
    case 'partial':   return { amount: fmt(remaining), label: 'pending', tone: 'text-[#C8952A]' }
    case 'pending':   return { amount: fmt(remaining), label: 'pending', tone: 'text-[#C8952A]' }
    default:          return { amount: 'No bill', label: '', tone: 'text-[#6B6B67]' }  // unbilled
  }
}

function fmtDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// A0 attention card: due + payment at a glance, computed so the user never has to calculate.
export default function AttentionSummaryCard({ order }: { order: Order }) {
  const u = urgency(order)
  const p = payment(order)

  return (
    <div className="flex items-stretch rounded-xl border border-[#E5E5E2] bg-white overflow-hidden">
      <div className="flex-1 flex items-center gap-2.5 px-3.5 py-3">
        <span className="w-8 h-8 rounded-full bg-[#FBF3E3] text-[#C8952A] flex items-center justify-center shrink-0">
          <CalendarIcon />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Due</p>
          <p className="text-sm font-semibold text-[#1A1A18] leading-tight truncate">{fmtDate(order.delivery_date)}</p>
          <p className={`text-[11px] font-medium ${u.tone}`}>{u.label}</p>
        </div>
      </div>

      <div className="w-px bg-[#E5E5E2]" />

      <div className="flex-1 flex items-center gap-2.5 px-3.5 py-3">
        <span className="w-8 h-8 rounded-full bg-[#F5F5F3] text-[#6B6B67] flex items-center justify-center shrink-0">
          <RupeeIcon />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Payment</p>
          <p className={`text-sm font-semibold leading-tight truncate ${p.tone}`}>{p.amount}</p>
          {p.label && <p className={`text-[11px] font-medium ${p.tone}`}>{p.label}</p>}
        </div>
      </div>
    </div>
  )
}
