import type { Order } from '@/lib/api/orders'
import OrderCard from './OrderCard'

interface Props {
  title: string
  dotColor: string
  orders: Order[]
}

export default function KanbanColumn({ title, dotColor, orders }: Props) {
  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      <div className="flex items-center gap-2 px-1 mb-3">
        <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
        <span className="text-sm font-semibold text-[#1A1A18]">{title}</span>
        <span className="ml-auto text-xs font-medium text-[#A0A09C] bg-[#F5F5F3] px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>

      <div className="space-y-3 min-h-[80px]">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center py-8 rounded-xl border border-dashed border-[#E5E5E2]">
            <p className="text-xs text-[#C8C8C4]">Empty</p>
          </div>
        ) : (
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  )
}
