'use client'

import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listOrderColumn, type Order, type OrderBoardPage } from '@/lib/api/orders'
import { compactInr } from '@/lib/orderPayment'
import DraggableCard from './DraggableCard'

interface Props {
  status: Order['status']
  title: string
  accent: string
  /** Client-side filter over loaded rows (dashboard summary cards). May under-report. */
  filterFn: (o: Order) => boolean
  mutatingIds: Set<string>
  /** Card id to flash with the transient recently-moved ring (clears after a few seconds). */
  highlightId: string | null
  /** Persistent map of orderId → previous status, drives the "From <status>" tag that stays. */
  movedFromMap: Record<string, Order['status']>
  /** Reports the latest per-status totals + column values up to the board. */
  onCounts: (counts: OrderBoardPage['counts'], value: OrderBoardPage['value']) => void
  headerAction?: React.ReactNode
}

const PAGE = 20

export function useColumnQuery(status: Order['status'], older: boolean, enabled = true) {
  return useInfiniteQuery({
    queryKey: older ? ['orders-board', status, 'older'] : ['orders-board', status],
    queryFn: ({ pageParam }) =>
      listOrderColumn({ status, cursor: pageParam, limit: PAGE, older }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled,
  })
}

export default function BoardColumn({
  status, title, accent, filterFn, mutatingIds, highlightId, movedFromMap, onCounts, headerAction,
}: Props) {
  const isDelivered = status === 'Delivered'
  const { isOver, setNodeRef } = useDroppable({ id: status })

  const recent = useColumnQuery(status, false)
  const [showOlder, setShowOlder] = useState(false)
  const older = useColumnQuery(status, true, isDelivered && showOlder)

  const counts = recent.data?.pages[0]?.counts
  const value = recent.data?.pages[0]?.value
  const total = counts?.[status] ?? 0
  useEffect(() => {
    if (counts && value) onCounts(counts, value)
  }, [counts, value, onCounts])

  // Unfiltered loaded count of the recent window — drives whether an older tail exists.
  const recentLoadedCount = recent.data?.pages.reduce((n, p) => n + p.results.length, 0) ?? 0
  const recentRows = (recent.data?.pages.flatMap((p) => p.results) ?? []).filter(filterFn)
  const olderRows = (older.data?.pages.flatMap((p) => p.results) ?? []).filter(filterFn)
  const rows = recentRows.concat(olderRows)

  // Infinite scroll: one sentinel near the bottom of the column's own scroll area.
  // Drains the recent window first, then the older window (Delivered only).
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    const root = scrollRef.current
    if (!el || !root) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        if (recent.hasNextPage && !recent.isFetchingNextPage) recent.fetchNextPage()
        else if (showOlder && older.hasNextPage && !older.isFetchingNextPage) older.fetchNextPage()
      },
      { root, rootMargin: '0px 0px 200px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [recent.hasNextPage, recent.isFetchingNextPage, older.hasNextPage, older.isFetchingNextPage, showOlder])

  const loading = recent.isLoading
  // Show-older affordance: recent window drained AND an older tail actually exists
  // (loaded recent rows are fewer than the true Delivered total).
  const canShowOlder =
    isDelivered && !showOlder && !recent.hasNextPage && !recent.isFetchingNextPage &&
    recentLoadedCount < total

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-72 flex-shrink-0 rounded-xl bg-[#F7F7F5] overflow-hidden transition-all"
      style={{ boxShadow: isOver ? `inset 0 0 0 2px ${accent}` : 'inset 0 0 0 1px #E5E5E2' }}
    >
      <div style={{ borderTop: `3px solid ${accent}` }} className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#1A1A18] tracking-tight">{title}</span>
          <div className="flex items-center gap-2">
            {headerAction}
            {/* Value of work in this stage — black on a column-coloured background, slightly larger. */}
            <span
              className="text-[12.5px] font-bold px-1.5 py-0.5 rounded tabular-nums text-[#1A1A18]"
              style={{ backgroundColor: `${accent}33` }}
            >
              {compactInr(value?.[status] ?? 0)}
            </span>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
              style={{ backgroundColor: `${accent}28`, color: accent }}
            >
              {total}
            </span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="px-2.5 pb-3 space-y-2.5 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-7">
            <div className="w-5 h-5 border-2 border-[#DCDCD8] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-7 rounded-lg border border-dashed border-[#DCDCD8]">
            <p className="text-xs text-[#C8C8C4]">Empty</p>
          </div>
        ) : (
          rows.map((order) => (
            <DraggableCard
              key={order.id}
              order={order}
              disabled={mutatingIds.has(order.id)}
              highlightColor={order.id === highlightId ? accent : undefined}
              movedFrom={movedFromMap[order.id]}
            />
          ))
        )}

        {canShowOlder && (
          <button
            onClick={() => setShowOlder(true)}
            className="w-full text-[11px] font-semibold text-[#A0A09C] hover:text-[#6B6B67] py-2 rounded-lg border border-dashed border-[#DCDCD8] transition-colors"
          >
            Show older delivered
          </button>
        )}
        {showOlder && older.isFetchingNextPage && (
          <div className="flex items-center justify-center py-3">
            <div className="w-4 h-4 border-2 border-[#DCDCD8] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div ref={sentinelRef} className="h-px" />
      </div>
    </div>
  )
}
