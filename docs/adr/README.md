# Architecture Decision Records

ADRs capture every significant technical choice: what was decided, why, what alternatives were considered, and what consequences follow.

**Format:** Each ADR is a single markdown file. Once accepted, an ADR is never deleted — only superseded by a newer one.

**Status values:** `Draft` → `Proposed` → `Accepted` | `Rejected` | `Superseded by ADR-XXXX`

---

## Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-0001](./ADR-0001-backend-framework.md) | Backend Framework — Django + DRF | Accepted | 2026-05-28 |
| [ADR-0002](./ADR-0002-auth-strategy.md) | Auth Strategy — Cookie-based JWT | Accepted | 2026-05-28 |
| [ADR-0003](./ADR-0003-database-orm.md) | Database — PostgreSQL + Django ORM | Accepted | 2026-05-28 |
| [ADR-0004](./ADR-0004-media-storage.md) | Media Storage — S3 Presigned URLs | Accepted | 2026-05-28 |
| [ADR-0005](./ADR-0005-deployment.md) | Deployment — EC2 Docker Dual-Container | Accepted | 2026-05-28 |

---

## How to Add a New ADR

1. Copy the template from any existing ADR
2. Increment the ID
3. Fill in all sections — especially **Consequences** and **Alternatives Considered**
4. Set status to `Proposed`, discuss, then move to `Accepted` once agreed
5. Add a row to this index
6. Commit as part of the change that implements the decision
