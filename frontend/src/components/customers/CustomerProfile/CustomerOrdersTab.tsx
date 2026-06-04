'use client'

import { useQuery } from '@tanstack/react-query'
import { listOrders } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'

const STATUS_COLORS: Record<string, string> = {
  'Booked':           'bg-blue-50 text-blue-700',
  'Started':          'bg-violet-50 text-violet-700',
  'Ready':            'bg-emerald-50 text-emerald-700',
  'Partial Delivery': 'bg-amber-50 text-amber-700',
  'Delivered':        'bg-gray-100 text-gray-500',
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmount(s: string) {
  const n = parseFloat(s) || 0
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000) return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export default function CustomerOrdersTab({ customerId }: { customerId: string }) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)

  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: () => listOrders({ customerId }),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-[#6B6B67]">No orders yet</p>
        <p className="text-xs text-[#A0A09C] mt-1">Orders for this customer will appear here</p>
      </div>
    )
  }

  // Active orders first, then delivered
  const sorted = [...data].sort((a, b) => {
    if (a.status === 'Delivered' && b.status !== 'Delivered') return 1
    if (a.status !== 'Delivered' && b.status === 'Delivered') return -1
    return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime()
  })

  return (
    <div className="divide-y divide-[#F0F0EE]">
      {sorted.map((order) => (
        <button
          key={order.id}
          type="button"
          onClick={() => openOrderDetail(order.id)}
          className="w-full flex items-center justify-between gap-3 px-6 py-3.5 text-left hover:bg-[#FAFAF8] transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-semibold text-[#A0A09C] flex-shrink-0">
              #{String(order.order_number).padStart(4, '0')}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[#6B6B67]">{fmtDate(order.delivery_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="text-sm font-semibold text-[#1A1A18]">{fmtAmount(order.total_amount)}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {order.status}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
