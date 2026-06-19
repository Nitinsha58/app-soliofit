# VS-29 — Order WhatsApp Messaging (Program Overview)

**Status:** 29.1–29.4 shipped; 29.5–29.8 (finalized template set) specced — Pending build
**Created:** 2026-06-19
**Depends on:** VS-28 (Order Detail command screen), merged to `main`.
**ADR:** [ADR-0010 — WhatsApp Click-to-Chat Messaging](../../adr/ADR-0010-whatsapp-click-to-chat-messaging.md) (Accepted)

This is the **master tracker** for the VS-29 program: let the boutique notify a customer
about their order over WhatsApp in one tap from the Order Detail Overview, using
predefined status/payment templates, and **track which status messages have been sent** so
the action restyles to a "sent" state.

---

## Goal

From the Order Detail **Overview**, just below the stage-aware primary action, the owner
can send the customer a status-appropriate WhatsApp message (Booked / Started / Ready /
Partial Delivery / Delivered), with an outstanding-payment line appended when money is due.
The send is one tap: it opens WhatsApp with a prefilled, editable draft and records that
the message was sent for that status.

This is **assisted manual messaging** for the MVP — not the automated WhatsApp Business
API integration, which stays Post-MVP (`02-feature-set §2.5`). See ADR-0010 for the
delivery-mechanism and tracking decisions.

---

## Locked decisions

1. **Click-to-chat delivery.** Opens `https://wa.me/<intl-number>?text=<encoded message>`;
   the owner reviews/edits and sends in WhatsApp. No server-side sender, no preview UI
   (the draft is the preview). (ADR-0010 §1, §5.)
2. **`91` + 10-digit normalization.** Stored numbers (local, no country code) are prefixed
   with India code `91`; an existing `91…` 12-digit number is left as-is. Default code is a
   single constant. (ADR-0010 §2.)
3. **Predefined, swappable templates.** Five status templates + two payment templates
   (full pending; partial — one paid, one pending) in one client module with placeholders.
   Interim ahead of in-panel template management (§ Future). (ADR-0010 §3.)
4. **Message reflects the order's current status.** On a Ready order the action is
   "Send Ready". The status word in the label/template = `order.status`.
5. **Send-tracking in a dedicated `OrderMessageLog` table**; the order **detail**
   serializer exposes a derived `messages_sent` map. "Sent" = send-initiated (optimistic),
   not delivery-confirmed; **Resend** is always available. (ADR-0010 §4, §5.)
6. **Three button states, color = status (§0.8).** Unsent → green-outline + WhatsApp icon
   (`Send <Status>`); Sent → muted/check (`<Status> sent · <time>`) with a quiet Resend;
   No phone → disabled. Stays a **secondary** action — never out-weighs the gold primary
   (§0.7 one dominant action).

---

## Sub-slices

| Slice | Title | Layer | Status |
|-------|-------|-------|--------|
| [29.1](./vs-29.1-backend-message-tracking.md) | `OrderMessageLog` model + `POST /orders/{id}/messages/` + `messages_sent` on detail serializer | Backend | **Done** |
| [29.2](./vs-29.2-send-status-button.md) | Send-status button on Overview — templates module, `wa.me` open, three-state styling + resend | Frontend | **Done** |
| [29.3](./vs-29.3-board-card-action.md) | WhatsApp send-status footer on dashboard order cards (desktop hover overlay / mobile in-flow); `messages_sent` extended to the board action | Backend + Frontend | **Done** |
| [29.4](./vs-29.4-post-create-modal.md) | Post-create "send booked message" modal → redirect to the new order's detail drawer | Frontend | **Done** |
| [29.5](./vs-29.5-template-spec.md) | Finalized template spec — vault doc §10 (product source of truth + refined future schema) | Vault / product | **Pending** |
| [29.6](./vs-29.6-working-hours-backend.md) | Boutique working hours (`opening_time`/`closing_time`) — order-settings + `me` payload | Backend | **Pending** |
| [29.7](./vs-29.7-finalized-templates.md) | Finalized template copy — status-aware `paymentContext`, `{item}`="order", **Partial Delivery skipped** | Frontend | **Pending** |
| [29.8](./vs-29.8-pickup-window-settings.md) | Pickup window + working-hours Settings UI | Frontend | **Pending** |

**Execution order:** 29.1 → 29.2 → 29.3 → 29.4 (all **Done**), then the finalized-template track:
**29.5 (spec) → 29.6 (backend hours) → 29.7 (template copy) → 29.8 (pickup window + Settings UI)**.
No broken-window risk: 29.6 lands before 29.8 needs hours; 29.7 ships with a pickup-window fallback
until 29.8 wires the real value.

---

## Future (not in VS-29 scope yet)

- **In-panel template management** — edit/manage message templates in the app instead of
  the hard-coded module. The templates module (29.2/29.7), `template_key` (29.1), and the refined
  schema in vault §10 (`action_key`, `payment_context` as a resolved fragment) are the seams this
  builds on. New sub-slice when prioritized.
- **Partial Delivery messaging** — skipped for now (29.7); revisit once the Partial Delivery model
  is fixed.
- **Delay notice + payment reminders** (gentle / follow-up / consolidated) — separate
  collection/notice track via `action_key`, needs installment-level data (`due_date`,
  `days_overdue`, consolidated customer dues). Documented in vault §10; their own backend slice.
- **Structured order-item capture** — replaces the interim `{item}`="order" with a real garment
  label. Their own slice.
- **WhatsApp Business API auto-send + delivery receipts** — remains Post-MVP
  (`02-feature-set §2.5`); would supersede the optimistic "sent" semantics with real
  delivery state.

---

## Definition of done (program)

- From Overview, one tap opens WhatsApp prefilled with the correct status message, plus a
  payment line when outstanding.
- After sending, the action shows a "sent" state for that status with a Resend option;
  the state survives reload (server-tracked).
- The number is correctly normalized to a `wa.me`-valid international form.
- Every surface passes the `07-ux-guidelines §0.10` pre-build checklist.

## Completion log

- **2026-06-19 — VS-29.5–29.8 specced (Pending build).** Finalized WhatsApp template set
  (warm "ji" tone, vault §10) decomposed into four buildable sub-slices: **29.5** vault spec doc
  (source of truth, lands at build), **29.6** boutique working hours (additive backend), **29.7**
  finalized template copy (status-aware `paymentContext`, `{item}`="order", **Partial Delivery
  skipped — no send action**), **29.8** pickup window + working-hours Settings UI. Execution
  29.5 → 29.6 → 29.7 → 29.8; 29.7 ships with a "during our working hours" fallback until 29.8 wires
  real hours. Documented as future: Partial Delivery messaging, Delay notice, payment reminders,
  `action_key` logging, structured item capture. Specs only — no implementation yet.
- **2026-06-19 — VS-29.4 shipped (in review).** Post-create "send booked message" modal
  (`OrderCreatedModal`). After an order is created, a white success modal offers one dominant
  quick action — send the customer the Booked WhatsApp confirmation — then **every exit**
  (send success, "Go to order", X, backdrop, Escape) opens the new order's detail drawer via
  `openOrderDetail`. Auto-redirects once the send is recorded (the drawer shows "Booked sent"
  from fresh detail); on POST failure the modal stays open with a recoverable error and "Go to
  order" still works. No-phone orders hide the WhatsApp button. `useWhatsAppSend.send()` now
  returns `Promise<boolean>` so the modal redirects only on a recorded send (existing callers
  ignore the return). `AddOrderFlow.onCreated` captures the order into AppShell state and shows
  the modal; the board still refreshes underneath. Commit `e6e5854`. Type-check clean.
- **2026-06-19 — VS-29.3 shipped (in review).** WhatsApp send-status footer on every dashboard
  `OrderCard` — a merged green-hint strip. **Desktop:** hidden until card hover, shown as an
  absolute overlay (no layout shift; hovered card lifts via `lg:hover:z-20`). **Touch:** always
  visible, in-flow. Hidden when no phone; stops pointer/click propagation so taps never start a
  drag or open the drawer. **Backend amendment (board action only):** `get_queryset` prefetches
  `message_logs` for the `board` action and the board serializes `results` with
  `OrderDetailSerializer`, so cards carry `messages_sent`. Bounded cost — **+1 query per page,
  not N+1** (proved by a query-flatness test). The generic `GET /api/orders/` list stays on
  `OrderSerializer`, unchanged — this is a scoped extension of ADR-0010's detail-only tracking,
  not a new decision (no ADR). Shared `useWhatsAppSend` hook extracted (both the detail action
  and the card footer use it; `WhatsAppAction` refactored onto it, behavior identical). The card
  footer patches the board React Query cache in place on send — replacing only the matching
  order's `messages_sent` across the status column's recent + older caches, preserving
  `next_cursor` / `counts` / `value` exactly. `BoardColumn` gained bottom padding so the last
  card's hover overlay isn't clipped. Commit `9256627`; **199 backend tests pass**; type-check clean.
- **2026-06-19 — VS-29 program closed — Done.** Both sub-slices shipped and verified. From the
  Order Detail Overview, one tap opens a prefilled `wa.me` draft for the order's current status
  (with a payment line when outstanding), records the send server-side, and flips the action to a
  server-backed "sent" state with Resend. Commits `9400fb2` (29.1), `b557cd1` (29.2).
  **Deferred follow-up (tracked, not a blocker):** no frontend unit tests cover
  `whatsappTemplates` / `WhatsAppAction` — the project has no frontend test framework (verification
  is type-check + browser by design, per the frontend-verification reality). Adding template/component
  unit tests would require standing up Jest/Vitest first; that is its own infrastructure slice, not
  part of VS-29. The template logic is pure and small and was browser-verified.
- **2026-06-19 — VS-29.2 verified (browser pass).** On `#0022` (Started): `Send Started` renders
  directly below `Mark Ready`; tap opened the WhatsApp draft with normalized phone `919000001005`,
  the Started template, and the correct full-pending payment line (single ₹1,111); button flipped to
  `Started sent · <time>` with Resend; the sent state persisted from the server after reload; one
  `status_started` log row created. 375/768 viewport checks clean — the WhatsApp action reads as a
  secondary, the primary stays dominant, no horizontal overflow. Empty-phone, already-`91…`, and
  POST-failure/offline paths were source-reviewed (revert-optimistic + recovery message confirmed in
  `catch`), not live-tested. `tsc --noEmit` clean.
- **2026-06-19 — VS-29.1 verified (review pass).** `OrderMessageLog` additive backend: migration
  `0009_ordermessagelog` applies cleanly, `makemigrations --check` no drift, `messages_sent` is
  detail-only (list/board unchanged), resend appends a row + updates the exposed timestamp, invalid
  status → 400, cross-boutique → 404. 10 new `OrderMessageLogTests`; **198/198 backend tests pass.**
  Commit `9400fb2`.
- _2026-06-19 — VS-29 program opened. ADR-0010 Accepted. Specs only; no implementation yet
  — awaiting build approval per sub-slice. Execution: 29.1 → 29.2._
