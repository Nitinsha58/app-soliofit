'use client'

import { useState, useEffect, useRef } from 'react'
import type { Order } from '@/lib/api/orders'
import { updateOrder } from '@/lib/api/orders'
import PaymentSchedule from './PaymentSchedule'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface FormState {
  delivery_date: string
  total_amount: string
  remarks: string
}

export default function OrderInfoSection({ order, onOrderChange, onUpdated }: Props) {
  const [form, setForm] = useState<FormState>({
    delivery_date: order.delivery_date,
    total_amount: order.total_amount,
    remarks: order.remarks,
  })
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pendingFormRef = useRef<FormState | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Flush any pending debounced save on unmount
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        if (pendingFormRef.current) doSave(pendingFormRef.current)
      }
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setForm({
      delivery_date: order.delivery_date,
      total_amount: order.total_amount,
      remarks: order.remarks,
    })
  }, [order.id])

  function scheduleAutosave(updates: Partial<FormState>) {
    const next = { ...form, ...updates }
    setForm(next)
    pendingFormRef.current = next
    onOrderChange({
      delivery_date: next.delivery_date,
      total_amount: next.total_amount,
      remarks: next.remarks,
    })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      pendingFormRef.current = null
      doSave(next)
    }, 800)
  }

  async function doSave(data: FormState) {
    // Abort any in-flight save — prevents older PATCH from landing after a newer one
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    if (mountedRef.current) setSaveState('saving')
    try {
      await updateOrder(order.id, {
        delivery_date: data.delivery_date,
        total_amount: data.total_amount,
        remarks: data.remarks,
      }, controller.signal)
      abortControllerRef.current = null
      onUpdated()
      if (!mountedRef.current) return
      setSaveState('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      if (!mountedRef.current) return
      setSaveState('error')
    }
  }

  return (
    <div className="px-5 py-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest">
          Order Information
        </h3>
        {saveState === 'saving' && (
          <span className="text-[11px] text-[#A0A09C] flex items-center gap-1">
            <span className="w-2.5 h-2.5 border border-[#A0A09C] border-t-transparent rounded-full animate-spin inline-block" />
            Saving…
          </span>
        )}
        {saveState === 'saved' && (
          <span className="text-[11px] text-emerald-600 font-medium">Saved ✓</span>
        )}
        {saveState === 'error' && (
          <span className="text-[11px] text-red-500">Save failed</span>
        )}
      </div>

      <div className="space-y-4">
        {/* Delivery date */}
        <div>
          <label className="block text-xs font-medium text-[#6B6B67] mb-1.5">Delivery Date</label>
          <input
            type="date"
            value={form.delivery_date}
            onChange={(e) => scheduleAutosave({ delivery_date: e.target.value })}
            className="w-full text-sm text-[#1A1A18] border border-[#E5E5E2] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#C8952A] focus:ring-1 focus:ring-[#C8952A]/30 transition-colors"
          />
        </div>

        {/* Total amount */}
        <div>
          <label className="block text-xs font-medium text-[#6B6B67] mb-1.5">Bill Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#A0A09C] font-medium select-none">₹</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.total_amount}
              onChange={(e) => scheduleAutosave({ total_amount: e.target.value })}
              className="w-full text-sm text-[#1A1A18] border border-[#E5E5E2] rounded-lg pl-7 pr-3 py-2 bg-white focus:outline-none focus:border-[#C8952A] focus:ring-1 focus:ring-[#C8952A]/30 transition-colors"
            />
          </div>
        </div>

        {/* Payment schedule — reactive to bill amount typed above */}
        <PaymentSchedule
          orderId={order.id}
          billAmount={parseFloat(form.total_amount) || 0}
        />

        {/* Customer address (read-only) */}
        {order.customer_address && (
          <div>
            <label className="block text-xs font-medium text-[#6B6B67] mb-1.5">Address</label>
            <p className="text-sm text-[#6B6B67] bg-[#F5F5F3] rounded-lg px-3 py-2">{order.customer_address}</p>
          </div>
        )}

        {/* Remarks */}
        <div>
          <label className="block text-xs font-medium text-[#6B6B67] mb-1.5">Remarks</label>
          <textarea
            rows={3}
            value={form.remarks}
            onChange={(e) => scheduleAutosave({ remarks: e.target.value })}
            placeholder="Internal notes about this order…"
            className="w-full text-sm text-[#1A1A18] border border-[#E5E5E2] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#C8952A] focus:ring-1 focus:ring-[#C8952A]/30 transition-colors resize-none placeholder:text-[#C8C8C4]"
          />
        </div>
      </div>
    </div>
  )
}
