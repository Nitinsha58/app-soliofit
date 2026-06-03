import { apiRequest } from './client'

export interface Activity {
  id: string
  activity_type: string
  metadata: Record<string, string>
  created_at: string
}

export async function fetchActivities(orderId: string): Promise<Activity[]> {
  return apiRequest<Activity[]>(`/api/orders/${orderId}/activities/`)
}
