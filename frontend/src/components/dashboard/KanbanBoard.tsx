'use client'

import { useState, useEffect } from 'react'
import { listOrders, type Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import KanbanColumn from './KanbanColumn'

const COLUMNS: { status: Order['status']; label: string; dotColor: string }[] = [
  { status: 'Booked',           label: 'Booked',           dotColor: 'bg-blue-400' },
  { status: 'Started',          label: 'Started',          dotColor: 'bg-violet-400' },
  { status: 'Ready',            label: 'Ready',            dotColor: 'bg-emerald-400' },
  { status: 'Partial Delivery', label: 'Partial Delivery', dotColor: 'bg-amber-400' },
  { status: 'Delivered',        label: 'Delivered',        dotColor: 'bg-gray-400' },
]

export default function KanbanBoard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const ordersRefreshKey = useUIStore((s) => s.ordersRefreshKey)

  useEffect(() => {
    setLoading(true)
    listOrders()
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ordersRefreshKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalOrders = orders.length

  return (
    <div>
      {totalOrders === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center mb-4">
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
          {COLUMNS.map(({ status, label, dotColor }) => (
            <KanbanColumn
              key={status}
              title={label}
              dotColor={dotColor}
              orders={orders.filter((o) => o.status === status)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
