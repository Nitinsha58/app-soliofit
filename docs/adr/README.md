# Architecture Decision Records

ADRs capture significant technical choices: what was decided, why, what alternatives were considered, and what consequences follow.

**When to write an ADR:** Only when the current implementation slice requires the decision. Do not pre-plan ADRs for future slices.

**Format:** Each ADR is a single markdown file. Once accepted, an ADR is never deleted — only superseded by a newer one.

**Status values:** `Draft` → `Proposed` → `Accepted` | `Rejected` | `Superseded by ADR-XXXX`

---

## Index

| ID | Title | Status | Slice |
|----|-------|--------|-------|
| [ADR-0001](./ADR-0001-backend-framework.md) | Backend Framework — Django + DRF | Accepted | VS-00 |
| [ADR-0002](./ADR-0002-auth-strategy.md) | Auth Strategy — Cookie-based JWT | Accepted | VS-01 |
| [ADR-0003](./ADR-0003-database-orm.md) | Database — PostgreSQL + Django ORM | Accepted | VS-00 |
| [ADR-0004](./ADR-0004-frontend-framework.md) | Frontend Framework — Next.js 14 App Router + shadcn/ui | Accepted | VS-00 |
| [ADR-0005](./ADR-0005-s3-presigned-url-strategy.md) | S3 Presigned URL Strategy with Local Stub Mode | Accepted | VS-07 |
| [ADR-0006](./ADR-0006-orders-list-scaling.md) | Orders List Scaling via Keyset Cursor Pagination | Accepted | VS-20 |
| [ADR-0007](./ADR-0007-boutique-tenancy.md) | Boutique Tenancy — Single-Boutique Schema Foundation | Accepted | VS-23 |
| [ADR-0008](./ADR-0008-production-deployment.md) | Production Deployment — Single EC2, Docker Compose, GitHub Actions | Accepted | VS-18 |
| [ADR-0009](./ADR-0009-strict-installment-plan.md) | Strict Installment Plan — `bill = Σ installments`, atomic create + combined edit | Accepted | VS-27 |

_Future ADRs will be added as each slice requires a documented decision._

---

## How to Add a New ADR

1. Identify the decision that must be made to implement the current slice
2. Copy the template from any existing ADR, increment the ID
3. Fill in all sections — especially **Consequences** and **Alternatives Considered**
4. Set status to `Proposed`, discuss, then move to `Accepted` once agreed
5. Add a row to this index
6. Commit as part of the slice that implements the decision
