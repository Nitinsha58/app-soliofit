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
| VS-15 | Calendar | Month view with workload coloring, date drill-down | Done |
| VS-16 | Settings | Profile edit, password change, notification toggles | Done |
| VS-17 | Mobile layout | Bottom nav, full-screen drawers, responsive Kanban | Done |
| VS-18 | Production deployment | Push to `main` → deploys to EC2 via GitHub Actions | Done |
| VS-19 | Order payment summary | Cards show remaining balance + payment state (annotated, no N+1) | Done |
| VS-20 | Orders list scaling | Per-column lazy-load on scroll; category counts = totals; defer aged Delivered | Done |
| VS-21 | Delete order | Soft-delete order + cascade installments/media + S3 cleanup, with confirm | Done |
| VS-22 | Forgot password | Pre-login email reset link (Gmail SMTP) | Done |
| VS-23 | Boutique tenant | Introduce Boutique entity; scope all data to it; per-boutique order numbers | Done |
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
| VS-15 | Calendar | Done |
| VS-16 | Settings | Done |
| VS-19 | Order payment summary | Done |
| VS-20 | Orders list scaling | Done |
| VS-21 | Delete order | Done |
| VS-22 | Forgot password | Done |
| VS-23 | Boutique tenant | Done |
| VS-17 | Mobile layout | Done |
| VS-18 | Production deployment | **Done** |

_Window reviewed: 2026-06-07 (post-VS-19 window review): `docs/README.md` status synced; VS-20–VS-23 + VS-08b specs written; ADR-0006 (orders list scaling — keyset cursor) accepted; VS-21/22/23 promoted Backlog → Pending. Next review after VS-18 (MVP close)._
_Final batch execution order: VS-20 → VS-21 → VS-22 → VS-23 → VS-17 → VS-18. VS-23 tenancy decision recorded in ADR-0007 (Accepted); VS-18 still needs a deployment ADR at its activation._
_2026-06-09: VS-23 (Boutique tenant) closed — ADR-0007 Accepted, schema on final tenancy foundation. **VS-17 (Mobile layout) is now Active.** Two slices remain to MVP close: VS-17 → VS-18._
_2026-06-09: VS-17 in progress — QuickActions drawer unit landed (`3ce7e75`): Photos/Voice/Payment shortcuts now scroll to their live sections (were dead buttons), the "Mark Delivered" 375px wrap carry-forward (spec line below) is fixed, and a "Payments" section header was added as the Payment shortcut's landing target. Remaining VS-17 units: bottom nav, responsive Kanban (single-column + selector), full-screen drawers/sheets on mobile, 375px/768px sweep._
_2026-06-09: VS-17 — **Global Search + shared AppHeader** unit landed (6 commits `1de1300`→`68ae8c4`; spec `docs/superpowers/specs/2026-06-09-global-search-appheader-design.md`, plan `docs/superpowers/plans/2026-06-09-global-search-appheader.md`). Bottom nav back to five items (Dashboard·Orders·⊕·Payments·Customers; Search removed; Home→Dashboard). Search is now a global command surface — one engine (`useSearch`+`SearchResults`), three shells (`SearchPage` full route, `SearchSheet` mobile overlay, `SearchDropdown` desktop). New persistent `AppHeader` (title + per-route Add-Order slot + search + notifications + profile) in `AppShell`; sidebar slimmed to sections; per-page title rows removed; Calendar moved into `ProfileMenu` for mobile; Calendar/Orders/BoardColumn full-height math corrected for the 56px header. Tablet icon rail explicitly deferred. Remaining VS-17 units: responsive Kanban (single-column + column selector), full-screen mobile drawers/sheets audit, 375/768 breakpoint sweep._
_2026-06-09: VS-17 — **Responsive Kanban (mobile single-column)** unit landed (2 commits `4552e66`→`ea0ab6c`; spec `docs/superpowers/specs/2026-06-09-responsive-kanban-design.md`, plan `docs/superpowers/plans/2026-06-09-responsive-kanban.md`). `KanbanBoard` is now a responsive switch: desktop board unchanged (`hidden lg:block`); mobile (`lg:hidden`) renders `MobileBoard` — one focused status column + `ColumnChips` + compact `AttentionRail` (Delayed·Today·Upcoming; Pending/Overdue excluded — Payments domain). `MobileBoard` loads all five columns; smart default focus = status with most delayed loaded rows (ties by column order, else Booked); tapping a date pill applies the cross-board filter, chips show filtered counts, focus auto-jumps to the heaviest status. DnD stays desktop-only; mobile status change via the existing detail-drawer dropdown. Remaining VS-17 units: full-screen mobile drawers/sheets audit, 375/768 breakpoint sweep._
_2026-06-10: VS-17 (Mobile Layout) **closed — Done.** Five units shipped: QuickActions drawer (`3ce7e75`); Global Search + shared AppHeader (`1de1300`→`68ae8c4`); Responsive Kanban mobile single-column (`4552e66`→`ea0ab6c`); mobile overlay audit — consistent bottom-sheet/full-width patterns (`d90c2fa`); final 375/768 breakpoint sweep (visual + static — no clipping/overflow defects). No ADR required. **Deferred follow-up (tracked, not a blocker):** `PaymentKanban` (the `/payments` board) is still a horizontally-scrolling multi-column board on mobile — functional/contained (scrolls, doesn't clip); giving it the single-column treatment is its own design/unit, out of the responsive-Kanban spec scope. **VS-18 (Production deployment) is now Active — the last MVP slice; needs a deployment ADR at activation.**_

_2026-06-11: **VS-18 (Production deployment) closed — Done. 🎉 MVP is LIVE in production at https://app.soliofit.com.** ADR-0008 Accepted (host Nginx + Certbot, Redis shared cache, WhiteNoise static, PR-gated single `main`, tarball-over-SSH, pre-deploy + daily `pg_dump`). Artifacts: `b91e5cc` prod settings → `2667950` Dockerfiles + compose + `.dockerignore` → `03b0ffd` host nginx + CI/deploy workflow + scripts + env templates → `e4f7b63`/`14be1b5` provisioning runbook (`deploy/README.md`). Provisioned: repo `github.com/Nitinsha58/app-soliofit`, EC2 + Elastic IP, DNS `app.soliofit.com`, S3 `soliofit-prod-media`, IAM keys. HTTPS + CI/CD deploys + health check + S3 uploads/media all verified live. Vault `08-devops-deployment.md` rewritten to as-built (v2.0). **All 19 vertical slices (VS-00 → VS-18) are complete — MVP done.** See the VS-18 completion record below for as-built deviations (public-read media, console email).  Next review: post-MVP planning window._
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

### VS-15 — Calendar ✓

**Completion record:** Commits `3b1b03b` → `332cd2d` → `cbcbda6` · Deviations: kept the existing `/api/calendar/` path (reworked payload) instead of a new `calendar-summary` action; preserved the approved workload-dot + late-pill model rather than the reference's single On-track/Busy/Overdue dot; omitted the reference's "Filters" button (no filter feature exists); dropped the pickup chip (not modelled in MVP). Calendar reached via Dashboard shortcut + Orders toolbar button — mobile bottom nav stays at 5 items.

Backend: `CalendarView` (`apps/orders/calendar_views.py`) at `GET /api/calendar/?year=&month=` returns per-date `{deliveries, payments, payment_amount, late, workload}` via aggregate `.values().annotate()` (no N+1); unpaid `Installment` due-dates drive payment counts/amounts; `late` = past-due undelivered deliveries. 31/31 orders tests pass (incl. `CalendarViewTests` + `OrderNumberRaceTests`); media presign validation added with 9 tests.

Frontend (`/calendar`): month grid (Monday-start, 5/6 dynamic rows), proportionate `min-h-[84px]` scrollable cells, today = filled accent circle, single workload dot (green 0–2 / amber 3–5 / red 6+), red "N late" pill, neutral 🚚/₹ event chips. Three summary cards (deliveries today / amount to collect / overdue) matching the reference top-nav; bold month header + green "Today" pill + notification bell. Mobile (375px) summary card stacks vertically so the amount renders without truncation (`cbcbda6`). Date tap → right panel (desktop) / bottom sheet (mobile) reusing `ScheduleCard`. Workload thresholds upgrade to capacity-based once VS-16 ships `daily_capacity`.

**What:** Clean-minimal month view — per-day workload overview + date drill-down (per the `01` cell spec).

**Backend:**
- `GET /api/calendar/?year={y}&month={m}` — one row per date in the month:
  `{ deliveries, payments, payment_amount, late, workload }`, in a single round-trip (aggregated; no N+1). `deliveries` = orders on that `delivery_date`; `payments` = unpaid installments with `due_date` on that date; `payment_amount` = their summed amount; `late` = orders on that date with `status != Delivered` and date `< today`; `workload` = `deliveries + payments` (interim count metric — upgrades to capacity-based in VS-16). (Reworks the v1 count endpoint; keeps the existing `/api/calendar/` path rather than a new `calendar-summary` action.)
- `GET /api/orders/?delivery_date_from={d}&delivery_date_to={d}` — single date drill-down (reuses existing filter)

**Frontend:**
- Calendar page (sidebar nav item)
- Month grid, clean-minimal cell (per `01`): date (today = filled accent circle) · single workload dot (green 0–2 / amber 3–5 / red 6+) · red "N late" pill · neutral icon+count event chips (🚚 delivery, ₹ payment). Pickup not modelled in MVP.
- Hairline borders + gaps; out-of-month and empty cells recede; grid fills the viewport height.
- Three summary cards above the grid: deliveries due today (🚚), amount to collect (₹), overdue orders (⊘); proportionate cell height (not viewport-fill); workload legend below the grid.
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
- `daily_capacity` (PositiveSmallIntegerField, default 6, min 1) — garments the shop can finish per day. Drives the calendar workload-dot thresholds, relative to capacity: Light < ⌈½·cap⌉, Busy ⌈½·cap⌉–cap, Overloaded ≥ cap. At the default capacity of 6 this reproduces the interim bands VS-15 shipped (0–2 / 3–5 / 6+); the same bands colour the Add-Order mini-calendar.
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
- **Add-Order recommendation pill (O4)** in `StepDelivery`: "Suggested: <nearest date ≥ today + buffer_days with load < daily_capacity>" pill below the picker, plus a soft confirm when the selected date is at/over capacity (escalating wording past an absolute 13+ "very heavy" mark)
- Notification preferences: 4 toggles
- Danger Zone: "Delete all data" (typed confirmation phrase) — **deferred for MVP: render as a disabled control with a "coming soon" note**
- Logout button

**ADR:** None.

**Review checkpoint:** Update business name → persists on reload. Change password → can log in with new password. Toggle notification preference → persists. Set buffer days = 2 → Add-Order recommendation skips the next 2 days. High-load date → soft confirm appears.

**Completion record:** Commits `c44cb0a` (backend), `81f6e8e` (frontend), `c85a032` (VS-17 carry-forward), `6faa041` (review fixes) · Deferred: none.

Backend: `UserSettings` 1:1 (`delivery_buffer_days` default 0, `daily_capacity` default 6, min 1 / max 100) and `NotificationPreference` 1:1 (4 booleans, default True). **Notification prefs are preference-only — not wired to any delivery channel; stored for a future notification pipeline.** `PATCH /api/auth/me/` (email read-only), `POST /api/auth/change-password/` (verifies old, validates new, `update_session_auth_hash` keeps the session valid), `GET/PATCH /api/auth/order-settings/` and `/notification-preferences/` (auto-create on first access). 13 users-app tests, 99 backend total.

Frontend: `/settings` (Profile, Change password, Order settings, Notification toggles, disabled "Delete all data" danger zone, mobile logout); `ProfileMenu` mobile avatar (initials owner→business→email) in the Dashboard header → Settings + Logout (desktop keeps the sidebar). `StepDelivery` O4: suggests the nearest date with `load < daily_capacity` (≥ today + buffer), capacity-relative soft confirm escalating past an absolute 13+ mark. `client.ts` surfaces DRF field errors (e.g. wrong current password).

Review deviations addressed before close: workload-dot bands made capacity-relative on both the Calendar and the Add-Order mini-calendar (half-capacity rule — default cap=6 reproduces 0–2 / 3–5 / 6+); `daily_capacity=0` rejected at the serializer; Settings labels associated to inputs via `htmlFor`/`id`. Slice + vault wording reconciled to the half-capacity rule.

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
- **Carry-forward (pre-VS-15 P3):** `QuickActions.tsx` "Mark Delivered" button squeezes/wraps at 375px — fix as part of the mobile drawer/action polish.
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

**ADR:** Write a deployment-strategy ADR at activation (next sequential ID — ADR-0006 is taken by orders list scaling, so this will likely be ADR-0008 after VS-23's tenancy ADR). Do not hardcode the number ahead of time.

**Note:** Requires EC2 provisioned and SSH key configured as a GitHub secret. Flag before starting this slice.

**Review checkpoint:** Push to `main` → GitHub Actions passes → change visible on live EC2 URL. `curl https://yourdomain.com/api/health/` returns 200.

---

**Status: Done (2026-06-11). 🎉 MVP LIVE at https://app.soliofit.com.** Spec: `docs/adr/ADR-0008-production-deployment.md` (Accepted); plan: `docs/superpowers/plans/2026-06-10-production-deployment.md`; runbook: `deploy/README.md`.

**As-built architecture (ADR-0008):** single EC2 `t3.small` (Ubuntu 22.04, ap-south-1) running Docker Compose (`frontend`, `backend`, `postgres:15-alpine`, `redis:alpine` — **no nginx container**), ports bound to `127.0.0.1` only. **Host** Nginx + Certbot terminate TLS and reverse-proxy (`/api/`,`/admin/`,`/static/`→`:8000`, `/`→`:3000`). PR-gated single `main`; GitHub Actions tests (backend `manage.py test`; frontend type-check+build, **no lint**) then on `main` builds both images → `images.tar.gz` over SSH → pre-deploy `pg_dump` → `docker load` → `docker compose up -d`. Tarball-over-SSH, **no registry**. Redis shared cache (fixes the per-worker password-reset throttle, the VS-22 LocMem caveat). WhiteNoise serves Django static (collectstatic at container start). `.dockerignore` keeps `.env` out of images.

**Units shipped:** `b91e5cc` prod settings (Redis + WhiteNoise + TLS-proxy security, `SECURE_SSL_REDIRECT=True`) → `2667950` prod Dockerfiles + compose + `.dockerignore` (secret-leak fix) → `03b0ffd` host nginx site config + CI/deploy workflow + EC2/backup scripts + env templates (review fixes: concurrency guard, frontend-only security headers, timeouts, idempotent cron, guarded pre-deploy backup) → `e4f7b63` provisioning runbook → `14be1b5` runbook fixes (deploy-SSH SG reality + read-only deploy key).

**Operator-provisioned (live):** repo `github.com/Nitinsha58/app-soliofit`; EC2 + Elastic IP; DNS `app.soliofit.com`; S3 media bucket `soliofit-prod-media`; IAM keys; on-box `backend/.env`; GitHub secrets `EC2_HOST`/`EC2_SSH_KEY` + variable `NEXT_PUBLIC_API_URL`.

**Verified live:** HTTPS + valid TLS; CI/CD deploy on merge to `main`; `/api/health/` 200; secure-cookie login; `/admin/` styled (WhiteNoise); S3 uploads + media display.

**As-built deviations from the original design (intentional, MVP):**
- **Media access = public-read prefixes, not presigned URLs.** Image `403`s were diagnosed as private-object reads; chose "MVP Option A" — a bucket policy granting public read on `photos/*` and `voice-notes/*` on `soliofit-prod-media`. This **deviates from the presigned-URL model** originally in vault docs 03/04. Acceptable for MVP (media is non-sensitive workout/voice content); revisit if media must be access-controlled. *(Vault 03/04 updated 2026-06-11 to document the as-built public-read model + the private-bucket/presigned-GET hardening target.)* Note: presigned URLs are still used for **upload (PUT)**; only the **read** path is public-read.
- **Email backend = console (not SMTP) for now**, so a missing/unconfigured mail account can't break the app. Password-reset emails print to the container log until SMTP creds are added to `backend/.env`. The VS-08 password-reset flow is otherwise fully wired.
- **`backend/.env` lives on the server and is not overwritten by normal deploys** (deploys ship images + compose only) — secret rotation is decoupled from redeploy.
- Debug note: stale AWS creds required **recreating** the backend container (env changes need a container recreate, not just restart) — captured for ops.

No deferrals block MVP. **All 19 slices (VS-00 → VS-18) complete.**

---

### VS-19 — Order Payment Summary

**What:** Order cards surface how much has been collected and the order's payment state, so the boutique can see outstanding balances at a glance without opening each order. Reuses the VS-11 payments-dashboard taxonomy so the cards and that dashboard never disagree.

**Backend (`orders`):**
- `OrderViewSet.get_queryset()` gains an `amount_paid` annotation: `Coalesce(Subquery(Sum of installments where paid_date is set), 0)` — the same subquery style as the existing `has_delayed_installment` `Exists` annotation. No per-card query (no N+1).
- `OrderSerializer` exposes three read-only fields derived in Python from the two annotations (`amount_paid`, `has_delayed_installment`):
  - `amount_paid` — total collected
  - `remaining` — `max(total_amount − amount_paid, 0)`
  - `payment_state` ∈ `completed | overdue | partial | pending` (mirrors `payments.views._classify_order`), plus `unbilled` when `total_amount == 0` so a zero-bill order does not read as paid
- Defaults are safe on freshly-created orders (no annotation present → `amount_paid` 0, state `pending`/`unbilled`).

**Frontend:**
- `Order` type extended with `amount_paid` / `remaining` / `payment_state`.
- Both card surfaces — `OrderCard` (Kanban) and `ScheduleCard` (Orders Schedule) — show **`₹paid / ₹total`** on the amount line, with a colored state pill + "₹X due" beneath (the "Paid / total progress" layout). Paid state hides the due text.
- Labels: Paid (emerald) / Partial (amber) / Unpaid (neutral) / Overdue (red); `unbilled` → no pill, plain bill amount only.
- On `ScheduleCard` the unified payment pill **replaces** the standalone "Delayed" badge — one payment signal, not two.

**ADR:** None — one additive annotation + presentational serializer fields; isolated and easily reversible (noted in commit body).

**Review checkpoint:** Order with 1 of 2 installments paid → "Partial · ₹X due", amount line shows `₹paid / ₹total`. Fully paid → "Paid", no due text, remaining ₹0. Past-due unpaid installment → "Overdue" (red). Zero-bill order → no pill. Order-list query count is flat regardless of how many cards render (assert via `assertNumQueries`).

**Completion record:** Commits `bb153f7` (code), `7ccdfce` (spec) · Deferred: none · Scope: limited to `OrderCard` (Kanban) + `ScheduleCard` (Orders Schedule). `CustomerOrdersTab` left as a row-list (customer profile already shows customer-level outstanding balance + a Payments tab).

Backend: `OrderViewSet.get_queryset()` annotates `amount_paid` via a Coalesce'd `Sum` subquery (no join → no N+1, no row multiplication), alongside the existing `has_delayed_installment` `Exists`. `OrderSerializer` derives `amount_paid` / `remaining` (`max(total − paid, 0)`) / `payment_state` in pure Python from those annotations, with safe defaults for freshly-created (un-annotated) orders. `payment_state` ∈ `completed | overdue | partial | pending | unbilled` — mirrors `payments.views._classify_order`. 9 tests (state matrix, safe-create defaults, flat query count, delivery-load grouping guard); 108 backend total, frontend type-check clean.

Frontend: `Order` type + `lib/orderPayment.ts` (`paymentMeta`, `inr`). Both cards show `₹paid / ₹total` with a colored state pill (Paid/Partial/Unpaid/Overdue) + "₹X due"; Paid hides due text; `unbilled` → plain bill, no pill. On `ScheduleCard` the unified pill **replaced** the standalone "Delayed" badge (one payment signal). Card layout: "Paid / total progress" option.

---

### VS-20 — Orders List Scaling

**What:** Replace the currently-unbounded orders list (`OrderViewSet` has `pagination_class = None`) with **per-column keyset (cursor) pagination + lazy-load on scroll**, so the board stays fast as orders accumulate. Category counts stay true totals (not loaded counts); aged Delivered orders are deferred behind a "show older" cursor continuation rather than dropped.

**ADR:** [ADR-0006](../adr/ADR-0006-orders-list-scaling.md) — Orders list scaling via keyset cursor pagination. **Accepted.**

**Backend (`orders`):**
- **Pagination is opt-in via a dedicated board action** — `GET /api/orders/board/?status=Booked&cursor=<opaque>&limit=20`. The default `GET /api/orders/` list is **unchanged** (returns a plain `Order[]`), so no existing caller's response shape changes.
- Per-column sort: active columns by `(delivery_date, created_at, id)` asc (soonest due first); Delivered by `(delivered_at, id)` desc (newest completed first). The opaque cursor encodes the relevant tuple. `limit` default 20, capped (≤50). Keyset (not offset) so concurrent drags/creates/deletes don't skip or duplicate rows mid-scroll.
- Board response: `{ results: [...], next_cursor: <opaque|null>, counts: {…}, value: {…} }`. `counts` are full per-status **totals** and `value` is `Sum(total_amount)` per status — both from a single grouped aggregate query (no N+1). `results` keep the VS-19 `amount_paid` / `has_delayed_installment` annotations.
- **Status changes funnel through `PATCH /api/orders/{id}/status/` only** (status is a domain event, not a field edit — it sets/clears `delivered_at`, writes activity, and changes board membership). `status` becomes read-only in `OrderSerializer`; `partial_update` **rejects** an incoming `status` with a 400 ("Use /status/ to change order status.") rather than silently ignoring it. `update_status` is the single transactional path: idempotent on a no-op; sets `delivered_at = now()` when moving **into** Delivered (previous status ≠ Delivered), clears it when moving out; writes the `DELIVERY_MARKED` / `PARTIAL_DELIVERY` / `STATUS_CHANGED` activity. (Also fixes the latent bug where QuickActions "Mark Delivered" PATCHed status and logged no activity.)
- New nullable `Order.delivered_at`. Data migration backfills existing Delivered orders from the latest `DELIVERY_MARKED` activity timestamp (fallback `updated_at`); add an index over `(user, status, delivered_at)`.
- Delivered column: default window returns `delivered_at >= today − 30 days` (keyset by `delivered_at` desc); an explicit `older=true` mode returns `delivered_at < cutoff` behind a "show older" affordance — deferred, not excluded.
- Every non-board consumer keeps the legacy `GET /api/orders/` → `Order[]` contract: the Orders Schedule (`/orders`, date-range filtered), the calendar day drill-down (single-date), the customer profile (customer filtered), and the `delivery-load` aggregate. None use the cursor.

**Frontend:**
- New `listOrderColumn({ status, cursor, limit })` client for the board action; `listOrders()` (→ `Order[]`) stays as-is for all other callers.
- QuickActions "Mark Delivered" switches from `updateOrder({ status })` to `updateOrderStatus(id, 'Delivered')` (the only status path now).
- Board columns use React Query `useInfiniteQuery` keyed `[orders-board, status]`, `getNextPageParam = next_cursor`; append on an IntersectionObserver sentinel near the column bottom.
- Column header shows the true total from `counts` plus the column's total order value (`value`, compact ₹) — the value chip is in the column colour, slightly larger, to read as the value of work in that stage.
- Drag-and-drop: optimistically move the card on status change, then invalidate/refetch the **source and destination** column's first page (membership + counts change) — no full-board reload.
- **Touch-safe DnD:** split into `MouseSensor` (desktop) + `TouchSensor` with a deliberate ~280ms press-and-hold; drop `touch-action: none` from the card so touch scrolling works over cards and a scroll isn't mistaken for a drag.
- **Recently-moved feedback:** a just-dropped card gets a brief status-colored ring + an **Undo snackbar** that clear after ~6s. Undo is a **one-shot** compensating reverse `/status` move that then dismisses the snackbar (not re-offered, so repeated clicks can't ping-pong the card). Separately, a **persistent `From <previous status>` tag** (in the *source* status's colour) stays on the card for the session — driven by a client-side `orderId → previous status` map that survives refetches.
- **Card payment display:** the *paid* amount is colour-coded by payment state (green=paid, orange=partial, **red=pending or overdue**) with `/ total` neutral; the text payment badge and "₹ due" line are removed. A bottom-right last-changed stamp shows `updated_at` as 12-hour AM/PM clock time. No emoji anywhere in the UI (project rule).
- The **Delivered column is a normal, always-visible column** (no collapse/hide): it shows its recent-window cards, loads more on scroll, and exposes a **"Show older delivered"** affordance that continues into the `older=true` window. A drop lands and the newly-delivered card appears at the top of the recent window (it gets `delivered_at = now()`).
- During drag, auto-scroll the board horizontally near the edges so offscreen columns (e.g. Delivered) are reachable — or carry as a VS-17 mobile-polish item if dnd-kit autoscroll proves involved.
- `ScheduleView` (`/orders`) is **unchanged** — it groups by delivery date over the visible week via the legacy `listOrders()`, not the per-column cursor.

**Review checkpoint:** A column with 60+ orders loads ~20, scroll fetches more, header shows the true total. Drag a card across columns → both counts update, no duplicate/disappeared cards. Delivered shows recent first; "show older" pulls the rest. Per-page query count stays flat (no N+1; `amount_paid` still annotated). Calendar and customer-profile lists unchanged.

**Completion record (2026-06-08):** Backend (units 1–2) `e5e9584`/`b691959`/`d37d10f`/`254a152`, cursor 400 hardening `8e5f1fd`; frontend (unit 3) `467d88f`; review rounds `0d16c2a` (older-tail gating, touch sensors, last-changed time), `4c9a6b9` (undo snackbar, paid recolor, column value, emoji purge), `cba1d7c` (persistent colored provenance, always-on Delivered, red pending), `d3297cf` (one-shot undo, black value chip). Backend 57 tests (incl. 12 BoardActionTests); `delivered_at` field + backfill migration; board response `{results,next_cursor,counts,value}`. ADR-0006 accepted + amended twice (per-column sort pre-impl; additive `value` during review). Scope notes: Delivered ships as a normal always-visible column (no collapse); summary-card filters apply client-side over loaded rows (under-reports by design). Deferred to **VS-17**: horizontal board auto-scroll during drag (dnd-kit autoscroll), QuickActions "Mark Delivered" 375px wrap. Follow-up: swap remaining monochrome icon glyphs (`✓`/`✕`) in payment-drawer buttons for SVGs (no-emoji rule).

---

### VS-21 — Delete Order

**What:** Let the owner soft-delete a mistaken/cancelled order, cascading to its installments and media, cleaning up S3 objects, and logging the deletion. No hard delete in MVP. **Distinct from** the Settings → "Delete all data" danger-zone item (an account-level wipe, currently a disabled "coming soon"); VS-21 is per-order.

**ADR:** None expected — soft-delete via `deleted_at` is already established (the `destroy` handler already sets `order.deleted_at`). Add one only if S3 cleanup needs an async job.

**Backend:**
- `DELETE /api/orders/{id}/` soft-deletes the order (sets `deleted_at`). The cascade is **already enforced by the existing invariant**: every active query for installments and media is scoped through `order__deleted_at__isnull=True` (verified across payments, dashboard, search, calendar, customer-profile, board), so flagging the order makes all children disappear from active views with no per-child `deleted_at` and no schema change. Child rows are **kept** (no hard delete) — payment history stays queryable, only excluded.
- **S3 cleanup is synchronous + best-effort**: on delete, the order's photo + voice-note `s3_key`s are collected and passed to a shared `apps.media.s3.delete_objects()` (batched `DeleteObjects`, idempotent on missing keys, swallows errors — never blocks the soft-delete). The single-object photo/voice deletes were refactored onto the same helper. No async job → no ADR.
- **Trusted-cleanup prerequisite (security):** because the stored `s3_key` is what the cleanup path deletes, it must not be client-forgeable. Media create now validates `s3_key` against the presign contract (`photos/<uuid>.<img-ext>` / `voice-notes/<uuid>.<audio-ext>`, no `..`/absolute paths) and **derives `public_url` server-side** (read-only) from the key — closing a pre-existing hole where an owner could attach an arbitrary key and delete an arbitrary bucket object (or path-traverse out of `MEDIA_ROOT/stub` in dev) via the order/media delete.
- `OrderActivity.Type.ORDER_DELETED` added and logged (with `order_number`) inside the same transaction as the `deleted_at` write.
- Ownership/idempotency come free from `get_queryset` (user-scoped, `deleted_at__isnull=True`): another user's order and an already-deleted order both 404, and the second delete performs no second S3 cleanup or activity.
- Restore is out of scope for MVP (rows recoverable in the DB); no restore UI. **Settled at activation:** installment/media rows are soft (kept, parent-filtered), not hard-deleted; S3 deletion is synchronous best-effort.

**Frontend:**
- `DangerZone` section at the bottom of the Order Details drawer: a **two-step** delete (no one-tap) — "Delete order" expands an in-place confirmation naming the order and its side effects ("Delete order #0042? This also removes its installments and photos. This can't be undone.") with explicit Delete/Cancel.
- `deleteOrder(id)` client → `DELETE /api/orders/{id}/`.
- On success: `showToast("Order #0042 deleted")`, `onUpdated()` (the existing `ordersRefreshKey` fan-out — board, schedule, customer, payments, dashboard, notifications all refetch and the card disappears), then close the drawer. On error: inline message, stay open.
- Added a minimal global toast: `useUIStore.showToast/dismissToast` + a `ToastHost` rendered in `AppShell` (single transient bottom-center pill, auto-dismiss). `['orders-schedule']` added to the `AppShell` refresh fan-out so deletes (and any order mutation) drop the card from the Orders Schedule too.

**Review checkpoint:** Deleting an order removes it from board, calendar, search, and customer profile; its installments drop out of payment totals; S3 objects are removed (or cleanup enqueued); the activity log records the deletion. No one-tap accidental delete.

**Completion record (2026-06-09):** Commits `01f6fc1` (backend soft-delete + S3 cleanup + activity), `5445d98` (media `s3_key` validation security fix), `6c2b8ae` (frontend confirm flow). Browser-verified: delete removes the card and drawer, toast shown. No deferrals.

Backend: `perform_destroy` collects the order's photo + voice-note `s3_key`s, then within one `transaction.atomic()` sets `deleted_at`, writes `OrderActivity.Type.ORDER_DELETED` (with `order_number`), and after commit calls `apps.media.s3.delete_objects()` (batched, idempotent, best-effort — never blocks the soft-delete). Cascade is free: the verified invariant is that every active child query already scopes `order__deleted_at__isnull=True` (payments, dashboard, search, calendar, customer-profile, board), so child rows are kept (payment history queryable) but excluded from all active views — no per-child `deleted_at`, no schema change. Ownership + idempotency come from `get_queryset` (user-scoped, `deleted_at__isnull=True`): another user's order and a re-delete both 404 with no second cleanup. **Security prerequisite shipped (`5445d98`):** new `apps.media.s3` module is the single source of truth for valid keys (`photos/<uuid>.<img-ext>` / `voice-notes/<uuid>.<audio-ext>`, no `..`/absolute); media-create serializers now `validate_s3_key` and `public_url` is derived server-side (read-only) — closing the hole where a client-forgeable key could delete an arbitrary bucket object (or path-traverse out of `MEDIA_ROOT/stub` in dev) via order/media delete. The single-object photo/voice deletes were refactored onto the same `delete_objects([key])` helper. 138 backend tests (9 `DeleteOrderTests` + 4 `MediaKeyValidationTests`). No ADR — soft-delete + synchronous best-effort cleanup needed no new architectural decision.

Frontend: `DangerZone` at the drawer bottom — two-step (no one-tap): "Delete order" expands an in-place confirmation naming the order (`#0042`) and side effects ("This also removes its installments and photos. This can't be undone.") with explicit Delete/Cancel. `deleteOrder(id)` → `DELETE /api/orders/{id}/`; on success `showToast`, `onUpdated()` (the `ordersRefreshKey` fan-out — board/schedule/customer/payments/dashboard/notifications all refetch, card disappears), then close drawer; on error inline message, stay open. Added a minimal global toast (`useUIStore.showToast/dismissToast` + `ToastHost` in `AppShell`, single transient bottom-center pill, auto-dismiss 3s) and added `['orders-schedule']` to the AppShell refresh fan-out so deletes drop the card from the Orders Schedule too. No emoji (project rule). `tsc` clean.

---

### VS-22 — Forgot Password

**What:** Pre-login password reset via an emailed link (Gmail SMTP).

**ADR:** None expected — uses Django's built-in token machinery; SMTP is already planned in `08-devops`. Flag only if we choose a custom token model.

**Backend:**
- Use Django's `PasswordResetTokenGenerator` (no new model).
- `POST /api/auth/password-reset/` `{ email }` → always 200 (no account enumeration); if the email matches a user, email a reset link. Rate-limit per email/IP.
- `POST /api/auth/password-reset/confirm/` `{ uid, token, new_password }` → validate token (expiry via `PASSWORD_RESET_TIMEOUT`, default 3 days), run `validate_password`, set the new password, invalidate the token.
- Email link targets the frontend: `https://<host>/reset-password?uid=<uid>&token=<token>`.

**Frontend:**
- `/forgot-password`: email input → neutral success copy ("If that email exists, we've sent a reset link.").
- `/reset-password`: reads uid+token from the query, new+confirm password, calls confirm; success → redirect to login with a toast; invalid/expired token → clear error + link back to `/forgot-password`.
- "Forgot password?" link on the login page.

**Review checkpoint:** Requesting a reset for a real email delivers a link that lets you set a new password and log in. Unknown email → identical success copy (no enumeration). Expired/garbage token → friendly error. Rate limit blocks rapid repeats.

**Completion record (2026-06-09):** Commits `cb48239` (backend endpoints), `a943e16` (P3 fix: expiry copy), `1137a71` (frontend screens). No new model, no migration. Both units browser-verified. No deferrals.

Backend: `PasswordResetRequestView` (`POST /api/auth/password-reset/`) always returns 200 with neutral copy; emails a signed link to a matching **active** user only; throttled **5/hour per email** (custom `PasswordResetThrottle` keyed on email, IP fallback) via `DEFAULT_THROTTLE_RATES`. `PasswordResetConfirmView` (`POST .../confirm/`) decodes uid + verifies the token with Django's `default_token_generator`, runs `validate_password`, sets the password; the token self-invalidates (hash-based) so it can't be replayed. `_expiry_phrase()` derives the email's "expires in N days/hours" from `PASSWORD_RESET_TIMEOUT` (3 days) so the copy can't drift. Email/SMTP settings added (Gmail-ready, **console backend in dev**, locmem in tests), `FRONTEND_BASE_URL` for the link; all documented in `.env.example`. 13 users-app tests (enumeration-safe request, throttle + per-email isolation, single-use token, bad uid/token, weak password, inactive user, expiry-copy default + override); **151 backend total**. **Throttle caveat:** backed by the default LocMem cache — correct for one process; move to Redis at VS-18 if the backend scales horizontally.

Frontend: `/forgot-password` (zod + native email validation, neutral success copy, no enumeration), `/reset-password` (Suspense-wrapped `useSearchParams`; new+confirm with match check; rejected/expired token → inline error + "Request a new link"; missing uid/token → immediate "Link expired"; success → toast + redirect to `/login`). `ToastHost` mounted in the `(auth)` layout so the reset-success toast survives the client navigation into `/login` (both share the layout). "Forgot password?" link on the login page. `requestPasswordReset` / `confirmPasswordReset` added to the auth API client; reset schemas in `validations/auth.ts`. tsc clean.

---

### VS-23 — Boutique Tenant (schema foundation)

**What:** Introduce a `Boutique` entity that **owns** all tenant data, with per-boutique order numbering — scoped to a **single boutique** for MVP. Schema future-proofing so staff accounts / multi-boutique can arrive later without a painful FK migration. **Not SaaS:** no signup, billing, staff roles, tenant admin, or multi-boutique onboarding — post-MVP per `09-mvp-scope`. `User` = boutique operator/staff identity (distinct from `Customer`, which stays non-auth boutique-private data, and from any future Soliofit member account).

**ADR:** [ADR-0007](../adr/ADR-0007-boutique-tenancy.md) — Boutique Tenancy (single-boutique schema foundation). **Accepted.** Settled: `boutique` FK on **roots only** (User, Order, Customer), not on children; `Order.user`/`Customer.user` become attribution (`created_by`, non-cascading); operational settings re-home to the boutique.

**Backend (per ADR-0007):**
- `Boutique` model: `name`, `owner` (FK User, PROTECT — **primary/billing owner**, not a permissions model), `delivery_buffer_days`, `daily_capacity`, timestamps. `User.boutique` FK (PROTECT) — every operator belongs to one boutique.
- `boutique` FK on **tenant roots only** — `User`, `Order`, `Customer` (denormalized on Order/Customer for the per-boutique unique constraint + join-free scoping). Children (installments, media, activities) get **no** `boutique` FK — they stay scoped through their parent, mirroring the soft-delete cascade invariant.
- **Ownership vs attribution:** rename `Order.user`/`Customer.user` → `created_by` (`SET_NULL, null=True`) — attribution only; deleting/deactivating staff must never cascade-delete boutique data. Ownership is `boutique`.
- **Operational settings move to `Boutique`:** `delivery_buffer_days` + `daily_capacity` re-homed; `UserSettings` table removed; `/api/auth/order-settings/` reads the caller's boutique. `NotificationPreference` stays per-user.
- **Same-boutique integrity:** an order's `customer.boutique_id` must equal `order.boutique_id` — enforced in serializer/viewset (boutique injected server-side), with an isolation test.
- `order_number` unique **per boutique** — drop global `unique=True`, add `UniqueConstraint(boutique, order_number)`; `perform_create` scopes the `Max+1` retry loop by boutique and sets `created_by`.
- Querysets scope every root filter `user=request.user` → `boutique=request.user.boutique`; children flip the parent predicate (`order__user=` → `order__boutique=`). Surfaces: board + delivery-load, schedule, calendar, payments + installments, dashboard/notifications, search, customer profile.
- **Migration (nullable → seed+backfill → enforce):** add Boutique + nullable `boutique`; `RenameField` `user`→`created_by`; data-migrate one seeded Boutique (name from `business_name`, owner = earliest user, settings copied from operator's `UserSettings`) and backfill all User/Order/Customer rows; then enforce non-null `boutique`, flip `created_by` to `SET_NULL`, swap the order_number constraint, drop `UserSettings`. **Keep steps split** — the seeded boutique must exist before `User.boutique` goes non-null (circular `Boutique.owner ↔ User.boutique`).

**Out of scope (Non-Goals):** customer/member login accounts, cross-boutique customer discovery/portability, staff roles, billing/subscription admin, marketplace. Future shape recorded in the ADR (`BoutiqueMembership`, member portability, boutique-level subscription) — not built now.

**Frontend:** Minimal/none for MVP — the boutique is implicit (single). Settings already shows the business name; order-settings continue to work against the (now boutique-level) values transparently.

**Review checkpoint:** All existing data belongs to one seeded boutique with nothing lost in backfill (orders keep their numbers); new orders number per boutique; queries are boutique-scoped (cross-boutique isolation asserted per surface); an order can't link another boutique's customer; staff deletion nulls `created_by` without dropping orders; no signup/multi-tenant UI appears; `09-mvp-scope` still lists multi-boutique/SaaS as post-MVP.

**Completion record (2026-06-09):** Backend (Unit 1) `1a0e8f1`; admin/bypass-path fix `73f7f82`. ADR-0007 Accepted + indexed, with two dated amendment notes (pre-acceptance review revisions; implementation-start `User.boutique` null=True for the circular-FK bootstrap). 7 hand-authored migrations (nullable → seed+backfill → enforce); dev DB backfilled to one "Demo Boutique" with all 27 orders + 10 customers + every user attached, zero orphans, order numbers preserved. `created_by` (SET_NULL) attribution split from `boutique` ownership; per-boutique `order_number` via `UniqueConstraint`; same-boutique customer integrity enforced in the serializer queryset; operational settings re-homed to Boutique, `UserSettings` removed, `NotificationPreference` stays per-user. Review [P2] (admin's `UserCreationForm` bypasses `create_user` → tenant-less user) fixed with a model-level `User.save()` insert guard (alias-aware) + boutique surfaced in admin. **160 backend tests pass**; `check` clean; `makemigrations --check` no drift. Deferred: none. Scope notes: frontend unchanged (boutique implicit/single, order-settings shape identical); the "first user created by a raw bypass path on an empty DB" case stays out of scope by design (real first users go through `createsuperuser` → `create_user`).

---

### VS-08b — Voice Format Conversion (deferred)

**Status:** Backlog — **Deferred. Not in the current MVP execution order** (VS-20 → VS-21 → VS-22 → VS-23 → VS-17 → VS-18). Tracked for post-MVP; pull in only if iOS playback becomes a launch blocker.

**What (if revived):** Server-side `.webm` → `.mp3` conversion so iOS Safari can play voice notes recorded as WebM/Opus. Recording already works everywhere; the gap is iOS playback of WebM. Would add an FFmpeg conversion step on upload and store an `.mp3` alongside (or in place of) the original.

---

## Completion Criteria

A slice is complete when:
- [ ] Backend endpoints tested with curl or a REST client
- [ ] Frontend manually tested in browser (happy path + one error case)
- [ ] No TypeScript errors (`npm run build` clean)
- [ ] No Django check errors (`python manage.py check`)
- [ ] Committed with a structured message
- [ ] ADR written if the slice required a new architectural decision
