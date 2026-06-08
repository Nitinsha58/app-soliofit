'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'

// Single transient toast, bottom-center, auto-dismissing. Matches the board
// snackbar styling. No emoji (project rule).
export default function ToastHost() {
  const toast = useUIStore((s) => s.toast)
  const dismissToast = useUIStore((s) => s.dismissToast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(dismissToast, 3000)
    return () => clearTimeout(timer)
  }, [toast?.id, dismissToast])

  if (!toast) return null

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-[#1A1A18] px-4 py-2.5 text-[13px] text-white shadow-xl"
    >
      {toast.message}
    </div>
  )
}
