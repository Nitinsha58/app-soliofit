import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSearch } from '@/lib/api/search'

export function useSearch(initialQuery = '') {
  const [inputValue, setInputValue] = useState(initialQuery)
  const [debouncedQ, setDebouncedQ] = useState(initialQuery.trim())

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(inputValue.trim()), 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => fetchSearch(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  })

  const customers = data?.customers ?? []
  const orders = data?.orders ?? []
  const hasResults = customers.length > 0 || orders.length > 0

  return {
    inputValue,
    setInputValue,
    debouncedQ,
    isFetching,
    customers,
    orders,
    hasResults,
    showEmpty: debouncedQ.length >= 2 && !isFetching && !hasResults,
    showHint: debouncedQ.length < 2 && inputValue.length === 0,
  }
}
