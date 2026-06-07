import { apiRequest } from './client'

export interface CalendarDay {
  deliveries: number
  payments: number
  payment_amount: string
  late: number
  workload: number
}

// month is 1-indexed (Jan = 1), matching the backend query params.
export async function fetchCalendar(
  year: number,
  month: number,
): Promise<Record<string, CalendarDay>> {
  return apiRequest(`/api/calendar/?year=${year}&month=${month}`)
}
