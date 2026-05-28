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

| Phase | Status | Units |
|-------|--------|-------|
| Phase 0 — Foundation | Not started | [View units](./workflow/phase-0-units.md) |
| Phase 1 — Order Core | Not started | Planned after Phase 0 review |
| Phase 2 — Payments | Not started | Planned after Phase 1 review |
| Phase 3 — Discovery | Not started | Planned after Phase 2 review |
| Phase 4 — Polish | Not started | Planned after Phase 3 review |

---

## ADR Index

| ID | Title | Status |
|----|-------|--------|
| [ADR-0001](./adr/ADR-0001-backend-framework.md) | Backend Framework — Django + DRF | Accepted |
| [ADR-0002](./adr/ADR-0002-auth-strategy.md) | Auth Strategy — Cookie-based JWT | Accepted |
| [ADR-0003](./adr/ADR-0003-database-orm.md) | Database — PostgreSQL + Django ORM | Accepted |
| [ADR-0004](./adr/ADR-0004-media-storage.md) | Media Storage — S3 Presigned URLs | Accepted |
| [ADR-0005](./adr/ADR-0005-deployment.md) | Deployment — EC2 Docker Dual-Container | Accepted |
