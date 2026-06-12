'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
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
import MobileBoard from './MobileBoard'

const COLUMNS: { status: Order['status']; label: string; accent: string }[] = [
  { status: 'Booked',           label: 'Booked',           accent: '#A0A09C' },
  { status: 'Started',          label: 'Started',          accent: '#C8952A' },
  { status: 'Ready',            label: 'Ready',            accent: '#34D399' },
  { status: 'Partial Delivery', label: 'Partial Delivery', accent: '#FBBF24' },
  // Delivered is a normal column now: recent window shown, older tail behind
  // "Show older delivered" inside the column — never hidden.
  { status: 'Delivered',        label: 'Delivered',        accent: '#9CA3AF' },
]

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

// A completed move, kept briefly to drive the Undo snackbar and the recently-moved
// ring. `order` is the card as it was before the move.
type Move = { order: Order; from: Order['status']; to: Order['status'] }
const MOVE_TTL = 6000

export default function KanbanBoard() {
  const queryClient = useQueryClient()
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set())
  const [lastMove, setLastMove] = useState<Move | null>(null)
  // Persistent origin per card (orderId → previous status). Survives refetches so the
  // "From <status>" tag stays with the card for the whole session, not just briefly.
  const [movedFromMap, setMovedFromMap] = useState<Record<string, Order['status']>>({})
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
    // Mouse only — does NOT capture touch, so a touch that starts on a card can still
    // scroll the board (the card no longer sets touch-action: none).
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch: require a deliberate ~280ms press-and-hold before a drag begins; if the
    // finger moves more than `tolerance` first, it's a scroll, not a drag. Makes every
    // drag intentional and lets vertical/horizontal scrolling work over cards.
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
  )

  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current) }, [])

  // Latest per-status totals come from whichever column reported most recently —
  // identical across every column's response. (Per-column `value` is read locally
  // in each BoardColumn header.)
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

  // Optimistically move a card between column caches (membership, both badges, the
  // totals map), fire the /status change, and reconcile from the server on settle.
  function performMove(order: Order, from: Order['status'], to: Order['status']) {
    queryClient.setQueryData<Board>(['orders-board', from], (old) => removeFromCache(old, order.id, from))
    queryClient.setQueryData<Board>(['orders-board', from, 'older'], (old) => removeFromCache(old, order.id, from))
    queryClient.setQueryData<Board>(['orders-board', to], (old) => addToCache(old, { ...order, status: to }, to))
    setCounts((c) => (c ? { ...c, [from]: Math.max(0, c[from] - 1), [to]: c[to] + 1 } : c))
    setMovedFromMap((m) => ({ ...m, [order.id]: from }))  // persistent origin tag

    setMutatingIds((prev) => new Set(prev).add(order.id))
    updateOrderStatus(order.id, to)
      .then(() => triggerOrdersRefresh())
      .catch(() => { invalidateColumn(from); invalidateColumn(to) })
      .finally(() => {
        invalidateColumn(from); invalidateColumn(to)
        setMutatingIds((prev) => { const next = new Set(prev); next.delete(order.id); return next })
      })
  }

  // Show the ring + "From <status>" + Undo snackbar for MOVE_TTL, then clear.
  function flashMove(move: Move) {
    setLastMove(move)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setLastMove(null), MOVE_TTL)
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
    performMove(order, from, to)
    flashMove({ order, from, to })
  }

  // Undo = a one-shot compensating reverse move (writes its own activity), then the
  // snackbar dismisses. Not re-offered, so repeated clicks can't ping-pong the card.
  function undoMove() {
    if (!lastMove) return
    const { order, from, to } = lastMove
    performMove(order, to, from)
    dismissMove()
  }

  function dismissMove() {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setLastMove(null)
  }

  const highlightId = lastMove ? lastMove.order.id : null
  const isEmpty = counts != null && Object.values(counts).reduce((a, b) => a + b, 0) === 0

  return (
    <>
      {/* Desktop board (drag/drop) */}
      <div className="hidden lg:block">
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
                  highlightId={highlightId}
                  movedFromMap={movedFromMap}
                  onCounts={onCounts}
                />
              ))}
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
      </div>

      {/* Mobile board (single focused column) */}
      <div className="lg:hidden">
        <MobileBoard activeFilter={activeFilter} setActiveFilter={setActiveFilter} filterFn={filterFn} />
      </div>

      {/* Undo snackbar (shared) */}
      {lastMove && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-[#1A1A18] px-4 py-2.5 text-[13px] text-white shadow-xl">
          <span className="tabular-nums">
            #{String(lastMove.order.order_number).padStart(4, '0')}
            <span className="text-[#B0B0AC]">  {lastMove.from} → {lastMove.to}</span>
          </span>
          <button onClick={undoMove} className="font-semibold text-[#FBBF24] hover:text-[#FCD34D] transition-colors">
            Undo
          </button>
          <button onClick={dismissMove} aria-label="Dismiss" className="text-[#B0B0AC] hover:text-white transition-colors">
            ×
          </button>
        </div>
      )}
    </>
  )
}
