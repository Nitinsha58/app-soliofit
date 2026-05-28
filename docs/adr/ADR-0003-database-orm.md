# ADR-0003 — Database: PostgreSQL + Django ORM (No Raw SQL)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Deciders** | Nitin |

---

## Context

Soliofit has complex relational data: orders belong to customers, installments belong to orders, photos and voice notes belong to orders, activity logs belong to orders. Payment state and delivery overdue status are computed from related data. Customer search requires fuzzy matching on name and phone.

---

## Decision

Use **PostgreSQL 15+** as the database, accessed exclusively through **Django ORM**. No raw SQL anywhere in the codebase.

Key details:
- `pg_trgm` extension enabled via a dedicated Django migration (`RunSQL`)
- GIN trigram indexes on `customers.name` and `customers.phone` for fast fuzzy search
- All schema changes via `makemigrations` / `migrate` — migration files committed to git
- Computed fields (`paid_amount`, `payment_state`, `is_delivery_overdue`) as Django model `@property` methods — computed at query time, no background jobs

---

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| SQLite | Not suitable for production; no `pg_trgm`; no concurrent writes |
| MySQL | Weaker support for `pg_trgm`; Django's PostgreSQL extras unavailable |
| Prisma / raw SQL | Loses Django migration tooling; adds a separate ORM layer |
| Materialized views for payment state | Adds stale-data risk; computed properties are simpler and always accurate |

---

## Consequences

**Positive:**
- `makemigrations` generates migration files automatically from model changes
- Migration files are version-controlled — fresh DB can be built from scratch with `migrate`
- `django.contrib.postgres` provides `GinIndex`, `TrigramSimilarity` without extra libraries
- `@property` computed fields are always accurate — no sync issues

**Negative:**
- `@property` fields on `Order` (paid_amount, payment_state) trigger additional queries per object unless prefetched — must use `prefetch_related('installments')` in list views
- `pg_trgm` GIN indexes require PostgreSQL; not portable to SQLite for local testing

---

## References

- `03-technical-architecture.md` §4 — Full ORM model definitions
- `04-system-design.md` — Entity relationships and scalability notes
