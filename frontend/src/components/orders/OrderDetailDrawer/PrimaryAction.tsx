'use client'

import { useState, useRef, useEffect } from 'react'
import type { Order } from '@/lib/api/orders'
import { updateOrderStatus } from '@/lib/api/orders'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
}

// Stage-aware guided next step (VS-28 §0.7 — one dominant action). Partial Delivery is NOT a
// guided step from Ready; it's only reachable via the status pill. Delivered → no primary.
const NEXT: Partial<Record<Order['status'], { label: string; to: Order['status']; confirm: boolean }>> = {
  'Booked':           { label: 'Start work',     to: 'Started',   confirm: false },
  'Started':          { label: 'Mark Ready',     to: 'Ready',     confirm: false },
  'Ready':            { label: 'Mark Delivered',  to: 'Delivered', confirm: true },
  'Partial Delivery': { label: 'Mark Delivered',  to: 'Delivered', confirm: true },
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export default function PrimaryAction({ order, onOrderChange, onUpdated }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const step = NEXT[order.status]

  // Delivered (or any status without a guided next step): quiet terminal state, no action.
  if (!step) {
    return (
      <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-500">
        <CheckIcon /> Delivered
      </div>
    )
  }

  async function commit() {
    if (!step) return
    if (mountedRef.current) { setSaving(true); setError(false) }
    try {
      await updateOrderStatus(order.id, step.to)
      onUpdated()
      if (!mountedRef.current) return
      onOrderChange({ status: step.to })
      setConfirming(false)
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  function onClick() {
    if (step!.confirm) setConfirming(true)
    else commit()
  }

  const isDeliver = step.to === 'Delivered'

  return (
    <div>
      <button
        onClick={onClick}
        disabled={saving && !step.confirm}
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
          isDeliver ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#C8952A] hover:bg-[#A87820]'
        }`}
      >
        {isDeliver ? <CheckIcon /> : <ArrowIcon />}
        {saving && !step.confirm ? 'Saving…' : step.label}
      </button>

      {confirming && (
        <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5 border ${error ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-xs font-medium flex-1 ${error ? 'text-red-700' : 'text-emerald-800'}`}>
            {error ? 'Failed to update — try again?' : 'Mark this order as Delivered?'}
          </p>
          <button
            onClick={() => { setConfirming(false); setError(false) }}
            className="text-xs text-[#6B6B67] hover:text-[#1A1A18] border border-[#E5E5E2] bg-white px-3 py-1.5 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={saving}
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}
