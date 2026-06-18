# VS-28 — Order Detail as a Command Screen (Program Overview)

**Status:** Done — all four sub-slices shipped and verified
**Created:** 2026-06-14
**Depends on:** VS-27 (strict billing + drawer payment editor), merged to `main`.

This is the **master tracker** for the VS-28 program: reshape the Order Detail drawer from one
long, editable form into a **tabbed operational command screen** — show what matters today
first, push deeper details into focused secondary views. Each sub-slice ships and is reviewed
independently through the normal slice loop.

> **No ADR for this program.** The tabbed structure and stage-aware primary action are
> **UX/product-structure decisions, not architectural ones** — our process reserves ADRs for
> durable technical-architecture choices. The locked decisions live here, in the spec.

---

## Goal

Make Order Detail read like an operational command screen (per the Attention-First standard,
`07-ux-guidelines.md §0`):

- **Show** what helps today's work (due date, what's owed, the next action, photos/notes/voice).
- **Summarize** money/delay as snapshots, not editable forms.
- **Hide** editing/history/admin behind focused secondary views.

The current drawer shows everything as one long editable scroll; VS-28 replaces that with
**Overview · Work · Money** tabs plus a pushed **More Details** screen.

---

## Locked decisions

1. **Three tabs only — Overview · Work · Money** — at **all breakpoints** (mobile full-screen
   and the desktop/tablet ~460px right panel). One consistent shell.
2. **More Details is a pushed screen**, reached from an Overview row — **not** a fourth tab.
   It holds customer details, full order details, internal remarks, activity, and the danger zone.
3. **Overview is read-only-first** — identity → urgency → one dominant action → work/money
   snapshots → order note → More Details. Inputs appear only in their focused views.
4. **One dominant action: a stage-aware primary** that guides the next step in the workflow:

   | Current status | Primary action → new status |
   |---|---|
   | Booked | **Start work** → Started |
   | Started | **Mark Ready** → Ready |
   | Ready | **Mark Delivered** → Delivered |
   | Partial Delivery | **Mark Delivered** → Delivered |
   | Delivered | — (no primary; delivered state shown) |

   **Partial Delivery is reachable only via the status pill**, never the guided next step from
   Ready. Forward steps (Start/Ready) are one-tap; **Delivered keeps a confirm** (it sets
   `delivered_at` and is the consequential transition).
5. **Money reuses the VS-27.5 `PaymentSchedule`** whole-plan editor as the Money view. Overview
   shows only a **read-only** payment snapshot (bill / paid / outstanding / progress) with a
   "View plan ›" jump to Money — never the editor inline (keeps Overview out of "long form" feel).
6. **Color = status only** (green safe / amber attention / red danger / grey info), per §0.8.

---

## Sub-slices

| Slice | Title | Layer | Status |
|-------|-------|-------|--------|
| [28.1](./vs-28.1-shell-overview.md) | Tab shell + Overview core (identity, attention card, stage-aware primary, read-only payment snapshot) | Frontend | **Done** |
| [28.2](./vs-28.2-work-tab.md) | Work tab — merge photos + voice into one "Work Instructions" card | Frontend | **Done** |
| [28.3](./vs-28.3-money-tab.md) | Money tab — attention-first pass over the VS-27.5 plan editor | Frontend | **Done** |
| [28.4](./vs-28.4-more-details.md) | More Details pushed screen — customer/order details, remarks, activity, danger zone | Frontend | **Done** |

**Execution order:** 28.1 (shell) → 28.2 / 28.3 / 28.4 (refine each tab/screen). 28.1 mounts the
existing sections as **interim** content under the new tabs so nothing regresses mid-program.

---

## Definition of done (program)

- Order Detail opens on a tabbed Overview that answers "what is this, what matters now, what do
  I do next" without scrolling or editing.
- One dominant, stage-aware action; rare/admin actions in More Details.
- Photos/notes/voice grouped as Work; bill/plan as Money; both reachable in one tap.
- Every surface passes the `07-ux-guidelines.md §0.10` pre-build checklist.

## Completion log

- **2026-06-19 — VS-28 program closed — Done.** All four sub-slices shipped and verified. Order Detail is now a tabbed command screen (Overview · Work · Money) with a pushed More Details secondary screen. `OrderHeader.tsx`, `QuickActions.tsx`, and `OrderInfoSection.tsx` are orphaned (kept in place; remove in a later cleanup slice). No ADR was required — all decisions were UX/product-structure. Commit `838e24c` (VS-28.4).
- **2026-06-19 — VS-28.4 verified (browser pass).** More Details pushed screen confirmed: Customer card (name → View customer nav, phone tel: link, address), Order details card (status neutral pill, order number + Ordered date quiet, delivery date read-first → tap → date input → autosave → auto-collapse, bill read-only "Edit in Money"), Order note card (remarks read-first → tap → textarea → autosave → auto-collapse), ActivityFeed, DangerZone. Back button returns to Overview. `tsc --noEmit` clean. No backend changes. Commit `838e24c`.
- **2026-06-14 — VS-28.3 implemented (in review).** On `feat/vs-28-order-detail`. Money tab
  presentation pass over the already-complete VS-27.5 editor (no billing logic/math/endpoint/locking
  change). New `MoneyTab.tsx` frames `PaymentSchedule` in one **Payment Plan** card (parallels
  WorkTab). `PaymentSchedule` view mode now leads with **Outstanding as state language**
  (`₹X outstanding` / `₹X overdue` / `Paid in full`), Bill+Paid demoted to context, and the
  **"Edit bill & plan"** button demoted from amber-fill to a bordered text-gold secondary (still a
  clear button per Nitin — bill/date/split edits are common). Edit mode, mark-paid, dirty/save, and
  the strict invariant untouched. Overview installments preview deferred (kept lean). Type-check
  clean. No backend changes.
- **2026-06-14 — VS-28.2 implemented (in review).** On `feat/vs-28-order-detail`. Work tab is now
  one **Work Instructions** card (`WorkTab.tsx`) grouping garment photos, **Measurement Notes**
  photos, and voice into the tailor's single instruction packet; `PhotoSection`/`VoiceSection`
  gained a boring `embedded` prop (margins/header only — no second code path). Overview gains a
  compact, read-only `OverviewWorkCard` (counts + ≤3 tiny thumbnails) placed above the payment
  summary (§0.3) that taps through to the Work tab. Read-only preview re-fetches media APIs
  (duplicate reads accepted for now; consolidation left open). Type-check clean. No backend changes.
  Earlier same-day: drawer mobile scroll/overflow containment fix (`5fb8a60`).
- **2026-06-14 — VS-28.1 implemented (in review).** On `feat/vs-28-order-detail` (off `main`,
  post VS-27 merge). Tabbed shell (Overview · Work · Money) + persistent identity strip replaces
  the long editable scroll; `QuickActions` scroll-shortcuts retired. Overview command screen:
  status/priority pills, `AttentionSummaryCard` (due + urgency + payment/outstanding from order
  fields), stage-aware `PrimaryAction` (Booked→Start work, Started→Mark Ready, Ready/Partial→Mark
  Delivered [confirmed]; Delivered→none), read-only `OverviewPaymentCard` (bill/paid/outstanding +
  progress + "View plan ›" → Money), order-note preview + More Details row. Work/Money/More-Details
  mount existing sections as interim content (Money = VS-27.5 `PaymentSchedule`; More Details =
  `OrderInfoSection` with payments suppressed + `ActivityFeed` + `DangerZone`). `OrderHeader.tsx` and
  `QuickActions.tsx` now orphaned (kept untouched for low regression risk; remove in a later slice).
  Type-check clean. No backend changes.
- _2026-06-14 — VS-28 program opened. 28.1 in development off `main` (post VS-27 merge)._
