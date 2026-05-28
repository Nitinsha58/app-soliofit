# ADR-0005 — Deployment: EC2 Docker Dual-Container + Nginx

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Deciders** | Nitin |

---

## Context

Soliofit is a single-operator product used by one boutique. It does not need horizontal scaling, high availability, or Kubernetes at MVP. The priority is: simple to deploy, simple to maintain, easy to roll back, cheap to run.

---

## Decision

Deploy on a single **AWS EC2 instance** using **Docker Compose** with two application containers behind **Nginx** as a reverse proxy:

```
EC2 Instance
├── Nginx (port 443 / 80)
│   ├── / → Next.js container (port 3000)
│   └── /api/ → Django container (port 8000)
├── Docker: frontend (Next.js 14)
├── Docker: backend (Django + Gunicorn)
└── Docker: postgres (PostgreSQL 15)
```

CI/CD via **GitHub Actions**: on push to `main`, build both Docker images and deploy to EC2 via SSH.

---

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| Vercel (frontend) + Railway (backend) | Two separate platforms; harder to manage CORS, cookies, and env sync; cost unpredictable |
| AWS ECS / EKS | Significant operational overhead; overkill for single-operator MVP |
| Heroku | Higher cost; less control over infrastructure; not worth it at this scale |
| Single Django + Next.js in one container | Tight coupling; can't independently deploy or scale either service |
| Serverless (Lambda) | Cold starts are unacceptable for a real-time order management tool |

---

## Consequences

**Positive:**
- Full control over infrastructure; can SSH and inspect at any time
- Docker Compose makes local dev environment identical to production
- Nginx handles SSL termination, compression, and routing cleanly
- Single EC2 bill — predictable cost (~$20–30/month for `t3.small`)
- Rolling back = `git revert` + `docker compose up`

**Negative:**
- Single point of failure — EC2 downtime = app downtime (acceptable for single-operator MVP)
- No auto-scaling — must manually resize if usage grows
- SSL certificate renewal via Certbot cron (simple but manual to set up initially)
- GitHub Actions SSH deploy requires maintaining EC2 SSH key as a GitHub secret

---

## Deployment Checklist (Per Release)

1. Push to `main` branch
2. GitHub Actions builds `frontend` and `backend` Docker images
3. SSH into EC2, pull latest images, run `docker compose up -d`
4. Check `docker compose ps` and `docker compose logs` for errors
5. Verify health endpoint: `curl https://yourdomain.com/api/health/`

---

## References

- `08-devops-deployment.md` — Full Docker Compose configs, Nginx config, CI/CD pipeline, backup scripts
