# ADR-0009 — Strict Installment Plan (`bill = Σ installments`)

**Status:** Accepted
**Slice:** VS-27 (see [program overview](../workflow/vs-27-installments/00-overview.md))
**Date:** 2026-06-14

---

## Context

Billing in Soliofit is an **order attribute**: `Order.total_amount` is the bill, and
`Installment` rows (FK to the order) are the payment schedule. There is no separate billing
model, and for the MVP that is the right shape — one tailoring order has one bill.

However, the bill and the schedule were allowed to drift:

- Installments were created with **separate, non-atomic** API calls after the order was
  created (frontend `Promise.allSettled`), so an order could persist with a partial or empty
  schedule if a call failed.
- The consistency rule was `Σ installments ≤ total_amount` — partial scheduling was a valid
  state, and `remaining` could not be relied on to equal the unpaid schedule.
- `total_amount` could be edited **independently** of the schedule, so a bill change could
  momentarily (or persistently) leave `Σ ≠ bill`.
- Single-row create/patch/delete endpoints meant several writable paths could each leave the
  relationship inconsistent.

The product owner's requirement is that the **bill and its installments are a single,
consistent unit**: every billed order is fully scheduled, and every write that touches
either side keeps them in agreement.

## Decision

Adopt and enforce a single invariant for every order with a schedule:

> **`Order.total_amount == Σ(installment.amount)`**, and **`total_amount ≥ Σ(paid)`**.

Enforced as follows:

1. **Atomic create.** Order + installments are created in one transaction. When no
   installments are supplied and `total_amount > 0`, a **default installment** is
   auto-created (`amount = total_amount`, `due_date = delivery_date`, unpaid). `bill == 0`
   creates no installment.
2. **Combined atomic edit.** Bill and unpaid schedule are edited **together** via a single
   order-scoped endpoint `PUT /api/orders/{id}/billing/` with payload
   `{ total_amount, installments: [unpaid set] }`. It validates `total ≥ Σ(paid)` and
   `Σ(paid) + Σ(new) == total`, then replaces the unpaid rows and updates the bill in one
   transaction. **Paid installments are never touched.**
3. **No write side-door.** The single-row create/patch/delete installment endpoints are
   **removed**. `mark-paid` (single) and the list endpoint are retained.
4. **Derived money, unchanged.** `amount_paid` / `remaining` / `payment_state` stay derived
   from paid installments — no stored balance. Under the invariant, `remaining` equals the
   sum of unpaid installments.
5. **Legacy reconciliation.** A one-time, idempotent backfill (VS-27.2) brings existing
   orders onto the invariant: default installment for unscheduled orders, balancing
   installment for partials (remark `"Auto-balanced during VS-27 migration"`, due delivery
   date), and a manual-review report for over-scheduled orders.

Billing stays an **order attribute** — the endpoint is order-scoped, not a new resource.

## Consequences

**Positive**
- No partial saves, no bill/schedule drift, no hidden API path that can break the invariant.
- The bill ↔ plan relationship is always trustworthy; `remaining` == unpaid schedule.
- Paid history is protected (locked rows, bill ≥ paid).

**Negative / trade-offs**
- **Every billed order now carries at least one installment** (the default, due on the
  delivery date). The payments dashboard will show a due-on-delivery payment for orders that
  previously had no schedule. Intended for tailoring, but an explicit behavior change.
- The drawer's whole-plan editor uses an explicit **Save** (sticky bar on unsaved changes),
  a deliberate exception to Soliofit's autosave-everywhere guideline — justified because
  money schedules require atomicity.
- The combined edit deletes-and-recreates unpaid rows, so unpaid installment IDs are not
  stable across an edit (paid rows keep their IDs). Acceptable — unpaid rows carry no
  external references.

## Alternatives considered

1. **Keep flexible `Σ ≤ bill`** (status quo + atomic create only). Rejected: the product
   requirement is strict equality; flexible leaves `remaining` ambiguous and the bill/plan
   able to drift.
2. **Introduce a separate billing/FeeDetails model.** Rejected for the MVP: a tailoring
   order has one bill; a billing model only earns its keep with line items, tax, discounts,
   or invoice versions. Billing stays an order attribute.
3. **Independent bill edit + server rejects imbalance.** Rejected: editing a single value
   almost always breaks `Σ == bill`, forcing friction (delete + re-add to rebalance). The
   combined atomic "edit bill & plan" is cleaner, especially on mobile.
4. **No backfill ("enforce only on new writes").** Rejected: existing live orders would show
   inconsistent payment state indefinitely. A logged, idempotent backfill reconciles them.
