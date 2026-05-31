# Soliofit — Project Documentation

Central reference for all technical decisions, architecture rationale, and implementation progress.

---

## Structure

| Directory | Contents |
|-----------|---------|
| [`/adr`](./adr/README.md) | Architecture Decision Records — every significant technical choice |
| [`/product`](./product/README.md) | Pointers to the product vault (requirements, screens, UX, scope) |
| [`/workflow`](./workflow/development-process.md) | Development process, unit definitions, review checkpoints |

---

## Product Documentation Vault

All product requirements, screen definitions, and feature specs live at:

```
/Users/nitin/MemoryGraph/Soliofit/Soliofit
```

See [`/product/README.md`](./product/README.md) for the full index.

---

## Development Status

Development follows a vertical slice approach. Each slice delivers an observable feature increment end-to-end.

| Slice | Description | Status |
|-------|-------------|--------|
| VS-00 | Foundation shell | Complete |
| VS-01 | Authentication | Complete |
| VS-02 | App shell | Complete |
| VS-03 | Customer management | Complete |
| VS-04 | Order creation | Complete |
| VS-05 | Kanban board | Complete |
| VS-06 | Order details | Complete |
| VS-07 | Photo upload | Complete |
| VS-08 | Voice notes | Not started |
| VS-09 | Installments | Not started |
| VS-10 | Dashboard intelligence | Not started |
| VS-11 | Payments dashboard | Not started |
| VS-12 | Activity log | Not started |
| VS-13 | Customer profile | Not started |
| VS-14 | Global search | Not started |
| VS-15 | Calendar | Not started |
| VS-16 | Settings | Not started |
| VS-17 | Mobile layout | Not started |
| VS-18 | Production deployment | Not started |

Full specifications: [`/workflow/vertical-slices.md`](./workflow/vertical-slices.md)

---

## ADR Index

ADRs are written incrementally as each slice requires a documented decision. No pre-planned ADRs.

| ID | Title | Status | Slice |
|----|-------|--------|-------|
| [ADR-0001](./adr/ADR-0001-backend-framework.md) | Backend Framework — Django + DRF | Accepted | VS-00 |
| [ADR-0002](./adr/ADR-0002-auth-strategy.md) | Auth Strategy — Cookie-based JWT | Accepted | VS-01 |
| [ADR-0003](./adr/ADR-0003-database-orm.md) | Database — PostgreSQL + Django ORM | Accepted | VS-00 |
| [ADR-0004](./adr/ADR-0004-frontend-framework.md) | Frontend Framework — Next.js 14 App Router + shadcn/ui | Accepted | VS-00 |
| [ADR-0005](./adr/ADR-0005-s3-presigned-url-strategy.md) | S3 Presigned URL Strategy with Local Stub Mode | Accepted | VS-07 |
