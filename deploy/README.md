# Soliofit — Production Provisioning Runbook (VS-18 / ADR-0008)

One-time operator setup that the repo can't automate from CI: the GitHub repo,
the EC2 box, DNS, TLS, the S3 backup bucket, the on-box secrets, and the first
green deploy. Everything referenced here lives in this repo (`deploy/`,
`docker-compose.yml`, `.github/workflows/deploy.yml`).

**Topology (ADR-0008):** one EC2 `t3.small` (Ubuntu 22.04, `ap-south-1`) running
Docker Compose (`frontend`, `backend`, `postgres`, `redis` — **no nginx
container**). Nginx + Certbot run on the **host** and terminate TLS. CI builds
images, ships them as a tarball over SSH, and runs `docker compose up -d`.

> **On-box path:** all artifacts assume the repo lives at
> `/home/ubuntu/soliofit` (the scripts and the deploy workflow hardcode this).
> Keep that path unless you change it in `deploy/scripts/*.sh` and
> `.github/workflows/deploy.yml` together.

---

## 1. GitHub

- Create the GitHub repo and add it as `origin`:
  ```bash
  git remote add origin git@github.com:<you>/soliofit.git
  git branch -m master main
  git push -u origin main
  ```
- **Branch-protect `main`:** require PRs, and require the `backend` and
  `frontend` status checks to pass before merge.
- Repo **Variables** (Settings → Secrets and variables → Actions → *Variables*):
  - `NEXT_PUBLIC_API_URL = https://yourdomain.com`  *(baked into the frontend
    image at build time — not a secret)*
- Repo **Secrets** (same screen → *Secrets*):
  - `EC2_HOST` — the Elastic IP or domain of the box
  - `EC2_SSH_KEY` — the **private** key for `ubuntu@` (the matching public key
    goes in the instance's `~/.ssh/authorized_keys`)

> **Two distinct key pairs — don't conflate them.** `EC2_SSH_KEY` authenticates
> **GitHub Actions → EC2** (the deploy `scp`/`ssh`). It is *separate* from the
> read-only **deploy key** you create on the box in §4, which authenticates
> **EC2 → GitHub** for the initial `git clone`.

These two secrets are the *only* secrets GitHub ever sees. All app secrets live
on the box (section 4).

---

## 2. AWS

- Launch EC2 `t3.small`, Ubuntu 22.04, 30 GB gp3, region `ap-south-1`.
- Allocate an **Elastic IP** and associate it with the instance.
- **Security group** inbound:
  - `80` and `443` from anywhere (`0.0.0.0/0`) — public web traffic + Certbot's
    HTTP-01 challenge.
  - `22` (SSH) — needs a decision. The deploy workflow runs on **GitHub-hosted
    runners**, whose source IPs are ephemeral and span large, frequently-changing
    ranges. Restricting `22` to your home IP will make the deploy `scp`/`ssh`
    steps **fail**. For MVP, open `22` to `0.0.0.0/0` **with key-only SSH** — the
    SSH *key* is the access control, not the source IP. EC2 Ubuntu AMIs already
    ship with `PasswordAuthentication no`; confirm it in
    `/etc/ssh/sshd_config` and keep it off. Hardened alternatives (deferred —
    ADR-0008 Non-Goals): run a **self-hosted GitHub runner on the box** (zero
    inbound `22` needed for deploy), or use **AWS SSM Session Manager**.
- Create a **private** S3 bucket for backups. The instance (via instance role or
  an IAM user's `aws configure`) needs `s3:PutObject`, `s3:ListBucket`, and
  `s3:DeleteObject` on it. Note the bucket name for `BACKUP_BUCKET`.

---

## 3. DNS

- Point an `A` record for `yourdomain.com` at the Elastic IP. Wait for it to
  resolve (`dig +short yourdomain.com`) before running Certbot in section 4.

---

## 4. On the EC2 box

Order matters — the setup script reads the repo from `/home/ubuntu/soliofit`, so
clone first.

1. **Give the box read access to the repo, then clone it to the expected path.**
   The deploy workflow ships images as tarballs, but the box still needs the repo
   for the nginx config + scripts during setup. Use a **read-only deploy key**
   (generate on the box, register the public half in GitHub):
   ```bash
   ssh-keygen -t ed25519 -C "soliofit-ec2-deploy" -f ~/.ssh/soliofit_deploy -N ""
   cat ~/.ssh/soliofit_deploy.pub
   ```
   Add that public key in GitHub → repo **Settings → Deploy keys → Add deploy
   key** (leave **"Allow write access" unchecked** — read-only). Then clone using
   that key:
   ```bash
   GIT_SSH_COMMAND='ssh -i ~/.ssh/soliofit_deploy' \
     git clone git@github.com:<you>/soliofit.git /home/ubuntu/soliofit
   cd /home/ubuntu/soliofit
   ```
   *(A public repo can skip the deploy key and clone over HTTPS. To later pull
   updates to nginx/scripts on the box, reuse the same `GIT_SSH_COMMAND` prefix.)*

2. **Run the host setup script** (installs Docker, host Nginx, Certbot, awscli;
   installs the Nginx site config + symlink; sets the daily backup cron):
   ```bash
   bash deploy/scripts/ec2-setup.sh
   ```
   Then **log out and back in** (or `newgrp docker`) so the `docker` group
   membership takes effect for your shell.

3. **Set the domain and issue TLS:**
   ```bash
   sudo sed -i 's/YOUR_DOMAIN/yourdomain.com/' /etc/nginx/sites-available/soliofit
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d yourdomain.com
   ```
   Certbot injects the `443` server block + the 80→443 redirect and arms
   auto-renewal via its systemd timer. *(Optional hardening: add
   `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
   to the Certbot-generated 443 block — Django already emits HSTS on `/api/` and
   `/admin/`, so the domain is armed either way.)*

4. **Create the on-box secrets** (never committed to git):
   ```bash
   mkdir -p /home/ubuntu/soliofit/backend
   nano /home/ubuntu/soliofit/backend/.env
   ```
   `backend/.env` must contain (see `backend/.env.example` for the full list):
   - `DJANGO_SECRET_KEY` — a fresh 50+ char secret (**not** the dev key)
   - `DJANGO_DEBUG=False`
   - `DJANGO_ALLOWED_HOSTS=yourdomain.com`
   - `CSRF_TRUSTED_ORIGINS=https://yourdomain.com`
   - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
   - `POSTGRES_HOST=postgres`  *(the compose service name in production)*
   - `REDIS_URL=redis://redis:6379/0`
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
     `S3_BUCKET_NAME` *(media uploads)*
   - `BACKUP_BUCKET` *(the section-2 backup bucket)*
   - `EMAIL_*` *(SMTP)*, `FRONTEND_BASE_URL`, `FRONTEND_URL`

   The **frontend needs no on-box env** — `NEXT_PUBLIC_API_URL` is baked into the
   image at build (the GitHub Actions `vars.NEXT_PUBLIC_API_URL`).

---

## 5. First deploy

1. Open a PR into `main`; confirm the `backend` and `frontend` checks pass; merge.
2. The `deploy` job builds both images, `scp`s the tarball + `docker-compose.yml`
   to `/home/ubuntu/soliofit/`, takes a pre-deploy `pg_dump` (skipped with a
   warning on the very first deploy when no `postgres` container exists yet),
   `docker load`s the images, and runs `docker compose up -d`. The backend
   container runs `migrate` + `collectstatic` before Gunicorn starts.
3. Create the first admin user:
   ```bash
   cd /home/ubuntu/soliofit
   docker compose exec backend python manage.py createsuperuser
   ```

---

## 6. Verify (definition of done)

- `curl https://yourdomain.com/api/health/` → `{"status":"ok"}` over HTTPS.
- App loads over HTTPS; login works (secure cookie set); an order can be created.
- `/admin/` loads **with CSS** (WhiteNoise is serving collected static files).
- TLS auto-renew is armed: `sudo certbot renew --dry-run` succeeds.
- A pre-deploy backup exists after the deploy
  (`ls /home/ubuntu/soliofit/backups/pre-deploy-*.sql.gz`) and the daily cron is
  installed (`crontab -l | grep backup-db`).
- After 02:00 (or a manual run of `deploy/scripts/backup-db.sh`), a dump appears
  under `s3://<BACKUP_BUCKET>/postgres/`.

Once all of the above pass, **VS-18 closes → MVP is in production.**

---

## Troubleshooting quick reference

| Symptom | Likely cause / check |
|---|---|
| `502 Bad Gateway` on `/` | frontend container down — `docker compose ps`, `docker compose logs frontend` |
| `502` on `/api/` | backend not up or still migrating — `docker compose logs backend` |
| `/admin/` unstyled | `collectstatic` didn't run / WhiteNoise misconfig — check backend logs at start |
| Login fails over HTTPS | `CSRF_TRUSTED_ORIGINS` / `DJANGO_ALLOWED_HOSTS` mismatch in `backend/.env` |
| Certbot fails | DNS A-record not resolving yet, or port 80 blocked in the security group |
| Backup is empty (~20 B) | `postgres` container wasn't running at deploy — expected only on the first deploy |
| Deploy can't SSH | `EC2_HOST`/`EC2_SSH_KEY` wrong, or `22` not reachable from GitHub-hosted runners — see the §2 SG note (open `22` + key-only SSH) |
| `git clone` denied on EC2 | No read access — register the §4 read-only **deploy key** in GitHub repo Deploy keys first |
