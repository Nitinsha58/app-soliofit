# ADR-0006 — Orders List Scaling via Keyset Cursor Pagination

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-07 |
| **Deciders** | Nitin |
| **Slice** | VS-20 |

---

## Context

The orders board (Kanban + Orders Schedule) loads every order in one request: `OrderViewSet` sets `pagination_class = None`, overriding the global DRF `PageNumberPagination` / `PAGE_SIZE = 50` default. At single-boutique MVP volumes this is fine, but the payload and render cost grow unbounded as orders accumulate, and the Delivered column — which only ever grows — dominates that cost while being the least operationally useful.

VS-20 introduces per-column lazy-load on scroll. The hard part is that the orders board is **mutated while the user scrolls**: drag-and-drop changes an order's `status` (moving it between columns), new orders are created (inserting at arbitrary positions in the sort), and VS-21 will soft-delete orders (removing rows). A pagination scheme has to stay correct under those mutations, and the column headers must show **true totals**, not "how many are currently loaded."

## Decision

**Per-column keyset (cursor) pagination.** The board fetches one column (status) at a time and pages with an opaque cursor over a stable sort, not a numeric offset.

- **Request:** `GET /api/orders/?status=Booked&cursor=<opaque>&limit=20` (composable with the existing `customer`, `delivery_date_from`, `delivery_date_to` filters). `limit` defaults to 20, capped at 50.
- **Sort tuple:** `(delivery_date, created_at, id)` — deterministic and total, so the cursor always resumes at an unambiguous position. The cursor encodes the last row's tuple; the next page selects rows strictly after it.
- **Response:**
  ```json
  {
    "results": [ /* annotated orders (amount_paid, has_delayed_installment, …) */ ],
    "next_cursor": "<opaque|null>",
    "counts": { "Booked": 142, "Started": 30, "Ready": 8, "Partial Delivery": 3, "Delivered": 1204 }
  }
  ```
  `counts` are full per-status **totals** for the active filter set, computed in a single grouped aggregate query — decoupled from the loaded page so headers stay accurate as the user scrolls.
- **Delivered deferral:** the default Delivered page returns only recent Delivered (delivered/updated within ~30 days). Older Delivered are not dropped — they are reached by continuing the same cursor behind a "show older" affordance.
- **Scope:** this shapes only `OrderViewSet.list` (the board path). Non-board consumers — the `delivery-load` action, the calendar aggregate, and the customer-profile order list — keep their own queries and are unaffected; cursor params are ignored there.

**Frontend:** each column is a React Query `useInfiniteQuery` keyed `[orders, status, filters]` with `getNextPageParam = next_cursor`, appending pages on an IntersectionObserver sentinel. Drag-and-drop optimistically moves the card, then invalidates the **source and destination** columns' first page (membership and counts both change) — never a full-board reload.

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
