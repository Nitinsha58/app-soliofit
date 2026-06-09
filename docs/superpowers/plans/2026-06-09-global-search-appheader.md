# Shared AppHeader + GlobalSearch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make search a global command surface reachable from every authenticated screen (inline bar on desktop, icon→sheet on mobile), behind a persistent shared `AppHeader`, and return the mobile bottom nav to a clean five-item model.

**Architecture:** One search engine (`useSearch` hook + `SearchResults`), three shells (`SearchPage` full-page route, `SearchSheet` mobile overlay, `SearchDropdown` desktop panel). A new `AppHeader` in `AppShell` owns page title + a per-route primary-action slot + utilities (search, notifications, profile). The sidebar drops to sections only. No backend or search-API changes.

**Tech Stack:** Next.js (App Router) + React + TypeScript, Tailwind, Zustand (`useUIStore`), TanStack Query. Spec: `docs/superpowers/specs/2026-06-09-global-search-appheader-design.md`.

> **Verification model (project reality):** This frontend has **no test framework** (0 test files; only `type-check` + `lint` scripts). Do NOT add a test runner. Each task verifies with type-check + lint + a browser check. `node_modules` live in the Docker dev volume, so npm runs go through the container.
>
> Type-check: `docker compose -f docker-compose.dev.yml exec frontend npm run type-check`
> Lint: `docker compose -f docker-compose.dev.yml exec frontend npm run lint`
> Browser: dev server at `http://localhost:3000`; check the stated breakpoints (375px mobile, 768px tablet, ≥1024px desktop) via DevTools device toolbar.

---

## File Structure

**Unit 1 — bottom nav + naming**
- Modify: `frontend/src/app/(app)/components/MobileNav.tsx` — remove Search tab; rename Home→Dashboard.
- Modify: `frontend/src/app/(app)/dashboard/page.tsx` — page title "Orders"→"Dashboard".

**Unit 2 — extract search engine (`frontend/src/components/search/`)**
- Create: `useSearch.ts` — input/debounce/query/derived-flags hook (shell-agnostic; no URL sync).
- Create: `CustomerRow.tsx`, `OrderRow.tsx` — result rows, with an `onSelect` callback so a shell can close itself.
- Create: `SearchResults.tsx` — sections + hint/empty/no-result states.
- Modify: `frontend/src/app/(app)/search/page.tsx` — becomes the `SearchPage` shell over the shared internals (keeps `?q=` sync + autofocus).

**Unit 3 — AppHeader + AppShell restructure**
- Create: `frontend/src/app/(app)/components/AppHeader.tsx` — route→`{title, addOrder}` map, title, utilities, desktop search trigger (routes to `/search` in this unit), mobile search icon.
- Modify: `frontend/src/app/(app)/components/AppShell.tsx` — right column = AppHeader (flex-shrink-0) + scroll content + MobileNav; mount point ready for the search overlay.
- Modify: `frontend/src/app/(app)/components/Sidebar.tsx` — sections only; drop `NotificationBell` + Search nav item.
- Modify section pages: `dashboard`, `payments`, `customers`, `settings`, `calendar` — remove hand-rolled title rows + mobile bell/profile clusters.

**Unit 4 — wire GlobalSearch overlay**
- Modify: `frontend/src/stores/useUIStore.ts` — add `searchOpen` / `openSearch` / `closeSearch`.
- Create: `frontend/src/components/search/SearchSheet.tsx` — mobile full-screen overlay shell.
- Create: `frontend/src/components/search/SearchDropdown.tsx` — desktop inline-input + anchored panel shell.
- Modify: `AppHeader.tsx` — desktop renders `SearchDropdown`; mobile icon → `openSearch()`.
- Modify: `AppShell.tsx` — mount `<SearchSheet>`; add `⌘K`/`Ctrl-K` handler.

---

## UNIT 1 — Bottom nav cleanup + naming

Ships independently. Reduces nav clutter immediately.

### Task 1.1: Remove Search tab, rename Home→Dashboard in MobileNav

**Files:**
- Modify: `frontend/src/app/(app)/components/MobileNav.tsx`

- [ ] **Step 1: Edit the `tabs` array**

Replace the existing array (currently `Home/Orders/Payments/Customers/Search`) with four entries — the existing `slice(0,2)` / `slice(2)` split still yields 2 left + FAB + 2 right:

```tsx
const tabs = [
  { href: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
  { href: '/orders', label: 'Orders', icon: <OrdersIcon /> },
  { href: '/payments', label: 'Payments', icon: <PaymentsIcon /> },
  { href: '/customers', label: 'Customers', icon: <CustomersIcon /> },
]
```

- [ ] **Step 2: Remove the now-unused `SearchIcon`**

Delete the `function SearchIcon() { ... }` definition in `MobileNav.tsx` (it is only referenced by the removed tab). Leave `HomeIcon`/`OrdersIcon`/`PaymentsIcon`/`CustomersIcon` intact.

- [ ] **Step 3: Type-check + lint**

Run type-check and lint (commands in header). Expected: PASS, no unused-symbol warnings for `SearchIcon`.

- [ ] **Step 4: Browser check at 375px**

Load `http://localhost:3000/dashboard` at 375px. Expected: bottom nav shows `Dashboard · Orders · ⊕ · Payments · Customers`; no Search tab; "Dashboard" label fits without clipping; active state highlights the current tab.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/\(app\)/components/MobileNav.tsx
git commit -m "feat(VS-17): drop Search from bottom nav, rename Home→Dashboard"
```

### Task 1.2: Rename the Dashboard page title

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Change the heading**

The header `<h1>` currently reads "Orders" (collides with the separate Orders section). Change it:

```tsx
<h1 className="text-xl font-semibold text-[#1A1A18]">Dashboard</h1>
```

(Leave the mobile Calendar shortcut, `NotificationBell`, `ProfileMenu`, and desktop Add Order button as-is — those move in Unit 3.)

- [ ] **Step 2: Type-check + lint** — Expected: PASS.

- [ ] **Step 3: Browser check** — Load `/dashboard`; title reads "Dashboard"; bottom "Dashboard" tab is active. No other visual change.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(VS-17): rename Dashboard page title (was Orders)"
```

**✅ Unit 1 checkpoint:** Bottom nav at five items, naming consistent. App fully working. Review before Unit 2.

---

## UNIT 2 — Extract search engine (one engine)

Pure refactor — no user-visible change. `/search` must behave exactly as before afterward.

### Task 2.1: Create the `useSearch` hook

**Files:**
- Create: `frontend/src/components/search/useSearch.ts`

- [ ] **Step 1: Write the hook**

Extracts the debounce + query + derived flags from today's page. Shell-agnostic — URL sync stays in `SearchPage`.

```ts
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
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 2.2: Create the result rows

**Files:**
- Create: `frontend/src/components/search/CustomerRow.tsx`
- Create: `frontend/src/components/search/OrderRow.tsx`

- [ ] **Step 1: CustomerRow** (lifted from `search/page.tsx`, plus `onSelect` so a shell can close on navigate)

```tsx
'use client'

import { useRouter } from 'next/navigation'
import type { SearchCustomer } from '@/lib/api/search'

export default function CustomerRow({ customer, onSelect }: { customer: SearchCustomer; onSelect?: () => void }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => { router.push(`/customers/${customer.id}`); onSelect?.() }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F3] transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-[#FBF3E3] flex items-center justify-center text-[#C8952A] text-sm font-semibold flex-shrink-0">
        {customer.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{customer.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {customer.phone && <p className="text-xs text-[#A0A09C] truncate">{customer.phone}</p>}
          <span className="text-[10px] text-[#A0A09C] flex-shrink-0">
            {customer.order_count} {customer.order_count === 1 ? 'order' : 'orders'}
          </span>
        </div>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: OrderRow** (lifted; order opens the existing drawer via `openOrderDetail`, then `onSelect`)

```tsx
'use client'

import type { SearchOrder } from '@/lib/api/search'
import { useUIStore } from '@/stores/useUIStore'

const STATUS_COLORS: Record<string, string> = {
  'Booked':           'bg-blue-50 text-blue-700',
  'Started':          'bg-violet-50 text-violet-700',
  'Ready':            'bg-emerald-50 text-emerald-700',
  'Partial Delivery': 'bg-amber-50 text-amber-700',
  'Delivered':        'bg-gray-100 text-gray-600',
}

export default function OrderRow({ order, onSelect }: { order: SearchOrder; onSelect?: () => void }) {
  const openOrderDetail = useUIStore((s) => s.openOrderDetail)
  return (
    <button
      type="button"
      onClick={() => { openOrderDetail(order.id); onSelect?.() }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F3] transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-[#F0F0EE] flex items-center justify-center text-[#6B6B67] text-xs font-semibold flex-shrink-0">
        #{String(order.order_number).padStart(4, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A18] truncate">{order.customer_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {order.status}
          </span>
          {order.delivery_date && (
            <span className="text-[10px] text-[#A0A09C]">
              {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
```

- [ ] **Step 3: Type-check** — Expected: PASS.

### Task 2.3: Create `SearchResults`

**Files:**
- Create: `frontend/src/components/search/SearchResults.tsx`

- [ ] **Step 1: Write the presentational list** (sections + hint/empty states, lifted from the page body)

```tsx
'use client'

import type { SearchCustomer, SearchOrder } from '@/lib/api/search'
import CustomerRow from './CustomerRow'
import OrderRow from './OrderRow'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

interface Props {
  customers: SearchCustomer[]
  orders: SearchOrder[]
  showHint: boolean
  showEmpty: boolean
  debouncedQ: string
  onSelect?: () => void
}

export default function SearchResults({ customers, orders, showHint, showEmpty, debouncedQ, onSelect }: Props) {
  return (
    <>
      {showHint && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-[#F0F0EE] flex items-center justify-center text-[#A0A09C] mb-3">
            <SearchIcon />
          </div>
          <p className="text-sm font-medium text-[#6B6B67]">Search customers or orders</p>
          <p className="text-xs text-[#A0A09C] mt-1">Type a name, phone number, or order #0042</p>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <p className="text-sm font-medium text-[#6B6B67]">No results for &ldquo;{debouncedQ}&rdquo;</p>
          <p className="text-xs text-[#A0A09C] mt-1">Try a different name, phone, or order number</p>
        </div>
      )}

      {customers.length > 0 && (
        <div className="mt-2">
          <p className="px-4 pb-1 text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide">Customers</p>
          <div className="bg-white rounded-xl border border-[#E5E5E2] overflow-hidden divide-y divide-[#F0F0EE]">
            {customers.map((c) => <CustomerRow key={c.id} customer={c} onSelect={onSelect} />)}
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-4">
          <p className="px-4 pb-1 text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide">Orders</p>
          <div className="bg-white rounded-xl border border-[#E5E5E2] overflow-hidden divide-y divide-[#F0F0EE]">
            {orders.map((o) => <OrderRow key={o.id} order={o} onSelect={onSelect} />)}
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 2.4: Rewrite `search/page.tsx` as the `SearchPage` shell

**Files:**
- Modify: `frontend/src/app/(app)/search/page.tsx`

- [ ] **Step 1: Replace the file** with a thin shell over `useSearch` + `SearchResults`, preserving autofocus and `?q=` sync

```tsx
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
```

- [ ] **Step 2: Type-check + lint** — Expected: PASS, no unused imports.

- [ ] **Step 3: Browser regression check** — Load `/search`: input autofocuses; typing ≥2 chars shows debounced results; selecting a customer routes to its profile; selecting an order opens the drawer; `/search?q=nit` deep-link pre-fills + searches. Behavior identical to before.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/search/ frontend/src/app/\(app\)/search/page.tsx
git commit -m "refactor(VS-17): extract GlobalSearch engine (useSearch + SearchResults); /search is now a shell"
```

**✅ Unit 2 checkpoint:** Search engine extracted, `/search` unchanged for the user. Review before Unit 3.

---

## UNIT 3 — AppHeader shell + AppShell restructure

Introduces the persistent header. Search trigger routes to `/search` for now (overlay comes in Unit 4).

### Task 3.1: Create `AppHeader`

**Files:**
- Create: `frontend/src/app/(app)/components/AppHeader.tsx`

- [ ] **Step 1: Write AppHeader** — route→title/action map, title, desktop search trigger button + mobile search icon (both `router.push('/search')` this unit), `NotificationBell`, `ProfileMenu`, desktop Add Order in the action slot.

```tsx
'use client'

import { usePathname, useRouter } from 'next/navigation'
import NotificationBell from '@/components/dashboard/NotificationBell'
import ProfileMenu from './ProfileMenu'
import { useUIStore } from '@/stores/useUIStore'

const ROUTE_META: { prefix: string; title: string; addOrder?: boolean }[] = [
  { prefix: '/dashboard', title: 'Dashboard', addOrder: true },
  { prefix: '/orders',    title: 'Orders',    addOrder: true },
  { prefix: '/payments',  title: 'Payments' },
  { prefix: '/customers', title: 'Customers' },
  { prefix: '/calendar',  title: 'Calendar' },
  { prefix: '/settings',  title: 'Settings' },
  { prefix: '/search',    title: 'Search' },
]

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export default function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const openAddOrder = useUIStore((s) => s.openAddOrder)

  const meta = ROUTE_META.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + '/'))
  const title = meta?.title ?? ''

  return (
    // flex-shrink-0 row at the top of the right content column; lg:pl-60 clears the fixed sidebar.
    <header className="flex-shrink-0 bg-white border-b border-[#E5E5E2] lg:pl-60">
      <div className="h-14 flex items-center gap-3 px-4 lg:px-6">
        <h1 className="text-base lg:text-lg font-semibold text-[#1A1A18] truncate flex-shrink-0">{title}</h1>

        {/* Desktop inline search trigger (routes to /search this unit; becomes dropdown in Unit 4) */}
        <button
          onClick={() => router.push('/search')}
          className="hidden lg:flex items-center gap-2 flex-1 max-w-md ml-2 px-3 py-2 text-sm text-[#A0A09C] bg-[#F5F5F3] border border-[#E5E5E2] rounded-lg hover:border-[#C8952A] transition-colors"
        >
          <SearchIcon />
          <span>Search customers, orders…</span>
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {meta?.addOrder && (
            <button
              onClick={openAddOrder}
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] transition-colors"
            >
              + Add Order
            </button>
          )}

          {/* Mobile search icon (routes to /search this unit; opens sheet in Unit 4) */}
          <button
            onClick={() => router.push('/search')}
            aria-label="Search"
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#6B6B67] hover:bg-[#F5F5F3] transition-colors"
          >
            <SearchIcon />
          </button>

          <NotificationBell dropdownSide="right" />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 3.2: Restructure `AppShell` to mount the header

**Files:**
- Modify: `frontend/src/app/(app)/components/AppShell.tsx`

- [ ] **Step 1: Import AppHeader**

```tsx
import AppHeader from './AppHeader'
```

- [ ] **Step 2: Replace the layout block.** Move `lg:pl-60` off the scroll div (the header now carries it) and insert `<AppHeader />` above the scroll container. New return body:

```tsx
return (
  <div className="h-dvh flex flex-col bg-[#FAFAF8] overflow-hidden">
    <Sidebar />
    <AppHeader />
    <div className="flex-1 overflow-y-auto overscroll-contain lg:pl-60">
      {children}
    </div>
    <MobileNav />
    {showAddOrder && (
      <AddOrderFlow
        onClose={closeAddOrder}
        onCreated={() => { closeAddOrder(); triggerOrdersRefresh() }}
      />
    )}
    {selectedOrderId && (
      <OrderDetailDrawer
        orderId={selectedOrderId}
        onClose={closeOrderDetail}
        onUpdated={triggerOrdersRefresh}
      />
    )}
    <ToastHost />
  </div>
)
```

- [ ] **Step 3: Type-check + lint** — Expected: PASS.

- [ ] **Step 4: Browser check (header present, double header expected until 3.4)** — Load `/payments` desktop + 375px. Expected: shared header renders with title + search + bell + profile; sidebar still on desktop; page below still shows its own old title (removed in 3.4). Confirm no layout breakage / sidebar overlap.

### Task 3.3: Slim the Sidebar

**Files:**
- Modify: `frontend/src/app/(app)/components/Sidebar.tsx`

- [ ] **Step 1: Remove the Search nav item** from `navItems` (keep `Dashboard · Orders · Payments · Customers · Calendar`). Delete the now-unused `SearchIcon` function.

- [ ] **Step 2: Remove `NotificationBell`** — delete its import and the `<NotificationBell dropdownSide="left" />` usage in the sidebar header. The header `div` keeps the Soliofit/business-name block.

- [ ] **Step 3: Type-check + lint** — Expected: PASS, no unused `SearchIcon`/`NotificationBell`.

- [ ] **Step 4: Browser check (desktop)** — Sidebar shows five sections + Settings/identity/logout footer; no bell, no Search. Notifications now reachable via the header bell.

### Task 3.4: Strip per-page title rows

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`
- Modify: `frontend/src/app/(app)/payments/page.tsx`
- Modify: `frontend/src/app/(app)/customers/page.tsx`
- Modify: `frontend/src/app/(app)/settings/page.tsx`
- Modify: `frontend/src/app/(app)/calendar/page.tsx`

- [ ] **Step 1: Dashboard** — remove the entire header `div` (the `<h1>Dashboard</h1>` row with the mobile Calendar shortcut, `NotificationBell`, `ProfileMenu`, and desktop Add Order button), since the shared header now provides title + utilities + Add Order. Keep `<KanbanBoard />`. Remove the now-unused imports/helpers: `Link`, `NotificationBell`, `ProfileMenu`, `useUIStore`, and the local `PlusIcon` / `CalendarIcon` functions. Mobile Calendar access is restored in Step 6 (ProfileMenu link), since Calendar is neither in the bottom nav nor the mobile sidebar.

- [ ] **Step 2: Payments** — remove the `<h1>Payments</h1>` title row (the `flex items-center justify-between mb-...` header), keep the page body.

- [ ] **Step 3: Customers** — remove the `<h1>Customers</h1>` title row, keep the list/search-within-page body.

- [ ] **Step 4: Settings** — remove the `<h1>Settings mb-6</h1>` standalone title (the header bar now shows "Settings"); keep the settings form sections.

- [ ] **Step 5: Calendar** — remove the page's own top title row and its `lg:hidden` `NotificationBell` (now in the shared header). **Keep** the month-navigation toolbar and grid (page-body content per spec).

- [ ] **Step 6: Resolve mobile Calendar access** — Calendar is NOT in the bottom nav and the sidebar is desktop-only, so on mobile Calendar must stay reachable. Add a Calendar link to `ProfileMenu.tsx`, immediately above the existing Settings link, reusing the exact menu-item classes.

First add a `CalendarIcon` helper near the file's other icon helpers (`SettingsIcon`/`LogoutIcon`):

```tsx
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
```

Then insert this `<Link>` directly above the existing `href="/settings"` link (identical classes to the Settings item):

```tsx
<Link
  href="/calendar"
  role="menuitem"
  onClick={() => setOpen(false)}
  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#1A1A18] hover:bg-gray-50 transition-colors"
>
  <span className="text-[#A0A09C]"><CalendarIcon /></span>
  Calendar
</Link>
```

- [ ] **Step 7: Type-check + lint** — Expected: PASS, no unused imports across the five pages.

- [ ] **Step 8: Browser sweep (375px / 768px / desktop)** — For each of dashboard/orders/payments/customers/calendar/settings: exactly one header (the shared bar), correct title, no overflow, Add Order present on dashboard+orders, notifications + profile reachable everywhere, Calendar reachable on mobile via ProfileMenu.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/\(app\)/
git commit -m "feat(VS-17): shared AppHeader; slim sidebar to sections; strip per-page headers"
```

**✅ Unit 3 checkpoint:** Persistent header live across all screens; utilities consistent. Review before Unit 4.

---

## UNIT 4 — Wire GlobalSearch as the global surface

Replaces the route-based triggers with the live overlay (desktop dropdown, mobile sheet).

### Task 4.1: Add search overlay state to `useUIStore`

**Files:**
- Modify: `frontend/src/stores/useUIStore.ts`

- [ ] **Step 1: Add state + actions** mirroring the existing overlay fields (e.g. `showAddOrder` / `openAddOrder` / `closeAddOrder`):

```ts
// in the store's state interface:
searchOpen: boolean
openSearch: () => void
closeSearch: () => void

// in the store implementation:
searchOpen: false,
openSearch: () => set({ searchOpen: true }),
closeSearch: () => set({ searchOpen: false }),
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 4.2: Create `SearchSheet` (mobile overlay)

**Files:**
- Create: `frontend/src/components/search/SearchSheet.tsx`

- [ ] **Step 1: Write the full-screen sheet** — uses `useSearch`, autofocus, back/✕ close via `closeSearch`, body scroll handled by being a fixed overlay; closes on result select.

```tsx
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
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 4.3: Create `SearchDropdown` (desktop)

**Files:**
- Create: `frontend/src/components/search/SearchDropdown.tsx`

- [ ] **Step 1: Write the inline input + anchored panel** — opens on focus/≥2 chars, closes on Esc / outside click / select.

```tsx
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
```

- [ ] **Step 2: Type-check** — Expected: PASS.

### Task 4.4: Wire shells into AppHeader + AppShell

**Files:**
- Modify: `frontend/src/app/(app)/components/AppHeader.tsx`
- Modify: `frontend/src/app/(app)/components/AppShell.tsx`

- [ ] **Step 1: AppHeader desktop** — replace the desktop search trigger button with `<SearchDropdown />`:

```tsx
import SearchDropdown from '@/components/search/SearchDropdown'
// ...replace the `hidden lg:flex ... router.push('/search')` button with:
<div className="hidden lg:flex flex-1"><SearchDropdown /></div>
```

- [ ] **Step 2: AppHeader mobile** — change the mobile search icon to open the sheet:

```tsx
const openSearch = useUIStore((s) => s.openSearch)
// mobile button onClick:
onClick={openSearch}
```

(Remove the now-unused `router` import if nothing else uses it.)

- [ ] **Step 3: AppShell** — mount the sheet and add ⌘K to open it on mobile:

```tsx
import SearchSheet from '@/components/search/SearchSheet'
// from store: searchOpen, openSearch, closeSearch
// add effect:
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      if (window.matchMedia('(max-width: 1023px)').matches) { e.preventDefault(); openSearch() }
    }
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [openSearch])
// in JSX, near other overlays:
{searchOpen && <SearchSheet />}
```

- [ ] **Step 4: Type-check + lint** — Expected: PASS, no unused imports.

- [ ] **Step 5: Browser verification**
  - Desktop: header search input → typing shows the dropdown panel; Esc/outside-click closes; selecting a customer routes + closes; selecting an order opens the drawer + closes; ⌘K focuses the input.
  - Mobile (375px): header search icon → full-screen sheet, autofocus, back closes; select routes/opens drawer + closes sheet; context (previous screen) preserved on close.
  - `/search` route still works as the full-page surface (unchanged).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/useUIStore.ts frontend/src/components/search/ frontend/src/app/\(app\)/components/
git commit -m "feat(VS-17): wire GlobalSearch overlay — desktop dropdown + mobile sheet + ⌘K"
```

**✅ Unit 4 checkpoint:** Search reachable from anywhere. Feature complete.

---

## Post-feature wrap (after Unit 4)

- [ ] Run the post-change checklist: CRG incremental build (`build_or_update_graph_tool base=HEAD~N`) + store progress to mnemon.
- [ ] Update `docs/workflow/vertical-slices.md` Active Window with the units landed.
- [ ] Consider a `/qa` or `/design-review` pass at 375/768/desktop before closing the unit.
