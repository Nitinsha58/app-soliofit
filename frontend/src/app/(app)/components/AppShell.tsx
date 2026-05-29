'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { getMe } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore } from '@/stores/useUIStore'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import AddOrderFlow from '@/components/orders/AddOrderFlow'

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, login } = useAuthStore()
  const [checking, setChecking] = useState(!isAuthenticated)
  const hasChecked = useRef(false)
  const { showAddOrder, closeAddOrder, triggerOrdersRefresh } = useUIStore()

  useEffect(() => {
    if (isAuthenticated) {
      setChecking(false)
      return
    }
    if (hasChecked.current) return
    hasChecked.current = true

    getMe()
      .then((user) => {
        login(user)
        setChecking(false)
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Sidebar />
      <div className="lg:pl-60 min-h-screen pb-14 lg:pb-0">
        {children}
      </div>
      <MobileNav />
      {showAddOrder && (
        <AddOrderFlow
          onClose={closeAddOrder}
          onCreated={() => {
            closeAddOrder()
            triggerOrdersRefresh()
          }}
        />
      )}
    </div>
  )
}
