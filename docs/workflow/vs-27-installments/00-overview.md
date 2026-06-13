# VS-27 — Strict Bill ↔ Installment Plan (Program Overview)

**Status:** In progress — 27.1 implemented (in review); 27.2–27.5 pending
**Created:** 2026-06-14
**Decision record:** [ADR-0009 — Strict Installment Plan](../../adr/ADR-0009-strict-installment-plan.md)

This is the **master tracker** for the VS-27 program. The work is decomposed into five
buildable sub-slices (27.1 → 27.5). Each sub-slice ships and is reviewed independently
through the normal slice loop. This file is the single source of truth for the program's
goal, the locked decisions, the sub-slice status, and the cross-cutting impact notes.

---

## Goal

Make an order's **bill and its installments a single, consistent, atomic unit.** Today the
bill (`Order.total_amount`) and the installment schedule drift apart: installments are
created with separate, non-atomic API calls, the consistency rule is only `sum ≤ bill`
(enforced unevenly), and the bill can be edited independently of the schedule.

VS-27 establishes and enforces one invariant everywhere:

> **`Order.total_amount == Σ(installment.amount)`** whenever a schedule exists,
> and every write that touches either side keeps it true atomically.

No separate billing model is introduced — billing stays an **order attribute**
(`total_amount`), with installments anchored on the order. (See ADR-0009 § Alternatives.)

---

## Locked decisions

1. **Strict invariant** — `bill = Σ installments`, enforced on **every** write path. No
   API side-door can leave the relationship inconsistent.
2. **Atomic create** — order + its installments are created in one transaction. When
   `total_amount > 0` and no installments are supplied, a **default installment** is
   auto-created: `amount = total_amount`, `due_date = delivery_date`, unpaid. This is the
   "mandatory default step" that does **not** block the order flow.
3. **Atomic bill + plan edit** — changing the bill and the unpaid schedule happens
   **together** in one transaction via a single order-scoped endpoint, surfaced as an
   **"Edit bill & plan"** work surface.
4. **Paid rows are locked** — never edited, deleted, or replaced by any plan operation.
5. **Bill can never drop below the already-paid total** — `total_amount ≥ Σ(paid)`.
6. **No write side-door** — the old single-row create/patch/delete installment endpoints
   are **removed** (the UI no longer uses them). `mark-paid` is retained; list (GET) is
   retained.
7. **Legacy data is reconciled, not ignored** — a one-time, idempotent backfill brings
   existing orders onto the invariant (see VS-27.2).
8. **Quick date entry** — a shared `QuickDateInput` replaces native date pickers in the
   installment editors. Default value precedence: existing due date → delivery date →
   today. Year is hidden by default but defaults to the **base date's year** (not the
   current year), revealable to change.
9. **Whole-plan editor UX** — the schedule editor reads as "Review & save payment plan,"
   with a **sticky save bar shown only when there are unsaved changes.** This is a
   deliberate, justified exception to Soliofit's autosave-everywhere guideline: money
   schedules require atomicity.

---

## Cross-cutting impact

- **Payments dashboard** — because every billed order now carries at least one installment
  (the default, due on the delivery date), every billed order becomes a payment that is
  **due on its delivery date unless split.** This is intended for tailoring, but it is an
  explicit behavior change: orders that previously showed no schedule will now show a
  due-on-delivery installment. Verify the payment summary/board counts after VS-27.2.
- **Derived money fields** — `amount_paid` / `remaining` / `payment_state` stay derived
  (Coalesced `Sum` over paid installments). No new stored balance fields. With the strict
  invariant, `remaining` now always equals the sum of unpaid installments.
- **Soft-delete invariant** — all new installment queries must keep the existing
  `order__deleted_at__isnull=True` scoping (see project soft-delete cascade rule).

---

## Sub-slices

| Slice | Title | Layer | Depends on | Status |
|-------|-------|-------|-----------|--------|
| [27.1](./vs-27.1-backend-strict-billing.md) | Backend strict billing core | Backend | — | **Implemented — in review** |
| [27.2](./vs-27.2-legacy-audit-backfill.md) | Legacy audit + backfill | Backend (data) | 27.1 | Pending |
| [27.3](./vs-27.3-quick-date-input.md) | QuickDateInput component | Frontend | — | **Implemented — in review** |
| [27.4](./vs-27.4-add-order-plan.md) | Add Order strict plan | Frontend | 27.1, 27.3 | Pending |
| [27.5](./vs-27.5-drawer-edit-bill-and-plan.md) | Drawer "Edit bill & plan" | Frontend | 27.1, 27.3 | Pending |

**Execution order:** 27.1 (additive backend) → 27.3 (date input) → 27.4 + 27.5 (frontend)
**+ cutover** → 27.2 backfill.

**Deployment sequencing (important — avoids a broken-UI window):**
27.1 ships **non-breaking** — it only *adds* the new create-with-installments path and the
`PUT /orders/{id}/billing/` action; the old single-row endpoints stay live and the old UI
keeps working. The **breaking changes are batched into a single "cutover" release alongside
27.4 + 27.5**: enable auto-default-on-omit, remove the single-row write endpoints, and make
`total_amount` read-only outside the billing path. Because the UI that needs those paths and
the removal of those paths ship together, production is never left with a broken installment
editor. The **27.2 backfill** runs with (or immediately after) the cutover, so the invariant
holds across both new and legacy data at the same moment.

---

## Definition of done (program)

- New billed orders are always fully scheduled; splitting is optional but must balance.
- The bill and unpaid schedule are only ever edited together, atomically.
- Paid installments are never disturbed; bill never drops below paid.
- No writable installment endpoint can break the invariant.
- All pre-existing orders have been reconciled (or surfaced in the manual-review report).
- ADR-0009 is `Accepted`.

## Completion log

- **2026-06-14 — VS-27.1 implemented (in review, not yet committed).** Additive backend
  foundation. Order create accepts an optional write-only `installments[]` (validated
  `Σ == total_amount`, created atomically with the order; omitted = unchanged). New
  `billing` detail action on `OrderViewSet` → `PUT /api/orders/{id}/billing/` (atomic
  bill + unpaid-schedule replace; `total ≥ Σ(paid)`; `Σ(paid)+Σ(new) == total`; paid rows
  preserved; `select_for_update` on the order). `InstallmentMarkPaidView` now locks the
  parent order before setting `paid_date`. Old single-row write endpoints kept + marked
  deprecated. ADR-0009 → Accepted. Tests: 116 pass in `apps.orders` + `apps.payments`
  (incl. new `StrictBillingCreateTests`, `BillingEndpointTests`, `MarkPaidLockTests`,
  `DeprecatedInstallmentEndpointsTests`). No migration. Cutover items (auto-default-on-omit,
  endpoint removal, bill read-only guard) deferred to the 27.4/27.5 release.
