'use client'

import { useRouter } from 'next/navigation'
import type { SearchCustomer } from '@/lib/api/search'

export default function CustomerRow({ customer, onSelect }: { customer: SearchCustomer; onSelect?: () => void }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => { router.push(`/customers/${customer.id}`); onSelect?.() }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F3] transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-[#FBF3E3] flex items-center justify-center text-[#C8952A] text-sm font-semibold flex-shrink-0">
        {customer.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{customer.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {customer.phone && <p className="text-xs text-[#A0A09C] truncate">{customer.phone}</p>}
          <span className="text-[10px] text-[#A0A09C] flex-shrink-0">
            {customer.order_count} {customer.order_count === 1 ? 'order' : 'orders'}
          </span>
        </div>
      </div>
    </button>
  )
}
