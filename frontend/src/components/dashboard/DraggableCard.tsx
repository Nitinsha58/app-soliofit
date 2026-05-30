'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Order } from '@/lib/api/orders'
import OrderCard from './OrderCard'

interface Props {
  order: Order
}

export default function DraggableCard({ order }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
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
      className={isDragging ? 'opacity-0' : 'touch-none'}
    >
      <OrderCard order={order} />
    </div>
  )
}
