# ADR-0010 — Customer Messaging via WhatsApp Click-to-Chat (`wa.me`) Deep Links

**Status:** Accepted
**Slice:** VS-29 (see [program overview](../workflow/vs-29-whatsapp/00-overview.md))
**Date:** 2026-06-19

---

## Context

Boutique owners notify customers about their order by hand — copying a message into
WhatsApp when an order is booked, started, ready, or delivered, and chasing pending
payments. Soliofit already stores the customer's phone number and surfaces a P1
"WhatsApp Quick Link" on the customer profile (`02-feature-set §1.2`), but there is no
way to send a **status-appropriate, prefilled** message from the order itself, and no
record of what was sent.

VS-29 introduces order status messaging. Two questions had to be decided before building:

1. **How is the message delivered?** Automated send (WhatsApp Business API / a gateway)
   versus the user-driven `wa.me` click-to-chat deep link that opens WhatsApp with a
   prefilled, editable draft the owner reviews and sends themselves.
2. **How do we track that a status message was sent**, so the button can restyle to a
   "sent" state and avoid accidental duplicate sends?

Constraints that shaped the decision:

- The product owner's requirement is a fast, in-MVP capability — *not* the full
  automated WhatsApp Business API integration, which remains explicitly **Post-MVP**
  (`02-feature-set §2.5`).
- Phone numbers are currently stored **without a country code** (local 10-digit Indian
  numbers). `wa.me` requires a full international number with no `+`/spaces.
- The MVP architecture has **no background workers or message queues** — all
  "automation" is query-time (`02-feature-set §3`). An automated sender would break that
  constraint and add credential/billing/webhook surface.

## Decision

**1. Deliver via `wa.me` click-to-chat deep links.** The order detail "Send <status>"
action opens `https://wa.me/<intl-number>?text=<url-encoded message>` in a new tab. The
owner sees the prefilled draft in WhatsApp, can edit it, and presses send themselves. We
do not integrate the WhatsApp Business API, an SMS gateway, or any server-side sender for
the MVP. This keeps zero new credentials, zero background infrastructure, and zero
per-message cost, and the human-in-the-loop step doubles as the message preview (so no
in-app preview UI is built).

**2. Normalize the number to `91` + 10 digits.** Stored numbers are stripped of
non-digits; a bare 10-digit number is prefixed with the India country code `91`. A number
that already carries a 12-digit `91…` form is used as-is (no double prefix). The default
country code is a single constant so it can change if the product expands beyond India.

**3. Templates are predefined, client-side, and swappable.** Status templates
(Booked / Started / Ready / Partial Delivery / Delivered) and payment templates (full
amount pending; partial — one paid, one pending) live in one frontend module with
placeholders (customer name, order number, amounts, shop name). They are interim content
ahead of the in-panel **template management** capability (a later VS-29 sub-slice); the
module is the single seam that capability will replace.

**4. Track sends in a dedicated `OrderMessageLog` table.** Each send appends a row
(`order`, `order_status`, `channel`, `template_key`, `sent_by`, `sent_at`, `metadata`).
The order **detail** serializer exposes a derived `messages_sent` map (latest `sent_at`
per status) the button reads to choose its state. A dedicated, append-only table — rather
than a flag on `Order` or reuse of `OrderActivity` — is chosen because it is the
extension point for template management and a future messaging/audit history, keeps a full
resend history, and supports indexed "latest per status" lookups without polluting the
activity feed.

**5. "Sent" means send-initiated, not delivery-confirmed.** Click-to-chat gives no
delivery receipt — we only know the draft was opened. The status is therefore marked sent
**optimistically** when the action is taken (a log row is written), and **Resend** is
always available. True delivery/read receipts would require the Post-MVP Business API and
are out of scope.

`POST /api/orders/{id}/messages/` writes the log row; it is **additive and
non-breaking** (no existing endpoint or field changes).

## Consequences

**Positive**
- Ships inside the MVP architecture — no queue, no worker, no third-party credentials or
  per-message billing, no webhook endpoint to secure.
- The owner always reviews/edits before sending; the WhatsApp draft *is* the preview.
- `OrderMessageLog` gives a real send history and a clean seam for template management and
  future channels (SMS/email) without reshaping `Order`.
- Resend is a first-class, low-risk affordance because tracking is optimistic, not a hard
  lock.

**Negative / trade-offs**
- **No delivery confirmation.** A "sent" marker means the owner opened the draft, not that
  the customer received it. Documented in the UI semantics and revisited if/when the
  Business API lands.
- **Manual step remains.** This is assisted manual messaging, not automation — by design
  for the MVP; the automated path is still §2.5 Post-MVP.
- **Country-code assumption.** Normalization assumes Indian 10-digit numbers; numbers
  stored in other formats may need the prefix logic revisited when multi-region support is
  considered.
- A new table + migration is added (additive; cascades on order delete).

## Alternatives considered

1. **WhatsApp Business API / gateway auto-send.** Rejected for the MVP: requires a
   Meta/BSP account, approved message templates, credentials, webhooks, per-message cost,
   and a background sender — all contrary to the no-worker MVP architecture. Remains the
   documented Post-MVP path (`02-feature-set §2.5`).
2. **SMS or email status notifications.** Rejected: WhatsApp is the boutique's actual
   customer channel (`07-ux-guidelines §1.1`); SMS/email add cost and friction for lower
   engagement. Listed Post-MVP (§2.9).
3. **Boolean/JSON flag on `Order` (e.g. `messages_sent` JSON field).** Rejected: no resend
   history, no `sent_by`/`template_key` attribution, and a poor base for template
   management/audit. The dedicated log is barely more code and far more extensible.
4. **Reuse `OrderActivity` with a `message_sent` type.** Considered (zero new table, shows
   in the activity feed for free) but rejected: it overloads the audit-event log with
   messaging concerns, makes "latest sent per status" a filtered scan, and is a weaker
   foundation for template management. A purpose-built table was chosen for the messaging
   domain.
5. **In-app message preview/confirm modal before opening WhatsApp.** Rejected: the
   WhatsApp draft is already an editable preview; an extra modal adds a tap with no value
   (`07-ux-guidelines §1.2` operational speed).

## References

- VS-29 program overview — [`../workflow/vs-29-whatsapp/00-overview.md`](../workflow/vs-29-whatsapp/00-overview.md)
- VS-29.1 backend message tracking — [`../workflow/vs-29-whatsapp/vs-29.1-backend-message-tracking.md`](../workflow/vs-29-whatsapp/vs-29.1-backend-message-tracking.md)
- VS-29.2 send-status button — [`../workflow/vs-29-whatsapp/vs-29.2-send-status-button.md`](../workflow/vs-29-whatsapp/vs-29.2-send-status-button.md)
- Vault `02-feature-set.md §2.5` (WhatsApp Business API — Post-MVP), `§1.2` (WhatsApp Quick Link)
- Vault `07-ux-guidelines.md §0` (Attention-First gate), `§0.8` (color is status language)
- ADR-0007 (boutique tenancy — scoping of new models)
