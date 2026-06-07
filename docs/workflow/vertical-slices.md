# Vertical Slice Map

Each slice delivers an observable, end-to-end feature increment — from database to UI. No slice is considered done until it can be manually tested in the browser against a running backend.

**ADR rule:** Write an ADR only when the current slice requires a documented decision. Do not pre-plan ADRs for future slices.

---

## Slice Overview

| # | Slice | Observable Outcome | Status |
|---|-------|--------------------|--------|
| VS-00 | Foundation shell | `docker compose up` → Django `/api/health/` + Next.js `/` both respond | Done |
| VS-01 | Authentication | Login with email/password → JWT cookie set. Logout → cookie cleared | Done |
| VS-02 | App shell | Protected layout + sidebar + nav. Unauthenticated → redirect to login | Done |
| VS-03 | Customer management | Create, search, list customers | Done |
| VS-04 | Order creation | Create an order in < 30 seconds, appears in Kanban as Booked | Done |
| VS-05 | Kanban board | All 5 columns render, drag-and-drop changes order status | Done |
| VS-06 | Order details | Open an order, view all fields, autosave edits | Done |
| VS-07 | Photo upload | Garment + notes photos upload via S3, view in lightbox | Done |
| VS-08 | Voice notes | Hold-to-record, upload, playback with seek and speed control | Done |
| VS-09 | Installments | Add installments, mark paid, computed overdue status shows | Done |
| VS-10 | Dashboard intelligence | Summary strip counts + notification bell with counts | Done |
| VS-11 | Payments dashboard | Payment Kanban screen with summary strip | Done |
| VS-12 | Activity log | State changes auto-logged, visible in Order Details | Done |
| VS-13 | Customer profile | All 3 tabs: orders, payments, media | Done |
| VS-15a | Orders Schedule | `/orders` week view — order cards grouped by delivery date, priority-sorted | Done |
| VS-14 | Global search | Search by customer name, phone, order ID (pg_trgm) | Done |
| VS-15 | Calendar | Month view with workload coloring, date drill-down | Pending |
| VS-16 | Settings | Profile edit, password change, notification toggles | Pending |
| VS-17 | Mobile layout | Bottom nav, full-screen drawers, responsive Kanban | Pending |
| VS-18 | Production deployment | Push to `main` → deploys to EC2 via GitHub Actions | Pending |
| VS-19 | Order payment summary | Cards show remaining balance + payment state (annotated, no N+1) | Backlog |
| VS-20 | Orders list scaling | Per-column lazy-load on scroll; category counts = totals; defer aged Delivered | Backlog |
| VS-21 | Delete order | Soft-delete order + cascade installments/media + S3 cleanup, with confirm | Backlog |
| VS-22 | Forgot password | Pre-login email reset link (Gmail SMTP) | Backlog |
| VS-23 | Boutique tenant | Introduce Boutique entity; scope all data to it; per-boutique order numbers | Backlog |
| VS-08b | Voice format | `.webm`→`.mp3` server-side conversion for iOS playback | Backlog — **Deferred** |

> **MVP execution order after VS-15:** VS-16 → VS-19 → VS-20 → VS-21 → VS-22 → VS-23 → VS-17 → VS-18.
> VS-20 and VS-23 each require an ADR at activation. VS-23 (tenant) lands before VS-17/VS-18 so launch is on the final schema. Interim hardening (order_number race-fix, presign validation) ships as `fix` commits ahead of the slices.

---

## Active Window

| # | Slice | Status |
|---|-------|--------|
| VS-08 | Voice notes | Done |
| VS-09 | Installments | Done |
| VS-10 | Dashboard intelligence | Done |
| VS-11 | Payments dashboard | Done |
| VS-12 | Activity log | Done |
| VS-13 | Customer profile | Done |
| VS-14 | Global search | Done |
| VS-15a | Orders Schedule | Done |
| VS-15 | Calendar | **Active** |

_Window reviewed: 2026-06-04 (after VS-15a completion). Next review after VS-16._
_VS-15a (Orders Schedule) added as gap-fix slice after PRD review on 2026-06-03. Inserted before VS-15 in execution order._

---

## Slice Specifications

---

### VS-00 — Foundation Shell ✓

**Completion record:** Commit `854f4b1` · No deferrals.

**What:** Minimum infrastructure to run both services locally. No product features yet.

**Backend:**
- `backend/` directory with `Dockerfile.dev`
- Django project init (`django-admin startproject config .`)
- PostgreSQL connected, `GET /api/health/` returns `{"status": "ok"}`
- `requirements.txt` with pinned versions

**Frontend:**
- `frontend/` directory with `Dockerfile.dev`
- Next.js 14 scaffold (TypeScript, Tailwind, App Router)
- `/` renders default Next.js page

**Infra:**
- `docker-compose.dev.yml`: `postgres`, `backend`, `frontend` services
- `.env.example` for both services
- Updated `.gitignore`

**ADRs:** ADR-0001 and ADR-0003 cover all decisions for this slice.

**Review checkpoint:** `docker compose -f docker-compose.dev.yml up` starts without errors. Both URLs respond: `http://localhost:8000/api/health/` and `http://localhost:3000/`.

---

### VS-01 — Authentication ✓

**Completion record:** Commit `c152bd1` · No deferrals.

**What:** Email + password login. JWT stored in HTTP-only cookie. Logout clears cookie.

**Backend:**
- `apps/users/` Django app registered
- `User` model (AbstractBaseUser, email-based login)
- `users` migration
- `CookieJWTAuthentication` class
- `POST /api/auth/login/` → sets `access_token` cookie (24h)
- `POST /api/auth/logout/` → clears cookie
- `GET /api/auth/me/` → returns current user or 401

**Frontend:**
- `useAuthStore` (Zustand): user, isAuthenticated, login, logout actions
- `apiClient` base (typed fetch, `credentials: 'include'`, 401 redirect)
- Login page: email + password form (React Hook Form + Zod), calls login API

**ADR:** ADR-0002 covers auth strategy.

**Review checkpoint:** Submit correct credentials → cookie set, redirect to `/dashboard`. Submit wrong credentials → error shown inline. Logout → cookie cleared, redirect to `/login`.

---

### VS-02 — App Shell ✓

**Completion record:** Commit `0b8b18e` · No deferrals.

**What:** Protected layout with sidebar and navigation. Unauthenticated requests redirected to login.

**Backend:**
- `GET /api/auth/me/` already done in VS-01 — used to hydrate auth state on load

**Frontend:**
- `(app)/layout.tsx`: auth guard — if not authenticated, redirect to `/login`
- `Sidebar.tsx` (desktop): navigation links for all screens
- `MobileNav.tsx` (bottom bar): mobile navigation
- `(app)/dashboard/page.tsx`: placeholder — "Dashboard (coming soon)"

**ADR:** None.

**Review checkpoint:** Visit `/dashboard` without being logged in → redirected to `/login`. After login → see sidebar and placeholder dashboard page.

---

### VS-03 — Customer Management ✓

**Completion record:** Commit `775d74a` · No deferrals.

**What:** Create, search, and list customers.

**Backend:**
- `apps/customers/` Django app
- `Customer` model (UUID pk, name, phone, address, soft-delete via `deleted_at`)
- `customers` migration
- `CustomerViewSet`: list (search by name/phone), retrieve, create, update, soft-delete

**Frontend:**
- Customer list page with live search (300ms debounce)
- Customer card: name, phone, total orders, last order date, outstanding amount
- Create customer form (inline modal): name, phone, address
- Empty state

**ADR:** None.

**Review checkpoint:** Create a customer → appears in list. Search by name and phone — results filter correctly. Soft-delete → disappears from list.

---

### VS-04 — Order Creation ✓

**Completion record:** Commit `9d79411` · Deferred: garment photo upload in Step 2 (skip button used; wired in VS-07). Voice note in Step 5 (skip button used; wired in VS-08). Installment plan skeleton in Step 4 (wired in VS-09).

**What:** Multi-step Add Order flow. New order appears in Kanban as Booked.

**Backend:**
- `apps/orders/` Django app
- `Order` model (UUID pk, human_id, user FK, customer FK, status, delivery_date, total_amount, priority, remarks, soft-delete)
- `orders` migration
- `POST /api/orders/` — creates order, returns order data
- `GET /api/orders/delivery-load/` — returns order count per date (for workload indicator)

**Frontend:**
- Add Order modal (6 steps with step indicator):
  - Step 1: Customer search + inline create
  - Step 2: Garment photos (upload deferred to VS-07 — skip button available)
  - Step 3: Delivery date picker with workload indicator
  - Step 4: Bill amount + optional installment plan skeleton
  - Step 5: Voice note + notes photos (deferred — skip available)
  - Step 6: Review + Create
- On create → new card appears in Kanban Booked column

**ADR:** None.

**Review checkpoint:** Create an order with a customer, delivery date, and bill amount. Order appears in Kanban Booked column with correct customer name and date. Delivery date picker shows workload counts.

---

### VS-05 — Kanban Board ✓

**Completion record:** Commit `f417ae0` · No deferrals. Summary strip counts only (full intelligence in VS-10 as planned).

**What:** Full Kanban board with 5 columns. Drag-and-drop changes order status.

**Backend:**
- `GET /api/orders/` — list with status, delivery_date, customer, payment summary
- `PATCH /api/orders/{id}/status/` — update status only

**Frontend:**
- Kanban board: Booked / Started / Ready / Partial Delivery / Delivered columns
- Order card: ID, customer name, photo thumbnail, delivery date (color-coded), remaining payment, voice note indicator, photo count, priority border, delayed badge
- Drag-and-drop via `@dnd-kit/core` → calls PATCH status endpoint
- Summary strip cards (counts only — full intelligence in VS-10)
- Cards sorted by delivery date ascending within each column

**ADR:** None (DnD library is a straightforward implementation choice, not an architectural decision).

**Review checkpoint:** All orders visible in correct columns. Drag a card to a new column → status updates. Card colors reflect urgency correctly.

---

### VS-06 — Order Details ✓

**Completion record:** Commit `9d334a0` · Placeholder sections for photos, voice, installments, activity log present. Each wired in dedicated slice.

**What:** Right-side drawer with full order view. Autosave on field change.

**Backend:**
- `GET /api/orders/{id}/` — full order detail
- `PATCH /api/orders/{id}/` — partial update (all fields)

**Frontend:**
- Order Details drawer (right panel on desktop, full screen on mobile)
- Sections: header, quick action bar, order information, placeholders for photos/voice/installments/activity
- All order fields editable, autosave debounced at 800ms
- Status change dropdown (inline)
- Priority toggle

**ADR:** None.

**Review checkpoint:** Click an order card → drawer opens with all fields. Edit delivery date → saves without a save button. Change status via dropdown → Kanban updates.

---

### VS-07 — Photo Upload ✓

**Completion record:** Commits `4fc46ca`, `48438da` · Deferred: photo reorder drag (planned for VS-17). ADR-0005 written and accepted. Camera-first flow added as VS-07 patch: Add button opens action sheet (Take Photo / Choose from Gallery); CameraCapture component handles getUserMedia, retake, and permission/unsupported fallbacks.

**What:** Garment photos and notes photos upload via S3 presigned URL, view in lightbox.

**Backend:**
- `apps/media/` Django app
- `OrderPhoto` model (UUID pk, order FK, s3_key, public_url, photo_type: garment/notes, display_order)
- `media` migration
- `POST /api/upload/presign/` — generates presigned PUT URL (boto3)
- `POST /api/orders/{id}/photos/` — saves photo record after S3 upload
- `DELETE /api/orders/{id}/photos/{photo_id}/` — deletes record + S3 object

**Frontend:**
- Garment photos: horizontal scrollable strip in Order Details
- Notes photos: 2-column grid in Order Details
- Upload flow: skeleton → presign → PUT to S3 → save record → show thumbnail
- Lightbox viewer (swipe navigation)
- Delete: × badge on hover (desktop) + long-press (touch)
- Retry button on upload failure
- Wire photo upload into Add Order Step 2

**ADR:** ADR-0005 (S3 presigned URL strategy with local stub mode).

**Review checkpoint:** Upload a garment photo → appears in strip. Tap → lightbox opens. Delete → removed from strip and S3. Retry works on simulated failure.

---

### VS-08 — Voice Notes ✓

**Completion record:** Commit `4c86775` · Deferred: none. VoiceRecorder logic duplicated inline in StepAdditional (not extracted to shared hook) — acceptable for MVP, revisit in VS-17 mobile polish if needed.

**What:** Hold-to-record voice notes, upload to S3, playback with seek and speed.

**Backend:**
- `VoiceNote` model (UUID pk, order FK, s3_key, public_url, duration_seconds)
- New migration in `apps/media/`
- `POST /api/upload/presign/` is folder- and content-type-agnostic — pass `folder: "voice-notes"`, `content_type: "audio/webm"` (no backend change needed)
- `POST /api/orders/{id}/voice-notes/` — saves voice note record
- `DELETE /api/orders/{id}/voice-notes/{id}/` — deletes record + S3 object

**Frontend:**
- Microphone button: hold to record (getUserMedia), release to upload
- Duration counter + waveform animation while recording
- Voice note card: static waveform, play/pause, duration, timestamp, speed toggle (1× → 1.5× → 2×)
- Max 5 minutes enforced
- Wire voice recording into Add Order Step 5

**ADR:** None (same S3 pattern as VS-07).

**Review checkpoint:** Hold mic → recording starts. Release → upload spinner shows → playback card appears. Play → audio plays. Speed toggle works. Delete removes the card.

---

### VS-09 — Installments ✓

**Completion record:** Commits `0fc713a`, `3ca5f8d`, `bb8912e`, `0edeb27` · Unit 3 complete: `DraftInstallments.tsx` wired into Add Order Step 4 — add/edit/delete with bill-limit validation, reactive remaining, delivery date as default due_date. Installments created via `await Promise.allSettled()` after `createOrder()` (blocking, not fire-and-forget — money data). StepReview shows installment count + total. "Split remaining" plan generator deferred (post-MVP). `InstallmentSection.tsx` is dead code (superseded by `PaymentSchedule.tsx`).

**What:** Create installments on an order. Mark paid. Computed overdue status.

**Backend:**
- `apps/payments/` Django app
- `Installment` model (UUID pk, order FK, amount, due_date, paid_date, remarks; computed `status` and `days_overdue` as `@property`)
- `payments` migration
- `InstallmentViewSet`: list per order, create, update, delete (unpaid only), mark-paid action

**Frontend:**
- Installments section in Order Details:
  - Summary row: total / paid / remaining + progress bar
  - Installment card: amount, due date, status badge (Pending/Paid/Delayed), days overdue
  - Mark Paid button with confirm dialog
  - Add installment form (inline): amount, due date, remarks
  - Edit and delete actions
- Wire installment creation into Add Order Step 4

**ADR:** None.

**Review checkpoint:** Add two installments. Mark one paid → badge changes to Paid. Set past due date on unpaid → badge shows Delayed with days count. Delete unpaid → removed. Paid installment cannot be deleted.

---

### VS-10 — Dashboard Intelligence ✓

**Completion record:** Commits `9ba5852`, `78d30e4`, `06a9ec4` · No deferrals. TanStack Query v5 installed. `refetchOnWindowFocus` active; all mutation paths (order create, status drag, installment add/edit/delete/mark-paid, bill amount change) call `triggerOrdersRefresh` which triggers immediate `refetchQueries` for dashboard-summary and notification-counts in AppShell. Mobile strip uses horizontal scroll (min-w-[130px]) at <lg breakpoint.

**What:** Summary strip with live counts. Notification bell with 4 alert types.

**Backend:**
- `GET /api/dashboard/summary/` — 5 counts: orders due today, upcoming (7 days), delayed, pending payments total, overdue installments count
- `GET /api/notifications/count/` — 4 counts: delivery due today, delayed delivery, installment due today, overdue installment
- `GET /api/notifications/` — grouped list of actual records per alert type

**Frontend:**
- Dashboard summary strip: 5 tappable cards (filter Kanban on tap)
- Notification bell: badge with total count, dropdown panel with grouped alerts
- TanStack Query `refetchOnWindowFocus: true` for both

**ADR:** None.

**Review checkpoint:** Create an order with today's delivery date → "Orders Due Today" count updates. Create an overdue installment → bell badge shows count. Click bell → grouped list of alerts visible.

---

### VS-11 — Payments Dashboard ✓

**Completion record:** Commit `c2f2040` · No deferrals. Payment state classification: completed (paid ≥ total), overdue (unpaid with due_date < today), partial (paid > 0), pending (paid = 0). TanStack Query key `['payment-orders', range]` — range param drives backend filter. AppShell invalidates `payments-summary` and `payment-orders` on `ordersRefreshKey` change. Column max-height `max-h-[600px]` with `overflow-y-auto`. Payment card click opens Order Details drawer.

**What:** Payments Dashboard screen with Kanban by payment state and summary strip.

**Backend:**
- `GET /api/payments/summary/` — 4 totals: total receivable, received today, pending count, overdue count
- `GET /api/payments/orders/` — orders grouped by payment state (Pending/Partial/Overdue/Completed) with installment detail per order, filterable by date range

**Frontend:**
- Payments Dashboard page (sidebar nav item)
- Summary strip: 4 cards
- Date filter: Today / This Week / This Month / All Time
- Payment Kanban: 4 columns
- Payment card: customer name, phone, order ID, total/paid/remaining, next installment, overdue badge
- Card click → Order Details drawer (focused on Installments section)

**ADR:** None.

**Review checkpoint:** Payments Dashboard loads with correct column distribution. Date filter changes results. Click payment card → Order Details opens.

---

### VS-12 — Activity Log ✓

**Completion record:** Commit `762782e` · No deferrals. `OrderActivity` model in `apps/orders` with 7 types. `create_order_activity()` helper in `services.py` shared by both `orders/views.py` and `payments/views.py`. All mutation paths wrapped in `transaction.atomic()` so activity rows and data changes commit together. `ActivityFeed.tsx` renders a connector-line timeline with per-type SVG icons. `['activities']` invalidated from AppShell `ordersRefreshKey` effect alongside all other query keys.

**What:** Auto-logged order events. Visible in Order Details.

**Backend:**
- `OrderActivity` model (UUID pk, order FK, activity_type, metadata JSON, created_at)
- Add to `orders` migration
- Auto-insert inside same transaction on: order created, status changed, installment created, installment paid, delivery marked
- `GET /api/orders/{id}/activities/` — chronological list, newest first

**Frontend:**
- Activity section in Order Details
- Each entry: icon + event description + timestamp
- Compact, no expansion

**ADR:** None.

**Review checkpoint:** Create an order → "Order Created" entry appears. Drag to Started → "Status changed to Started" entry appears. Mark installment paid → "Installment Paid" entry appears. All in correct chronological order.

---

### VS-13 — Customer Profile ✓

**Completion record:** Commits `b2fbb57`, `cf912d6` · No deferrals. Customer list `list()` overridden to batch-compute `total_orders` + `outstanding_balance` with 2 aggregate queries (no N+1). `CustomerViewSet` uses `@action` detail=True for `payments` and `media` — `self.get_object()` enforces ownership. `destroy()` override blocks deletion if active (non-Delivered) orders exist. Status changes from drawer header now use `updateOrderStatus` (hits activity log endpoint). Customer name in Order Details closes drawer then navigates. `['customer-orders']`, `['customer-payments']`, `['customer-media']` all invalidated from AppShell on ordersRefreshKey.

**What:** Full customer history screen with 3 tabs.

**Backend:**
- `GET /api/customers/{id}/` — customer detail with aggregate stats (total orders, total spent, outstanding balance)
- Tabs use existing endpoints with customer filter: orders list, installments list, photos list, voice notes list

**Frontend:**
- Customer Profile screen (accessed from Customer List or Order Details → customer name tap)
- Profile header: name (inline editable), phone, address, stats row, edit/delete buttons
- Tab 1 — Orders: all orders, active first
- Tab 2 — Payments: installment history across all orders, grouped by order
- Tab 3 — Media: all garment photos, notes photos, voice notes across all orders
- WhatsApp deep link on phone number

**ADR:** None.

**Review checkpoint:** Open customer profile → all 3 tabs load correctly. Edit name inline → saves. Orders tab shows correct orders. Media tab shows photos and voice notes across all orders.

---

### VS-15a — Orders Schedule ✓

**Completion record:** Commits `d8801dd` → `ec572c7` → `1de905d` · No deferrals.

Backend: `delivery_date_from/to` filters in `OrderViewSet.get_queryset()` with `parse_date()` + `ValueError` catch; DRF `ValidationError` for bad inputs. `has_delayed_installment` annotated via `Exists` subquery on every queryset path; `update_status()` re-fetches through annotated queryset before serializing. 19/19 backend tests pass.

Frontend (final — `1de905d`): Infinite horizontal scroll replacing week-pagination. `loadedWeeks: string[]` state + `useQueries` (one query per loaded week, key `['orders-schedule', weekStart]`). `IntersectionObserver` sentinels trigger load of adjacent weeks; DOM capped at `MAX_WEEKS=9`. Scroll-position preserved on prepend/left-trim via `useLayoutEffect` + `prevFirstDayRef` date-diff. Observer gated behind `requestAnimationFrame` to suppress IO during initial-scroll mount. Month label derived from center-visible column. `ScheduleCard` is a deliberate narrow card for ~200px columns. `COLUMN_STEP=210` constant used throughout scroll math.

**What:** The `/orders` route. A week-based delivery schedule — order cards grouped into date columns (Mon–Sun), sorted by attention priority within each day. Fixes the broken "Orders" nav link that has existed since VS-02.

**Why this is separate from Dashboard and Calendar:**
- Dashboard (`/dashboard`) answers "what status is everything at?" — groups by workflow status (Booked, Started, Ready…).
- Orders Schedule (`/orders`) answers "what have I got coming up this week?" — groups by delivery date.
- Calendar (`/calendar`, VS-15) answers "am I overloaded in June?" — month-level workload heatmap.

**Backend:**
- `OrderViewSet.get_queryset()`: add `delivery_date_from` and `delivery_date_to` query params
  ```python
  # In OrderViewSet.get_queryset():
  date_from = self.request.query_params.get('delivery_date_from')
  date_to   = self.request.query_params.get('delivery_date_to')
  if date_from:
      queryset = queryset.filter(delivery_date__gte=date_from)
  if date_to:
      queryset = queryset.filter(delivery_date__lte=date_to)
  ```
- No new endpoints, no migrations. Change is additive — existing callers with no filter params are unaffected.

**Frontend:**
- Update `listOrders` (or equivalent API client function) to accept `{ deliveryDateFrom?, deliveryDateTo?, customerId? }` — replacing the current `customerId`-only signature.
- New `/orders` page component: `OrdersSchedulePage`
- Infinite horizontal day-column timeline (see completion record for the shipped detail): `loadedWeeks` state + `useQueries` (one query per week, keyed by week start), `IntersectionObserver` sentinels load adjacent weeks, DOM capped at `MAX_WEEKS`
- Group orders by `delivery_date` client-side
- Within each date group, sort by priority tier (see below)
- Navigation: scroll horizontally to move through weeks; a passive month label tracks the center column; a "Today" button scrolls back to today's column. (No ← / → week-pagination buttons — superseded during the layout rework.)
- Card: dedicated narrow `ScheduleCard` for ~200px columns (not a reuse of the Kanban `OrderCard`)
- Click card → open existing `OrderDetailsDrawer` (right side panel on desktop, full screen on mobile)
- Sidebar "Orders" link and mobile bottom nav "Orders" item both resolve to `/orders`

**Priority sort order within each date column (top = most urgent):**

| Tier | Condition |
|------|-----------|
| 1 | `delivery_date < today` AND `status != Delivered` — overdue, never delivered |
| 2 | `delivery_date = today` AND has delayed installment |
| 3 | `delivery_date = today` — any other status |
| 4 | `priority = urgent` (priority flag set) |
| 5 | `status = Started` |
| 6 | `status = Booked` |
| 7 | `status = Ready` or `Partial Delivery` |
| 8 | `status = Delivered` |

Within the same tier: sort by `created_at` ascending.

**Mobile:**
- Horizontal scroll through date columns
- One column fully visible with adjacent column peeking (~20px) to indicate scrollability
- Same priority ordering as desktop

**ADR:** None. No new architectural decisions — additive filter on existing viewset, dedicated `ScheduleCard`, reuse of the existing drawer.

**Review checkpoint:** Navigate to `/orders` — page loads (no 404). Current week's orders appear in correct date columns. Within one column, overdue orders are at the top and delivered orders at the bottom. Click a card — Order Details drawer opens. Scrolling left/right loads adjacent weeks without a jump; "Today" returns to today's column. Sidebar "Orders" and mobile bottom nav "Orders" both open this page. `GET /api/orders/?delivery_date_from=2026-06-02&delivery_date_to=2026-06-08` returns only orders in that range.

---

### VS-14 — Global Search ✓

**Completion record:** Commit `e3f3592` · No deferrals. pg_trgm extension + concurrent GIN indexes on customers.name and customers.phone via atomic=False migration. `apps/search` registered in INSTALLED_APPS. Customer search uses name/phone icontains (union, max 5 total). Order search parses `#0042`/`0042` to integer and filters `order_number=<int>` (exact). Frontend `/search` page: URL-backed query state, 300ms debounce, ≥2 chars, Customers + Orders result sections. Search added to Sidebar (desktop) and MobileNav (mobile, 2-FAB-3 layout).

**What:** Fast global search across customers and orders.

**Backend:**
- `pg_trgm` extension migration (hand-written migration in `customers` app)
- GIN trigram indexes on `customers.name` and `customers.phone`
- `GET /api/search/?q={query}` — returns up to 5 customers and 5 orders (ILIKE + trigram)

**Frontend:**
- Search results page
- Results grouped: Customers section, Orders section
- 300ms debounce, minimum 2 characters
- Customer result tap → Customer Profile
- Order result tap → Order Details drawer

**ADR:** None.

**Review checkpoint:** Search by partial customer name → results appear. Search by phone → customer found. Search by order ID → order found. `SELECT * FROM pg_extension WHERE extname = 'pg_trgm';` returns a row.

---

### VS-15 — Calendar

**What:** Clean-minimal month view — per-day workload overview + date drill-down (per the `01` cell spec).

**Backend:**
- `GET /api/calendar/?year={y}&month={m}` — one row per date in the month:
  `{ deliveries, payments, payment_amount, late, workload }`, in a single round-trip (aggregated; no N+1). `deliveries` = orders on that `delivery_date`; `payments` = unpaid installments with `due_date` on that date; `payment_amount` = their summed amount; `late` = orders on that date with `status != Delivered` and date `< today`; `workload` = `deliveries + payments` (interim count metric — upgrades to capacity-based in VS-16). (Reworks the v1 count endpoint; keeps the existing `/api/calendar/` path rather than a new `calendar-summary` action.)
- `GET /api/orders/?delivery_date_from={d}&delivery_date_to={d}` — single date drill-down (reuses existing filter)

**Frontend:**
- Calendar page (sidebar nav item)
- Month grid, clean-minimal cell (per `01`): date (today = filled accent circle) · single workload dot (green 0–2 / amber 3–5 / red 6+) · red "N late" pill · neutral icon+count event chips (🚚 delivery, ₹ payment). Pickup not modelled in MVP.
- Hairline borders + gaps; out-of-month and empty cells recede; grid fills the viewport height.
- Slim one-line summary above the grid ("N deliveries due today · ₹X to collect · N overdue"); no KPI trend cards.
- View switcher: **Month** only (Week/Day deferred — week-zoom served by `/orders`).
- Colour: red = late/overloaded only; event chips neutral; one workload dot (per `07`).
- Prev / Today / Next month navigation.
- Date tap → right panel (desktop) / bottom sheet (mobile) reusing the VS-15a `ScheduleCard`; order tap → Order Details drawer.

**ADR:** None — presentational refinement of an active slice; one additive aggregate field, no contract break.

**Review checkpoint:** Calendar loads for current month, grid fills height. Orders on different dates → workload dot reflects deliveries+payments (try 0–2 / 3–5 / 6+). A date with past-due undelivered orders shows the red "N late" pill above its chips. Each day shows at most one workload dot — no capacity bar or "Busy" label. Event chips are neutral (only late/overloaded is red). Out-of-month days recede; today is circled. Tap a date → order list shows; tap an order → drawer opens.

---

### VS-16 — Settings

**What:** Profile edit, password change, notification preferences.

**Backend:**
- `NotificationPreference` model (OneToOne to User, 4 boolean toggles)
- `delivery_buffer_days` (PositiveSmallIntegerField, default 0) — on User or a `UserSettings` 1:1
- `daily_capacity` (PositiveSmallIntegerField, default 6) — garments the shop can finish per day. Drives the calendar workload-dot thresholds once set (Light ≤ ⅓·cap, Overloaded ≥ cap); until set, VS-15 uses the interim count thresholds (0–2 / 3–5 / 6+).
- Add to `users` migration
- `PATCH /api/auth/me/` — update name, business name, phone
- `POST /api/auth/change-password/` — verify old, set new
- `GET/PATCH /api/auth/notification-preferences/` — read and update toggles
- `GET/PATCH /api/auth/order-settings/` — read/update `delivery_buffer_days`

**Frontend:**
- Settings page (sidebar gear icon)
- Profile section: business name, owner name, phone, change password form
- Order Settings section: numeric input for default delivery buffer days
- Order Settings section: numeric input for daily capacity (workload) — feeds the VS-15 calendar dot thresholds
- **Add-Order recommendation pill (O4)** in `StepDelivery`: "Suggested: <nearest date ≥ today + buffer_days with ≤5 load>" pill below the picker, plus a soft confirm when a high-load (13+) date is selected
- Notification preferences: 4 toggles
- Danger Zone: "Delete all data" (typed confirmation phrase) — **deferred for MVP: render as a disabled control with a "coming soon" note**
- Logout button

**ADR:** None.

**Review checkpoint:** Update business name → persists on reload. Change password → can log in with new password. Toggle notification preference → persists. Set buffer days = 2 → Add-Order recommendation skips the next 2 days. High-load date → soft confirm appears.

---

### VS-17 — Mobile Layout

**What:** Responsive layouts for all screens. Mobile-first polish pass.

**Backend:** No changes.

**Frontend:**
- Bottom navigation bar (mobile replacement for sidebar)
- Kanban: horizontal scroll on mobile, one column visible at a time with column selector
- Order Details: full screen on mobile instead of side drawer
- Add Order Flow: bottom sheet on mobile
- All drawers and modals: full-screen on mobile
- Verify all screens at 375px and 768px breakpoints

**ADR:** None.

**Review checkpoint:** Load app on 375px viewport. All screens navigable via bottom nav. Kanban scrollable. Order Details opens full screen. No overflow or broken layouts.

---

### VS-18 — Production Deployment

**What:** Production Docker Compose + Nginx config + CI/CD pipeline.

**Backend:**
- `backend/Dockerfile` (production, Gunicorn)
- Production settings (`config/settings/production.py`)

**Frontend:**
- `frontend/Dockerfile` (production, `next build` + `next start`)

**Infra:**
- `docker-compose.prod.yml`: frontend, backend, postgres, nginx services
- `nginx/nginx.conf`: `/` → Next.js (3000), `/api/` → Django (8000)
- `.github/workflows/deploy.yml`: build both images on push to `main`, SSH into EC2, pull + restart

**ADR:** Write ADR-0006 (deployment strategy) here.

**Note:** Requires EC2 provisioned and SSH key configured as a GitHub secret. Flag before starting this slice.

**Review checkpoint:** Push to `main` → GitHub Actions passes → change visible on live EC2 URL. `curl https://yourdomain.com/api/health/` returns 200.

---

## Completion Criteria

A slice is complete when:
- [ ] Backend endpoints tested with curl or a REST client
- [ ] Frontend manually tested in browser (happy path + one error case)
- [ ] No TypeScript errors (`npm run build` clean)
- [ ] No Django check errors (`python manage.py check`)
- [ ] Committed with a structured message
- [ ] ADR written if the slice required a new architectural decision
