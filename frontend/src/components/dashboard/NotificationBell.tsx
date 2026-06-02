'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNotificationCounts, fetchNotifications } from '@/lib/api/dashboard'
import type { OrderAlert, InstallmentAlert } from '@/lib/api/dashboard'
import { useUIStore } from '@/stores/useUIStore'

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function fmtDate(s: string) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function fmtAmount(s: string) {
  const n = parseFloat(s) || 0
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

interface OrderRowProps {
  item: OrderAlert
  onOpen: (id: string) => void
}

function OrderRow({ item, onOpen }: OrderRowProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="w-full text-left px-4 py-2 hover:bg-[#F7F7F5] transition-colors flex items-center justify-between gap-2"
    >
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-[#1A1A18]">#{item.order_number}</span>
        <span className="text-xs text-[#6B6B67] ml-1 truncate">· {item.customer_name}</span>
      </div>
      <span className="text-[11px] text-[#A0A09C] flex-shrink-0">{fmtDate(item.delivery_date)}</span>
    </button>
  )
}

interface InstallmentRowProps {
  item: InstallmentAlert
  onOpen: (id: string) => void
}

function InstallmentRow({ item, onOpen }: InstallmentRowProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.order_id)}
      className="w-full text-left px-4 py-2 hover:bg-[#F7F7F5] transition-colors flex items-center justify-between gap-2"
    >
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-[#1A1A18]">#{item.order_number}</span>
        <span className="text-xs text-[#6B6B67] ml-1 truncate">· {item.customer_name}</span>
        <span className="text-xs text-[#C8952A] ml-1 font-medium">{fmtAmount(item.amount)}</span>
      </div>
      <span className="text-[11px] text-[#A0A09C] flex-shrink-0">{fmtDate(item.due_date)}</span>
    </button>
  )
}

interface SectionProps {
  title: string
  count: number
  accentColor: string
  children: React.ReactNode
}

function Section({ title, count, accentColor, children }: SectionProps) {
  if (count === 0) return null
  return (
    <div>
      <div className={`flex items-center gap-2 px-4 py-1.5 bg-[#F7F7F5] border-b border-[#E5E5E2]`}>
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${accentColor}`}>{title}</span>
        <span className={`text-[10px] font-bold tabular-nums ${accentColor}`}>{count}</span>
      </div>
      {children}
    </div>
  )
}

interface Props {
  dropdownSide?: 'left' | 'right'
}

export default function NotificationBell({ dropdownSide = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)

  const { data: counts } = useQuery({
    queryKey: ['notification-counts'],
    queryFn: fetchNotificationCounts,
  })

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen(orderId: string) {
    setOpen(false)
    openOrderDetail(orderId)
  }

  const total = counts?.total ?? 0
  const hasAny = total > 0

  const dropdownClass =
    dropdownSide === 'left'
      ? 'absolute left-0 top-full mt-2 w-80 z-50'
      : 'absolute right-0 top-full mt-2 w-80 z-50'

  const allEmpty =
    notifs &&
    notifs.delivery_due_today.length === 0 &&
    notifs.delayed_delivery.length === 0 &&
    notifs.installment_due_today.length === 0 &&
    notifs.overdue_installment.length === 0

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-1.5 rounded-lg transition-colors ${
          open
            ? 'bg-[#FBF3E3] text-[#C8952A]'
            : 'text-[#A0A09C] hover:text-[#1A1A18] hover:bg-gray-50'
        }`}
        aria-label={`Notifications${total > 0 ? ` (${total})` : ''}`}
      >
        <BellIcon />
        {hasAny && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className={`${dropdownClass} bg-white rounded-xl border border-[#E5E5E2] shadow-xl overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[#E5E5E2] flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1A1A18]">Alerts</p>
            {hasAny && (
              <span className="text-xs font-semibold text-red-500 tabular-nums">{total} total</span>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {!notifs ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : allEmpty ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[#A0A09C]">No alerts right now</p>
              </div>
            ) : (
              <>
                <Section
                  title="Delivery Due Today"
                  count={notifs.delivery_due_today.length}
                  accentColor="text-amber-600"
                >
                  {notifs.delivery_due_today.map((item) => (
                    <OrderRow key={item.id} item={item} onOpen={handleOpen} />
                  ))}
                </Section>

                <Section
                  title="Delayed Delivery"
                  count={notifs.delayed_delivery.length}
                  accentColor="text-red-500"
                >
                  {notifs.delayed_delivery.map((item) => (
                    <OrderRow key={item.id} item={item} onOpen={handleOpen} />
                  ))}
                </Section>

                <Section
                  title="Installment Due Today"
                  count={notifs.installment_due_today.length}
                  accentColor="text-amber-600"
                >
                  {notifs.installment_due_today.map((item) => (
                    <InstallmentRow key={item.id} item={item} onOpen={handleOpen} />
                  ))}
                </Section>

                <Section
                  title="Overdue Installments"
                  count={notifs.overdue_installment.length}
                  accentColor="text-red-500"
                >
                  {notifs.overdue_installment.map((item) => (
                    <InstallmentRow key={item.id} item={item} onOpen={handleOpen} />
                  ))}
                </Section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
