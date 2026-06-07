'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import OrderCard from './OrderCard'

interface Props {
  order: Order
  disabled?: boolean
  /** Status accent applied as a brief ring after a drop confirms the move. */
  highlightColor?: string
}

export default function DraggableCard({ order, disabled = false, highlightColor }: Props) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
    disabled,
  })

  const style = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    ...(highlightColor
      ? { boxShadow: `0 0 0 2px ${highlightColor}`, borderRadius: '0.75rem', transition: 'box-shadow 0.4s ease-out' }
      : {}),
  }

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
