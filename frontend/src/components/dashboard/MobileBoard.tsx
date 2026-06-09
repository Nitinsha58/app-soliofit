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

  const anyPage = booked.data?.pages[0] ?? started.data?.pages[0] ?? ready.data?.pages[0] ?? partial.data?.pages[0] ?? delivered.data?.pages[0]
  const counts = anyPage?.counts ?? ZERO_COUNTS
  const value = anyPage?.value ?? ZERO_VALUE

  const [focused, setFocused] = useState<Order['status']>('Booked')
  const didDefault = useRef(false)

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
