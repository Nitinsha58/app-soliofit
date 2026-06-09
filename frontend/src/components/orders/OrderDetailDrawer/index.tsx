'use client'

import { useState, useEffect } from 'react'
import type { Order } from '@/lib/api/orders'
import { getOrder } from '@/lib/api/orders'
import OrderHeader from './OrderHeader'
import QuickActions from './QuickActions'
import OrderInfoSection from './OrderInfoSection'
import PhotoSection from './PhotoSection'
import VoiceSection from './VoiceSection'
import ActivityFeed from './ActivityFeed'
import DangerZone from './DangerZone'

interface Props {
  orderId: string
  onClose: () => void
  onUpdated: () => void
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}


export default function OrderDetailDrawer({ orderId, onClose, onUpdated }: Props) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    getOrder(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId])

  function handleOrderChange(updates: Partial<Order>) {
    setOrder((prev) => prev ? { ...prev, ...updates } : prev)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Drawer — full screen mobile, right panel desktop */}
      <div
        className={`
          fixed z-50 bg-white flex flex-col
          inset-0
          lg:inset-auto lg:right-0 lg:top-0 lg:bottom-0 lg:w-[460px] lg:border-l lg:border-[#E5E5E2] lg:shadow-2xl
          transition-transform duration-200
          ${visible
            ? 'translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
          }
        `}
      >
        {/* Close button — positioned top-right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-[#A0A09C] hover:text-[#1A1A18] transition-colors p-1"
        >
          <XIcon />
        </button>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !order ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#A0A09C]">Order not found</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <OrderHeader
              order={order}
              onOrderChange={handleOrderChange}
              onUpdated={onUpdated}
            />
            <QuickActions
              order={order}
              onOrderChange={handleOrderChange}
              onUpdated={onUpdated}
            />
            <OrderInfoSection
              order={order}
              onOrderChange={handleOrderChange}
              onUpdated={onUpdated}
            />

            {/* Deferred sections. id anchors are the scroll targets for the
                QuickActions shortcuts; scroll-mt gives a little breathing room. */}
            <div className="pt-1">
              <div id="order-photos" className="scroll-mt-3">
                <PhotoSection orderId={order.id} />
              </div>
              <div id="order-voice" className="scroll-mt-3">
                <VoiceSection orderId={order.id} />
              </div>
              <ActivityFeed orderId={order.id} />
            </div>

            <DangerZone order={order} onUpdated={onUpdated} onClose={onClose} />
          </div>
        )}
      </div>
    </>
  )
}
