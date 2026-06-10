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
