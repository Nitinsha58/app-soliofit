'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSearch } from '@/components/search/useSearch'
import SearchResults from '@/components/search/SearchResults'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const { inputValue, setInputValue, debouncedQ, isFetching, customers, orders, showHint, showEmpty } =
    useSearch(searchParams.get('q') ?? '')

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debouncedQ) router.replace(`/search?q=${encodeURIComponent(debouncedQ)}`, { scroll: false })
    else router.replace('/search', { scroll: false })
  }, [debouncedQ])

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="sticky top-0 z-10 bg-[#FAFAF8] border-b border-[#E5E5E2] px-4 py-3">
        <div className="relative max-w-xl mx-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A09C] pointer-events-none"><SearchIcon /></span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search customers or order #"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E5E5E2] rounded-xl text-sm text-[#1A1A18] placeholder-[#A0A09C] focus:outline-none focus:ring-2 focus:ring-[#C8952A]/30 focus:border-[#C8952A]"
          />
          {isFetching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </div>
      </div>
      <div className="max-w-xl mx-auto py-2">
        <SearchResults customers={customers} orders={orders} showHint={showHint} showEmpty={showEmpty} debouncedQ={debouncedQ} />
      </div>
    </div>
  )
}
