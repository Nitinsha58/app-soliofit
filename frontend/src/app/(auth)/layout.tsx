import type { ReactNode } from 'react'
import ToastHost from '../(app)/components/ToastHost'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center">
      {children}
      {/* Mounted here too (separate from AppShell) so the reset-success toast
          set just before redirecting to /login is visible — both routes share
          this layout, so it survives the client navigation. */}
      <ToastHost />
    </div>
  )
}
