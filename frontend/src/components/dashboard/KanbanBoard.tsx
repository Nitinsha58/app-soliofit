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
import SummaryStrip from './SummaryStrip'

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

    updateOrderStatus(orderId, newStatus).catch(() => {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: prevStatus } : o)),
      )
    })
  }

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SummaryStrip orders={orders} />

      {orders.length === 0 && (
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
          {COLUMNS.map(({ status, label, accent }) => (
            <KanbanColumn
              key={status}
              status={status}
              title={label}
              accent={accent}
              orders={orders.filter((o) => o.status === status)}
            />
          ))}
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
