'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, type CustomerFormData } from '@/lib/validations/customer'
import { sanitizePhone } from '@/lib/customerPrefill'
import { createCustomer, type Customer } from '@/lib/api/customers'

interface Props {
  onClose: () => void
  onCreated: (customer: Customer) => void
  // Prefill seeded from the page's search box (phone-like → phone, else name).
  initialName?: string
  initialPhone?: string
}

export default function CreateCustomerModal({ onClose, onCreated, initialName = '', initialPhone = '' }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: initialName, phone: initialPhone, address: '' },
  })

  // defaultValues only apply on first mount; if the modal stays mounted and the prefill changes
  // (or it reopens with a new search), reset the fields to the new seed.
  useEffect(() => {
    reset({ name: initialName, phone: initialPhone, address: '' })
  }, [initialName, initialPhone, reset])

  async function onSubmit(data: CustomerFormData) {
    const customer = await createCustomer(data)
    onCreated(customer)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl lg:rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.12)] w-full lg:max-w-md p-6 max-h-[92vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#1A1A18]">Add Customer</h2>
          <button
            onClick={onClose}
            className="text-[#A0A09C] hover:text-[#1A1A18] transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[#1A1A18] mb-1">
              Name
            </label>
            <input
              {...register('name')}
              id="name"
              type="text"
              autoFocus
              className="w-full px-3 py-2.5 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
              placeholder="Customer name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-[#B91C1C]">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-[#1A1A18] mb-1">
              Phone
            </label>
            <input
              {...register('phone')}
              // Sanitize via setValue so RHF/zod store the cleaned digits — not just the DOM.
              // (Mutating e.target.value inside register's onChange can leave RHF with the raw
              // typed/pasted value, e.g. "+91 9876543210" failing validation while the field
              // shows "9876543210".)
              onChange={(e) => setValue('phone', sanitizePhone(e.target.value), { shouldValidate: true })}
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className="w-full px-3 py-2.5 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
              placeholder="10-digit phone number"
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-[#B91C1C]">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-[#1A1A18] mb-1">
              Address{' '}
              <span className="text-[#A0A09C] font-normal">(optional)</span>
            </label>
            <textarea
              {...register('address')}
              id="address"
              rows={2}
              className="w-full px-3 py-2.5 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A] resize-none"
              placeholder="Address"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-[#E5E5E2] text-sm font-medium text-[#6B6B67] rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Adding…' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
