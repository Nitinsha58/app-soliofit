'use client'

import { useEffect, useRef } from 'react'
import type { Order } from '@/lib/api/orders'
import { compactInr } from '@/lib/orderPayment'
import OrderCard from './OrderCard'
import { useUIStore } from '@/stores/useUIStore'

interface Props {
  label: string
  accent: string
  value: string
  count: number
  rows: Order[]
  isLoading: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  emptyLabel: string
}

export default function FocusedColumn({
  label, accent, value, count, rows, isLoading, hasNextPage, isFetchingNextPage, onLoadMore, emptyLabel,
}: Props) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) onLoadMore() },
      { rootMargin: '0px 0px 300px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  return (
    <div className="flex flex-col rounded-xl bg-[#F7F7F5]" style={{ boxShadow: 'inset 0 0 0 1px #E5E5E2' }}>
      <div style={{ borderTop: `3px solid ${accent}` }} className="px-4 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#1A1A18] tracking-tight">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold px-1.5 py-0.5 rounded tabular-nums text-[#1A1A18]" style={{ backgroundColor: `${accent}33` }}>
              {compactInr(value)}
            </span>
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full tabular-nums" style={{ backgroundColor: `${accent}28`, color: accent }}>
              {count}
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-[#DCDCD8] border-t-transparent rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-10 rounded-lg border border-dashed border-[#DCDCD8]"><p className="text-xs text-[#C8C8C4]">{emptyLabel}</p></div>
        ) : (
          rows.map((o) => <OrderCard key={o.id} order={o} onClick={() => openOrderDetail(o.id)} />)
        )}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-3"><div className="w-4 h-4 border-2 border-[#DCDCD8] border-t-transparent rounded-full animate-spin" /></div>
        )}
        <div ref={sentinelRef} className="h-px" />
      </div>
    </div>
  )
}
