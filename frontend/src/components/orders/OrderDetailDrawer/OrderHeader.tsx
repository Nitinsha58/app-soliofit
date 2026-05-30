'use client'

import { useState } from 'react'
import type { Order } from '@/lib/api/orders'
import { ORDER_STATUSES, updateOrder } from '@/lib/api/orders'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
}

const STATUS_COLORS: Record<Order['status'], string> = {
  'Booked':           'bg-blue-50 text-blue-700 border-blue-200',
  'Started':          'bg-violet-50 text-violet-700 border-violet-200',
  'Ready':            'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partial Delivery': 'bg-amber-50 text-amber-700 border-amber-200',
  'Delivered':        'bg-gray-100 text-gray-600 border-gray-200',
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.36 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 7.18 7.18l1.27-.82a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export default function OrderHeader({ order, onOrderChange, onUpdated }: Props) {
  const [statusChanging, setStatusChanging] = useState(false)

  async function handleStatusChange(newStatus: Order['status']) {
    setStatusChanging(true)
    try {
      await updateOrder(order.id, { status: newStatus })
      onOrderChange({ status: newStatus })
      onUpdated()
    } finally {
      setStatusChanging(false)
    }
  }

  async function handlePriorityToggle() {
    const newPriority = !order.priority
    await updateOrder(order.id, { priority: newPriority })
    onOrderChange({ priority: newPriority })
    onUpdated()
  }

  return (
    <div className="px-5 pt-5 pb-4 border-b border-[#E5E5E2]">
      {/* Order number */}
      <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-1">
        #{String(order.order_number).padStart(4, '0')}
      </p>

      {/* Customer name */}
      <h2 className="text-lg font-bold text-[#1A1A18] leading-tight">{order.customer_name}</h2>

      {/* Phone */}
      {order.customer_phone && (
        <a
          href={`tel:${order.customer_phone}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#6B6B67] hover:text-[#C8952A] transition-colors mt-1"
        >
          <PhoneIcon />
          {order.customer_phone}
        </a>
      )}

      {/* Status + Priority row */}
      <div className="flex items-center gap-2 mt-3">
        <select
          value={order.status}
          disabled={statusChanging}
          onChange={(e) => handleStatusChange(e.target.value as Order['status'])}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer appearance-none pr-6 ${STATUS_COLORS[order.status]} disabled:opacity-60`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236B6B67' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          onClick={handlePriorityToggle}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
            order.priority
              ? 'bg-amber-50 text-[#C8952A] border-amber-200'
              : 'bg-[#F5F5F3] text-[#A0A09C] border-[#E5E5E2] hover:border-amber-200 hover:text-[#C8952A]'
          }`}
        >
          <StarIcon filled={order.priority} />
          {order.priority ? 'Priority' : 'Normal'}
        </button>
      </div>
    </div>
  )
}
