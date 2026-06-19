'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getMe } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore } from '@/stores/useUIStore'
import Sidebar from './Sidebar'
import AppHeader from './AppHeader'
import MobileNav from './MobileNav'
import ToastHost from './ToastHost'
import AddOrderFlow from '@/components/orders/AddOrderFlow'
import OrderDetailDrawer from '@/components/orders/OrderDetailDrawer'
import OrderCreatedModal from '@/components/orders/OrderCreatedModal'
import SearchSheet from '@/components/search/SearchSheet'
import type { Order } from '@/lib/api/orders'

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, login } = useAuthStore()
  const [checking, setChecking] = useState(!isAuthenticated)
  const hasChecked = useRef(false)
  const {
    showAddOrder, closeAddOrder,
    triggerOrdersRefresh,
    ordersRefreshKey,
    selectedOrderId, openOrderDetail, closeOrderDetail,
    searchOpen,
  } = useUIStore()

  // VS-29.4 — the just-created order awaiting the post-create "send booked message" modal.
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null)

  const queryClient = useQueryClient()
  useEffect(() => {
    if (ordersRefreshKey === 0) return
    void queryClient.invalidateQueries({ queryKey: ['orders-schedule'] })
    void queryClient.refetchQueries({ queryKey: ['dashboard-summary'] })
    void queryClient.refetchQueries({ queryKey: ['notification-counts'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['payments-summary'] })
    void queryClient.invalidateQueries({ queryKey: ['payment-orders'] })
    void queryClient.invalidateQueries({ queryKey: ['activities'] })
    void queryClient.invalidateQueries({ queryKey: ['customer'] })
    void queryClient.invalidateQueries({ queryKey: ['customer-orders'] })
    void queryClient.invalidateQueries({ queryKey: ['customer-payments'] })
    void queryClient.invalidateQueries({ queryKey: ['customer-media'] })
  }, [ordersRefreshKey])

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
      <AppHeader />
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
          onCreated={(order) => {
            closeAddOrder()
            triggerOrdersRefresh()
            setCreatedOrder(order) // show the post-create "send booked message" modal
          }}
        />
      )}
      {createdOrder && (
        <OrderCreatedModal
          order={createdOrder}
          onGoToOrder={() => {
            const id = createdOrder.id
            setCreatedOrder(null)
            openOrderDetail(id) // every exit lands on the new order's detail drawer
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
      <ToastHost />
      {searchOpen && <SearchSheet />}
    </div>
  )
}
