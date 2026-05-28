# ADR-0004 — Media Storage: S3 Presigned URLs (Direct Browser Upload)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Deciders** | Nitin |

---

## Context

Soliofit stores garment photos, notes photos, and voice note audio files. These are uploaded by the boutique operator from an iPad or mobile device. Files can be large (photos up to ~10MB, voice notes variable). The backend runs on a single EC2 instance with limited bandwidth.

---

## Decision

Use **AWS S3** for all media storage with a **presigned URL direct upload** pattern:

1. Browser requests a presigned PUT URL from Django (`POST /api/media/presign/`)
2. Django generates the URL via `boto3` (expires in 5 minutes) and returns `{ presignedUrl, s3Key, publicUrl }`
3. Browser uploads the file directly to S3 using the presigned URL
4. Browser sends `{ s3Key, publicUrl }` to Django to save the record in PostgreSQL

S3 path structure:
- `garment-photos/{uuid}.{ext}`
- `notes-photos/{uuid}.{ext}`
- `voice-notes/{uuid}.{webm|mp3}`

---

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| Upload through Django (multipart POST) | All file bytes route through EC2 — wastes bandwidth, adds latency, risks OOM on large files |
| django-storages with FileField | Still routes through Django; tightly couples file storage to Django model save |
| Cloudinary / Imgix | External SaaS dependency; per-upload cost; not needed at MVP scale |
| Local filesystem on EC2 | Not durable; lost on instance replacement; no horizontal scaling |

---

## Consequences

**Positive:**
- Zero file bytes touch the EC2 instance — upload bandwidth scales to S3's limits
- 5-minute presign expiry limits exposure if a URL leaks
- S3 durability (99.999999999%) — files survive EC2 failures
- Simple implementation: one `boto3.generate_presigned_url` call in Django

**Negative:**
- Two HTTP calls per upload (presign request + PUT to S3)
- S3 CORS must be configured on the bucket to allow browser PUT requests
- No server-side image validation or compression at upload time (deferred to post-MVP)
- Public URLs are permanent — no fine-grained access control at MVP

---

## S3 CORS Configuration Required

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["PUT"],
  "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
  "ExposeHeaders": []
}]
```

---

## References

- `03-technical-architecture.md` §8 — Full presign view implementation and upload flow diagram
