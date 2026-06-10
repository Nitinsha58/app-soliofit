# ADR-0008 — Production Deployment (Single EC2, Docker Compose, GitHub Actions)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-10 |
| **Deciders** | Nitin |
| **Slice** | VS-18 |

---

## Context

VS-18 is the last MVP slice: ship Soliofit to production. The repo currently has **dev-only** infra (`docker-compose.dev.yml`, `frontend/Dockerfile.dev`, `backend/Dockerfile.dev`), **no GitHub remote** (`git remote -v` is empty; the only branch is `master`), no CI, and no Nginx. `backend/config/settings/production.py` already exists.

The product vault `08-devops-deployment.md` is a near-complete, opinionated blueprint (single EC2 `t3.small` in `ap-south-1`, Docker Compose for frontend/backend/postgres, build-in-CI → image tarball over SSH, Let's Encrypt TLS, daily `pg_dump`→S3). This ADR **ratifies that blueprint** and resolves the gaps and self-contradictions found in it. It records the deployment architecture; the implementation plan produces the artifacts.

Two realities shape the decision:
- **Greenfield ops:** GitHub repo/remote, EC2 instance, Elastic IP, DNS, TLS cert, and the S3 backup bucket do not exist yet. Provisioning these is **operator work** (done by Nitin), distinct from the code artifacts this slice generates.
- **Three blueprint gaps** required decisions: (1) the throttle cache vs Gunicorn workers, (2) Nginx host-vs-container, (3) branch/deploy model — plus a CI gap (frontend lint is unrunnable here).

## Non-Goals (explicit)

MVP deployment only. This ADR does **not** adopt, and the slice does not build:
- A container registry (GHCR/ECR) — images ship as tarballs over SSH.
- Near-zero-downtime / blue-green deploys — a brief restart gap is accepted.
- Managed Postgres (RDS) — Postgres runs as a container on the box.
- CloudFront/CDN, SES, Sentry, autoscaling, multi-instance — all post-MVP.
- Multi-environment (staging) pipelines — single production target.

## Decision

### Topology — single EC2 (`t3.small`, Ubuntu 22.04, ap-south-1)

- **Host (not containerized):** Nginx + Certbot run on the EC2 host. Certbot's `--nginx` plugin issues and **auto-renews** TLS via its systemd timer. Nginx terminates TLS and reverse-proxies to the containers' published ports: `/api/`, `/admin/`, `/static/` → `localhost:8000`; everything else → `localhost:3000`. 80→443 redirect; `client_max_body_size 25M`; HSTS + `X-Frame-Options`/`X-Content-Type-Options`.
- **Docker Compose (prod):** `frontend` (Next.js standalone), `backend` (Gunicorn, 3 workers), `postgres:15-alpine`, `redis:alpine`. **No nginx container** — Nginx lives on the host (see decision 4).

### 1. Deploy trigger & branch policy — PR-gated `main`

Create the GitHub repo + remote; rename `master` → `main`; **branch-protect `main`**. Work on `feature/*` branches → PR into `main` → the CI gate must pass to merge → merging to `main` **auto-deploys**. One production branch; no separate `dev`.

### 2. CI gate (GitHub Actions, on PR + push to `main`)

- **Backend job:** `python manage.py test` (the existing 151+ tests) against a `postgres:15` service container with test env.
- **Frontend job:** `npm ci` → `npm run type-check` → `npm run build`.
- **Deploy job** (`needs: [backend, frontend]`, `if: ref == main`): build both prod images, ship, deploy (see decisions 5/7).

> **CI gap resolved:** the blueprint's frontend job ran `npm run lint`, but this project has **no ESLint config** — `next lint` would hit an interactive setup prompt and hang/fail CI. The lint step is **dropped**; `type-check` + `build` are the frontend gate. Re-add lint only after committing an explicit `.eslintrc.json`.

### 3. Secrets handling — `.env` on the box

Production secrets live in `.env` files **on the EC2 instance** (`backend/.env`, `frontend/.env`), never in git. Only two values are GitHub repository secrets: `EC2_HOST` and `EC2_SSH_KEY`. This decouples secret rotation from redeployment. `frontend`'s `NEXT_PUBLIC_API_URL` is a **build arg** (baked at image build), set to the production origin in the deploy workflow.

### 4. Nginx / domain / TLS — host Nginx site config

Nginx and Certbot run on the **host**, not in Compose (resolves the blueprint's contradiction, where the EC2 setup script installed host nginx+certbot yet the prod compose also defined an nginx container mounting `/etc/letsencrypt`). The generated reverse-proxy config is a **host Nginx site config** — installed at `/etc/nginx/sites-available/soliofit` and symlinked into `/etc/nginx/sites-enabled/` — **not** a Compose-mounted file. (Stated explicitly so the nginx container is never reintroduced.) TLS via Let's Encrypt; renewal is automatic through Certbot's systemd timer.

### 5. Backup & migration posture

- **Migrations:** the `backend` container runs `python manage.py migrate` before starting Gunicorn. With a single backend container there is no migrate race.
- **Pre-deploy backup:** the deploy script takes a `pg_dump` of the live database **before** `docker compose up -d` runs the new container's migrations — cheap rollback insurance per deploy.
- **Daily backup:** cron `pg_dump | gzip` → S3 at 02:00, retaining the last 14.

### 6. Cache / throttle — Redis shared cache

Gunicorn runs 3 workers; Django's default **LocMem cache is per-process**, so the password-reset throttle counter (`PasswordResetThrottle`, ADR-adjacent VS-22 control) is **not shared** across workers and is effectively ~3× looser than configured — even on one instance. Add a `redis:alpine` container and point Django `CACHES` at it, making the throttle correct across all workers and providing a real shared cache for future use.

### 7. Restart strategy — simple swap

Deploy is `docker compose up -d` (recreates changed containers) — a few seconds of downtime during the swap, acceptable for a boutique MVP. A `GET /api/health/` endpoint (DB-connectivity check → `200`/`503`) backs UptimeRobot monitoring. Blue-green / near-zero-downtime is deferred (Non-Goals).

### Image delivery — tarball over SSH (no registry)

CI builds both prod images, `docker save | gzip`, `scp` to EC2, `docker load`, then `docker compose up -d`. Free and simple for a single box; GHCR is deferred (Non-Goals).

## Consequences

**Artifacts produced by this slice (code, in-repo):**
- `frontend/Dockerfile` (multi-stage, Next.js `output: 'standalone'`) + `next.config` standalone flag.
- `backend/Dockerfile` (Gunicorn).
- `docker-compose.yml` (prod: frontend, backend, postgres, redis — no nginx).
- `deploy/nginx/soliofit.conf` — the **host** Nginx site config (installed to `sites-available`, symlinked to `sites-enabled`).
- `.github/workflows/deploy.yml` (test → build → ship → deploy; lint dropped).
- Django `CACHES` → Redis in `production.py`; confirm throttle reads it.
- `GET /api/health/` endpoint.
- Pre-deploy + daily backup scripts; EC2 setup script (host nginx+certbot+docker).
- Updated `backend/.env.example` / `frontend/.env.example` (Redis URL, prod hosts).

**Operator-provisioned (out-of-repo, by Nitin):**
- GitHub repo + remote; `main` branch protection.
- EC2 instance + Elastic IP; security groups (80/443, SSH).
- DNS A-record → Elastic IP; initial `certbot --nginx` cert issuance.
- S3 backup bucket; on-box `.env` files; GitHub secrets (`EC2_HOST`, `EC2_SSH_KEY`).

**Trade-offs accepted:** single point of failure (one EC2, co-located Postgres); brief deploy downtime; tarball transfer is slower than a registry pull but needs no registry auth. All are appropriate at boutique MVP scale and revisited post-MVP (RDS, GHCR, blue-green, Sentry).

## Alternatives Considered

- **Branch model — direct-push `main`** (push deploys, no PR gate) or **two-branch `master`→`main`**. Rejected: direct-push has no CI gate before production; two-branch adds ceremony without value for a solo dev. PR-gated `main` gives a CI gate with one production branch.
- **Throttle — Gunicorn `workers=1`** (LocMem becomes process-global) or **accept the ~3× looser throttle**. Rejected: `workers=1` caps concurrency (one slow request blocks all); accepting looseness weakens a security control. Redis is a small container that fixes correctness and adds caching headroom.
- **Nginx — containerized nginx + certbot sidecar** (all-in-compose, portable). Rejected for MVP: webroot cert renewal in containers is fiddlier than Certbot's `--nginx` host plugin, which auto-renews with no extra wiring on a single box.
- **Image delivery — GHCR/ECR registry**. Rejected for MVP: adds registry auth on the box for no benefit at one-instance scale; tarball-over-SSH is free and simple. (Deferred, not foreclosed.)
- **Database — RDS managed Postgres**. Rejected for MVP cost/simplicity; containerized Postgres with daily `pg_dump`→S3 is sufficient at boutique scale. (Deferred.)
- **Deploy — blue-green / zero-downtime cutover**. Rejected: a few seconds of restart downtime is acceptable for this audience; blue-green is disproportionate complexity now. (Deferred.)

## Future shape (not built now)
GHCR image registry · RDS managed Postgres · blue-green/zero-downtime cutover · Sentry error tracking · CloudFront for media · SES for email at volume. None are foreclosed by this design.
