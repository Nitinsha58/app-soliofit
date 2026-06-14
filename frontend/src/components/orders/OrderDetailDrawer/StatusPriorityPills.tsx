'use client'

import { useState, useRef, useEffect } from 'react'
import type { Order } from '@/lib/api/orders'
import { ORDER_STATUSES, updateOrder, updateOrderStatus } from '@/lib/api/orders'
import { STATUS_PILL_BORDERED } from '@/lib/orderStatus'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// Status (pill dropdown — every transition incl. Partial Delivery) + priority toggle.
// The stage-aware *guided* next step lives in PrimaryAction; this pill is the manual override.
export default function StatusPriorityPills({ order, onOrderChange, onUpdated }: Props) {
  const [statusChanging, setStatusChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  function showError(msg: string) {
    if (!mountedRef.current) return
    setError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => { if (mountedRef.current) setError(null) }, 3000)
  }

  async function handleStatusChange(newStatus: Order['status']) {
    if (mountedRef.current) setStatusChanging(true)
    try {
      await updateOrderStatus(order.id, newStatus)
      onUpdated()
      if (!mountedRef.current) return
      onOrderChange({ status: newStatus })
    } catch {
      showError('Status update failed')
    } finally {
      if (mountedRef.current) setStatusChanging(false)
    }
  }

  async function handlePriorityToggle() {
    const newPriority = !order.priority
    try {
      await updateOrder(order.id, { priority: newPriority })
      onUpdated()
      if (!mountedRef.current) return
      onOrderChange({ priority: newPriority })
    } catch {
      showError('Priority update failed')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={order.status}
          disabled={statusChanging}
          onChange={(e) => handleStatusChange(e.target.value as Order['status'])}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer appearance-none pr-6 ${STATUS_PILL_BORDERED[order.status]} disabled:opacity-60`}
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
      {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
    </div>
  )
}
