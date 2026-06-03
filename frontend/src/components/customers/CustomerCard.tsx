'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer } from '@/lib/api/customers'
import { deleteCustomer } from '@/lib/api/customers'
import { ApiError } from '@/lib/api/client'

interface Props {
  customer: Customer
  onDeleted: (id: string) => void
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function CustomerCard({ customer, onDeleted }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const initials = customer.name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const whatsappHref = `https://wa.me/${customer.phone.replace(/\D/g, '')}`

  async function handleConfirmDelete() {
    try {
      await deleteCustomer(customer.id)
      onDeleted(customer.id)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Cannot delete customer')
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E5E2] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <p className="text-sm font-semibold text-[#1A1A18] mb-1">Delete {customer.name}?</p>
        <p className="text-xs text-[#6B6B67] mb-4">This cannot be undone.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 py-2 text-xs font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            className="flex-1 py-2 text-xs font-medium text-white bg-[#B91C1C] rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/customers/${customer.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/customers/${customer.id}`)}
      className="bg-white rounded-xl border border-[#E5E5E2] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow cursor-pointer"
    >
      {deleteError && (
        <p className="text-xs text-red-600 mb-3">{deleteError}</p>
      )}

      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-full bg-[#FBF3E3] flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-[#C8952A]">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#1A1A18]">{customer.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-[#6B6B67]">{customer.phone}</p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#2D7A4F] hover:text-[#25613F] transition-colors flex-shrink-0"
              aria-label="Open WhatsApp"
            >
              <WhatsAppIcon />
            </a>
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
          className="text-[#C8C8C4] hover:text-[#B91C1C] transition-colors p-1 -mr-1 flex-shrink-0 mt-0.5"
          aria-label="Delete customer"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E5E5E2] grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Orders</p>
          <p className="text-sm font-semibold text-[#1A1A18] mt-0.5 tabular-nums">
            {customer.total_orders ?? 0}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Outstanding</p>
          <p className="text-sm font-semibold text-[#1A1A18] mt-0.5 tabular-nums">
            ₹{customer.outstanding_balance ?? 0}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Last order</p>
          <p className="text-sm font-medium text-[#6B6B67] mt-0.5">—</p>
        </div>
      </div>
    </div>
  )
}
