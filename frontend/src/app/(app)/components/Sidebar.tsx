'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout as logoutApi } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function CustomersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/orders', label: 'Orders', icon: <OrdersIcon /> },
  { href: '/payments', label: 'Payments', icon: <PaymentsIcon /> },
  { href: '/customers', label: 'Customers', icon: <CustomersIcon /> },
  { href: '/calendar', label: 'Calendar', icon: <CalendarIcon /> },
]

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-[#FBF3E3] text-[#C8952A]'
          : 'text-[#6B6B67] hover:bg-gray-50 hover:text-[#1A1A18]'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#C8952A] rounded-r-full" />
      )}
      <span className={`flex-shrink-0 ${active ? 'text-[#C8952A]' : 'text-[#A0A09C]'}`}>
        {icon}
      </span>
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout: storeLogout } = useAuthStore()

  async function handleLogout() {
    await logoutApi().catch(() => {})
    storeLogout()
    router.push('/login')
  }

  const settingsActive = pathname.startsWith('/settings')

  return (
    <aside className="fixed left-0 top-0 z-40 w-60 h-screen hidden lg:flex flex-col bg-white border-r border-[#E5E5E2]">
      <div className="px-5 py-5 border-b border-[#E5E5E2] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-lg font-semibold text-[#1A1A18] tracking-tight">Soliofit</span>
          {user?.business_name && (
            <p className="text-xs text-[#6B6B67] mt-0.5 truncate">{user.business_name}</p>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      <div className="px-3 pb-4 pt-3 border-t border-[#E5E5E2] space-y-0.5">
        <Link
          href="/settings"
          className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            settingsActive
              ? 'bg-[#FBF3E3] text-[#C8952A]'
              : 'text-[#6B6B67] hover:bg-gray-50 hover:text-[#1A1A18]'
          }`}
        >
          {settingsActive && (
            <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#C8952A] rounded-r-full" />
          )}
          <span className={`flex-shrink-0 ${settingsActive ? 'text-[#C8952A]' : 'text-[#A0A09C]'}`}>
            <SettingsIcon />
          </span>
          Settings
        </Link>

        <div className="px-3 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FBF3E3] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#C8952A]">
              {(user?.business_name ?? user?.owner_name ?? 'S').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A18] truncate leading-tight">
              {user?.business_name || 'My Boutique'}
            </p>
            {user?.owner_name && (
              <p className="text-xs text-[#6B6B67] truncate mt-0.5">{user.owner_name}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#6B6B67] hover:bg-gray-50 hover:text-[#1A1A18] transition-colors"
        >
          <span className="text-[#A0A09C]">
            <LogoutIcon />
          </span>
          Log out
        </button>
      </div>
    </aside>
  )
}
