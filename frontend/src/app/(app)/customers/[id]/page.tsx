'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getCustomer, type CustomerDetail } from '@/lib/api/customers'
import CustomerProfileHeader from '@/components/customers/CustomerProfile/CustomerProfileHeader'
import CustomerOrdersTab from '@/components/customers/CustomerProfile/CustomerOrdersTab'
import CustomerPaymentsTab from '@/components/customers/CustomerProfile/CustomerPaymentsTab'
import CustomerMediaTab from '@/components/customers/CustomerProfile/CustomerMediaTab'

type Tab = 'orders' | 'payments' | 'media'
const TABS: { key: Tab; label: string }[] = [
  { key: 'orders',   label: 'Orders' },
  { key: 'payments', label: 'Payments' },
  { key: 'media',    label: 'Media' },
]

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [overrides, setOverrides] = useState<Partial<CustomerDetail>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id),
  })

  const customer = data ? { ...data, ...overrides } : null

  if (isLoading || !customer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <CustomerProfileHeader
        customer={customer}
        onCustomerChange={(updates) => setOverrides((prev) => ({ ...prev, ...updates }))}
      />

      {/* Tabs */}
      <div className="flex border-b border-[#E5E5E2] bg-white px-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'border-[#C8952A] text-[#C8952A]'
                : 'border-transparent text-[#6B6B67] hover:text-[#1A1A18]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-20">
        {activeTab === 'orders'   && <CustomerOrdersTab   customerId={id} />}
        {activeTab === 'payments' && <CustomerPaymentsTab customerId={id} />}
        {activeTab === 'media'    && <CustomerMediaTab    customerId={id} />}
      </div>
    </div>
  )
}
