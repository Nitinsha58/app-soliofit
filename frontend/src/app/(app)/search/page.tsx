'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchSearch, type SearchCustomer, type SearchOrder } from '@/lib/api/search'
import { useUIStore } from '@/stores/useUIStore'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CustomerRow({ customer }: { customer: SearchCustomer }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.push(`/customers/${customer.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F3] transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-[#FBF3E3] flex items-center justify-center text-[#C8952A] text-sm font-semibold flex-shrink-0">
        {customer.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{customer.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {customer.phone && (
            <p className="text-xs text-[#A0A09C] truncate">{customer.phone}</p>
          )}
          <span className="text-[10px] text-[#A0A09C] flex-shrink-0">
            {customer.order_count} {customer.order_count === 1 ? 'order' : 'orders'}
          </span>
        </div>
      </div>
    </button>
  )
}

function OrderRow({ order }: { order: SearchOrder }) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)

  const STATUS_COLORS: Record<string, string> = {
    'Booked':           'bg-blue-50 text-blue-700',
    'Started':          'bg-violet-50 text-violet-700',
    'Ready':            'bg-emerald-50 text-emerald-700',
    'Partial Delivery': 'bg-amber-50 text-amber-700',
    'Delivered':        'bg-gray-100 text-gray-600',
  }

  return (
    <button
      type="button"
      onClick={() => openOrderDetail(order.id)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F3] transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-[#F0F0EE] flex items-center justify-center text-[#6B6B67] text-xs font-semibold flex-shrink-0">
        #{String(order.order_number).padStart(4, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{order.customer_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {order.status}
          </span>
          {order.delivery_date && (
            <span className="text-[10px] text-[#A0A09C]">
              {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(inputValue.trim())
      if (inputValue.trim()) {
        router.replace(`/search?q=${encodeURIComponent(inputValue.trim())}`, { scroll: false })
      } else {
        router.replace('/search', { scroll: false })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => fetchSearch(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  })

  const customers = data?.customers ?? []
  const orders = data?.orders ?? []
  const hasResults = customers.length > 0 || orders.length > 0
  const showEmpty = debouncedQ.length >= 2 && !isFetching && !hasResults

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Search input */}
      <div className="sticky top-0 z-10 bg-[#FAFAF8] border-b border-[#E5E5E2] px-4 py-3">
        <div className="relative max-w-xl mx-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A09C] pointer-events-none">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search customers or order #"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E5E5E2] rounded-xl text-sm text-[#1A1A18] placeholder-[#A0A09C] focus:outline-none focus:ring-2 focus:ring-[#C8952A]/30 focus:border-[#C8952A]"
          />
          {isFetching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-xl mx-auto py-2">
        {debouncedQ.length < 2 && inputValue.length === 0 && (
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
              {customers.map((c) => (
                <CustomerRow key={c.id} customer={c} />
              ))}
            </div>
          </div>
        )}

        {orders.length > 0 && (
          <div className="mt-4">
            <p className="px-4 pb-1 text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide">Orders</p>
            <div className="bg-white rounded-xl border border-[#E5E5E2] overflow-hidden divide-y divide-[#F0F0EE]">
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
