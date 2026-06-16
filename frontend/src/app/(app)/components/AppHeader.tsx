'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/dashboard/NotificationBell'
import ProfileMenu from './ProfileMenu'
import SearchDropdown from '@/components/search/SearchDropdown'
import { useUIStore } from '@/stores/useUIStore'

const ROUTE_META: { prefix: string; title: string; addOrder?: boolean }[] = [
  { prefix: '/dashboard', title: 'Dashboard', addOrder: true },
  { prefix: '/orders',    title: 'Orders',    addOrder: true },
  { prefix: '/payments',  title: 'Payments' },
  { prefix: '/customers', title: 'Customers' },
  { prefix: '/calendar',  title: 'Calendar' },
  { prefix: '/settings',  title: 'Settings' },
  { prefix: '/search',    title: 'Search' },
]

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export default function AppHeader() {
  const pathname = usePathname()
  const openAddOrder = useUIStore((s) => s.openAddOrder)
  const openSearch = useUIStore((s) => s.openSearch)

  const meta = ROUTE_META.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + '/'))
  const title = meta?.title ?? ''

  return (
    <header className="flex-shrink-0 bg-white border-b border-[#E5E5E2] lg:pl-60">
      <div className="h-14 flex items-center gap-3 px-4 lg:px-6">
        <h1 className="text-base lg:text-lg font-semibold text-[#1A1A18] truncate flex-shrink-0">{title}</h1>

        <div className="hidden lg:flex flex-1"><SearchDropdown /></div>

        <div className="flex items-center gap-2 ml-auto">
          {meta?.addOrder && (
            <button
              onClick={openAddOrder}
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] transition-colors"
            >
              + Add Order
            </button>
          )}

          <button
            onClick={openSearch}
            aria-label="Search"
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#6B6B67] hover:bg-[#F5F5F3] transition-colors"
          >
            <SearchIcon />
          </button>

          <NotificationBell dropdownSide="right" />
          <div className="lg:hidden">
            <ProfileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
