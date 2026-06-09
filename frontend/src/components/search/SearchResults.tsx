'use client'

import type { SearchCustomer, SearchOrder } from '@/lib/api/search'
import CustomerRow from './CustomerRow'
import OrderRow from './OrderRow'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

interface Props {
  customers: SearchCustomer[]
  orders: SearchOrder[]
  showHint: boolean
  showEmpty: boolean
  debouncedQ: string
  onSelect?: () => void
}

export default function SearchResults({ customers, orders, showHint, showEmpty, debouncedQ, onSelect }: Props) {
  return (
    <>
      {showHint && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-[#F0F0EE] flex items-center justify-center text-[#A0A09C] mb-3">
            <SearchIcon />
          </div>
          <p className="text-sm font-medium text-[#6B6B67]">Search customers or orders</p>
          <p className="text-xs text-[#A0A09C] mt-1">Type a name, phone number, or order #0042</p>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <p className="text-sm font-medium text-[#6B6B67]">No results for &ldquo;{debouncedQ}&rdquo;</p>
          <p className="text-xs text-[#A0A09C] mt-1">Try a different name, phone, or order number</p>
        </div>
      )}

      {customers.length > 0 && (
        <div className="mt-2">
          <p className="px-4 pb-1 text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide">Customers</p>
          <div className="bg-white rounded-xl border border-[#E5E5E2] overflow-hidden divide-y divide-[#F0F0EE]">
            {customers.map((c) => <CustomerRow key={c.id} customer={c} onSelect={onSelect} />)}
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-4">
          <p className="px-4 pb-1 text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide">Orders</p>
          <div className="bg-white rounded-xl border border-[#E5E5E2] overflow-hidden divide-y divide-[#F0F0EE]">
            {orders.map((o) => <OrderRow key={o.id} order={o} onSelect={onSelect} />)}
          </div>
        </div>
      )}
    </>
  )
}
