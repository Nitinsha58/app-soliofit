'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomerDetail } from '@/lib/api/customers'
import { updateCustomer, deleteCustomer } from '@/lib/api/customers'
import { ApiError } from '@/lib/api/client'

interface Props {
  customer: CustomerDetail
  onCustomerChange: (updates: Partial<CustomerDetail>) => void
}

function fmtAmount(s: string) {
  const n = parseFloat(s) || 0
  if (n >= 100_000) return '₹' + (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000) return '₹' + (n / 1_000).toFixed(1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function EditableField({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (v: string) => void
  onBlur: () => void
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#A0A09C] uppercase tracking-wide mb-0.5">{label}</p>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full text-sm text-[#1A1A18] bg-transparent border-b border-transparent hover:border-[#E5E5E2] focus:border-[#C8952A] outline-none py-0.5 transition-colors placeholder:text-[#C8C8C4]"
      />
    </div>
  )
}

export default function CustomerProfileHeader({ customer, onCustomerChange }: Props) {
  const router = useRouter()
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone)
  const [address, setAddress] = useState(customer.address)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const savedRef = useRef({ name: customer.name, phone: customer.phone, address: customer.address })

  async function saveField(field: 'name' | 'phone' | 'address', value: string) {
    if (value === savedRef.current[field] || !value.trim()) return
    try {
      await updateCustomer(customer.id, { [field]: value })
      savedRef.current[field] = value
      onCustomerChange({ [field]: value } as Partial<CustomerDetail>)
    } catch {
      // revert to last saved
      if (field === 'name') setName(savedRef.current.name)
      if (field === 'phone') setPhone(savedRef.current.phone)
      if (field === 'address') setAddress(savedRef.current.address)
    }
  }

  async function handleDelete() {
    try {
      await deleteCustomer(customer.id)
      router.push('/customers')
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Cannot delete customer')
      setConfirmDelete(false)
    }
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const whatsappHref = `https://wa.me/${phone.replace(/\D/g, '')}`

  return (
    <div className="bg-white border-b border-[#E5E5E2] px-6 pt-4 pb-5">
      {/* Back */}
      <button
        onClick={() => router.push('/customers')}
        className="flex items-center gap-1.5 text-xs text-[#A0A09C] hover:text-[#1A1A18] transition-colors mb-4"
      >
        <BackIcon />
        Customers
      </button>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-[#FBF3E3] flex items-center justify-center flex-shrink-0">
          <span className="text-base font-bold text-[#C8952A]">{initials}</span>
        </div>

        {/* Fields */}
        <div className="flex-1 min-w-0 space-y-2">
          <EditableField
            label="Name"
            value={name}
            placeholder="Customer name"
            onChange={setName}
            onBlur={() => saveField('name', name)}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <EditableField
                label="Phone"
                value={phone}
                placeholder="Phone number"
                onChange={setPhone}
                onBlur={() => saveField('phone', phone)}
              />
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2D7A4F] hover:text-[#25613F] transition-colors flex-shrink-0 mb-1"
              aria-label="Open WhatsApp"
            >
              <WhatsAppIcon />
            </a>
          </div>
          <EditableField
            label="Address"
            value={address}
            placeholder="Address (optional)"
            onChange={setAddress}
            onBlur={() => saveField('address', address)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-[#E5E5E2] grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Orders</p>
          <p className="text-lg font-bold text-[#1A1A18] mt-0.5 tabular-nums">{customer.total_orders}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Total Spent</p>
          <p className="text-lg font-bold text-emerald-600 mt-0.5 tabular-nums">{fmtAmount(customer.total_spent)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Outstanding</p>
          <p className={`text-lg font-bold mt-0.5 tabular-nums ${parseFloat(customer.outstanding_balance) > 0 ? 'text-amber-600' : 'text-[#1A1A18]'}`}>
            {fmtAmount(customer.outstanding_balance)}
          </p>
        </div>
      </div>

      {/* Delete */}
      {deleteError && <p className="text-xs text-red-600 mt-3">{deleteError}</p>}
      {confirmDelete ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setConfirmDelete(false)}
            className="flex-1 py-1.5 text-xs font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 py-1.5 text-xs font-medium text-white bg-[#B91C1C] rounded-lg hover:bg-red-700 transition-colors"
          >
            Confirm Delete
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="mt-3 text-xs text-[#A0A09C] hover:text-[#B91C1C] transition-colors"
        >
          Delete customer
        </button>
      )}
    </div>
  )
}
