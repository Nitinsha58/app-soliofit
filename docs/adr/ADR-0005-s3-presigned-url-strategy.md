# ADR-0005 — S3 Presigned URL Strategy with Local Stub Mode

## Status
Accepted

## Context
VS-07 (Photo Upload) requires photos to be uploaded from the browser directly to storage. Routing binary payloads through Django would add unnecessary latency and memory pressure for every upload.

Testing the full upload UX — skeleton thumbnails, retry on failure, lightbox, delete — requires a working end-to-end upload path during development, before AWS credentials are available or the S3 bucket is configured.

## Decision

**Production path:** Django generates a presigned PUT URL via boto3. The browser PUTs the file body directly to S3 (no cookies, no Django in the data path). After the PUT completes, the browser calls `POST /api/orders/{id}/photos/` to save the `s3_key` and `public_url` as an `OrderPhoto` record in Postgres.

**Development stub path:** When `S3_BUCKET_NAME` is empty in `backend/.env`, Django falls back to a local stub. The presign endpoint returns URLs constructed from `request.build_absolute_uri()`, pointing to a Django view at `PUT /api/upload/stub/{s3_key}` that writes the file body to `MEDIA_ROOT/stub/`. Django's development media server serves the file back via `MEDIA_URL`. The stub view uses `AllowAny` permission and is only registered when `DEBUG=True`.

The frontend upload code is **identical for both paths** — it PUTs to whichever URL the presign response returns.

## Consequences

- No code change needed when switching from stub to S3: set `S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in `backend/.env`.
- The stub writes files to `backend/mediafiles/` (gitignored, ephemeral in CI). Files persist locally across container restarts because the backend directory is volume-mounted.
- Production S3 bucket requires: a CORS policy allowing `PUT` from the app origin, a bucket policy restricting public access to presigned keys only, and an IAM user with `s3:PutObject` and `s3:DeleteObject` on the bucket.
- Presigned PUT URLs expire in 5 minutes — sufficient for the upload flow.
- boto3 is a lazy import: it is only imported inside the view when `S3_BUCKET_NAME` is set, so the dev stub path has no boto3 dependency at runtime.
