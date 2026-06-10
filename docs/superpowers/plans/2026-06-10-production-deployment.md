# Production Deployment (VS-18) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Soliofit to a single EC2 box — production Docker images, prod Compose (frontend/backend/postgres/redis), host Nginx+TLS, and a PR-gated GitHub Actions deploy — per ADR-0008.

**Architecture:** Two parts. **Part A (in-repo artifacts)** — prod Dockerfiles, `production.py` (DEBUG off, Redis cache, WhiteNoise static, TLS-proxy security), prod `docker-compose.yml`, host Nginx site config, the Actions workflow, and host/backup scripts — all buildable and reviewable now. **Part B (provisioning runbook)** — the operator steps (GitHub repo, EC2, DNS, TLS, S3 bucket, secrets) that can't be automated from here; the final checkpoint is the first green production deploy.

**Tech Stack:** Django 5 + Gunicorn + WhiteNoise + django-redis, Next.js 14 standalone, PostgreSQL 15, Redis, Docker Compose, host Nginx + Certbot, GitHub Actions. Spec: `docs/adr/ADR-0008-production-deployment.md`.

> **Verification model:** Backend has a real Django test suite — run it in the dev container. Use Django's deploy checklist for settings. No frontend test framework (type-check + build only). Commands:
> - Backend tests: `docker compose -f docker-compose.dev.yml exec -T backend python manage.py test`
> - Deploy check: `docker compose -f docker-compose.dev.yml exec -T -e DJANGO_SETTINGS_MODULE=config.settings.production backend python manage.py check --deploy`
> - Image builds: `docker build -f backend/Dockerfile backend` / `docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://example.com frontend`
> - Compose validity: `docker compose -f docker-compose.yml config -q`
> - Nginx syntax: `docker run --rm -v "$PWD/deploy/nginx/soliofit.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t`
>
> **Already present (do not recreate):** `frontend/next.config.mjs` has `output: 'standalone'`; `/api/health/` exists in `backend/config/urls.py`; `SIMPLE_JWT['AUTH_COOKIE_SECURE'] = True` in base settings.

## File Structure
**Part A**
- Modify `backend/requirements.txt` — add `django-redis`, `whitenoise`.
- Rewrite `backend/config/settings/production.py` — prod overrides.
- Create `backend/Dockerfile` (prod, Gunicorn).
- Create `frontend/Dockerfile` (prod, multi-stage standalone).
- Create `docker-compose.yml` (prod: frontend, backend, postgres, redis).
- Create `deploy/nginx/soliofit.conf` — **host** Nginx site config (sites-available).
- Create `.github/workflows/deploy.yml` — test → build → ship → deploy.
- Create `deploy/scripts/backup-db.sh`, `deploy/scripts/ec2-setup.sh`.
- Modify `backend/.env.example`, `frontend/.env.example` — prod keys.

**Part B**
- Create `deploy/README.md` — operator provisioning runbook.

---

## UNIT 1 — Production Django settings (Redis + WhiteNoise + security)

### Task 1.1: Add prod dependencies
**Files:** Modify `backend/requirements.txt`

- [ ] **Step 1: Append two deps** (keep the existing lines):
```
django-redis==5.*
whitenoise==6.*
```

- [ ] **Step 2: Install into the running dev backend** (node_modules-style volume rule applies to Python too):
Run: `docker compose -f docker-compose.dev.yml exec -T backend pip install -r requirements.txt`
Expected: installs `django-redis` and `whitenoise` with no errors.

### Task 1.2: Write production settings
**Files:** Modify `backend/config/settings/production.py` (currently a stub)

- [ ] **Step 1: Replace the file** with:
```python
from .base import *  # noqa: F401, F403
from decouple import config, Csv

# ── Core ──────────────────────────────────────────────────────────────────────
DEBUG = False
ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', cast=Csv())
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', cast=Csv())

# ── Behind host Nginx terminating TLS (ADR-0008) ──────────────────────────────
# Nginx sets X-Forwarded-Proto; trust it so Django treats requests as HTTPS.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Belt-and-suspenders HTTPS: Django redirects any non-HTTPS request. No loop —
# SECURE_PROXY_SSL_HEADER is trusted and Nginx forwards X-Forwarded-Proto, and
# Nginx's port-80 block 301s to 443 (never proxies plain HTTP to Django).
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'
# (SIMPLE_JWT['AUTH_COOKIE_SECURE'] is already True in base — correct for HTTPS.)

# ── Shared cache across Gunicorn workers (ADR-0008) ───────────────────────────
# Makes the password-reset throttle correct (DRF throttling uses caches['default']).
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://redis:6379/0'),
    }
}

# ── Static: serve Django/admin assets from Gunicorn via WhiteNoise ────────────
# Nginx /static/ proxies to Django; WhiteNoise serves the collected files.
MIDDLEWARE.insert(
    MIDDLEWARE.index('django.middleware.security.SecurityMiddleware') + 1,
    'whitenoise.middleware.WhiteNoiseMiddleware',
)
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
```

- [ ] **Step 2: Run the existing test suite** (still on dev settings) to confirm nothing broke:
Run: `docker compose -f docker-compose.dev.yml exec -T backend python manage.py test`
Expected: PASS (the full suite, 151+ tests).

- [ ] **Step 3: Run Django's deploy checklist against production settings:**
Run: `docker compose -f docker-compose.dev.yml exec -T -e DJANGO_SETTINGS_MODULE=config.settings.production -e DJANGO_ALLOWED_HOSTS=example.com -e CSRF_TRUSTED_ORIGINS=https://example.com backend python manage.py check --deploy`
Expected: completes with **no `security.W*` warnings** about SSL redirect, HSTS, secure cookies, or DEBUG (WhiteNoise/Redis configs import cleanly without connecting). A `staticfiles` manifest note is fine (collectstatic runs at container start).

- [ ] **Step 4: Commit**
```bash
git add backend/requirements.txt backend/config/settings/production.py
git commit -m "feat(VS-18): production settings — Redis cache, WhiteNoise static, TLS-proxy security"
```

**✅ Unit 1 checkpoint:** prod settings harden the app; tests green; deploy check clean. Review before Unit 2.

---

## UNIT 2 — Production images + Compose

### Task 2.0: `.dockerignore` (prevent secret/cruft leak)
**Files:** Create `backend/.dockerignore`, `frontend/.dockerignore`

> **Why first:** the Dockerfiles use `COPY . .`, and Docker does NOT honor `.gitignore` — without these, the local `backend/.env` (dev secret, AWS/SMTP creds) is baked into the production image.

- [ ] **Step 1: `backend/.dockerignore`**
```
# Secrets — never bake into the image (runtime env comes from compose env_file)
.env
.env.*
!.env.example
# Python / build cruft
__pycache__/
*.py[cod]
.pytest_cache/
# Generated / local data
staticfiles/
mediafiles/
*.sqlite3
```
- [ ] **Step 2: `frontend/.dockerignore`**
```
# Secrets / local env
.env.local
.env*.local
# Deps / build output (rebuilt inside the image)
node_modules/
.next/
out/
npm-debug.log*
```
- [ ] **Step 3: Verify after the images build (Tasks 2.1/2.2):** `docker run --rm soliofit-backend:plancheck test ! -f /app/.env` → exit 0 (`.env` absent), and `test -f /app/.env.example` → present.

### Task 2.1: Backend production Dockerfile
**Files:** Create `backend/Dockerfile`

- [ ] **Step 1: Write it** (Gunicorn; migrate + collectstatic happen at container start in Compose so no build-time env is needed):
```dockerfile
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
```

- [ ] **Step 2: Verify it builds:**
Run: `docker build -f backend/Dockerfile -t soliofit-backend:plancheck backend`
Expected: builds to a final image with no errors.

### Task 2.2: Frontend production Dockerfile
**Files:** Create `frontend/Dockerfile`

- [ ] **Step 1: Write it** (multi-stage; uses the existing `output: 'standalone'`):
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Verify it builds:**
Run: `docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://example.com -t soliofit-frontend:plancheck frontend`
Expected: build completes; the `runner` stage contains `server.js`.

### Task 2.3: Production Compose
**Files:** Create `docker-compose.yml` (repo root)

- [ ] **Step 1: Write it.** Container ports bind to `127.0.0.1` only (host Nginx is the sole public ingress). `postgres` reuses `backend/.env` for its `POSTGRES_*`. The healthcheck uses `$$` so the value resolves inside the container:
```yaml
services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    env_file: ./backend/.env
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:alpine
    restart: unless-stopped
    volumes:
      - redisdata:/data

  backend:
    image: soliofit-backend:latest
    restart: unless-stopped
    env_file: ./backend/.env
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    ports:
      - "127.0.0.1:8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60"

  frontend:
    image: soliofit-frontend:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
  redisdata:
```
(`NEXT_PUBLIC_API_URL` is baked into the frontend image at build, so the runtime service needs no env.)

- [ ] **Step 2: Validate the compose file:**
Run: `docker compose -f docker-compose.yml config -q`
Expected: no output, exit 0 (valid). A warning about the images not existing locally is fine — they're built in CI.

- [ ] **Step 3: Commit**
```bash
git add backend/Dockerfile frontend/Dockerfile docker-compose.yml
git commit -m "feat(VS-18): production Dockerfiles + prod compose (frontend/backend/postgres/redis)"
```

**✅ Unit 2 checkpoint:** both images build; prod compose validates. Review before Unit 3.

---

## UNIT 3 — Host Nginx, CI/CD workflow, scripts, env templates

### Task 3.1: Host Nginx site config
**Files:** Create `deploy/nginx/soliofit.conf`

- [ ] **Step 1: Write it.** This is a **host** Nginx *site* config (installed to `/etc/nginx/sites-available/soliofit`, symlinked into `sites-enabled`) — NOT a Compose-mounted file (per ADR-0008). Provide the port-80 server block with proxy rules; `certbot --nginx` injects the 443 block + redirect during provisioning. Forwarded headers are inlined (self-contained, so `nginx -t` passes without Ubuntu's `proxy_params`):
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;   # operator replaces during provisioning

    client_max_body_size 25M;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] **Step 2: Verify Nginx accepts it:**
Run: `docker run --rm -v "$PWD/deploy/nginx/soliofit.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t`
Expected: `syntax is ok` / `test is successful`.

### Task 3.2: GitHub Actions deploy workflow
**Files:** Create `.github/workflows/deploy.yml`

- [ ] **Step 1: Write it.** Backend tests + frontend type-check/build gate every PR and push to `main`; the deploy job runs only on `main`. No lint step (no ESLint config). The deploy step takes a pre-deploy `pg_dump` before bringing up new containers:
```yaml
name: CI / Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: soliofit_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12', cache: 'pip' }
      - name: Install deps
        working-directory: backend
        run: pip install -r requirements-dev.txt
      - name: Run tests
        working-directory: backend
        env:
          DJANGO_SETTINGS_MODULE: config.settings.development
          DJANGO_SECRET_KEY: ci-secret-key-minimum-50-characters-long-padding-string
          POSTGRES_DB: soliofit_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_HOST: localhost
        run: python manage.py test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - name: Install deps
        working-directory: frontend
        run: npm ci
      - name: Type-check
        working-directory: frontend
        run: npm run type-check
      - name: Build
        working-directory: frontend
        env:
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}
        run: npm run build

  deploy:
    needs: [backend, frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build images
        run: |
          docker build -f backend/Dockerfile -t soliofit-backend:latest backend
          docker build -f frontend/Dockerfile \
            --build-arg NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL }} \
            -t soliofit-frontend:latest frontend
          docker save soliofit-backend:latest soliofit-frontend:latest | gzip > images.tar.gz
      - name: Copy images to EC2
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          source: "images.tar.gz,docker-compose.yml"
          target: "/home/ubuntu/soliofit/"
      - name: Deploy on EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ubuntu/soliofit
            set -a; . ./backend/.env; set +a
            mkdir -p backups
            docker exec $(docker ps -qf name=postgres) \
              pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "backups/pre-deploy-$(date +%F-%H%M).sql.gz" || true
            gunzip -c images.tar.gz | docker load
            docker compose up -d
            docker image prune -f
            echo "Deploy complete"
```

- [ ] **Step 2: Lint the workflow if `actionlint` is available, else syntax-review:**
Run: `command -v actionlint >/dev/null && actionlint .github/workflows/deploy.yml || python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml ok')"`
Expected: `yaml ok` (or actionlint clean).

### Task 3.3: Host + backup scripts
**Files:** Create `deploy/scripts/ec2-setup.sh`, `deploy/scripts/backup-db.sh`

- [ ] **Step 1: `deploy/scripts/ec2-setup.sh`** (one-time host prep — Docker, host Nginx, Certbot, dirs, daily backup cron):
```bash
#!/usr/bin/env bash
set -euo pipefail

# Docker + Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
sudo apt-get install -y docker-compose-plugin

# Host Nginx + Certbot (TLS on the host, not in Compose — ADR-0008)
sudo apt-get install -y nginx certbot python3-certbot-nginx awscli

# App + backup dirs
mkdir -p /home/ubuntu/soliofit /home/ubuntu/backups

# Install the Nginx site config (operator edits server_name, then runs certbot --nginx)
sudo cp /home/ubuntu/soliofit/deploy/nginx/soliofit.conf /etc/nginx/sites-available/soliofit
sudo ln -sf /etc/nginx/sites-available/soliofit /etc/nginx/sites-enabled/soliofit
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Daily DB backup at 02:00
( crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/soliofit/deploy/scripts/backup-db.sh >> /var/log/soliofit-backup.log 2>&1" ) | crontab -

echo "EC2 setup complete. Next: edit server_name in the nginx site, run 'sudo certbot --nginx', add backend/.env + frontend env, then push to main."
```

- [ ] **Step 2: `deploy/scripts/backup-db.sh`** (daily `pg_dump`→S3, keep 14):
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/soliofit
set -a; . ./backend/.env; set +a

STAMP="$(date +%F)"
FILE="/tmp/soliofit-backup-${STAMP}.sql.gz"
docker exec "$(docker ps -qf name=postgres)" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"
aws s3 cp "$FILE" "s3://${BACKUP_BUCKET}/postgres/"
rm -f "$FILE"
# Retain the latest 14
aws s3 ls "s3://${BACKUP_BUCKET}/postgres/" | sort | head -n -14 | awk '{print $4}' \
  | xargs -I {} aws s3 rm "s3://${BACKUP_BUCKET}/postgres/{}"
```

- [ ] **Step 3: Make them executable + shellcheck if available:**
Run: `chmod +x deploy/scripts/*.sh && (command -v shellcheck >/dev/null && shellcheck deploy/scripts/*.sh || echo "shellcheck not installed — skip")`
Expected: executable bits set; shellcheck clean or skipped.

### Task 3.4: Env templates
**Files:** Modify `backend/.env.example`, `frontend/.env.example`

- [ ] **Step 1: Append prod keys to `backend/.env.example`** (keep existing keys; these document what the on-box `.env` needs):
```
# ── Production (VS-18 / ADR-0008) ─────────────────────────────────────────────
# DJANGO_DEBUG=False
# DJANGO_ALLOWED_HOSTS=yourdomain.com
# CSRF_TRUSTED_ORIGINS=https://yourdomain.com
# POSTGRES_HOST=postgres            # the compose service name in production
# REDIS_URL=redis://redis:6379/0
# BACKUP_BUCKET=your-s3-backup-bucket
```

- [ ] **Step 2: Append to `frontend/.env.example`:**
```
# Production: baked into the image at build (GitHub Actions build-arg), e.g.
# NEXT_PUBLIC_API_URL=https://yourdomain.com
```

- [ ] **Step 3: Commit**
```bash
git add deploy/nginx/soliofit.conf .github/workflows/deploy.yml deploy/scripts backend/.env.example frontend/.env.example
git commit -m "feat(VS-18): host nginx config, CI/deploy workflow, EC2/backup scripts, env templates"
```

**✅ Unit 3 checkpoint:** Nginx config valid; workflow + scripts in place. Review before Part B.

---

## UNIT 4 (Part B) — Provisioning runbook + first green deploy

### Task 4.1: Operator runbook
**Files:** Create `deploy/README.md`

- [ ] **Step 1: Write the runbook** (the steps that cannot be automated from the repo; ordering matters):
```markdown
# Soliofit — Production Provisioning Runbook (VS-18 / ADR-0008)

One-time operator setup. Artifacts referenced live in this repo.

## 1. GitHub
- Create the GitHub repo; add it as `origin`. Rename the local branch: `git branch -m master main && git push -u origin main`.
- Branch-protect `main`: require the `backend` and `frontend` checks to pass; require PRs.
- Repo **Variables**: `NEXT_PUBLIC_API_URL = https://yourdomain.com`.
- Repo **Secrets**: `EC2_HOST` (Elastic IP/domain), `EC2_SSH_KEY` (private key for `ubuntu@`).

## 2. AWS
- Launch EC2 `t3.small`, Ubuntu 22.04, 30GB gp3, region `ap-south-1`. Attach an Elastic IP.
- Security group: inbound 80, 443, and 22 (SSH from your IP only).
- Create the S3 backup bucket (private); ensure the instance/user can `s3:PutObject`/`ListBucket`/`DeleteObject` on it.

## 3. DNS
- Point an A-record for `yourdomain.com` at the Elastic IP.

## 4. On the EC2 box
- `git clone` the repo to `/home/ubuntu/soliofit` (or let the first deploy scp `docker-compose.yml`; the scripts need the repo for nginx/scripts).
- Run `deploy/scripts/ec2-setup.sh` (installs Docker, host Nginx, Certbot; installs the site config; sets the backup cron).
- Edit `server_name` in `/etc/nginx/sites-available/soliofit`, then `sudo certbot --nginx` to issue + auto-renew TLS (it injects the 443 block + redirect).
- Create the on-box env files (NOT in git):
  - `backend/.env` — `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `POSTGRES_DB/USER/PASSWORD`, `POSTGRES_HOST=postgres`, `REDIS_URL=redis://redis:6379/0`, `AWS_*`, `S3_BUCKET_NAME`, `BACKUP_BUCKET`, `EMAIL_*`, `FRONTEND_BASE_URL`, `FRONTEND_URL`.
  - (frontend needs no on-box env — `NEXT_PUBLIC_API_URL` is baked at build.)

## 5. First deploy
- Open a PR into `main`; confirm `backend` + `frontend` checks pass; merge.
- The `deploy` job builds images, scps them, and runs `docker compose up -d` (migrations + collectstatic run on backend start).
- Create the first admin: `docker compose exec backend python manage.py createsuperuser`.

## 6. Verify (definition of done)
- `curl https://yourdomain.com/api/health/` → `{"status":"ok"}`.
- App loads over HTTPS; login works (secure cookie); an order can be created.
- `/admin/` loads with styling (WhiteNoise serving static).
- TLS auto-renew armed: `sudo certbot renew --dry-run` succeeds.
- A `backups/pre-deploy-*.sql.gz` exists after the deploy; daily cron present (`crontab -l`).
```

- [ ] **Step 2: Commit**
```bash
git add deploy/README.md
git commit -m "docs(VS-18): production provisioning runbook"
```

### Task 4.2: First green deploy (operator-gated final checkpoint)
- [ ] **Step 1:** Operator completes the runbook (sections 1–5). This is manual and external to the repo.
- [ ] **Step 2: Confirm the definition-of-done** (runbook §6): health endpoint `200`, HTTPS login, admin static styled, `certbot renew --dry-run` ok, backup present.
- [ ] **Step 3:** Once green, VS-18 closes → **MVP complete**. Run the post-change wrap (CRG + Active Window close + mnemon) and update vault `08-devops-deployment.md` to reflect the as-built decisions (host nginx, Redis, no nginx container).

---

## Notes for the executor
- Units 1–3 (Part A) are fully verifiable in this environment and should be implemented + reviewed now.
- Unit 4 Task 4.2 (first deploy) is **blocked on operator provisioning** — do not mark it done until the operator confirms the runbook is complete and the definition-of-done passes.
- Several `manage.py check --deploy` warnings about `SECRET_KEY` strength may appear when run with the dev secret; those clear under the real production secret and are not a Part-A blocker.
