import { apiRequest } from './client'

export interface CalendarDay {
  count: number
  has_overdue: boolean
}

// month is 1-indexed (Jan = 1), matching the backend query params.
export async function fetchCalendar(
  year: number,
  month: number,
): Promise<Record<string, CalendarDay>> {
  return apiRequest(`/api/calendar/?year=${year}&month=${month}`)
}
