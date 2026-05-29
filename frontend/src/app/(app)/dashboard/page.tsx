'use client'

import KanbanBoard from '@/components/dashboard/KanbanBoard'
import { useUIStore } from '@/stores/useUIStore'

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function DashboardPage() {
  const openAddOrder = useUIStore((s) => s.openAddOrder)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1A1A18]">Orders</h1>
        <button
          onClick={openAddOrder}
          className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] transition-colors"
        >
          <PlusIcon />
          Add Order
        </button>
      </div>
      <KanbanBoard />
    </div>
  )
}
