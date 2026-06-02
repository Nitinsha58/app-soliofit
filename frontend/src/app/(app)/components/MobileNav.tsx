'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/stores/useUIStore'

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3" y2="6" strokeWidth="2.5" />
      <line x1="3" y1="12" x2="3" y2="12" strokeWidth="2.5" />
      <line x1="3" y1="18" x2="3" y2="18" strokeWidth="2.5" />
    </svg>
  )
}

function PaymentsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function CustomersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

const tabs = [
  { href: '/dashboard', label: 'Home', icon: <HomeIcon /> },
  { href: '/orders', label: 'Orders', icon: <OrdersIcon /> },
  { href: '/payments', label: 'Payments', icon: <PaymentsIcon /> },
  { href: '/customers', label: 'Customers', icon: <CustomersIcon /> },
]

export default function MobileNav() {
  const pathname = usePathname()
  const openAddOrder = useUIStore((s) => s.openAddOrder)

  return (
    // Not fixed — sits at the bottom of the AppShell flex column so iOS URL-bar
    // changes don't affect its position. Safe-area padding grows the nav below
    // the 56px icon row without squishing it (padding is outside the h-14 div).
    <nav className="lg:hidden flex-shrink-0 bg-white border-t border-[#E5E5E2]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="h-14 flex items-center justify-around w-full px-2">
        {/* First 2 tabs */}
        {tabs.slice(0, 2).map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active ? 'text-[#C8952A]' : 'text-[#A0A09C]'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}

        {/* Center FAB */}
        <button
          onClick={openAddOrder}
          className="w-12 h-12 rounded-full bg-[#C8952A] flex items-center justify-center shadow-lg -mt-4 flex-shrink-0"
          aria-label="Add order"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Last 2 tabs */}
        {tabs.slice(2).map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active ? 'text-[#C8952A]' : 'text-[#A0A09C]'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
