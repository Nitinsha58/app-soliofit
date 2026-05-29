# ADR-0004 — Frontend Framework: Next.js 14 App Router + shadcn/ui

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-29 |
| **Deciders** | Nitin |
| **Slice** | VS-00 |

---

## Context

Soliofit is a single-operator, tablet-and-desktop-primary application. The UI is interaction-heavy: a Kanban board with drag-and-drop, a multi-step order creation modal, a right-side drawer for order details, photo uploads with inline previews, hold-to-record voice notes, and animated transitions throughout. The backend is a separate Django service — the frontend is a pure client application, not a full-stack Next.js app.

Key requirements driving this decision:
- Fast, fluid interactions (Kanban drag, drawer animations, autosave)
- Tablet-optimized layout (horizontal, Apple Pencil friendly)
- Server-side rendering is not required — all data is fetched from Django's API after auth
- A consistent component library to ship quickly without building primitives from scratch
- TypeScript throughout for safety on a solo-developer project

---

## Decision

**Next.js 14** with the **App Router**, **TypeScript**, **TailwindCSS**, and **shadcn/ui** as the component system. **Framer Motion** for animations.

State management:
- **TanStack Query** for all server state (fetching, caching, invalidation)
- **Zustand** for UI state (auth, drawer open/close, active order)
- **React Hook Form + Zod** for all forms

---

## Why Next.js over alternatives

| Option | Reason Not Chosen |
|--------|------------------|
| **React + Vite (SPA)** | Viable but adds manual routing, no file-based conventions, more boilerplate to configure for a production app |
| **Remix** | App Router in Next.js provides a similar data loading model (RSC + route loaders) with a larger ecosystem and better shadcn/ui + TanStack Query integration story |
| **SvelteKit** | Smaller ecosystem; fewer ready-made component libraries at the quality level of shadcn/ui; TypeScript tooling less mature |
| **Plain CRA** | Deprecated; no file-based routing; no active development |

Next.js wins on ecosystem breadth, TypeScript-first defaults, and the largest library of examples and tutorials — important for a solo developer moving fast.

---

## Why App Router over Pages Router

| Factor | App Router | Pages Router |
|--------|-----------|-------------|
| Route groups `(auth)` / `(app)` | ✓ Native | Manual folder convention |
| Layout nesting | ✓ Native | Requires manual `_app.tsx` wrapping |
| Future-proof | ✓ Active development | In maintenance mode |
| React Server Components | ✓ Available | Not available |
| Learning curve | Steeper | Simpler |

Soliofit does not need RSC — all data comes from Django API, not direct DB calls. But route groups give a clean separation between `(auth)` (login) and `(app)` (protected app shell) without any manual routing logic. The App Router layout nesting also maps directly to how the sidebar + drawer layout is structured.

---

## Why shadcn/ui over alternatives

| Option | Reason Not Chosen |
|--------|------------------|
| **Material UI (MUI)** | Opinionated visual style that conflicts with Soliofit's minimal, Linear-inspired design; heavy bundle |
| **Chakra UI** | Good library but less Tailwind-native; harder to customize at the token level |
| **Radix UI (unstyled)** | What shadcn/ui is built on — using shadcn/ui directly gives Radix primitives plus pre-built Tailwind styles, saving significant setup |
| **Plain Tailwind components** | Too much time building accessible primitives (dialogs, popovers, command palettes) from scratch |

shadcn/ui is a collection of copy-pasted, fully-owned components built on Radix UI primitives with Tailwind. There is no package to pin — components live in `src/components/ui/` and are modified freely. This avoids version lock-in and gives full control over every component's appearance and behavior.

---

## Why Framer Motion

The product requires fluid animations: drawer slide-in, card hover states, page transitions, drag-and-drop feedback. Framer Motion provides a declarative animation API that integrates naturally with React's component model and works well alongside `@dnd-kit` for the Kanban board.

CSS transitions alone are insufficient for the gesture-driven interactions (hold-to-record waveform, drag physics, spring-based drawer).

---

## Consequences

**Positive:**
- App Router route groups cleanly separate `(auth)` and `(app)` layouts with no manual routing logic
- shadcn/ui components are owned and customizable — no fighting a design system's opinions
- TanStack Query handles all caching and invalidation — no hand-rolled fetch state
- TypeScript across the full stack catches interface mismatches between frontend and Django API early
- Framer Motion + `@dnd-kit` are the best-in-class libraries for the specific interactions Soliofit needs

**Negative:**
- App Router mental model (server vs client components, `use client` boundaries) adds initial complexity, even though we use it primarily as a client app
- shadcn/ui components must be manually updated when Radix or Tailwind releases breaking changes
- Framer Motion adds ~35KB gzipped to the bundle (acceptable at this scale)
- TanStack Query v5 API differs significantly from v4 — documentation must specify which version

---

## Package Versions (Pinned at Project Init)

| Package | Version |
|---------|---------|
| next | 14.x |
| react | 18.x |
| typescript | 5.x |
| tailwindcss | 3.x |
| @tanstack/react-query | 5.x |
| zustand | 4.x |
| framer-motion | 11.x |
| react-hook-form | 7.x |
| zod | 3.x |
| @dnd-kit/core | 6.x |

---

## References

- `07-ux-guidelines.md` — Design direction, color palette, component specs, animation rules
- `03-technical-architecture.md` — Frontend structure and API client pattern
