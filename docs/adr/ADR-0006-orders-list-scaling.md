# ADR-0006 — Orders List Scaling via Keyset Cursor Pagination

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-07 |
| **Deciders** | Nitin |
| **Slice** | VS-20 |

_Amended 2026-06-07 (pre-implementation, from review, before any VS-20 code): pagination is exposed via an opt-in `board` action so the default `/api/orders/` list keeps its `Order[]` contract; "recent Delivered" is defined by a new `delivered_at` field; and the sort tuple is **per-column** — active columns by `(delivery_date, created_at, id)` ascending, the Delivered column by `(delivered_at, id)` descending (completion history reads newest-first). The core keyset-cursor decision is unchanged._

---

## Context

The orders board (Kanban + Orders Schedule) loads every order in one request: `OrderViewSet` sets `pagination_class = None`, overriding the global DRF `PageNumberPagination` / `PAGE_SIZE = 50` default. At single-boutique MVP volumes this is fine, but the payload and render cost grow unbounded as orders accumulate, and the Delivered column — which only ever grows — dominates that cost while being the least operationally useful.

VS-20 introduces per-column lazy-load on scroll. The hard part is that the orders board is **mutated while the user scrolls**: drag-and-drop changes an order's `status` (moving it between columns), new orders are created (inserting at arbitrary positions in the sort), and VS-21 will soft-delete orders (removing rows). A pagination scheme has to stay correct under those mutations, and the column headers must show **true totals**, not "how many are currently loaded."

## Decision

**Per-column keyset (cursor) pagination.** The board fetches one column (status) at a time and pages with an opaque cursor over a stable sort, not a numeric offset.

- **Endpoint (opt-in):** a dedicated board action — `GET /api/orders/board/?status=Booked&cursor=<opaque>&limit=20` — returns the paginated envelope. The default `GET /api/orders/` list is **unchanged**: it still returns a plain `Order[]` for the date-range, customer, and calendar-drilldown consumers. Pagination is therefore opt-in and no existing caller's response shape changes. `limit` defaults to 20, capped at 50.
- **Sort tuple (per column):** active columns (Booked / Started / Ready / Partial Delivery) sort `(delivery_date ASC, created_at ASC, id ASC)` — soonest due first; the Delivered column sorts `(delivered_at DESC, id DESC)` — most recently completed first, because Delivered is completion history, not upcoming work. Each is deterministic and total, so the cursor always resumes at an unambiguous position. The opaque cursor encodes the relevant tuple — `(delivery_date, created_at, id)` for active columns, `(delivered_at, id)` for Delivered — and the next page selects rows strictly after it.
- **Response:**
  ```json
  {
    "results": [ /* annotated orders (amount_paid, has_delayed_installment, …) */ ],
    "next_cursor": "<opaque|null>",
    "counts": { "Booked": 142, "Started": 30, "Ready": 8, "Partial Delivery": 3, "Delivered": 1204 }
  }
  ```
  `counts` are full per-status **totals** for the active filter set, computed in a single grouped aggregate query — decoupled from the loaded page so headers stay accurate as the user scrolls.
- **Delivered deferral:** a new nullable `Order.delivered_at` is set to `timezone.now()` when an order transitions **into** Delivered, and cleared if it ever transitions back out — so it always means "currently delivered, at this time." The Delivered column has two windows, each keyset-paged by `(delivered_at DESC, id DESC)`: the **default** window returns `delivered_at >= today − 30 days` (cutoff), and an explicit **`older=true`** mode returns `delivered_at < cutoff` behind a "show older" affordance — so no Delivered order is dropped, only deferred. A data migration backfills existing Delivered orders from their latest `DELIVERY_MARKED` activity timestamp (fallback `updated_at`). Add an index covering `(user, status, delivered_at)`. `updated_at` is explicitly rejected (any edit bumps it → long-delivered orders would resurface as "recent"); the activity timestamp is rejected as a query-time source (correlated subquery in the hot board path).
- **Scope:** only the Kanban board consumes the new envelope (via the `board` action). Every other consumer keeps the legacy `GET /api/orders/` → `Order[]` contract: the Orders Schedule (`/orders`, date-range filtered for the visible week), the calendar day drill-down (single-date filtered), the customer profile (customer filtered), and the `delivery-load` aggregate. The Orders Schedule is grouped by delivery **date**, not by status column, so it does **not** use the per-column cursor — its result set is already bounded by the visible week.

**Frontend:** a new `listOrderColumn({ status, cursor, limit })` client calls the board action; the existing `listOrders()` (returning `Order[]`) is untouched, so the Schedule, calendar, and customer-profile callers are unaffected. Each board column is a React Query `useInfiniteQuery` keyed `[orders-board, status]` with `getNextPageParam = next_cursor`, appending pages on an IntersectionObserver sentinel. Drag-and-drop optimistically moves the card, then invalidates the **source and destination** columns' first page (membership and counts both change) — never a full-board reload.

## Consequences

- Correct under concurrent mutation: keyset never skips or duplicates rows when the set changes between fetches, which offset pagination cannot guarantee while cards are dragged/created/deleted.
- Column counts remain truthful regardless of how much is loaded, because they come from a separate aggregate rather than `len(results)`.
- The Delivered column stops dominating payloads; its unbounded history is paid for only on demand.
- No random page-jump (you cannot ask for "page 5"). This is acceptable — the board is a scroll surface, not a paged table.
- The aggregate `counts` query runs once per column fetch. It must stay a single grouped query (no N+1) and must not perturb the VS-19 `amount_paid` annotation on `results` (see the `delivery-load` GROUP-BY note — annotations shared with `.values().annotate()` aggregations need care).
- The VS-19 per-row annotations (`amount_paid`, `has_delayed_installment`) ride along on `results` unchanged.
- A new opaque cursor encode/decode helper is introduced; it must be stable across deploys (encode the sort tuple, not a row index).

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| Limit/offset pagination (DRF `LimitOffsetPagination`) | Simple and gives a native total, but offset drifts — rows shift under inserts/moves/deletes mid-scroll, causing skipped or duplicated cards. The board mutates exactly while paging, which is the worst case for offset. |
| Defer-aged-Delivered only, no real pagination (YAGNI) | Smallest change, but does not satisfy "lazy-load on scroll" as specified, and still loads every active order at once — only the Delivered tail is bounded. |
| Keep `pagination_class = None` (load all) | The status quo; unbounded payload/render that degrades as orders accumulate. |
| Global `PageNumberPagination` (the DRF default) for orders | Page-number paging fits a table, not a per-column infinite-scroll board, and suffers the same offset-drift problem under mutation. |

## References

- `vertical-slices.md` — VS-20 spec and review checkpoint
- `03-technical-architecture.md` / `04-system-design.md` — DRF pagination defaults (orders intentionally opts out; reconciled for VS-20)
- ADR-0003 — Database / Django ORM (queryset and annotation conventions)
- VS-19 completion record — `amount_paid` / `has_delayed_installment` annotations carried on `results`
