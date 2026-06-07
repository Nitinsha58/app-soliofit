const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(public readonly httpStatus: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// DRF returns `{detail: "..."}` for view-level errors but `{field: ["..."]}`
// for serializer field validation. Prefer detail, then fall back to the first
// field error string so form-level messages (e.g. wrong password) surface.
function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.detail === 'string') return obj.detail
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') return value
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
    }
  }
  return 'API error'
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new ApiError(res.status, extractErrorMessage(error))
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
