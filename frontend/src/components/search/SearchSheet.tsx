'use client'

import { useEffect, useRef } from 'react'
import { useSearch } from './useSearch'
import SearchResults from './SearchResults'
import { useUIStore } from '@/stores/useUIStore'

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export default function SearchSheet() {
  const closeSearch = useUIStore((s) => s.closeSearch)
  const inputRef = useRef<HTMLInputElement>(null)
  const { inputValue, setInputValue, debouncedQ, isFetching, customers, orders, showHint, showEmpty } = useSearch('')

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeSearch() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeSearch])

  return (
    <div className="fixed inset-0 z-50 bg-[#FAFAF8] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-b border-[#E5E5E2] bg-white">
        <button onClick={closeSearch} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-lg text-[#6B6B67] hover:bg-[#F5F5F3]">
          <BackIcon />
        </button>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search customers or order #"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#F5F5F3] border border-[#E5E5E2] rounded-lg text-sm text-[#1A1A18] placeholder-[#A0A09C] focus:outline-none focus:ring-2 focus:ring-[#C8952A]/30 focus:border-[#C8952A]"
        />
        {isFetching && <span className="w-4 h-4 mr-1 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <SearchResults customers={customers} orders={orders} showHint={showHint} showEmpty={showEmpty} debouncedQ={debouncedQ} onSelect={closeSearch} />
      </div>
    </div>
  )
}
