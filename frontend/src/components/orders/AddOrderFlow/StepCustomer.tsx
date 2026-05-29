'use client'

import { useState, useRef, useEffect } from 'react'
import { listCustomers, createCustomer, type Customer } from '@/lib/api/customers'

interface Props {
  selected: Customer | null
  onSelect: (customer: Customer) => void
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function StepCustomer({ selected, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    listCustomers().then((r) => setResults(r.customers)).catch(() => {})
  }, [])

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { customers } = await listCustomers(value.trim() || undefined)
        setResults(customers)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.phone.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const customer = await createCustomer(form)
      onSelect(customer)
    } catch {
      setCreateError('Failed to create customer')
      setCreating(false)
    }
  }

  return (
    <div>
      <p className="text-xs text-[#6B6B67] mb-3">Search or create a customer</p>

      {selected && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-[#FBF3E3] rounded-lg border border-[#C8952A]/20">
          <div className="w-8 h-8 rounded-full bg-[#C8952A]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[#C8952A]">
              {selected.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A18] truncate">{selected.name}</p>
            <p className="text-xs text-[#6B6B67]">{selected.phone}</p>
          </div>
          <span className="text-xs font-medium text-[#C8952A] flex-shrink-0">Selected</span>
        </div>
      )}

      <div className="relative mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full px-4 py-2.5 border border-[#E5E5E2] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
          autoFocus={!selected}
        />
      </div>

      <div className="space-y-1 max-h-44 overflow-y-auto mb-3">
        {searching ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 && search ? (
          <p className="text-xs text-center text-[#A0A09C] py-4">No customers found</p>
        ) : (
          results.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#FBF3E3] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#C8952A]">
                  {c.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A18] truncate">{c.name}</p>
                <p className="text-xs text-[#6B6B67]">{c.phone}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-[#C8952A] border border-dashed border-[#C8952A]/40 rounded-lg hover:bg-[#FBF3E3] transition-colors"
        >
          <PlusIcon />
          Create New Customer
        </button>
      ) : (
        <div className="border border-[#E5E5E2] rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-[#1A1A18]">New Customer</p>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name *"
            className="w-full px-3 py-2 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
          />
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Phone *"
            className="w-full px-3 py-2 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
          />
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Address (optional)"
            className="w-full px-3 py-2 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
          />
          {createError && <p className="text-xs text-red-600">{createError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowCreate(false); setCreateError('') }}
              className="flex-1 py-2 text-xs font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.name.trim() || !form.phone.trim()}
              className="flex-1 py-2 text-xs font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create & Select'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
