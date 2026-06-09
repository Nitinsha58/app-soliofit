'use client'

import { useEffect, useRef, useState } from 'react'
import type { Order } from '@/lib/api/orders'
import { useColumnQuery } from './BoardColumn'
import ColumnChips, { type Chip } from './ColumnChips'
import FocusedColumn from './FocusedColumn'
import AttentionRail, { type RailFilter } from './AttentionRail'

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

interface Props {
  activeFilter: RailFilter | null
  setActiveFilter: (f: RailFilter | null) => void
  filterFn: (o: Order) => boolean
}

export default function MobileBoard({ activeFilter, setActiveFilter, filterFn }: Props) {
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

  const anyPage = booked.data?.pages[0] ?? started.data?.pages[0] ?? ready.data?.pages[0] ?? partial.data?.pages[0] ?? delivered.data?.pages[0]
  const counts = anyPage?.counts ?? ZERO_COUNTS
  const value = anyPage?.value ?? ZERO_VALUE

  const [focused, setFocused] = useState<Order['status']>('Booked')
  const didDefault = useRef(false)

  const filtering = activeFilter !== null

  // When filtering, chip counts + the focused list reflect filterFn over loaded rows;
  // otherwise chips use raw per-status totals and the list shows all loaded rows.
  const displayCounts = (filtering
    ? Object.fromEntries(CHIPS.map((c) => [c.status, rowsByStatus[c.status].filter(filterFn).length]))
    : counts) as Record<Order['status'], number>
  const displayRows = filtering ? rowsByStatus[focused].filter(filterFn) : rowsByStatus[focused]

  // Status with the most matches for `predicate`; ties break by CHIPS order; else Booked.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
}
