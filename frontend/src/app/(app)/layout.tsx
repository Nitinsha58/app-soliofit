import type { ReactNode } from 'react'
import AppShell from './components/AppShell'
import QueryProvider from '@/components/QueryProvider'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AppShell>{children}</AppShell>
    </QueryProvider>
  )
}
