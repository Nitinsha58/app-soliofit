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
import OrderDetailDrawer from '@/components/orders/OrderDetailDrawer'

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, login } = useAuthStore()
  const [checking, setChecking] = useState(!isAuthenticated)
  const hasChecked = useRef(false)
  const {
    showAddOrder, closeAddOrder,
    triggerOrdersRefresh,
    selectedOrderId, closeOrderDetail,
  } = useUIStore()

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
    <div className="h-dvh flex flex-col bg-[#FAFAF8] overflow-hidden">
      <Sidebar />
      {/* flex-1 + overflow-y-auto: content scrolls inside the shell, not the document.
          overscroll-contain allows natural rubber-band within this div on iOS,
          but prevents scroll chaining up to the (non-scrolling) body. */}
      <div className="flex-1 overflow-y-auto overscroll-contain lg:pl-60">
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
      {selectedOrderId && (
        <OrderDetailDrawer
          orderId={selectedOrderId}
          onClose={closeOrderDetail}
          onUpdated={triggerOrdersRefresh}
        />
      )}
    </div>
  )
}
