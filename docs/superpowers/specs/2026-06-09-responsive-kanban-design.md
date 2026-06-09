# Design — Responsive Kanban (mobile single-column) (VS-17)

**Date:** 2026-06-09
**Slice:** VS-17 (Mobile Layout)
**Status:** Approved (direction A1 + refinements incorporated)

## Guiding principle

> On mobile the dashboard board is the daily command center, not a horizontally
> huge wall. Show one focused status column at a time, with a compact attention
> rail (Delayed · Today · Upcoming) and status chips above it. Two calm
> horizontal rails, then one focused work column.

Desktop is unchanged. This is a mobile-only (`lg:hidden`) presentation over the
existing board data and the existing `activeFilter` system.

## Goals

- Mobile (`<lg`): a single focused status column instead of the 5-wide board.
- A compact **attention rail** of the three board date-filters: Delayed · Today
  · Upcoming. Pending ₹ and Overdue are intentionally excluded (Payments domain).
- **Column chips** (Booked · Started · Ready · Partial · Delivered) with counts;
  tap to focus a status.
- Tapping a date pill applies the cross-board filter; chips show per-status
  filtered counts and focus auto-jumps to the status with the most matches.
- **Smart default focus:** open on the status with the most *delayed* orders;
  fall back to Booked when there are none.
- Mobile status changes happen in the existing detail drawer (drag/drop stays a
  desktop affordance).
- No backend or API changes.

## Non-goals

- No change to the desktop board, `SummaryStrip`, or drag/drop.
- No new status-change UI — the drawer's existing status `<select>` is reused.
- No Pending/Overdue pills on the mobile rail (they live on `/payments`).
- No backend filtered-count endpoint; filtering stays client-side over loaded
  rows (see Data).

## Architecture

`KanbanBoard` already owns the shared `activeFilter`, `filterFn`, and `counts`
state. It becomes the responsive switch:

- **Desktop (`hidden lg:block`):** today's `SummaryStrip` (5 cards) + the
  horizontal 5-column board + dnd-kit drag. Unchanged.
- **Mobile (`lg:hidden`):** a new `MobileBoard`, fed the same `activeFilter` /
  `setActiveFilter` / `filterFn`.

`MobileBoard` **loads all five column queries** (via the existing
`useColumnQuery(status)` hook — same data footprint as desktop). From that data
it derives raw counts, delayed-per-status (for default focus), and filtered
counts, and it renders only the selected status's cards. Loading all five also
makes chip-switching instant and keeps the desktop and mobile data model
identical.

## Components

**New (`frontend/src/components/dashboard/`)**
- `MobileBoard.tsx` — orchestrator. Holds `focusedStatus` state; consumes
  `activeFilter` / `setActiveFilter` / `filterFn` from `KanbanBoard`; runs the
  five column queries; computes raw + filtered per-status counts and the
  delayed-per-status map; renders `AttentionRail` + `ColumnChips` + the focused
  column's cards.
- `AttentionRail.tsx` — three pills (Delayed · Today · Upcoming) from
  `dashboard-summary`. Props: `activeFilter`, `onFilterChange`.
- `ColumnChips.tsx` — five status chips with count badges. Props: `counts`
  (raw or filtered), `selected`, `onSelect`.

**Changed**
- `KanbanBoard.tsx` — wrap the current board UI in `hidden lg:block`; render
  `<MobileBoard … />` in `lg:hidden`. The DndContext/SummaryStrip stay in the
  desktop branch. `activeFilter`/`filterFn`/move logic stay in `KanbanBoard`.

The focused column on mobile renders plain `OrderCard`s (tap →
`openOrderDetail`) — **not** `DraggableCard`; mobile has no drag.

## Attention rail (B)

Order, urgent-first: **Delayed · Today · Upcoming**. ~38px tall; small pills,
not cards; horizontal scroll (all three fit at 375px). Color: **Delayed** red,
**Today** amber, **Upcoming** neutral. Each maps to the existing `activeFilter`
value (`delayed` / `today` / `upcoming`); tapping toggles it (tap again clears).

## Column chips + focused column (C)

Five chips with count badges; the selected chip is highlighted amber (per the
A1 mockup). The focused column shows the mockup header — status name, the
`value` total (₹, compact e.g. ₹9.3K) and the count — then its cards with the
existing infinite scroll. Card visuals unchanged (date chip, paid/total,
priority). Tap → full-screen detail drawer.

**Default focus (smart):** on mount, focus the status with the most *delayed*
orders (delayed = `filterFn` for `delayed` applied per status). If no delayed
orders exist, fall back to **Booked**. This does not activate the Delayed pill —
it only chooses the starting column. Focus is not persisted across navigations.

## Filter behavior (D)

- **No filter:** chips show raw per-status totals (the full `counts` map every
  column response carries); the focused column lists that status's orders.
- **Filter active:** `filterFn` is applied to each column's loaded rows; chips
  switch to **filtered counts**, focus **auto-jumps to the status with the most
  matches**, and the focused column lists that status's matching orders. Other
  chips show their filtered subset. Clearing the pill restores raw counts and
  the smart default focus.

**Ties:** "most matches" / "most delayed" ties break by board column order
(Booked → Started → Ready → Partial → Delivered).

**Delivered under a date filter:** `filterFn` excludes Delivered (matching the
desktop board), so while a date pill is active the Delivered chip reads 0 and is
never the auto-focus target. The chip stays visible.

**Data caveat (internal only):** filtered counts are computed over loaded rows,
so a column with unfetched pages can under-report — identical to the desktop
behavior. This stays an implementation note; **no user-facing wording** (no
"loaded rows only" text) appears in the UI. The user gets useful narrowing, not
accounting-grade totals.

## Status change on mobile (E)

Drag/drop stays desktop-only. On mobile: tap a card → detail drawer → the
existing status `<select>` in `OrderHeader.tsx` → `updateOrderStatus`. The board
already reacts to the change via `triggerOrdersRefresh` (refetches the columns),
so the chip counts and focused list stay truthful. No new status UI.

## Edge cases & verification

- Empty focused column → "No {status} orders"; filter active with zero total
  matches → empty filtered state; loading → existing spinner.
- Switching chips while a filter is active keeps the filter applied to the newly
  focused status.
- Desktop board, drag/drop, and `SummaryStrip` untouched at `lg+`.
- **Verification (project reality — no frontend test framework):** `type-check`
  + browser sweep at **375 / 768 / desktop**. Confirm: single column on mobile,
  chips switch focus, rail toggles filter + auto-focus to the heaviest status,
  smart default focus on load, drawer status change reflects on the board, and
  desktop is unchanged.

## Decomposition — two shippable units

1. **Unit 1 — Single-column mobile board.** Responsive switch in `KanbanBoard`
   + `MobileBoard` + `ColumnChips` + focused full-width column + smart default
   focus + tap-card-to-drawer status change. Delivers the core "not
   horizontally huge" win.
2. **Unit 2 — Attention rail + filter.** `AttentionRail` (3 pills) + the
   filtered-chips / auto-focus behavior layered on Unit 1.
