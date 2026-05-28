# ADR-0001 — Backend Framework: Django + Django REST Framework

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Deciders** | Nitin |

---

## Context

Soliofit needs a backend that can:
- Serve a REST API to a separate Next.js frontend
- Handle relational data with complex query patterns (order filtering, payment aggregation, search)
- Manage file metadata (S3 keys/URLs stored in PostgreSQL)
- Provide built-in auth, migration, and admin tooling
- Be deployable on a single EC2 instance without operational complexity

---

## Decision

Use **Django 5** as the web framework and **Django REST Framework (DRF) 3.15+** as the API layer.

Key packages:
- `djangorestframework-simplejwt` — JWT token management
- `django-cors-headers` — CORS for the Next.js frontend
- `django-filter` — queryset filtering on API endpoints
- `boto3` — S3 presigned URL generation
- `psycopg2-binary` — PostgreSQL adapter

---

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| FastAPI | No built-in ORM or migration system; less ecosystem maturity for this use case |
| Node.js (Express/Fastify) | Would require separate ORM setup; team has Python experience |
| Next.js API Routes (full-stack) | Tightly couples frontend and backend; harder to scale or separate later |

---

## Consequences

**Positive:**
- Battle-tested ORM with automatic migrations — no manual SQL
- Django admin is available for data inspection during development
- DRF ViewSets reduce boilerplate for CRUD operations
- Excellent PostgreSQL support via `psycopg2` and `django.contrib.postgres`

**Negative:**
- Django has a larger memory footprint than FastAPI
- Slightly more boilerplate than FastAPI for simple endpoints
- Two Docker containers required (Next.js + Django), adding minor deployment complexity

---

## References

- `03-technical-architecture.md` §3 — Full Django project structure and settings
- `09-mvp-scope.md` §5 Phase 0 — Django scaffold is the first deliverable
