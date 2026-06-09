# Responsive Kanban (mobile single-column) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile (`<lg`), replace the 5-wide dashboard board with one focused status column, a row of status chips, and (Unit 2) a compact attention rail (Delayed · Today · Upcoming) that filters with smart auto-focus. Desktop is unchanged.

**Architecture:** `KanbanBoard` becomes a responsive switch — desktop board in `hidden lg:block`, a new `MobileBoard` in `lg:hidden`. `MobileBoard` runs the five existing `useColumnQuery` hooks (React Query dedupes against the hidden desktop board, so no extra network), derives raw + filtered per-status counts and a smart default focus, and renders only the selected status's cards. No drag/drop on mobile — status changes go through the existing detail-drawer status dropdown.

**Tech Stack:** Next.js (App Router) + React + TypeScript, Tailwind, TanStack Query, Zustand (`useUIStore`). Spec: `docs/superpowers/specs/2026-06-09-responsive-kanban-design.md`.

> **Verification model (project reality):** No frontend test framework — do NOT add one. Each task verifies with `docker compose -f docker-compose.dev.yml exec frontend npm run type-check` (must pass clean). `next lint` is unusable (no config) — skip it. Browser sweeps at **375 / 768 / desktop** happen at unit checkpoints (dev stack on `http://localhost:3000`). Restart the frontend service to pick up new module files.

## Reference facts (already in the codebase)
- `Order['status']` = `'Booked' | 'Started' | 'Ready' | 'Partial Delivery' | 'Delivered'`.
- `useColumnQuery(status, older, enabled?)` — exported from `frontend/src/components/dashboard/BoardColumn.tsx`; returns a TanStack `useInfiniteQuery` (`.data.pages[]`, `.isLoading`, `.hasNextPage`, `.isFetchingNextPage`, `.fetchNextPage()`).
- Each page is `OrderBoardPage { results: Order[]; next_cursor; counts: Record<status, number>; value: Record<status, string> }` — `counts`/`value` are the FULL per-status maps on every response.
- `compactInr(value: string | number)` from `@/lib/orderPayment`.
- `useUIStore((s) => s.openOrderDetail)` opens the full-screen detail drawer (whose `OrderHeader` already has a status `<select>` — the mobile status-change path).
- The desktop `KanbanBoard` accents: Booked `#60A5FA`, Started `#A78BFA`, Ready `#34D399`, Partial Delivery `#FBBF24`, Delivered `#9CA3AF`.

## File Structure
**Unit 1**
- Create `frontend/src/components/dashboard/ColumnChips.tsx` — horizontal status chips with count badges.
- Create `frontend/src/components/dashboard/FocusedColumn.tsx` — one full-width column (header + card list + load-more sentinel + empty/loading), plain `OrderCard`s (no drag).
- Create `frontend/src/components/dashboard/MobileBoard.tsx` — orchestrator: five column queries, raw counts/value, smart default focus, renders chips + focused column.
- Modify `frontend/src/components/dashboard/KanbanBoard.tsx` — responsive switch (desktop `hidden lg:block`, `<MobileBoard/>` in `lg:hidden`).

**Unit 2**
- Create `frontend/src/components/dashboard/AttentionRail.tsx` — three filter pills.
- Modify `MobileBoard.tsx` — accept `activeFilter`/`setActiveFilter`/`filterFn`; filtered chip counts, auto-focus, render the rail.
- Modify `KanbanBoard.tsx` — pass `activeFilter`/`setActiveFilter`/`filterFn` to `MobileBoard`.

---

## UNIT 1 — Single-column mobile board

### Task 1.1: ColumnChips
**Files:** Create `frontend/src/components/dashboard/ColumnChips.tsx`

- [ ] **Step 1: Write the component**
```tsx
'use client'

import type { Order } from '@/lib/api/orders'

export interface Chip { status: Order['status']; label: string; accent: string }

interface Props {
  chips: Chip[]
  counts: Record<Order['status'], number>
  selected: Order['status']
  onSelect: (s: Order['status']) => void
}

export default function ColumnChips({ chips, counts, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
      {chips.map(({ status, label }) => {
        const active = status === selected
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(status)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-semibold transition-colors ${
              active ? 'bg-[#C8952A] border-[#C8952A] text-white' : 'bg-white border-[#E5E5E2] text-[#6B6B67]'
            }`}
          >
            <span>{label}</span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-white text-[#C8952A]' : 'bg-[#F0F0EE] text-[#6B6B67]'}`}>
              {counts[status] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Type-check** — Run the type-check command. Expected: PASS.

### Task 1.2: FocusedColumn
**Files:** Create `frontend/src/components/dashboard/FocusedColumn.tsx`

- [ ] **Step 1: Write the component** (full-width; viewport-rooted infinite-scroll sentinel; no internal scroll cap so the page scrolls naturally)
```tsx
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
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 1.3: MobileBoard
**Files:** Create `frontend/src/components/dashboard/MobileBoard.tsx`

- [ ] **Step 1: Write the component** (runs the five queries, derives raw counts/value, smart default focus = most delayed loaded rows else Booked, renders chips + focused column)
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Order } from '@/lib/api/orders'
import { useColumnQuery } from './BoardColumn'
import ColumnChips, { type Chip } from './ColumnChips'
import FocusedColumn from './FocusedColumn'

const CHIPS: Chip[] = [
  { status: 'Booked',           label: 'Booked',    accent: '#60A5FA' },
  { status: 'Started',          label: 'Started',   accent: '#A78BFA' },
  { status: 'Ready',            label: 'Ready',     accent: '#34D399' },
  { status: 'Partial Delivery', label: 'Partial',   accent: '#FBBF24' },
  { status: 'Delivered',        label: 'Delivered', accent: '#9CA3AF' },
]

const ZERO_COUNTS: Record<Order['status'], number> = { 'Booked': 0, 'Started': 0, 'Ready': 0, 'Partial Delivery': 0, 'Delivered': 0 }
const ZERO_VALUE: Record<Order['status'], string> = { 'Booked': '0', 'Started': '0', 'Ready': '0', 'Partial Delivery': '0', 'Delivered': '0' }

function todayStr(): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const t = new Date()
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}

export default function MobileBoard() {
  const booked    = useColumnQuery('Booked', false)
  const started   = useColumnQuery('Started', false)
  const ready     = useColumnQuery('Ready', false)
  const partial   = useColumnQuery('Partial Delivery', false)
  const delivered = useColumnQuery('Delivered', false)

  const queries: Record<Order['status'], ReturnType<typeof useColumnQuery>> = {
    'Booked': booked, 'Started': started, 'Ready': ready, 'Partial Delivery': partial, 'Delivered': delivered,
  }

  const rowsByStatus = {} as Record<Order['status'], Order[]>
  for (const c of CHIPS) rowsByStatus[c.status] = queries[c.status].data?.pages.flatMap((p) => p.results) ?? []

  // counts/value are full per-status maps bundled on any column response.
  const anyPage = booked.data?.pages[0] ?? started.data?.pages[0] ?? ready.data?.pages[0] ?? partial.data?.pages[0] ?? delivered.data?.pages[0]
  const counts = anyPage?.counts ?? ZERO_COUNTS
  const value = anyPage?.value ?? ZERO_VALUE

  const [focused, setFocused] = useState<Order['status']>('Booked')
  const didDefault = useRef(false)

  // Smart default focus, once, when data first lands: status with the most delayed
  // loaded rows (delivery_date < today, not Delivered); falls back to Booked.
  useEffect(() => {
    if (didDefault.current || !anyPage) return
    const today = todayStr()
    let best: Order['status'] = 'Booked'
    let bestN = 0
    for (const c of CHIPS) {
      const n = rowsByStatus[c.status].filter((o) => o.status !== 'Delivered' && o.delivery_date < today).length
      if (n > bestN) { bestN = n; best = c.status }
    }
    setFocused(best)
    didDefault.current = true
  }, [booked.data, started.data, ready.data, partial.data, delivered.data])

  const q = queries[focused]
  const chip = CHIPS.find((c) => c.status === focused)!

  return (
    <div className="space-y-3">
      <ColumnChips chips={CHIPS} counts={counts} selected={focused} onSelect={setFocused} />
      <FocusedColumn
        label={chip.label}
        accent={chip.accent}
        value={value[focused]}
        count={counts[focused] ?? 0}
        rows={rowsByStatus[focused]}
        isLoading={q.isLoading}
        hasNextPage={!!q.hasNextPage}
        isFetchingNextPage={q.isFetchingNextPage}
        onLoadMore={() => q.fetchNextPage()}
        emptyLabel={`No ${chip.label} orders`}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 1.4: KanbanBoard responsive switch
**Files:** Modify `frontend/src/components/dashboard/KanbanBoard.tsx`

- [ ] **Step 1: Add the import** next to the other component imports (`import SummaryStrip …`):
```tsx
import MobileBoard from './MobileBoard'
```

- [ ] **Step 2: Wrap the desktop board and add the mobile board.** The current `return (` renders `<DndContext …> … </DndContext>` with `<SummaryStrip/>`, the empty state, the `overflow-x-auto` columns row, the `<DragOverlay>`, and the undo snackbar. Restructure the return so the entire DndContext block is desktop-only and `MobileBoard` renders below `lg`. Keep the undo snackbar shared (it only fires from desktop drag, harmless otherwise). The new return:
```tsx
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
        <MobileBoard />
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
```
Leave all the hooks, `COLUMNS`, `performMove`, sensors, and helper functions above the `return` unchanged.

- [ ] **Step 2: Type-check** — Expected: PASS (no unused vars; `onCounts`/`filterFn` still used by the desktop `BoardColumn`).

- [ ] **Step 3: Browser sweep (Unit 1 checkpoint)** — restart the frontend service. At **375px**: dashboard shows status chips + one focused column (default = the status with the most delayed orders, else Booked); tapping a chip switches the focused column; the column header shows label + ₹value + count; scrolling loads more; tapping a card opens the full-screen drawer and changing status there updates the board. At **desktop**: the 5-column board + `SummaryStrip` + drag/drop are unchanged. No console errors.

- [ ] **Step 4: Commit**
```bash
git add "frontend/src/components/dashboard/ColumnChips.tsx" "frontend/src/components/dashboard/FocusedColumn.tsx" "frontend/src/components/dashboard/MobileBoard.tsx" "frontend/src/components/dashboard/KanbanBoard.tsx"
git commit -m "feat(VS-17): responsive Kanban — mobile single-column board with status chips"
```

**✅ Unit 1 checkpoint:** mobile board is single-column with chips + smart default focus; desktop unchanged. Review before Unit 2.

---

## UNIT 2 — Attention rail + filter

### Task 2.1: AttentionRail
**Files:** Create `frontend/src/components/dashboard/AttentionRail.tsx`

- [ ] **Step 1: Write the component** (three pills from `dashboard-summary`; Delayed red, Today amber, Upcoming neutral; ~38px; tap toggles the matching board filter)
```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary } from '@/lib/api/dashboard'

export type RailFilter = 'delayed' | 'today' | 'upcoming'

interface Props {
  activeFilter: RailFilter | null
  onFilterChange: (f: RailFilter | null) => void
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default function AttentionRail({ activeFilter, onFilterChange }: Props) {
  const { data } = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchDashboardSummary })

  const pills: { key: RailFilter; label: string; count: number; tone: 'red' | 'amber' | 'neutral'; icon: React.ReactNode }[] = [
    { key: 'delayed',  label: 'Delayed',  count: data?.delayed_orders ?? 0,    tone: 'red',     icon: <ClockIcon /> },
    { key: 'today',    label: 'Today',    count: data?.orders_due_today ?? 0,  tone: 'amber',   icon: <CalendarIcon /> },
    { key: 'upcoming', label: 'Upcoming', count: data?.upcoming_orders ?? 0,   tone: 'neutral', icon: <CalendarIcon /> },
  ]

  const toneClass = (tone: string, active: boolean) =>
    active
      ? 'bg-[#C8952A] border-[#C8952A] text-white'
      : tone === 'red'
      ? 'bg-white border-[#E5E5E2] text-red-600'
      : tone === 'amber'
      ? 'bg-white border-[#E5E5E2] text-amber-600'
      : 'bg-white border-[#E5E5E2] text-[#6B6B67]'

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
      {pills.map(({ key, label, count, tone, icon }) => {
        const active = activeFilter === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(active ? null : key)}
            className={`flex-shrink-0 flex items-center gap-1.5 h-[38px] px-3 rounded-lg border text-[13px] font-semibold transition-colors ${toneClass(tone, active)}`}
          >
            {icon}
            <span>{label}</span>
            <span className="tabular-nums">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 2.2: Wire filter + rail into MobileBoard
**Files:** Modify `frontend/src/components/dashboard/MobileBoard.tsx`

- [ ] **Step 1: Add props and the rail import.** Change the import block to add:
```tsx
import AttentionRail, { type RailFilter } from './AttentionRail'
```
Change the component signature and add props (replace `export default function MobileBoard() {`):
```tsx
interface Props {
  activeFilter: RailFilter | null
  setActiveFilter: (f: RailFilter | null) => void
  filterFn: (o: Order) => boolean
}

export default function MobileBoard({ activeFilter, setActiveFilter, filterFn }: Props) {
```

- [ ] **Step 2: Derive display counts + rows from the filter, and auto-focus on filter change.** Replace the smart-default `useEffect` and the `const q = …` block with this (keeps the initial default-focus behavior, adds filter-driven counts/rows and auto-focus):
```tsx
  const filtering = activeFilter !== null

  // When filtering, chip counts + the focused list reflect filterFn over loaded rows;
  // otherwise chips use the raw per-status totals and the list shows all loaded rows.
  const displayCounts = (filtering
    ? Object.fromEntries(CHIPS.map((c) => [c.status, rowsByStatus[c.status].filter(filterFn).length]))
    : counts) as Record<Order['status'], number>
  const displayRows = filtering ? rowsByStatus[focused].filter(filterFn) : rowsByStatus[focused]

  // Pick the status with the most matches for `predicate`; ties break by CHIPS order; else Booked.
  function pickFocus(predicate: (o: Order) => boolean): Order['status'] {
    let best: Order['status'] = 'Booked'
    let bestN = 0
    for (const c of CHIPS) {
      const n = rowsByStatus[c.status].filter(predicate).length
      if (n > bestN) { bestN = n; best = c.status }
    }
    return best
  }

  // Smart default focus (most delayed loaded rows, else Booked), once, when data first lands.
  useEffect(() => {
    if (didDefault.current || !anyPage) return
    const today = todayStr()
    setFocused(pickFocus((o) => o.status !== 'Delivered' && o.delivery_date < today))
    didDefault.current = true
  }, [booked.data, started.data, ready.data, partial.data, delivered.data])

  // On filter change: a date filter auto-focuses the status with the most matches;
  // clearing it restores the smart default (most delayed, else Booked).
  useEffect(() => {
    const today = todayStr()
    setFocused(pickFocus(filtering ? filterFn : (o) => o.status !== 'Delivered' && o.delivery_date < today))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter])

  const q = queries[focused]
  const chip = CHIPS.find((c) => c.status === focused)!
```

- [ ] **Step 3: Render the rail and feed display counts/rows to the children.** Replace the returned JSX with:
```tsx
  return (
    <div className="space-y-3">
      <AttentionRail activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <ColumnChips chips={CHIPS} counts={displayCounts} selected={focused} onSelect={setFocused} />
      <FocusedColumn
        label={chip.label}
        accent={chip.accent}
        value={value[focused]}
        count={displayCounts[focused] ?? 0}
        rows={displayRows}
        isLoading={q.isLoading}
        hasNextPage={!!q.hasNextPage && !filtering}
        isFetchingNextPage={q.isFetchingNextPage}
        onLoadMore={() => q.fetchNextPage()}
        emptyLabel={filtering ? `No matching ${chip.label} orders` : `No ${chip.label} orders`}
      />
    </div>
  )
```
(`hasNextPage && !filtering` disables paginate-on-scroll while filtering, since filtered counts are over loaded rows and loading more raw pages would shift them; the desktop board has the same loaded-rows semantics.)

- [ ] **Step 4: Type-check** — Expected: PASS.

### Task 2.3: Pass filter state from KanbanBoard
**Files:** Modify `frontend/src/components/dashboard/KanbanBoard.tsx`

- [ ] **Step 1: Pass props to MobileBoard.** Change `<MobileBoard />` to:
```tsx
        <MobileBoard activeFilter={activeFilter} setActiveFilter={setActiveFilter} filterFn={filterFn} />
```
`activeFilter`, `setActiveFilter`, and `filterFn` already exist in `KanbanBoard`. Note `SummaryStrip`'s `ActiveFilter` type and `AttentionRail`'s `RailFilter` are both `'today' | 'upcoming' | 'delayed'` (RailFilter is the non-null subset) — the values are identical, so passing `activeFilter`/`setActiveFilter` is type-compatible. If the compiler flags the `null` union, the existing `ActiveFilter` (`… | null`) already matches `RailFilter | null`.

- [ ] **Step 2: Type-check** — Expected: PASS. If a type mismatch appears between `ActiveFilter` and `RailFilter | null`, align by importing and using `ActiveFilter` from `./SummaryStrip` for the `MobileBoard`/`AttentionRail` props instead of the local `RailFilter` alias (same string union).

- [ ] **Step 3: Browser sweep (Unit 2 checkpoint)** — restart frontend. At **375px**: the rail shows Delayed (red) · Today (amber) · Upcoming (neutral) with counts; tapping Delayed filters, chips switch to filtered counts, focus jumps to the status with the most matches; tapping other chips shows their filtered subset; the Delivered chip reads 0 under a date filter; tapping the pill again clears it and restores the smart default focus + raw counts. Desktop unchanged. No console errors.

- [ ] **Step 4: Commit**
```bash
git add "frontend/src/components/dashboard/AttentionRail.tsx" "frontend/src/components/dashboard/MobileBoard.tsx" "frontend/src/components/dashboard/KanbanBoard.tsx"
git commit -m "feat(VS-17): mobile attention rail (Delayed/Today/Upcoming) with filtered chips + auto-focus"
```

**✅ Unit 2 checkpoint:** attention rail filters with smart auto-focus; feature complete.

---

## Post-feature wrap (after Unit 2)
- [ ] CRG incremental build over the unit commits + store progress to mnemon.
- [ ] Update `docs/workflow/vertical-slices.md` Active Window (responsive Kanban landed; remaining VS-17 = full-screen mobile drawers/sheets audit, 375/768 sweep).
- [ ] Optional `/design-review` pass at 375/768.
