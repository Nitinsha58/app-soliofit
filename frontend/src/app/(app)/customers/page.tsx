'use client'

import { useState, useEffect, useRef } from 'react'
import { listCustomers, deleteCustomer, type Customer } from '@/lib/api/customers'
import CustomerCard from '@/components/customers/CustomerCard'
import CreateCustomerModal from '@/components/customers/CreateCustomerModal'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchCustomers(q: string) {
    setLoading(true)
    try {
      const data = await listCustomers(q.trim() || undefined)
      setCustomers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers('')
  }, [])

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCustomers(value), 300)
  }

  async function handleDelete(id: string) {
    await deleteCustomer(id)
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }

  function handleCreated(customer: Customer) {
    setCustomers((prev) => [customer, ...prev])
    setShowCreate(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1A1A18]">Customers</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] transition-colors"
        >
          <PlusIcon />
          Add Customer
        </button>
      </div>

      <div className="relative mb-6">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A09C] pointer-events-none">
          <SearchIcon />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full pl-9 pr-4 py-2.5 border border-[#E5E5E2] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="text-[#C8C8C4] mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <p className="text-sm font-medium text-[#6B6B67]">
            {search ? 'No customers found' : 'No customers yet'}
          </p>
          <p className="text-xs text-[#A0A09C] mt-1">
            {search
              ? 'Try a different name or phone number'
              : 'Add your first customer to get started'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] transition-colors"
            >
              Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCustomerModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
