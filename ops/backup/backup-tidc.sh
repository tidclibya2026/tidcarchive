#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${TIDC_BACKUP_ENV_FILE:-/etc/tidc-archive/backup.env}"
test -r "$ENV_FILE" || { echo "Missing protected environment file: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"

required=(MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MINIO_ENDPOINT MINIO_ACCESS_KEY MINIO_SECRET_KEY MINIO_BUCKET BACKUP_ROOT BACKUP_GPG_RECIPIENT OFFSITE_RCLONE_REMOTE)
for key in "${required[@]}"; do test -n "${!key:-}" || { echo "Missing $key" >&2; exit 1; }; done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d)"
DEST_DIR="${BACKUP_ROOT}/${STAMP}"
mkdir -p "$DEST_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

export MYSQL_PWD="$MYSQL_PASSWORD"
mysqldump --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" --user="$MYSQL_USER" --single-transaction --routines --events --databases "$MYSQL_DATABASE" | gzip -9 | gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" > "${DEST_DIR}/database.sql.gz.gpg"

mc alias set tidc "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
mc mirror --overwrite "tidc/${MINIO_BUCKET}" "${WORK_DIR}/minio" >/dev/null
tar -C "$WORK_DIR" -czf - minio | gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" > "${DEST_DIR}/minio.tar.gz.gpg"

sha256sum "${DEST_DIR}"/*.gpg > "${DEST_DIR}/SHA256SUMS"
printf 'created_at=%s\nminio_bucket=%s\n' "$STAMP" "$MINIO_BUCKET" > "${DEST_DIR}/manifest.txt"
rclone copy --checksum "$DEST_DIR" "${OFFSITE_RCLONE_REMOTE%/}/${STAMP}"

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS:-90}" -exec rm -rf {} +
echo "TIDC backup completed: $DEST_DIR"
