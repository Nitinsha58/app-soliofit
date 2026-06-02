'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { listOrders, updateOrderStatus, type Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import KanbanColumn from './KanbanColumn'
import OrderCard from './OrderCard'
import SummaryStrip, { type ActiveFilter } from './SummaryStrip'

const COLUMNS: { status: Order['status']; label: string; accent: string }[] = [
  { status: 'Booked',           label: 'Booked',           accent: '#60A5FA' },
  { status: 'Started',          label: 'Started',          accent: '#A78BFA' },
  { status: 'Ready',            label: 'Ready',            accent: '#34D399' },
  { status: 'Partial Delivery', label: 'Partial Delivery', accent: '#FBBF24' },
  { status: 'Delivered',        label: 'Delivered',        accent: '#9CA3AF' },
]

export default function KanbanBoard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set())
  const [showDelivered, setShowDelivered] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null)
  const ordersRefreshKey = useUIStore((s) => s.ordersRefreshKey)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  useEffect(() => {
    setLoading(true)
    listOrders()
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ordersRefreshKey])

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const orderId = active.id as string
    const newStatus = over.id as Order['status']
    const order = orders.find((o) => o.id === orderId)
    if (!order || order.status === newStatus) return

    const prevStatus = order.status

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    )
    setMutatingIds((prev) => new Set(Array.from(prev).concat(orderId)))

    updateOrderStatus(orderId, newStatus)
      .catch(() => {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: prevStatus } : o)),
        )
      })
      .finally(() => {
        setMutatingIds((prev) => {
          const next = new Set(prev)
          next.delete(orderId)
          return next
        })
      })
  }

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null
  const deliveredCount = orders.filter((o) => o.status === 'Delivered').length

  function filterOrders(all: Order[]): Order[] {
    if (!activeFilter) return all
    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    const plus7 = new Date(today)
    plus7.setDate(today.getDate() + 7)
    const plus7Str = `${plus7.getFullYear()}-${pad(plus7.getMonth() + 1)}-${pad(plus7.getDate())}`
    switch (activeFilter) {
      case 'today':
        return all.filter((o) => o.delivery_date === todayStr && o.status !== 'Delivered')
      case 'upcoming':
        return all.filter((o) => o.delivery_date > todayStr && o.delivery_date <= plus7Str && o.status !== 'Delivered')
      case 'delayed':
        return all.filter((o) => o.delivery_date < todayStr && o.status !== 'Delivered')
    }
  }

  const displayOrders = filterOrders(orders)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SummaryStrip activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {orders.length === 0 && !activeFilter && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="text-[#C8C8C4] mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <p className="text-sm font-medium text-[#6B6B67]">No orders yet</p>
          <p className="text-xs text-[#A0A09C] mt-1">Create your first order to get started</p>
        </div>
      )}

      <div className="overflow-x-auto pb-4 -mx-6 px-6">
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map(({ status, label, accent }) => {
            const isDeliveredCol = status === 'Delivered'
            if (isDeliveredCol && !showDelivered) {
              return (
                <div
                  key={status}
                  className="flex flex-col w-72 flex-shrink-0 rounded-xl bg-[#F7F7F5] overflow-hidden"
                  style={{ boxShadow: 'inset 0 0 0 1px #E5E5E2' }}
                >
                  <div style={{ borderTop: '3px solid #9CA3AF' }} className="px-3 pt-3 pb-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[#A0A09C] tracking-tight">{label}</span>
                      <button
                        onClick={() => setShowDelivered(true)}
                        className="text-[11px] font-semibold text-[#A0A09C] hover:text-[#6B6B67] bg-[#9CA3AF28] px-2 py-0.5 rounded-full transition-colors"
                      >
                        Show {deliveredCount > 0 ? `(${deliveredCount})` : ''}
                      </button>
                    </div>
                  </div>
                  <div className="px-2.5 pb-3">
                    <div className="flex items-center justify-center py-7 rounded-lg border border-dashed border-[#DCDCD8]">
                      <p className="text-xs text-[#C8C8C4]">Hidden</p>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <KanbanColumn
                key={status}
                status={status}
                title={label}
                accent={accent}
                orders={displayOrders.filter((o) => o.status === status)}
                mutatingIds={mutatingIds}
                headerAction={isDeliveredCol ? (
                  <button
                    onClick={() => setShowDelivered(false)}
                    className="text-[11px] font-semibold text-[#A0A09C] hover:text-[#6B6B67] transition-colors"
                  >
                    Hide
                  </button>
                ) : undefined}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOrder ? (
          <div className="rotate-1 shadow-2xl opacity-95 w-72">
            <OrderCard order={activeOrder} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
