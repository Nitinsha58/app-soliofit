'use client'

import { useState, useRef, useEffect } from 'react'
import type { Order } from '@/lib/api/orders'
import { updateOrderStatus } from '@/lib/api/orders'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
}

interface ActionButton {
  label: string
  icon: React.ReactNode
  live: boolean
  variant?: 'default' | 'danger'
  onClick?: () => void
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function PhotoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  )
}

function PaymentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

export default function QuickActions({ order, onOrderChange, onUpdated }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [deliveryError, setDeliveryError] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  async function handleMarkDelivered() {
    if (mountedRef.current) { setDelivering(true); setDeliveryError(false) }
    try {
      await updateOrderStatus(order.id, 'Delivered')
      onUpdated()
      if (!mountedRef.current) return
      onOrderChange({ status: 'Delivered' })
      setConfirming(false)
    } catch {
      if (mountedRef.current) setDeliveryError(true)
    } finally {
      if (mountedRef.current) setDelivering(false)
    }
  }

  const isDelivered = order.status === 'Delivered'

  const actions: ActionButton[] = [
    {
      label: 'Photos',
      icon: <PhotoIcon />,
      live: false,
    },
    {
      label: 'Voice',
      icon: <MicIcon />,
      live: false,
    },
    {
      label: 'Payment',
      icon: <PaymentIcon />,
      live: false,
    },
    {
      label: isDelivered ? 'Delivered' : 'Mark Delivered',
      icon: <CheckIcon />,
      live: true,
      variant: 'danger',
      onClick: () => setConfirming(true),
    },
  ]

  return (
    <div className="px-5 py-3 border-b border-[#E5E5E2]">
      <div className="flex items-center gap-2">
        {actions.map(({ label, icon, live, variant, onClick }) => (
          <button
            key={label}
            onClick={live ? onClick : undefined}
            disabled={!live || isDelivered}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              !live || isDelivered
                ? 'text-[#C8C8C4] border-[#EBEBEA] bg-[#FAFAF9] cursor-not-allowed'
                : variant === 'danger'
                ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer'
                : 'text-[#6B6B67] border-[#E5E5E2] bg-white hover:bg-[#F5F5F3] cursor-pointer'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Mark Delivered confirm dialog */}
      {confirming && (
        <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 border ${deliveryError ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-xs font-medium flex-1 ${deliveryError ? 'text-red-700' : 'text-emerald-800'}`}>
            {deliveryError ? 'Failed to update — try again?' : 'Mark this order as Delivered?'}
          </p>
          <button
            onClick={() => { setConfirming(false); setDeliveryError(false) }}
            className="text-xs text-[#6B6B67] hover:text-[#1A1A18] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMarkDelivered}
            disabled={delivering}
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md transition-colors disabled:opacity-60"
          >
            {delivering ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}
