'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { logout as logoutApi } from '@/lib/api/auth'
import { useAuthStore, type AuthUser } from '@/stores/useAuthStore'

// Initials fallback order: owner_name → business_name → email first letter.
function initials(user: AuthUser | null): string {
  const owner = user?.owner_name?.trim()
  if (owner) {
    const parts = owner.split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  const business = user?.business_name?.trim()
  if (business) return business.charAt(0).toUpperCase()
  const email = user?.email?.trim()
  if (email) return email.charAt(0).toUpperCase()
  return 'S'
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export default function ProfileMenu() {
  const router = useRouter()
  const { user, logout: storeLogout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleLogout() {
    await logoutApi().catch(() => {})
    storeLogout()
    router.push('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-lg bg-[#FBF3E3] flex items-center justify-center hover:brightness-95 transition"
      >
        <span className="text-sm font-bold text-[#C8952A]">{initials(user)}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-[#E5E5E2] shadow-lg py-1 z-50"
        >
          <div className="px-3 py-2 border-b border-[#F0F0EE]">
            <p className="text-sm font-semibold text-[#1A1A18] truncate leading-tight">
              {user?.business_name || 'My Boutique'}
            </p>
            {user?.owner_name && (
              <p className="text-xs text-[#6B6B67] truncate mt-0.5">{user.owner_name}</p>
            )}
          </div>
          <Link
            href="/calendar"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#1A1A18] hover:bg-gray-50 transition-colors"
          >
            <span className="text-[#A0A09C]"><CalendarIcon /></span>
            Calendar
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#1A1A18] hover:bg-gray-50 transition-colors"
          >
            <span className="text-[#A0A09C]"><SettingsIcon /></span>
            Settings
          </Link>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#6B6B67] hover:bg-gray-50 hover:text-[#1A1A18] transition-colors"
          >
            <span className="text-[#A0A09C]"><LogoutIcon /></span>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
