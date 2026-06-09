# Design — Shared AppHeader + GlobalSearch (VS-17 navigation refinement)

**Date:** 2026-06-09
**Slice:** VS-17 (Mobile Layout)
**Status:** Approved (direction + peer-review refinements incorporated)

## Guiding principle

> Search is a global utility, not a primary navigation item. It is always
> available from the persistent header: inline on desktop, icon-triggered sheet
> on mobile. The `/search` route remains only as a deep-linkable full-page
> search surface.

The mobile bottom nav returns to the clean five-choice model; search moves out
of navigation entirely and becomes a global command surface reachable from
every authenticated screen.

## Goals

- Mobile bottom nav: `Home (Dashboard) · Orders · ⊕ Add · Payments · Customers` — no Search tab.
- A persistent shared `AppHeader` across every authenticated screen, owning
  the page title, a per-route primary-action slot, and the utilities
  (search, notifications, profile).
- Search reachable from anywhere: inline search bar on desktop, icon → focused
  sheet on mobile. One engine, multiple shells.
- No backend or search API changes.
- Fix the existing inconsistency where the notification bell + profile only
  appear on the Dashboard and Calendar mobile headers.

## Non-goals

- No changes to the search backend, `fetchSearch`, or result shape.
- No dynamic-title override machinery (route map only; override hook deferred).
- No redesign of the order drawer, add-order flow, or entity detail screens.

## Architecture — one engine, three shells

The current `/search/page.tsx` already contains the entire search engine
(debounced autofocus input, `useQuery(['search', q], fetchSearch)`, result
rows, empty/loading/no-results states). We extract that so the engine is shared
and only the surrounding shell differs.

**Shared internals (`frontend/src/components/search/`)**
- `useSearch()` — hook owning input value, 300ms debounce, the React Query call,
  and derived `customers` / `orders` / `isFetching` / state flags.
- `SearchResults` — presentational list rendering the Customers and Orders
  sections, plus empty/short-query/no-results states.
- `CustomerRow` / `OrderRow` — result rows, lifted verbatim from the current
  page. **Result selection uses the existing destination behavior for that
  entity:** customer → its detail route; order → `openOrderDetail` (drawer on
  desktop, full-screen on mobile). On select the active search shell closes.

**Three shells, all consuming the shared internals**
- `SearchPage` — the full-page `/search` route. Keeps its own page layout,
  syncs `?q=`, and remains deep-linkable. Feels like a real page.
- `SearchSheet` — mobile full-screen overlay. Autofocus, back/✕ to dismiss,
  body scroll-lock, iOS safe-area aware. Mounted globally in `AppShell`.
- `SearchDropdown` — desktop. Inline input lives in `AppHeader`; on focus / ≥2
  chars an anchored dropdown panel renders `SearchResults`. Esc / outside-click
  closes.

## Components

**New**
- `(app)/components/AppHeader.tsx` — persistent top bar. Left: page title.
  Right: search affordance (inline bar on desktop, icon below `lg`),
  `NotificationBell`, `ProfileMenu`, and a per-route primary-action slot.
- `components/search/GlobalSearch` internals: `useSearch`, `SearchResults`,
  `CustomerRow`, `OrderRow`, plus the `SearchSheet` and `SearchDropdown` shells.

**Changed**
- `AppShell` — restructure into: fixed `Sidebar` + a right column holding
  `AppHeader` (flex-shrink-0) → scrolling content → `MobileNav`. Mount
  `<SearchSheet>` overlay here, alongside the existing `AddOrderFlow` /
  `OrderDetailDrawer` overlays. The header sits OUTSIDE the page scroll
  container, so pages that manage their own scroll (Orders schedule, Calendar
  grid) are unaffected.
- `Sidebar` — sections only: `Dashboard · Orders · Payments · Customers ·
  Calendar`. Footer: `Settings`, identity, logout. Remove `NotificationBell`
  and the Search nav item.
- `MobileNav` — remove the Search tab → `Dashboard · Orders · ⊕ · Payments ·
  Customers`. The `/dashboard` tab label becomes **"Dashboard"**.
- Section pages (`dashboard`, `orders`, `payments`, `customers`, `calendar`,
  `settings`) — remove their hand-rolled title row and mobile bell/profile
  cluster; that chrome now comes from `AppHeader`. Page-specific toolbars
  (Calendar month-nav, etc.) stay in the page body below the header.
- `/dashboard` — page title becomes **"Dashboard"** (was "Orders", which
  collided with the separate Orders section).
- `search/page.tsx` — becomes the `SearchPage` shell over the shared internals.

## State & data flow

- Add to `useUIStore`: `searchOpen`, `openSearch()`, `closeSearch()` — mirrors
  the existing `showAddOrder` / `selectedOrderId` overlay pattern.
- `useSearch` holds local input/debounce state; data via the existing
  `useQuery`. No API changes.
- The overlay/dropdown never navigates on open — it layers over the current
  route, preserving context. Closing (Esc / back / ✕ / backdrop) returns the
  user exactly where they were. Selecting a result routes to the entity via its
  existing destination behavior and closes the search shell.

## AppHeader behavior

- **Title:** a route → `{ title, primaryAction }` config map in `AppHeader`.
  Route map only for now; a dynamic-title override hook is a noted future
  extension, not built in this slice.
- **Primary-action slot:** Dashboard/Orders surface "Add Order" (desktop
  button; mobile keeps the bottom-nav `⊕` FAB, so the header action there is
  desktop-only). Other routes pass nothing.
- **Responsive:** desktop shows the inline search bar; below `lg` (and tablet
  when tight) it collapses to a search icon that opens `SearchSheet`.
- **Keyboard:** `⌘K` / `Ctrl-K` focuses desktop search / opens the mobile
  sheet. May defer to a follow-up if it complicates Unit 4.

## Edge cases

- z-index: search shell above content; selecting an order closes search and
  opens the drawer on top cleanly.
- iOS: sheet autofocus, safe-area padding, body scroll-lock while open.
- Empty / short-query (<2 chars) / no-results / loading states preserved from
  the current page.
- No double headers at any breakpoint after pages drop their title rows.

## Testing

- `useSearch` / `SearchResults`: debounce, result rendering, selection wiring.
- `AppHeader`: route → title mapping; primary-action slot per route.
- Layout sweep at 375px / 768px / desktop: no double headers, no overflow,
  bottom nav at five items, sidebar slimmed.

## Decomposition — shippable units

Each unit is independently reviewable and leaves the app working.

1. **Unit 1 — Bottom nav cleanup + naming.** Remove the Search tab; `/dashboard`
   tab + title → "Dashboard". Tiny, ships first.
2. **Unit 2 — Extract search engine.** Lift `useSearch` / `SearchResults` /
   `CustomerRow` / `OrderRow` out of `search/page.tsx`; `SearchPage` becomes a
   shell over them. Pure refactor, no UX change — safe checkpoint.
3. **Unit 3 — AppHeader shell + AppShell restructure.** Introduce `AppHeader`,
   relocate bell/profile, strip per-page title rows, slim the sidebar. Search
   trigger initially routes to `/search`.
4. **Unit 4 — Wire GlobalSearch as global surface.** Add store state, the
   desktop `SearchDropdown` and mobile `SearchSheet`, and `⌘K`. Delivers
   "search from anywhere."
