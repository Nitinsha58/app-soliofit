'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import OrderCard from './OrderCard'

interface Props {
  order: Order
  disabled?: boolean
}

export default function DraggableCard({ order, disabled = false }: Props) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? 'opacity-0' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <OrderCard
        order={order}
        onClick={() => openOrderDetail(order.id)}
      />
    </div>
  )
}
