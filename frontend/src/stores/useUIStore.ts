import { create } from 'zustand'

interface UIStore {
  showAddOrder: boolean
  openAddOrder: () => void
  closeAddOrder: () => void
  ordersRefreshKey: number
  triggerOrdersRefresh: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  showAddOrder: false,
  openAddOrder: () => set({ showAddOrder: true }),
  closeAddOrder: () => set({ showAddOrder: false }),
  ordersRefreshKey: 0,
  triggerOrdersRefresh: () => set((s) => ({ ordersRefreshKey: s.ordersRefreshKey + 1 })),
}))
