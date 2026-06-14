'use client'

import { useState, useEffect } from 'react'
import type { Order } from '@/lib/api/orders'
import { getOrder } from '@/lib/api/orders'
import DrawerIdentity from './DrawerIdentity'
import DrawerTabs, { type DrawerTab } from './DrawerTabs'
import OverviewTab from './OverviewTab'
import MoreDetailsView from './MoreDetailsView'
import WorkTab from './WorkTab'
import MoneyTab from './MoneyTab'

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
  const [tab, setTab] = useState<DrawerTab>('overview')
  const [moreDetails, setMoreDetails] = useState(false)

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

  // A child mutation changed something the server derives (amount_paid / remaining /
  // payment_state / status). Re-fetch the drawer's own copy so read-only summaries (Overview
  // payment snapshot, attention card) reflect it — the mutating tab updates itself, but these
  // siblings read the order's derived fields. Then refresh the parent board. The mutation has
  // already persisted server-side, so a failed refetch must not break the drawer; it's caught
  // here (no unhandled rejection) and we keep showing the last-known order.
  async function handleUpdated() {
    try {
      const fresh = await getOrder(orderId)
      setOrder(fresh)
    } catch {
      // refetch failed — leave the current order in place rather than blanking the drawer
    }
    onUpdated()
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
          fixed z-50 bg-white flex flex-col overflow-hidden max-w-full
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
        ) : moreDetails ? (
          // Pushed secondary screen (VS-28 §0.4 progressive disclosure)
          <MoreDetailsView
            order={order}
            onOrderChange={handleOrderChange}
            onUpdated={handleUpdated}
            onBack={() => setMoreDetails(false)}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Persistent identity + tabs (VS-28 command screen) */}
            <DrawerIdentity order={order} />
            <DrawerTabs active={tab} onChange={setTab} />

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
              {tab === 'overview' && (
                <OverviewTab
                  order={order}
                  onOrderChange={handleOrderChange}
                  onUpdated={handleUpdated}
                  onViewPlan={() => setTab('money')}
                  onViewWork={() => setTab('work')}
                  onMoreDetails={() => setMoreDetails(true)}
                />
              )}

              {/* Work — photos + voice as one "Work Instructions" card (VS-28.2) */}
              {tab === 'work' && <WorkTab orderId={order.id} />}

              {/* Money — "Payment Plan" card around the VS-27.5 whole-plan editor (VS-28.3) */}
              {tab === 'money' && (
                <MoneyTab
                  order={order}
                  onOrderChange={handleOrderChange}
                  onUpdated={handleUpdated}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
