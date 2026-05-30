'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Order } from '@/lib/api/orders'
import DraggableCard from './DraggableCard'

interface Props {
  status: Order['status']
  title: string
  accent: string
  orders: Order[]
}

export default function KanbanColumn({ status, title, accent, orders }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-72 flex-shrink-0 rounded-xl bg-[#F7F7F5] overflow-hidden transition-all"
      style={{
        boxShadow: isOver
          ? `inset 0 0 0 2px ${accent}`
          : 'inset 0 0 0 1px #E5E5E2',
      }}
    >
      {/* Colored top strip + header */}
      <div style={{ borderTop: `3px solid ${accent}` }} className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#1A1A18] tracking-tight">{title}</span>
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
            style={{ backgroundColor: `${accent}28`, color: accent }}
          >
            {orders.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="px-2.5 pb-3 space-y-2.5 min-h-[120px]">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center py-7 rounded-lg border border-dashed border-[#DCDCD8]">
            <p className="text-xs text-[#C8C8C4]">Empty</p>
          </div>
        ) : (
          orders.map((order) => <DraggableCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  )
}
