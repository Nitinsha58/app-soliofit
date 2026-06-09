# ADR-0007 — Boutique Tenancy (Single-Boutique Schema Foundation)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-09 |
| **Deciders** | Nitin |
| **Slice** | VS-23 |

_Revised 2026-06-09 (pre-acceptance, from review) before any VS-23 code. Incorporated: `User` is operator/staff identity (not end-customer); operational settings (`delivery_buffer_days`, `daily_capacity`) re-homed to the boutique while notification prefs stay per-user; `Order.user` / `Customer.user` redefined as **attribution** (`created_by`, non-cascading) with **ownership** moving to `boutique`; same-boutique validation on cross-root links; `boutique_id` confined to roots; explicit Non-Goals; `owner` qualified as primary/billing owner; future `BoutiqueMembership`, customer/member portability, and boutique-level subscription noted as shape-only._

_Amended 2026-06-09 (at implementation start, before code): **`User.boutique` is `null=True` at the DB**, application-guaranteed populated by `UserManager.create_user` (which bootstraps the solo boutique for the first user and attaches subsequent users to it). This resolves the circular `Boutique.owner ↔ User.boutique` bootstrap on a fresh deploy, where the first `createsuperuser` predates any boutique. `Order.boutique` and `Customer.boutique` remain **non-null** (always created within a request whose user already has a boutique). No change to the ownership/attribution or roots-only decisions._

---

## Context

Soliofit is a single-user, single-boutique app today. Tenant data is owned per **user**: `Order.user` and `Customer.user` are the only direct `users.User` foreign keys, and everything else hangs off those — installments through `order`, photos/voice notes through `order`, activities through `order`. Querysets scope with `user=request.user`; `order_number` is a **global** `PositiveIntegerField(unique=True)` filled by `Max(order_number)+1` with a retry-on-`IntegrityError` loop (`OrderViewSet.perform_create`).

**Three distinct identities, kept separate.** This ADR fixes the meaning of `User`:

- **`User` = the boutique operator / staff member** who signs in and runs the shop. Tenancy and permissions attach here.
- **`Customer` = the boutique's end-customer** (the person whose garments are being made). A `Customer` is private boutique data, **not** a login identity.
- A future **Soliofit member account** (an end-customer who logs in and can order across boutiques) is a **separate identity model**, introduced later — never conflated with `User`.

VS-23 future-proofs tenancy so staff accounts and multi-boutique can arrive later without a painful FK migration, **without** building any of that now. The MVP stays single-boutique. The decision to settle: **where the `boutique` FK lives**, **what `User` ownership vs attribution means**, **where operational settings belong**, **how `order_number` becomes per-boutique**, and **how existing data migrates** with nothing lost.

## Non-Goals (explicit)

VS-23 is schema foundation only. It does **not** implement, and this ADR does not design:

- Customer/member **login accounts** (end-customers remain non-auth `Customer` records).
- **Cross-boutique customer discovery** or customer portability between boutiques.
- **Staff roles / permissions** (one operator per boutique for now; `owner` is the only role).
- **Billing, subscriptions, or subscription-admin UI.**
- **Signup / multi-boutique onboarding** (the single boutique is seeded by migration).
- Any **marketplace** behavior (a customer ordering from arbitrary boutiques).

These stay post-MVP per `09-mvp-scope`. Shape notes for some are recorded under "Future shape" so today's schema doesn't foreclose them.

## Decision

Introduce a `Boutique` entity that **owns** tenant data. Attach a `boutique` FK to the **tenant roots only** — `User`, `Order`, `Customer`. Child records (installments, media, activities) get **no** `boutique` FK; they stay reachable only through a boutique-scoped parent, exactly like the VS-21 soft-delete cascade reaches children through `order__deleted_at__isnull=True`. One scoping pattern, minimal schema churn.

### Model

```python
class Boutique(models.Model):
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                 = models.CharField(max_length=200)
    # Primary / billing owner — NOT a full permissions model. Real staff roles
    # arrive later via BoutiqueMembership (see Future shape).
    owner                = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='owned_boutiques')
    # Operational settings live at the boutique, not on a staff member (re-homed
    # from UserSettings). Capacity drives calendar workload + Add-Order suggestion.
    delivery_buffer_days = models.PositiveSmallIntegerField(default=0)
    daily_capacity       = models.PositiveSmallIntegerField(default=6)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)
```

- **`User.boutique`** → `ForeignKey(Boutique, on_delete=PROTECT, related_name='users')`. Every operator belongs to exactly one boutique. This is the tenancy link.
- **`Order.boutique` / `Customer.boutique`** → `ForeignKey(Boutique, on_delete=PROTECT, related_name='orders' / 'customers')`. **Ownership.** Denormalized onto these roots (rather than reached via `created_by.boutique`) for the two reasons below.
- **Attribution, not ownership:** the existing `Order.user` / `Customer.user` are renamed **`created_by`** → `ForeignKey('users.User', on_delete=SET_NULL, null=True, related_name='created_orders' / 'created_customers')`. They record *who entered the record*, nothing more. Deleting or deactivating a staff member must **never** cascade-delete boutique data — `SET_NULL` keeps the order/customer under its boutique with attribution cleared. (`PROTECT` was the alternative; `SET_NULL` is chosen so staff can actually be removed.)
- **Operational settings move to the boutique.** `delivery_buffer_days` and `daily_capacity` are boutique-level operating parameters, not personal staff preferences, so they move onto `Boutique` and the `UserSettings` table is **removed**. `/api/auth/order-settings/` now reads/writes the caller's boutique.
- **Notification preferences stay per-user.** `NotificationPreference` (1:1 with `User`) is unchanged — whether *this operator* wants reminders is genuinely a personal setting.

### Why denormalize `boutique` onto Order and Customer

1. **The per-boutique uniqueness constraint must live on `Order` columns.** A DB `UniqueConstraint(fields=['boutique', 'order_number'])` cannot span a FK hop. `boutique_id` on `Order` is what makes the constraint database-enforceable.
2. **Join-free scoping.** `Order.objects.filter(boutique=request.user.boutique)` is one indexed-column filter; scoping via `created_by__boutique` would add a join to every board, schedule, calendar, dashboard, search, and payments query — and `created_by` is now nullable, so it can't carry ownership anyway.

### Same-boutique integrity on cross-root links

An `Order.customer` must belong to the **same** boutique as the order. Enforced in `OrderSerializer.validate` / the viewset: on create or update, reject a `customer` whose `boutique_id != request.user.boutique_id` (404/400, not a leak). Tested explicitly (an operator cannot attach another boutique's customer to an order). Because both roots carry `boutique_id`, this is a cheap equality check, and the value is always injected server-side — never client-supplied.

### `order_number` becomes per-boutique

- Drop `unique=True` on `Order.order_number`; add `UniqueConstraint(fields=['boutique', 'order_number'], name='uniq_order_number_per_boutique')` and an index on `(boutique, order_number)`.
- `perform_create` keeps its proven retry loop but scopes the max read: `Order.objects.filter(boutique=b).aggregate(Max('order_number'))['order_number__max'] or 0`, saving with `boutique=b, created_by=request.user`. The fresh-read-inside-fresh-`atomic()`, 5-attempt structure is unchanged.
- For the single seeded boutique, per-boutique `Max+1` equals today's global counter, so **existing numbers are untouched and new numbering is continuous** — zero user-visible disruption.

### Queryset scoping

Every root filter (`Order`/`Customer`) that currently uses `user=request.user` flips to `boutique=request.user.boutique`. Child queries keep joining through their parent and flip the parent predicate the same way (`order__user=` → `order__boutique=`). `created_by` is **never** used for scoping — ownership is the boutique. Surfaces: orders board + `perform_create` + `delivery-load`, Orders Schedule, calendar, payments dashboard + installments, dashboard summary/notifications, global search, customer profile.

### Data migration (nothing lost)

Standard nullable → populate → enforce sequence:

1. **Schema (nullable):** create `Boutique`; add `boutique` as `null=True` to User, Order, Customer; `RenameField` `Order.user`→`created_by` and `Customer.user`→`created_by` (preserves values).
2. **Data migration:** create **one** `Boutique` — `name` from the operator's `business_name` (fallback `"My Boutique"`), `owner` = earliest-created user, and `delivery_buffer_days` / `daily_capacity` copied from that operator's `UserSettings` (defaults 0 / 6 if absent). Assign **every** existing User, Order, Customer to it. Single-boutique MVP, so all users join the one boutique.
3. **Schema (enforce):** `AlterField` `boutique` to non-null on the three roots; `AlterField` `created_by` to `SET_NULL, null=True`; swap `order_number`'s `unique=True` for the per-boutique `UniqueConstraint`; **remove** the `UserSettings` model/table (settings now on `Boutique`).

Existing `order_number`s remain globally distinct and therefore trivially distinct within the single boutique — no renumbering.

**Circular-FK sequencing.** `Boutique.owner → User` and `User.boutique → Boutique` reference each other. The nullable→populate→enforce split resolves it cleanly **only if the steps stay separated**: step 1 adds `User.boutique` as `null=True` (so a `User` can exist without a boutique), step 2's data migration creates the seeded `Boutique` (its `owner` points at an already-existing user) and *then* backfills `User.boutique`, and step 3 flips `User.boutique` to non-null. The seeded boutique must be created **before** `User.boutique` becomes non-null — never collapse steps 2 and 3 into one migration.

### New-user / new-boutique provisioning

Out of scope (no signup). Exactly one boutique exists, seeded by the migration; new users created via `createsuperuser` / admin are attached to it (a short management step). Self-serve boutique creation is post-MVP.

## Future shape (recorded so today's schema doesn't foreclose it — not built now)

- **`BoutiqueMembership(user, boutique, role)`** if a person can belong to multiple boutiques or owner/staff roles become real. The current single `User.boutique` FK + `Boutique.owner` is the degenerate one-membership case; promoting to a membership table is additive.
- **Customer / member portability** as a *separate* identity: an end-customer could later become a Soliofit member who logs in and orders from any boutique — but a boutique must still **never** automatically see another boutique's private `Customer` data. Portability is an explicit linking model, not shared visibility.
- **Subscription / billing** belongs to **`Boutique`**, not to individual users (a boutique holds the plan; staff don't each carry a subscription).

## Consequences

- One consistent scoping rule: filter roots by `boutique`; children inherit it through their parent join — mirrors the soft-delete cascade invariant, so one mental model, not two.
- Clean ownership/attribution split: deleting or deactivating staff can never orphan-delete orders (`created_by` `SET_NULL`); the boutique owns the data.
- Operational settings are correctly boutique-scoped, so a second operator (future) sees the same capacity/buffer; only notification prefs differ per person.
- `order_number` uniqueness is **database-enforced per boutique**; the race-safe retry loop carries over with a one-line filter change.
- Cross-root integrity is guarded (an order's customer must share its boutique), with tests — closing a class of future cross-tenant leak before a second boutique exists.
- Minimal schema churn: one table + three FK columns + two re-homed settings fields, versus a `boutique` column on all seven tenant-touching models.
- Wide but mechanical edit surface: every `user=request.user` root filter flips to `boutique=`. Must be exhaustive — a missed filter would leak across boutiques once a second exists. Cross-boutique isolation is asserted per surface (board, schedule, calendar, payments, search, customer profile).
- `request.user.boutique` is read on nearly every request; the FK is indexed and the user row is already loaded, so cost is negligible.

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| **Scope only via `created_by.boutique`, no `boutique` column on Order/Customer** | The per-boutique `order_number` constraint can't span a FK hop, and `created_by` is nullable (attribution) so it can't carry ownership at all. Denormalizing the root FK solves both. |
| **`boutique` FK on every tenant model** (installments, media, settings, activities) — as the VS-23 spec text loosely listed | Unnecessary churn; children are reachable only through a boutique-scoped parent already, and duplicating the column risks parent/child disagreement. This ADR **revises** that spec line to roots-only. |
| **Keep `Order.user` / `Customer.user` as owning, cascading FKs** | Conflates attribution with ownership; deleting a staff account would cascade-delete the boutique's orders. Ownership must live on `boutique`; `created_by` is attribution only. |
| **Leave `delivery_buffer_days` / `daily_capacity` on `UserSettings`** | They are boutique operating parameters, not personal preferences — wrong scope the moment a second operator exists. Re-homed to `Boutique`. |
| **Full multi-tenant SaaS** (schema-per-tenant, `django-tenants`, Postgres RLS) | Far outside MVP; we are future-proofing a single trusted boutique, not isolating hostile co-tenants. |
| **Per-boutique sequence table for `order_number`** | The `Max+1` + retry loop is proven and now scoped by one filter; a sequence table adds locking/machinery for no MVP benefit. |
| **Keep the global `order_number`** | Two boutiques would share one number line; per-boutique numbering is the point of the slice. |

## References

- `vertical-slices.md` — VS-23 spec, review checkpoint (this ADR revises: FK roots-only; `user`→`created_by` attribution; operational settings → boutique)
- `09-mvp-scope.md` — multi-boutique / SaaS explicitly post-MVP
- `04-system-design.md` — entity relationships; tenant ownership currently via `user`
- VS-16 completion record — `UserSettings` (`delivery_buffer_days`, `daily_capacity`) being re-homed; `NotificationPreference` staying per-user
- ADR-0003 — Database / Django ORM (migration + queryset conventions)
- VS-21 completion record — the soft-delete cascade-through-parent invariant this scoping mirrors
- Pre-VS-15 hardening — race-safe `order_number` retry loop, now boutique-scoped
