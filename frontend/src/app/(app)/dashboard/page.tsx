'use client'

import Link from 'next/link'
import KanbanBoard from '@/components/dashboard/KanbanBoard'
import NotificationBell from '@/components/dashboard/NotificationBell'
import ProfileMenu from '@/app/(app)/components/ProfileMenu'
import { useUIStore } from '@/stores/useUIStore'

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default function DashboardPage() {
  const openAddOrder = useUIStore((s) => s.openAddOrder)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1A1A18]">Dashboard</h1>
        <div className="flex items-center gap-2">
          {/* Calendar shortcut — mobile entry point (desktop uses the sidebar) */}
          <Link
            href="/calendar"
            aria-label="Calendar"
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-[#E5E5E2] text-[#6B6B67] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <CalendarIcon />
          </Link>
          {/* Bell visible on mobile only (sidebar handles desktop) */}
          <div className="lg:hidden">
            <NotificationBell dropdownSide="right" />
          </div>
          {/* Profile/avatar menu — mobile entry to Settings + Logout (desktop uses sidebar) */}
          <div className="lg:hidden">
            <ProfileMenu />
          </div>
          <button
            onClick={openAddOrder}
            className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] transition-colors"
          >
            <PlusIcon />
            Add Order
          </button>
        </div>
      </div>
      <KanbanBoard />
    </div>
  )
}
