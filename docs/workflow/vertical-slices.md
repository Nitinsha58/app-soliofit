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
| VS-08 | Voice notes | Hold-to-record, upload, playback with seek and speed control | Pending |
| VS-09 | Installments | Add installments, mark paid, computed overdue status shows | Pending |
| VS-10 | Dashboard intelligence | Summary strip counts + notification bell with counts | Pending |
| VS-11 | Payments dashboard | Payment Kanban screen with summary strip | Pending |
| VS-12 | Activity log | State changes auto-logged, visible in Order Details | Pending |
| VS-13 | Customer profile | All 3 tabs: orders, payments, media | Pending |
| VS-14 | Global search | Search by customer name, phone, order ID (pg_trgm) | Pending |
| VS-15 | Calendar | Month view with workload coloring, date drill-down | Pending |
| VS-16 | Settings | Profile edit, password change, notification toggles | Pending |
| VS-17 | Mobile layout | Bottom nav, full-screen drawers, responsive Kanban | Pending |
| VS-18 | Production deployment | Push to `main` → deploys to EC2 via GitHub Actions | Pending |

---

## Slice Specifications

---

### VS-00 — Foundation Shell

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

### VS-01 — Authentication

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

### VS-02 — App Shell

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

### VS-03 — Customer Management

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

### VS-04 — Order Creation

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

### VS-05 — Kanban Board

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

### VS-06 — Order Details

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

### VS-07 — Photo Upload

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

### VS-08 — Voice Notes

**What:** Hold-to-record voice notes, upload to S3, playback with seek and speed.

**Backend:**
- `VoiceNote` model (UUID pk, order FK, s3_key, public_url, duration_seconds)
- Add to `media` migration
- `POST /api/upload/presign/` already handles audio (folder: `voice-notes`)
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

### VS-09 — Installments

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

### VS-10 — Dashboard Intelligence

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

### VS-11 — Payments Dashboard

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

### VS-12 — Activity Log

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

### VS-13 — Customer Profile

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

### VS-14 — Global Search

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

**What:** Month view with workload coloring and date drill-down.

**Backend:**
- `GET /api/calendar/?year={y}&month={m}` — order counts per date in the month
- `GET /api/orders/?delivery_date={date}` — orders for a specific date (reuses existing endpoint)

**Frontend:**
- Calendar page (sidebar nav item)
- Month grid: each date shows order count badge, color-coded (0–5 green, 6–12 amber, 13+ red)
- Previous/Next month navigation + "Today" button
- Date tap → right panel (desktop) / bottom sheet (mobile) listing orders for that date
- Order tap → Order Details drawer

**ADR:** None.

**Review checkpoint:** Calendar loads for current month. Create orders on different dates → counts appear on correct dates. Colors reflect load levels. Tap a date → order list shows.

---

### VS-16 — Settings

**What:** Profile edit, password change, notification preferences.

**Backend:**
- `NotificationPreference` model (OneToOne to User, 4 boolean toggles)
- Add to `users` migration
- `PATCH /api/auth/me/` — update name, business name, phone
- `POST /api/auth/change-password/` — verify old, set new
- `GET/PATCH /api/auth/notification-preferences/` — read and update toggles

**Frontend:**
- Settings page (sidebar gear icon)
- Profile section: business name, owner name, phone, change password form
- Notification preferences: 4 toggles
- Logout button

**ADR:** None.

**Review checkpoint:** Update business name → persists on reload. Change password → can log in with new password. Toggle notification preference → persists.

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

**ADR:** Write ADR-0005 (deployment strategy) here.

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
