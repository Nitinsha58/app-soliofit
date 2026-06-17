'use client'

import { useEffect, useRef, useState } from 'react'
import { STATUS_ACCENT, type Order } from '@/lib/api/orders'
import { STATUS_PILL } from '@/lib/orderStatus'
import { compactInr } from '@/lib/orderPayment'
import { useColumnQuery } from './BoardColumn'
import OrderCard from './OrderCard'
import { useUIStore } from '@/stores/useUIStore'

// ── Constants ───────────────────────────────────────────────────────────────

type Mode = 'urgent' | 'all' | 'payments'
type ColumnQuery = ReturnType<typeof useColumnQuery>
type PaymentState = Order['payment_state']

// Urgent = work that still needs tailoring attention. Ready (work done) and
// Delivered (closed) are intentionally excluded so they don't compete for focus.
const URGENT_STATUSES: Order['status'][] = ['Booked', 'Started', 'Partial Delivery']
// Canonical workflow order for the All Orders status grouping.
const STATUS_ORDER: Order['status'][] = ['Booked', 'Started', 'Ready', 'Partial Delivery', 'Delivered']

// Payments view sources work-progressed statuses where money may still be owed.
// (Booked/Started are still the delivery lens — they live in Urgent, not here.)
const PAYMENT_STATUSES: Order['status'][] = ['Ready', 'Partial Delivery', 'Delivered']

// Within a date group, surface the most-urgent payment first.
const PAYMENT_PRIORITY: Record<PaymentState, number> = {
  overdue: 0, partial: 1, pending: 2, completed: 3, unbilled: 4,
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

type Urgency = 'overdue' | 'soon' | 'upcoming'
function dayUrgency(dateStr: string, today: string, tomorrow: string): Urgency {
  if (dateStr < today) return 'overdue'
  if (dateStr === today || dateStr === tomorrow) return 'soon'
  return 'upcoming'
}
function dayLabel(dateStr: string, today: string, tomorrow: string): string {
  if (dateStr < today) return `Overdue · ${fmtDate(dateStr)}`
  if (dateStr === today) return `Today · ${fmtDate(dateStr)}`
  if (dateStr === tomorrow) return `Tomorrow · ${fmtDate(dateStr)}`
  return fmtDate(dateStr)
}

// Within one delivery-date group: priority pinned to top, then payment-delayed,
// then workflow status, then order number — surfacing the orders that need attention.
function sortInGroup(a: Order, b: Order): number {
  if (a.priority !== b.priority) return a.priority ? -1 : 1
  if (a.has_delayed_installment !== b.has_delayed_installment) return a.has_delayed_installment ? -1 : 1
  const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  return s !== 0 ? s : a.order_number - b.order_number
}

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-red-600',
  soon: 'text-amber-600',
  upcoming: 'text-[#6B6B67]',
}

// Σ order value (total_amount) over a set of orders (per-day total in Urgent).
function sumValue(orders: Order[]): number {
  return orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
}

// Σ outstanding balance (remaining) over a set of orders (per-group total in Payments).
function sumRemaining(orders: Order[]): number {
  return orders.reduce((s, o) => s + (Number(o.remaining) || 0), 0)
}

function flatRows(q: ColumnQuery): Order[] {
  return q.data?.pages.flatMap((p) => p.results) ?? []
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function Spinner({ small }: { small?: boolean }) {
  const s = small ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <div className={`flex items-center justify-center ${small ? 'py-3' : 'py-12'}`}>
      <div className={`${s} border-2 border-[#DCDCD8] border-t-transparent rounded-full animate-spin`} />
    </div>
  )
}

// Fires onLoadMore when the sentinel scrolls within ~300px of the viewport.
function useLoadMoreOnScroll(
  ref: React.RefObject<HTMLDivElement>,
  enabled: boolean,
  hasMore: boolean,
  busy: boolean,
  onLoadMore: () => void,
) {
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !busy) onLoadMore() },
      { rootMargin: '0px 0px 300px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasMore, busy])
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MobileBoard() {
  const [mode, setMode] = useState<Mode>('urgent')
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)

  return (
    <div className="space-y-3">
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'urgent', label: 'Urgent' },
          { value: 'all', label: 'All Orders' },
          { value: 'payments', label: 'Payments' },
        ]}
      />
      {mode === 'urgent' && <UrgentView onOrderClick={openOrderDetail} />}
      {mode === 'all' && <AllOrdersView onOrderClick={openOrderDetail} />}
      {mode === 'payments' && <PaymentsView onOrderClick={openOrderDetail} />}
    </div>
  )
}

// ── View switch — light track + dark-filled active segment ─────────────────────

function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-[#E5E5E2] bg-[#FAFAF8] p-1">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-[13px] font-semibold rounded-lg transition-colors ${
              active
                ? 'bg-[#1A1A18] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
                : 'text-[#6B6B67] hover:text-[#1A1A18]'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Urgent view — active work, date-grouped, lazy-loaded on scroll ─────────────

function UrgentView({ onOrderClick }: { onOrderClick: (id: string) => void }) {
  // Active statuses only — board pages them by delivery date ascending, so the
  // earliest/overdue work loads first and more dates stream in as you scroll.
  // Delivered is never fetched here.
  const booked = useColumnQuery('Booked', false)
  const started = useColumnQuery('Started', false)
  const partial = useColumnQuery('Partial Delivery', false)
  const active = [booked, started, partial]

  const today = ymd(new Date())
  const tomorrow = ymd(addDays(new Date(), 1))

  const rows = active.flatMap(flatRows)

  // Bucket by delivery date; orders missing a date go to a trailing group.
  const byDate = new Map<string, Order[]>()
  const undated: Order[] = []
  for (const o of rows) {
    if (!o.delivery_date) { undated.push(o); continue }
    const list = byDate.get(o.delivery_date)
    if (list) list.push(o)
    else byDate.set(o.delivery_date, [o])
  }
  const dateKeys = Array.from(byDate.keys()).sort()

  const initialLoading = active.some((q) => q.isLoading)
  const hasMore = active.some((q) => q.hasNextPage)
  const busy = active.some((q) => q.isFetchingNextPage)

  const sentinelRef = useRef<HTMLDivElement>(null)
  useLoadMoreOnScroll(sentinelRef, true, hasMore, busy, () => {
    active.forEach((q) => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage() })
  })

  if (initialLoading && rows.length === 0) return <Spinner />

  if (!initialLoading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-[#6B6B67]">Nothing needs attention</p>
        <p className="text-xs text-[#A0A09C] mt-1">No pending tailoring work right now</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {dateKeys.map((dateStr) => {
        const urgency = dayUrgency(dateStr, today, tomorrow)
        const groupOrders = [...byDate.get(dateStr)!].sort(sortInGroup)
        return (
          <DateGroup
            key={dateStr}
            label={dayLabel(dateStr, today, tomorrow)}
            count={groupOrders.length}
            value={sumValue(groupOrders)}
            labelClass={URGENCY_TEXT[urgency]}
          >
            {groupOrders.map((o) => (
              <OrderCard key={o.id} order={o} urgency={urgency} showStatus onClick={() => onOrderClick(o.id)} />
            ))}
          </DateGroup>
        )
      })}

      {undated.length > 0 && (
        <DateGroup label="No delivery date" count={undated.length} value={sumValue(undated)} labelClass="text-[#6B6B67]">
          {[...undated].sort(sortInGroup).map((o) => (
            <OrderCard key={o.id} order={o} urgency="upcoming" showStatus onClick={() => onOrderClick(o.id)} />
          ))}
        </DateGroup>
      )}

      {busy && <Spinner small />}
      <div ref={sentinelRef} className="h-px" />
    </div>
  )
}

function DateGroup({
  label, count, value, labelClass, children,
}: { label: string; count: number; value: number; labelClass: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className={`text-[13px] font-bold tracking-tight ${labelClass}`}>{label}</span>
        <div className="flex items-center gap-2">
          {/* Day's total order value — neutral so the urgency colour stays the signal */}
          <span className="text-[12px] font-bold tabular-nums text-[#1A1A18]">{compactInr(value)}</span>
          <span className={`text-[12px] font-bold tabular-nums ${labelClass}`}>{count}</span>
        </div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

// ── Payments view — the collection lens, date-grouped, lazy-loaded on scroll ──
// Work-progressed orders (Ready / Partial Delivery / Delivered) that still owe
// money. Grouped by delivery date, overdue dates first (same layout as Urgent).
// The header shows ₹ still to collect from that date + count of orders.
// Within each date group, orders are sorted by payment urgency (overdue → partial
// → pending) so the most urgent collection surfaces at the top of the group.
function PaymentsView({ onOrderClick }: { onOrderClick: (id: string) => void }) {
  const ready = useColumnQuery('Ready', false)
  const partial = useColumnQuery('Partial Delivery', false)
  // A delivered order with a balance can be old, so load the recent window then
  // chain the older tail — otherwise long-settled-but-unpaid orders never surface.
  const deliveredRecent = useColumnQuery('Delivered', false)
  const recentExhausted =
    !deliveredRecent.hasNextPage && !deliveredRecent.isFetchingNextPage &&
    (deliveredRecent.data?.pages.length ?? 0) > 0
  const deliveredOlder = useColumnQuery('Delivered', true, recentExhausted)
  const sources = [ready, partial, deliveredRecent, deliveredOlder]

  const today = ymd(new Date())
  const tomorrow = ymd(addDays(new Date(), 1))

  // Keep only orders with an outstanding balance; dedupe by id (the delivered
  // recent/older windows are keyset-disjoint, but ids must stay unique).
  const seen = new Set<string>()
  const outstanding = sources.flatMap(flatRows).filter((o) => {
    if (seen.has(o.id)) return false
    seen.add(o.id)
    return o.payment_state === 'overdue' || o.payment_state === 'partial' || o.payment_state === 'pending'
  })

  // Bucket by delivery date; orders missing a date go to a trailing group.
  const byDate = new Map<string, Order[]>()
  const undated: Order[] = []
  for (const o of outstanding) {
    if (!o.delivery_date) { undated.push(o); continue }
    const list = byDate.get(o.delivery_date)
    if (list) list.push(o)
    else byDate.set(o.delivery_date, [o])
  }
  const dateKeys = Array.from(byDate.keys()).sort()

  const initialLoading = ready.isLoading || partial.isLoading || deliveredRecent.isLoading
  const hasMore =
    !!ready.hasNextPage || !!partial.hasNextPage || !!deliveredRecent.hasNextPage ||
    (recentExhausted && !!deliveredOlder.hasNextPage)
  const busy = sources.some((q) => q.isFetchingNextPage)

  const sentinelRef = useRef<HTMLDivElement>(null)
  useLoadMoreOnScroll(sentinelRef, true, hasMore, busy, () => {
    if (ready.hasNextPage && !ready.isFetchingNextPage) ready.fetchNextPage()
    if (partial.hasNextPage && !partial.isFetchingNextPage) partial.fetchNextPage()
    if (deliveredRecent.hasNextPage && !deliveredRecent.isFetchingNextPage) deliveredRecent.fetchNextPage()
    else if (recentExhausted && deliveredOlder.hasNextPage && !deliveredOlder.isFetchingNextPage) deliveredOlder.fetchNextPage()
  })

  if (initialLoading && outstanding.length === 0) return <Spinner />

  return (
    <div className="space-y-4">
      {dateKeys.map((dateStr) => {
        const urgency = dayUrgency(dateStr, today, tomorrow)
        const groupOrders = [...byDate.get(dateStr)!].sort((a, b) => {
          const ps = PAYMENT_PRIORITY[a.payment_state] - PAYMENT_PRIORITY[b.payment_state]
          return ps !== 0 ? ps : a.order_number - b.order_number
        })
        return (
          <DateGroup
            key={dateStr}
            label={dayLabel(dateStr, today, tomorrow)}
            count={groupOrders.length}
            value={sumRemaining(groupOrders)}
            labelClass={URGENCY_TEXT[urgency]}
          >
            {groupOrders.map((o) => (
              <OrderCard key={o.id} order={o} showStatus onClick={() => onOrderClick(o.id)} />
            ))}
          </DateGroup>
        )
      })}

      {undated.length > 0 && (
        <DateGroup label="No delivery date" count={undated.length} value={sumRemaining(undated)} labelClass="text-[#6B6B67]">
          {[...undated]
            .sort((a, b) => {
              const ps = PAYMENT_PRIORITY[a.payment_state] - PAYMENT_PRIORITY[b.payment_state]
              return ps !== 0 ? ps : a.order_number - b.order_number
            })
            .map((o) => (
              <OrderCard key={o.id} order={o} showStatus onClick={() => onOrderClick(o.id)} />
            ))}
        </DateGroup>
      )}

      {outstanding.length === 0 && !hasMore && !busy && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium text-[#6B6B67]">No payments to collect</p>
          <p className="text-xs text-[#A0A09C] mt-1">Ready &amp; delivered orders are all paid up</p>
        </div>
      )}

      {(busy || (hasMore && outstanding.length === 0)) && <Spinner small />}
      <div ref={sentinelRef} className="h-px" />
    </div>
  )
}

// ── All Orders view — full status board, lazy-loaded per group ────────────────

function AllOrdersView({ onOrderClick }: { onOrderClick: (id: string) => void }) {
  const booked = useColumnQuery('Booked', false)
  const started = useColumnQuery('Started', false)
  const ready = useColumnQuery('Ready', false)
  const partial = useColumnQuery('Partial Delivery', false)

  // Delivered cards load only when the section is expanded; its count + total
  // come from the shared per-status maps, so the header needs no fetch.
  const [deliveredOpen, setDeliveredOpen] = useState(false)
  const deliveredRecent = useColumnQuery('Delivered', false, deliveredOpen)
  const recentExhausted =
    deliveredOpen && !deliveredRecent.hasNextPage && !deliveredRecent.isFetchingNextPage &&
    (deliveredRecent.data?.pages.length ?? 0) > 0
  const deliveredOlder = useColumnQuery('Delivered', true, deliveredOpen && recentExhausted)

  const activeQueries: Record<Exclude<Order['status'], 'Delivered'>, ColumnQuery> = {
    'Booked': booked, 'Started': started, 'Ready': ready, 'Partial Delivery': partial,
  }

  const anyPage =
    booked.data?.pages[0] ?? started.data?.pages[0] ?? ready.data?.pages[0] ??
    partial.data?.pages[0] ?? deliveredRecent.data?.pages[0]
  const counts = anyPage?.counts
  const value = anyPage?.value

  if (!anyPage && (booked.isLoading || started.isLoading || ready.isLoading || partial.isLoading)) {
    return <Spinner />
  }

  const totalAll = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  if (totalAll === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-[#6B6B67]">No orders yet</p>
        <p className="text-xs text-[#A0A09C] mt-1">Create your first order to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {STATUS_ORDER.map((status) => {
        const total = counts?.[status] ?? 0
        if (total === 0) return null
        const accent = STATUS_ACCENT[status]
        const groupValue = value?.[status] ?? '0'

        if (status === 'Delivered') {
          return (
            <DeliveredGroup
              key={status}
              accent={accent}
              total={total}
              value={groupValue}
              open={deliveredOpen}
              onToggle={() => setDeliveredOpen((o) => !o)}
              recent={deliveredRecent}
              older={deliveredOlder}
              recentExhausted={recentExhausted}
              onOrderClick={onOrderClick}
            />
          )
        }

        const q = activeQueries[status]
        return (
          <StatusGroup
            key={status}
            status={status}
            accent={accent}
            total={total}
            value={groupValue}
            rows={flatRows(q)}
            hasNextPage={!!q.hasNextPage}
            isFetchingNextPage={q.isFetchingNextPage}
            fetchNextPage={q.fetchNextPage}
            onOrderClick={onOrderClick}
          />
        )
      })}
    </div>
  )
}

function GroupBox({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border border-dashed p-1.5 flex flex-col gap-1.5"
      style={{ backgroundColor: `${accent}12`, borderColor: `${accent}60` }}
    >
      {children}
    </div>
  )
}

function GroupHeaderMeta({ accent, value, count }: { accent: string; value: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold tabular-nums text-[#1A1A18]">{compactInr(value)}</span>
      <span className="text-[11px] font-bold tabular-nums" style={{ color: accent }}>{count}</span>
    </div>
  )
}

// Active status group — always open, lazy-loads its own next page on scroll.
function StatusGroup({
  status, accent, total, value, rows, hasNextPage, isFetchingNextPage, fetchNextPage, onOrderClick,
}: {
  status: Order['status']
  accent: string
  total: number
  value: string
  rows: Order[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  onOrderClick: (id: string) => void
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  useLoadMoreOnScroll(sentinelRef, true, hasNextPage, isFetchingNextPage, fetchNextPage)

  return (
    <GroupBox accent={accent}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-sm ${STATUS_PILL[status]}`}>{status}</span>
        <GroupHeaderMeta accent={accent} value={value} count={total} />
      </div>
      {rows.map((o) => (
        <OrderCard key={o.id} order={o} showStatus onClick={() => onOrderClick(o.id)} />
      ))}
      {isFetchingNextPage && <Spinner small />}
      <div ref={sentinelRef} className="h-px" />
    </GroupBox>
  )
}

// Delivered group — collapsed by default. On expand: recent window first, then the
// older tail, both lazy-loaded on scroll.
function DeliveredGroup({
  accent, total, value, open, onToggle, recent, older, recentExhausted, onOrderClick,
}: {
  accent: string
  total: number
  value: string
  open: boolean
  onToggle: () => void
  recent: ColumnQuery
  older: ColumnQuery
  recentExhausted: boolean
  onOrderClick: (id: string) => void
}) {
  const rows = [...flatRows(recent), ...flatRows(older)]
  const busy = recent.isFetchingNextPage || older.isFetchingNextPage
  const hasMore = !!recent.hasNextPage || (recentExhausted && !!older.hasNextPage)

  const sentinelRef = useRef<HTMLDivElement>(null)
  useLoadMoreOnScroll(sentinelRef, open, hasMore, busy, () => {
    if (recent.hasNextPage && !recent.isFetchingNextPage) recent.fetchNextPage()
    else if (recentExhausted && older.hasNextPage && !older.isFetchingNextPage) older.fetchNextPage()
  })

  return (
    <GroupBox accent={accent}>
      <button onClick={onToggle} className="flex items-center justify-between gap-2 px-0.5 w-full" aria-expanded={open}>
        <span className="flex items-center gap-1.5">
          <Chevron open={open} />
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-sm ${STATUS_PILL['Delivered']}`}>Delivered</span>
        </span>
        <GroupHeaderMeta accent={accent} value={value} count={total} />
      </button>

      {open && (
        <>
          {recent.isLoading
            ? <Spinner small />
            : rows.map((o) => <OrderCard key={o.id} order={o} showStatus onClick={() => onOrderClick(o.id)} />)}
          {busy && <Spinner small />}
          <div ref={sentinelRef} className="h-px" />
        </>
      )}
    </GroupBox>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6B67"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
