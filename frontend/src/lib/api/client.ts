const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(public readonly httpStatus: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// Pages that must stay reachable while logged out — never auto-redirect away from
// these on a 401, otherwise the silent auth check on the login / reset screens would
// bounce the visitor in a loop.
const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password']

function onAuthPage(): boolean {
  return typeof window !== 'undefined' && AUTH_PATHS.some((p) => window.location.pathname.startsWith(p))
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

// Single-flight refresh: many requests can 401 at once (e.g. the dashboard fan-out
// after the 24h access token expires); they all await one refresh call rather than
// stampeding the endpoint. The new access_token arrives as an HttpOnly cookie, so we
// only care whether it succeeded.
let refreshInFlight: Promise<boolean> | null = null

function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/auth/refresh/`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

// Endpoints that must never trigger the refresh-retry (they ARE the auth handshake,
// so a 401 from them is terminal, not a stale-access-token signal).
const NO_REFRESH = ['/api/auth/refresh/', '/api/auth/login/']

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
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
    // Stale access token? Try the refresh cookie once, then replay the request. This
    // is what makes the 30-day session real and survive deploys: the cookie is still
    // validly signed (stable SECRET_KEY) — only the 24h access token lapsed.
    if (!retried && !NO_REFRESH.includes(path)) {
      const refreshed = await attemptRefresh()
      if (refreshed) return apiRequest<T>(path, options, true)
    }
    // Genuine auth failure. Bounce to login — but only from inside the app, never from
    // the auth pages themselves (which check auth on purpose).
    if (!onAuthPage() && typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    // 5xx / transient failures (e.g. the backend restarting mid-deploy) surface as
    // errors for React Query to retry — they must NOT log the user out.
    const error = await res.json().catch(() => ({}))
    throw new ApiError(res.status, extractErrorMessage(error))
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
