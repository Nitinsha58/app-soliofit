'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Order } from '@/lib/api/orders'
import { updateOrder } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import ActivityFeed from './ActivityFeed'
import DangerZone from './DangerZone'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
  onBack: () => void
  onClose: () => void
}

type EditField = 'delivery_date' | 'remarks' | null

// YYYY-MM-DD → human display (avoids UTC-offset shift from new Date("YYYY-MM-DD"))
function fmtDateStr(s: string) {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ISO datetime → human display (created_at)
function fmtDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function inr(s: string) {
  const n = parseFloat(s) || 0
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.36 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 7.18 7.18l1.27-.82a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

const STATUS_STYLE: Record<Order['status'], string> = {
  Booked: 'text-[#6B6B67] bg-[#F5F5F3]',
  Started: 'text-amber-700 bg-amber-50',
  Ready: 'text-emerald-700 bg-emerald-50',
  'Partial Delivery': 'text-amber-600 bg-amber-50',
  Delivered: 'text-[#9CA3AF] bg-[#F5F5F3]',
}

// VS-28.4 — More Details pushed screen. Secondary/admin content: customer details,
// order reference, delivery date + remarks (tap-to-edit / autosave / auto-collapse),
// activity, danger zone. Each field has its own timer + abort so saves are independent.
export default function MoreDetailsView({ order, onOrderChange, onUpdated, onBack, onClose }: Props) {
  const router = useRouter()
  const closeOrderDetail = useUIStore((s) => s.closeOrderDetail)

  const [editField, setEditField] = useState<EditField>(null)
  const [deliveryDate, setDeliveryDate] = useState(order.delivery_date)
  const [remarks, setRemarks] = useState(order.remarks)
  const [ddError, setDdError] = useState<string | null>(null)
  const [rmError, setRmError] = useState<string | null>(null)

  // Separate timer + abort per field so a save on one doesn't cancel the other.
  const ddTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ddAbortRef = useRef<AbortController | null>(null)
  const rmAbortRef = useRef<AbortController | null>(null)

  // Sync local state when the parent fetches a fresh order (e.g. after a sibling mutation).
  useEffect(() => {
    setDeliveryDate(order.delivery_date)
    setRemarks(order.remarks)
  }, [order.id])

  useEffect(() => {
    return () => {
      if (ddTimerRef.current) clearTimeout(ddTimerRef.current)
      if (rmTimerRef.current) clearTimeout(rmTimerRef.current)
      if (ddAbortRef.current) ddAbortRef.current.abort()
      if (rmAbortRef.current) rmAbortRef.current.abort()
    }
  }, [])

  // --- delivery date ---

  function handleDeliveryDateChange(value: string) {
    setDeliveryDate(value)
    setDdError(null)
    if (ddTimerRef.current) clearTimeout(ddTimerRef.current)
    ddTimerRef.current = setTimeout(() => saveDeliveryDate(value), 800)
  }

  async function saveDeliveryDate(value: string) {
    if (ddAbortRef.current) ddAbortRef.current.abort()
    const ctrl = new AbortController()
    ddAbortRef.current = ctrl
    try {
      await updateOrder(order.id, { delivery_date: value }, ctrl.signal)
      ddAbortRef.current = null
      onOrderChange({ delivery_date: value })
      onUpdated()
      setEditField((prev) => (prev === 'delivery_date' ? null : prev))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setDdError('Save failed — tap to retry.')
    }
  }

  // --- remarks ---

  function handleRemarksChange(value: string) {
    setRemarks(value)
    setRmError(null)
    if (rmTimerRef.current) clearTimeout(rmTimerRef.current)
    rmTimerRef.current = setTimeout(() => saveRemarks(value), 800)
  }

  async function saveRemarks(value: string) {
    if (rmAbortRef.current) rmAbortRef.current.abort()
    const ctrl = new AbortController()
    rmAbortRef.current = ctrl
    try {
      await updateOrder(order.id, { remarks: value }, ctrl.signal)
      rmAbortRef.current = null
      onOrderChange({ remarks: value })
      onUpdated()
      setEditField((prev) => (prev === 'remarks' ? null : prev))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setRmError('Save failed — tap to retry.')
    }
  }

  const orderNum = `#${String(order.order_number).padStart(4, '0')}`

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3 border-b border-[#E5E5E2] shrink-0">
        <button
          onClick={onBack}
          className="text-[#6B6B67] hover:text-[#1A1A18] transition-colors p-1 -ml-1"
          aria-label="Back to overview"
        >
          <BackIcon />
        </button>
        <h2 className="text-sm font-semibold text-[#1A1A18]">More details</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
        <div className="px-4 lg:px-5 py-4 space-y-3">

          {/* ── Customer card ── */}
          <div className="rounded-xl border border-[#E5E5E2] bg-white overflow-hidden">
            <p className="px-4 pt-3 pb-0.5 text-[10px] font-semibold text-[#A0A09C] uppercase tracking-wide">
              Customer
            </p>

            {/* Name → customer profile */}
            <button
              type="button"
              onClick={() => { closeOrderDetail(); router.push(`/customers/${order.customer}`) }}
              className="w-full flex items-center justify-between px-4 py-2.5 border-t border-[#F0F0EE] hover:bg-[#FAFAF8] transition-colors text-left"
            >
              <span className="text-[13px] font-semibold text-[#1A1A18] truncate">{order.customer_name}</span>
              <span className="flex items-center gap-0.5 text-[11px] text-[#A0A09C] shrink-0 ml-3">
                View customer <ChevronIcon />
              </span>
            </button>

            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-[#6B6B67] border-t border-[#F0F0EE] hover:bg-[#FAFAF8] transition-colors"
              >
                <PhoneIcon />
                {order.customer_phone}
              </a>
            )}

            {order.customer_address && (
              <p className="px-4 py-2.5 text-[13px] text-[#6B6B67] border-t border-[#F0F0EE] leading-snug">
                {order.customer_address}
              </p>
            )}
          </div>

          {/* ── Order details card ── */}
          <div className="rounded-xl border border-[#E5E5E2] bg-white overflow-hidden">
            <p className="px-4 pt-3 pb-0.5 text-[10px] font-semibold text-[#A0A09C] uppercase tracking-wide">
              Order details
            </p>

            {/* Status — neutral read-only */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#F0F0EE]">
              <span className="text-[12px] text-[#A0A09C]">Status</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[order.status]}`}>
                {order.status}
              </span>
            </div>

            {/* Order number + created date — quiet reference context */}
            <div className="flex items-center justify-between px-4 py-1.5 border-t border-[#F0F0EE]">
              <span className="text-[12px] text-[#A0A09C]">{orderNum}</span>
              {order.created_at && (
                <span className="text-[12px] text-[#C8C8C4]">Ordered {fmtDateTime(order.created_at)}</span>
              )}
            </div>

            {/* Delivery date — tap to edit */}
            <div className="px-4 py-2.5 border-t border-[#F0F0EE]">
              <p className="text-[10px] font-medium text-[#A0A09C] mb-1.5">Delivery date</p>
              {editField === 'delivery_date' ? (
                <>
                  <input
                    type="date"
                    value={deliveryDate}
                    autoFocus
                    onChange={(e) => handleDeliveryDateChange(e.target.value)}
                    className="w-full text-sm text-[#1A1A18] border border-[#E5E5E2] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#C8952A] focus:ring-1 focus:ring-[#C8952A]/30 transition-colors"
                  />
                  {ddError && <p className="mt-1 text-[11px] text-red-500">{ddError}</p>}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { setDdError(null); setEditField('delivery_date') }}
                  className="w-full flex items-center justify-between group"
                >
                  <span className="text-[13px] font-medium text-[#1A1A18]">{fmtDateStr(deliveryDate)}</span>
                  <span className="text-[11px] text-[#C8C8C4] group-hover:text-[#C8952A] transition-colors">
                    Tap to edit
                  </span>
                </button>
              )}
            </div>

            {/* Bill — read-only (VS-27.5 invariant: bill editable only inside Money tab) */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#F0F0EE]">
              <span className="text-[10px] font-medium text-[#A0A09C]">Bill</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[#1A1A18]">{inr(order.total_amount)}</span>
                <span className="text-[11px] text-[#C8C8C4]">· Edit in Money</span>
              </div>
            </div>
          </div>

          {/* ── Order note card ── */}
          <div className="rounded-xl border border-[#E5E5E2] bg-white overflow-hidden">
            <p className="px-4 pt-3 pb-0.5 text-[10px] font-semibold text-[#A0A09C] uppercase tracking-wide">
              Order note
            </p>
            <div className="px-4 py-2.5 border-t border-[#F0F0EE]">
              {editField === 'remarks' ? (
                <>
                  <textarea
                    rows={4}
                    value={remarks}
                    autoFocus
                    onChange={(e) => handleRemarksChange(e.target.value)}
                    placeholder="Internal notes about this order…"
                    className="w-full text-sm text-[#1A1A18] border border-[#E5E5E2] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#C8952A] focus:ring-1 focus:ring-[#C8952A]/30 transition-colors resize-none placeholder:text-[#C8C8C4]"
                  />
                  {rmError && <p className="mt-1 text-[11px] text-red-500">{rmError}</p>}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { setRmError(null); setEditField('remarks') }}
                  className="w-full flex items-start justify-between gap-3 group"
                >
                  <p className={`text-[13px] leading-relaxed text-left flex-1 ${remarks ? 'text-[#6B6B67]' : 'text-[#C8C8C4]'}`}>
                    {remarks || 'No note added'}
                  </p>
                  <span className="text-[11px] text-[#C8C8C4] group-hover:text-[#C8952A] transition-colors shrink-0">
                    Tap to edit
                  </span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Activity feed */}
        <ActivityFeed orderId={order.id} />

        {/* Danger zone — visually separated at the bottom */}
        <DangerZone order={order} onUpdated={onUpdated} onClose={onClose} />
      </div>
    </div>
  )
}
