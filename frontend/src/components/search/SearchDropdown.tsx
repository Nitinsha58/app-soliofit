'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearch } from './useSearch'
import SearchResults from './SearchResults'

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export default function SearchDropdown() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const { inputValue, setInputValue, debouncedQ, isFetching, customers, orders, showEmpty } = useSearch('')

  useEffect(() => {
    function onClick(e: MouseEvent) { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [])

  const showPanel = open && debouncedQ.length >= 2

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-md ml-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#F5F5F3] border border-[#E5E5E2] rounded-lg focus-within:border-[#C8952A]">
        <span className="text-[#A0A09C]"><SearchIcon /></span>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search customers, orders…  ⌘K"
          value={inputValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true) }}
          className="flex-1 bg-transparent text-sm text-[#1A1A18] placeholder-[#A0A09C] focus:outline-none"
        />
        {isFetching && <span className="w-4 h-4 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />}
      </div>
      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-[70vh] overflow-y-auto bg-[#FAFAF8] border border-[#E5E5E2] rounded-xl shadow-xl p-2 z-50">
          <SearchResults customers={customers} orders={orders} showHint={false} showEmpty={showEmpty} debouncedQ={debouncedQ} onSelect={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
