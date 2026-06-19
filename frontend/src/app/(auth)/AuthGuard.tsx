'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { getMe } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'

// Keeps logged-in users off the auth screens (login / forgot / reset). Auth is a
// cookie-JWT and the store isn't persisted across reloads, so we ask the server: a
// successful /me means there's a live session → send them to the dashboard. A 401
// (handled silently by the client on these paths — no redirect loop) means "not
// logged in", so we render the page. A brief spinner avoids flashing the form.
export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    getMe()
      .then((user) => {
        if (!active) return
        login(user)
        router.replace('/dashboard')
      })
      .catch(() => {
        if (active) setChecking(false)
      })
    return () => { active = false }
  }, [])

  if (checking) {
    return (
      <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
    )
  }

  return <>{children}</>
}
