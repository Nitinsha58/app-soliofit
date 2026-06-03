'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchActivities, type Activity } from '@/lib/api/activities'

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function fmtAmount(s: string) {
  const n = parseFloat(s) || 0
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

type IconType = 'plus' | 'arrow' | 'check' | 'truck' | 'edit' | 'dot'

function describe(a: Activity): { label: string; iconType: IconType; color: string } {
  const m = a.metadata
  switch (a.activity_type) {
    case 'order_created':
      return { label: 'Order created', iconType: 'plus', color: '#60A5FA' }
    case 'status_changed':
      return { label: `Status: ${m.from} → ${m.to}`, iconType: 'arrow', color: '#A0A09C' }
    case 'delivery_marked':
      return { label: 'Marked as Delivered', iconType: 'check', color: '#34D399' }
    case 'partial_delivery':
      return { label: 'Marked as Partial Delivery', iconType: 'truck', color: '#C8952A' }
    case 'installment_created':
      return {
        label: `Installment ${fmtAmount(m.amount)} added · due ${fmtDate(m.due_date)}`,
        iconType: 'plus',
        color: '#C8952A',
      }
    case 'installment_paid':
      return { label: `Payment ${fmtAmount(m.amount)} received`, iconType: 'check', color: '#34D399' }
    case 'payment_updated':
      return {
        label: `Installment updated to ${fmtAmount(m.amount)} · due ${fmtDate(m.due_date)}`,
        iconType: 'edit',
        color: '#A0A09C',
      }
    default:
      return { label: a.activity_type.replace(/_/g, ' '), iconType: 'dot', color: '#A0A09C' }
  }
}

function ActivityIcon({ type, color }: { type: IconType; color: string }) {
  const props = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (type) {
    case 'plus':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
    case 'arrow':
      return <svg {...props}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
    case 'check':
      return <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
    case 'truck':
      return <svg {...props}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
    case 'edit':
      return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
    default:
      return <svg {...props}><circle cx="12" cy="12" r="3" fill={color} stroke="none" /></svg>
  }
}

export default function ActivityFeed({ orderId }: { orderId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['activities', orderId],
    queryFn: () => fetchActivities(orderId),
  })

  return (
    <div className="mx-5 mb-6">
      <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide mb-2">Activity</p>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data?.length ? (
        <p className="text-xs text-[#C8C8C4] py-1">No activity yet.</p>
      ) : (
        <div>
          {data.map((activity, i) => {
            const { label, iconType, color } = describe(activity)
            return (
              <div key={activity.id} className="flex items-start gap-2.5 py-1.5 relative">
                {/* Connector line */}
                {i < data.length - 1 && (
                  <div className="absolute left-[6px] top-[22px] bottom-0 w-px bg-[#E5E5E2]" />
                )}
                <div className="flex-shrink-0 mt-0.5">
                  <ActivityIcon type={iconType} color={color} />
                </div>
                <p className="flex-1 text-xs text-[#1A1A18] min-w-0">{label}</p>
                <span className="text-[10px] text-[#A0A09C] flex-shrink-0 mt-0.5">{fmtTime(activity.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
