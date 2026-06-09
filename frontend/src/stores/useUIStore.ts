import { create } from 'zustand'

interface UIStore {
  showAddOrder: boolean
  openAddOrder: () => void
  closeAddOrder: () => void
  ordersRefreshKey: number
  triggerOrdersRefresh: () => void
  selectedOrderId: string | null
  openOrderDetail: (id: string) => void
  closeOrderDetail: () => void
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void
  // Lightweight global toast (single, transient). Rendered by ToastHost in AppShell.
  toast: { id: number; message: string } | null
  showToast: (message: string) => void
  dismissToast: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  showAddOrder: false,
  openAddOrder: () => set({ showAddOrder: true }),
  closeAddOrder: () => set({ showAddOrder: false }),
  ordersRefreshKey: 0,
  triggerOrdersRefresh: () => set((s) => ({ ordersRefreshKey: s.ordersRefreshKey + 1 })),
  selectedOrderId: null,
  openOrderDetail: (id) => set({ selectedOrderId: id }),
  closeOrderDetail: () => set({ selectedOrderId: null }),
  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toast: null,
  showToast: (message) => set({ toast: { id: Date.now(), message } }),
  dismissToast: () => set({ toast: null }),
}))
