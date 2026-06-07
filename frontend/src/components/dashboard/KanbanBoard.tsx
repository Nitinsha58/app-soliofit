'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { updateOrderStatus, type Order, type OrderBoardPage } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'
import BoardColumn from './BoardColumn'
import OrderCard from './OrderCard'
import SummaryStrip, { type ActiveFilter } from './SummaryStrip'

const COLUMNS: { status: Order['status']; label: string; accent: string }[] = [
  { status: 'Booked',           label: 'Booked',           accent: '#60A5FA' },
  { status: 'Started',          label: 'Started',          accent: '#A78BFA' },
  { status: 'Ready',            label: 'Ready',            accent: '#34D399' },
  { status: 'Partial Delivery', label: 'Partial Delivery', accent: '#FBBF24' },
]
const DELIVERED = { status: 'Delivered' as const, label: 'Delivered', accent: '#9CA3AF' }

type Board = InfiniteData<OrderBoardPage, string | null>

// Drop an order out of a column's cache (across all loaded pages) and decrement its
// header total. Counts live on every page but only page[0] feeds the badge.
function removeFromCache(old: Board | undefined, id: string, from: Order['status']): Board | undefined {
  if (!old) return old
  return {
    ...old,
    pages: old.pages.map((p, i) => ({
      ...p,
      results: p.results.filter((o) => o.id !== id),
      counts: i === 0 ? { ...p.counts, [from]: Math.max(0, p.counts[from] - 1) } : p.counts,
    })),
  }
}

// Prepend an order into a column's first loaded page and bump its total. Skips when the
// column isn't loaded yet (can't synthesise counts) — the post-settle invalidate refetches it.
function addToCache(old: Board | undefined, order: Order, to: Order['status']): Board | undefined {
  if (!old || old.pages.length === 0) return old
  return {
    ...old,
    pages: old.pages.map((p, i) =>
      i === 0
        ? { ...p, results: [order, ...p.results.filter((o) => o.id !== order.id)], counts: { ...p.counts, [to]: p.counts[to] + 1 } }
        : { ...p, results: p.results.filter((o) => o.id !== order.id) },
    ),
  }
}

function CollapsedDelivered({ total, onShow }: { total: number | null; onShow: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: DELIVERED.status })
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-72 flex-shrink-0 rounded-xl bg-[#F7F7F5] overflow-hidden transition-all"
      style={{ boxShadow: isOver ? `inset 0 0 0 2px ${DELIVERED.accent}` : 'inset 0 0 0 1px #E5E5E2' }}
    >
      <div style={{ borderTop: `3px solid ${DELIVERED.accent}` }} className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#A0A09C] tracking-tight">{DELIVERED.label}</span>
          <button
            onClick={onShow}
            className="text-[11px] font-semibold text-[#A0A09C] hover:text-[#6B6B67] bg-[#9CA3AF28] px-2 py-0.5 rounded-full transition-colors"
          >
            Show{total != null ? ` (${total})` : ''}
          </button>
        </div>
      </div>
      <div className="px-2.5 pb-3">
        <div className={`flex items-center justify-center py-7 rounded-lg border border-dashed transition-colors ${isOver ? 'border-[#9CA3AF]' : 'border-[#DCDCD8]'}`}>
          <p className="text-xs text-[#C8C8C4]">{isOver ? 'Drop to deliver' : 'Hidden'}</p>
        </div>
      </div>
    </div>
  )
}

export default function KanbanBoard() {
  const queryClient = useQueryClient()
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set())
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null)
  const [showDelivered, setShowDelivered] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null)
  const [counts, setCounts] = useState<OrderBoardPage['counts'] | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerOrdersRefresh = useUIStore((s) => s.triggerOrdersRefresh)
  const ordersRefreshKey = useUIStore((s) => s.ordersRefreshKey)
  const firstRefresh = useRef(true)

  // Order created / edited / deleted on another surface (AddOrderFlow, detail drawer)
  // bumps this key — refetch every board column so membership and totals stay truthful.
  useEffect(() => {
    if (firstRefresh.current) { firstRefresh.current = false; return }
    queryClient.invalidateQueries({ queryKey: ['orders-board'] })
  }, [ordersRefreshKey, queryClient])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Touch: short hold before a drag starts so a scroll gesture on phone/tablet
    // isn't mistaken for a drag (scroll vs drag intent).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current) }, [])

  // Latest totals come from whichever column reported most recently — same map everywhere.
  const onCounts = useCallback((c: OrderBoardPage['counts']) => setCounts(c), [])

  const filterFn = useCallback((o: Order): boolean => {
    if (!activeFilter) return true
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    const plus7 = new Date(today); plus7.setDate(today.getDate() + 7)
    const plus7Str = `${plus7.getFullYear()}-${pad(plus7.getMonth() + 1)}-${pad(plus7.getDate())}`
    if (o.status === 'Delivered') return false
    if (activeFilter === 'today') return o.delivery_date === todayStr
    if (activeFilter === 'upcoming') return o.delivery_date > todayStr && o.delivery_date <= plus7Str
    return o.delivery_date < todayStr // delayed
  }, [activeFilter])

  function invalidateColumn(s: Order['status']) {
    queryClient.invalidateQueries({ queryKey: ['orders-board', s] })
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveOrder((active.data.current?.order as Order) ?? null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const order = (active.data.current?.order as Order) ?? null
    setActiveOrder(null)
    if (!over || !order) return

    const to = over.id as Order['status']
    const from = order.status
    if (from === to) return

    // Optimistic: move the card between column caches, adjust both badges + the totals map.
    queryClient.setQueryData<Board>(['orders-board', from], (old) => removeFromCache(old, order.id, from))
    queryClient.setQueryData<Board>(['orders-board', from, 'older'], (old) => removeFromCache(old, order.id, from))
    queryClient.setQueryData<Board>(['orders-board', to], (old) => addToCache(old, { ...order, status: to }, to))
    setCounts((c) => (c ? { ...c, [from]: Math.max(0, c[from] - 1), [to]: c[to] + 1 } : c))

    setMutatingIds((prev) => new Set(prev).add(order.id))
    setRecentlyMovedId(order.id)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setRecentlyMovedId(null), 1500)

    updateOrderStatus(order.id, to)
      .then(() => triggerOrdersRefresh())
      .catch(() => {
        // Roll back to authoritative server state for both columns.
        invalidateColumn(from)
        invalidateColumn(to)
      })
      .finally(() => {
        // Reconcile membership, sort position, and totals from the server.
        invalidateColumn(from)
        invalidateColumn(to)
        setMutatingIds((prev) => { const next = new Set(prev); next.delete(order.id); return next })
      })
  }

  const isEmpty = counts != null && Object.values(counts).reduce((a, b) => a + b, 0) === 0

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SummaryStrip activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {isEmpty && !activeFilter && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="text-[#C8C8C4] mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <p className="text-sm font-medium text-[#6B6B67]">No orders yet</p>
          <p className="text-xs text-[#A0A09C] mt-1">Create your first order to get started</p>
        </div>
      )}

      <div className="overflow-x-auto pb-4 -mx-6 px-6">
        <div className="flex gap-4 min-w-max items-start">
          {COLUMNS.map(({ status, label, accent }) => (
            <BoardColumn
              key={status}
              status={status}
              title={label}
              accent={accent}
              filterFn={filterFn}
              mutatingIds={mutatingIds}
              recentlyMovedId={recentlyMovedId}
              onCounts={onCounts}
            />
          ))}

          {showDelivered ? (
            <BoardColumn
              status={DELIVERED.status}
              title={DELIVERED.label}
              accent={DELIVERED.accent}
              filterFn={filterFn}
              mutatingIds={mutatingIds}
              recentlyMovedId={recentlyMovedId}
              onCounts={onCounts}
              headerAction={
                <button
                  onClick={() => setShowDelivered(false)}
                  className="text-[11px] font-semibold text-[#A0A09C] hover:text-[#6B6B67] transition-colors"
                >
                  Hide
                </button>
              }
            />
          ) : (
            <CollapsedDelivered total={counts?.Delivered ?? null} onShow={() => setShowDelivered(true)} />
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOrder ? (
          <div className="rotate-1 shadow-2xl opacity-95 w-72">
            <OrderCard order={activeOrder} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
