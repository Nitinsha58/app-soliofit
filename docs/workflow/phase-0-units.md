# Phase 0 — Foundation: Implementation Units

**Goal:** Django and Next.js projects scaffolded, all ORM models defined, auth working, app shell visible, Docker dev environment running, production deployment pipeline functional.

**Milestone:** Can log in, see the empty app shell, and deploy to production EC2.

---

## Unit Overview

| # | Unit | Layer | Depends On | Status |
|---|------|-------|------------|--------|
| P0-01 | Monorepo structure + Docker Compose dev | Infra | — | Pending |
| P0-02 | Django project scaffold + settings split | Backend | P0-01 | Pending |
| P0-03 | Custom User model + initial migration | Backend | P0-02 | Pending |
| P0-04 | Customer model + migration | Backend | P0-03 | Pending |
| P0-05 | Order + OrderActivity models + migration | Backend | P0-03 | Pending |
| P0-06 | Media models (OrderPhoto, VoiceNote) + migration | Backend | P0-05 | Pending |
| P0-07 | Installment model + migration | Backend | P0-05 | Pending |
| P0-08 | pg_trgm extension migration | Backend | P0-04 | Pending |
| P0-09 | DRF configuration + Cookie JWT auth classes | Backend | P0-03 | Pending |
| P0-10 | Login + logout endpoints (functional, tested) | Backend | P0-09 | Pending |
| P0-11 | Next.js project scaffold + base config | Frontend | P0-01 | Pending |
| P0-12 | API client base + auth store (Zustand) | Frontend | P0-11 | Pending |
| P0-13 | Login page (functional, calls Django auth) | Frontend | P0-10, P0-12 | Pending |
| P0-14 | App shell: sidebar + layout + protected route | Frontend | P0-13 | Pending |
| P0-15 | Production Docker Compose + Nginx config | Infra | P0-01 | Pending |
| P0-16 | CI/CD pipeline (GitHub Actions → EC2) | Infra | P0-15 | Pending |

---

## Detailed Unit Specifications

---

### P0-01 — Monorepo Structure + Docker Compose Dev

**What:** Create the top-level repo structure with `backend/` and `frontend/` directories. Set up `docker-compose.dev.yml` with three services: `postgres`, `backend`, `frontend`.

**Outcome:** `docker compose -f docker-compose.dev.yml up` starts PostgreSQL, and placeholder containers for Django and Next.js, all connected on the same network.

**Files created:**
```
/
├── backend/
│   └── Dockerfile.dev
├── frontend/
│   └── Dockerfile.dev
├── docker-compose.dev.yml
├── .gitignore
└── .env.example
```

**Review checkpoint:** Docker Compose starts without errors. PostgreSQL is accessible.

---

### P0-02 — Django Project Scaffold + Settings Split

**What:** Run `django-admin startproject config .` inside `backend/`. Create all Django apps (`users`, `customers`, `orders`, `media`, `payments`, `notifications`). Split settings into `base.py`, `development.py`, `production.py`.

**Outcome:** `python manage.py check` passes. All apps are registered in `INSTALLED_APPS`.

**Files created:**
```
backend/
├── manage.py
├── requirements.txt
├── requirements-dev.txt
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
└── apps/
    ├── users/
    ├── customers/
    ├── orders/
    ├── media/
    ├── payments/
    └── notifications/
```

**Review checkpoint:** `python manage.py check` passes. `python manage.py runserver` starts without errors.

---

### P0-03 — Custom User Model + Initial Migration

**What:** Define `apps.users.User` (AbstractBaseUser) with `UserManager`. Define `NotificationPreference` OneToOne to User. Run `makemigrations users` + `migrate`.

**Why first:** Django requires `AUTH_USER_MODEL` to be set before any other model migration that references `User`.

**Outcome:** `users` table and `notification_preferences` table exist in PostgreSQL.

**Review checkpoint:** `python manage.py migrate` succeeds. Can create a superuser with `createsuperuser`.

---

### P0-04 — Customer Model + Migration

**What:** Define `apps.customers.Customer` with UUID pk, user FK, name, phone, address, soft-delete. Run `makemigrations customers` + `migrate`. Do NOT add GIN indexes yet (needs pg_trgm first — see P0-08).

**Outcome:** `customers` table exists. Basic index on `(user, deleted_at)`.

**Review checkpoint:** `migrate` succeeds. Table visible in `psql`.

---

### P0-05 — Order + OrderActivity Models + Migration

**What:** Define `apps.orders.Order` (Status choices, UUID pk, user FK, customer FK, computed properties) and `OrderActivity`. Run `makemigrations orders` + `migrate`.

**Outcome:** `orders` and `order_activities` tables exist with all indexes.

**Review checkpoint:** `migrate` succeeds. `Order.Status.values` returns the 5 status strings.

---

### P0-06 — Media Models + Migration

**What:** Define `apps.media.OrderPhoto` (with `PhotoType`) and `VoiceNote`. Run `makemigrations media` + `migrate`.

**Outcome:** `order_photos` and `voice_notes` tables exist.

**Review checkpoint:** `migrate` succeeds.

---

### P0-07 — Installment Model + Migration

**What:** Define `apps.payments.Installment` with computed `status` and `days_overdue` properties. Run `makemigrations payments` + `migrate`.

**Outcome:** `installments` table exists.

**Review checkpoint:** `migrate` succeeds.

---

### P0-08 — pg_trgm Extension + Customer GIN Indexes

**What:** Create a hand-written migration in `apps/customers/` that runs `CREATE EXTENSION IF NOT EXISTS pg_trgm`. Then update `Customer.Meta.indexes` to add GIN trigram indexes on `name` and `phone`. Run `makemigrations` + `migrate`.

**Outcome:** `pg_trgm` is active. Trigram indexes exist on `customers`.

**Review checkpoint:** `SELECT * FROM pg_extension WHERE extname = 'pg_trgm';` returns a row.

---

### P0-09 — DRF Configuration + Cookie JWT Auth Classes

**What:** Configure `REST_FRAMEWORK` in `base.py`. Implement `CookieJWTAuthentication` in `apps/users/authentication.py`. Register it as the default authentication class.

**Outcome:** DRF uses cookie-based JWT for all endpoints. Unauthenticated requests return 401.

**Review checkpoint:** `GET /api/customers/` without a cookie returns `{"detail": "Authentication credentials were not provided."}`.

---

### P0-10 — Login + Logout Endpoints

**What:** Implement `CookieTokenObtainPairView` and `LogoutView` in `apps/users/views.py`. Wire up `apps/users/urls.py` and include in `config/urls.py`.

**Outcome:** `POST /api/auth/login/` returns 200 and sets `access_token` + `refresh_token` cookies. `POST /api/auth/logout/` clears both cookies.

**Review checkpoint:** Test with `curl`: login sets cookies, subsequent requests to protected endpoints succeed, logout clears cookies.

---

### P0-11 — Next.js Project Scaffold

**What:** `npx create-next-app@14` inside `frontend/` with TypeScript, Tailwind, App Router. Install: `shadcn/ui`, `framer-motion`, `zustand`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@dnd-kit/core`. Configure `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`.

**Outcome:** `npm run dev` starts on port 3000. Default Next.js page renders.

**Review checkpoint:** `npm run build` succeeds with no TypeScript errors.

---

### P0-12 — API Client Base + Auth Store

**What:** Create `src/lib/api/client.ts` (typed fetch wrapper with `credentials: 'include'`, 401 redirect). Create `src/stores/useAuthStore.ts` (Zustand: user state, isAuthenticated).

**Outcome:** A typed `apiRequest<T>()` function exists. Auth state is managed in Zustand.

**Review checkpoint:** TypeScript compiles with no errors. Auth store can be imported in any component.

---

### P0-13 — Login Page

**What:** Build `src/app/(auth)/login/page.tsx` using React Hook Form + Zod validation. On submit, calls `POST /api/auth/login/`. On success, sets auth store state and redirects to `/dashboard`.

**Outcome:** Login page renders. Submitting valid credentials logs in and redirects. Invalid credentials show an error message.

**Review checkpoint:** Full manual test: correct credentials → redirect to dashboard. Wrong credentials → error shown.

---

### P0-14 — App Shell: Sidebar + Layout + Protected Route

**What:** Build `src/app/(app)/layout.tsx` with an auth guard (redirect to `/login` if not authenticated). Build `Sidebar.tsx` (desktop) and `MobileNav.tsx` (bottom nav) with all navigation links. Build a placeholder `dashboard/page.tsx`.

**Outcome:** Authenticated users see the sidebar and reach `/dashboard`. Unauthenticated users are redirected to `/login`.

**Review checkpoint:** Manual test: visit `/dashboard` without being logged in → redirected to `/login`. After login → see sidebar + empty dashboard.

---

### P0-15 — Production Docker Compose + Nginx Config

**What:** Create `docker-compose.prod.yml` with `frontend`, `backend`, `postgres` services. Create `nginx/nginx.conf` routing `/` to frontend and `/api/` to backend. Create production Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`).

**Outcome:** `docker compose -f docker-compose.prod.yml up` starts the full production stack locally. Nginx routes correctly.

**Review checkpoint:** `curl http://localhost/api/health/` returns 200. `curl http://localhost/` returns the Next.js HTML.

---

### P0-16 — CI/CD Pipeline (GitHub Actions → EC2)

**What:** Create `.github/workflows/deploy.yml`. On push to `main`: build both Docker images, SSH into EC2, pull images, run `docker compose up -d`.

**Outcome:** Pushing to `main` triggers a deploy. The live site on EC2 reflects the latest code.

**Review checkpoint:** Push a trivial change (e.g., update a comment), confirm GitHub Actions passes and the change appears on the live EC2 URL.

> **Note:** This unit requires EC2 to be provisioned and SSH key configured as a GitHub secret. Flag this before starting P0-16.

---

## Phase 0 Completion Criteria

- [ ] All 16 units implemented and reviewed
- [ ] `docker compose up` starts the full dev stack without errors
- [ ] Login flow works end-to-end (Django issues cookies, Next.js stores auth state)
- [ ] App shell renders after login with correct sidebar navigation
- [ ] Production deploy to EC2 works via GitHub Actions
- [ ] No TypeScript errors (`npm run build` clean)
- [ ] No Django check errors (`python manage.py check`)
- [ ] All database tables created via ORM migrations (no manual SQL)
