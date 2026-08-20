#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${TIDC_BACKUP_ENV_FILE:-/etc/tidc-archive/backup.env}"
test -r "$ENV_FILE" || { echo "Missing protected environment file: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"
test "${ALLOW_RESTORE_TEST:-no}" = "yes" || { echo "Set ALLOW_RESTORE_TEST=yes only for an isolated restore environment." >&2; exit 1; }
test -n "${RESTORE_TEST_DATABASE:-}" && test -n "${RESTORE_TEST_BUCKET:-}" || { echo "Missing isolated restore targets." >&2; exit 1; }

LATEST="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -print | sort | tail -n 1)"
test -n "$LATEST" || { echo "No backup directory found." >&2; exit 1; }
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

sha256sum --check "${LATEST}/SHA256SUMS"
gpg --batch --decrypt "${LATEST}/database.sql.gz.gpg" | gzip -d | mysql --host="$RESTORE_DB_HOST" --port="${RESTORE_DB_PORT:-3306}" --user="$RESTORE_DB_USER" "$RESTORE_TEST_DATABASE"

gpg --batch --decrypt "${LATEST}/minio.tar.gz.gpg" | tar -xzf - -C "$WORK_DIR"
mc alias set tidc "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
mc mb --ignore-existing "tidc/${RESTORE_TEST_BUCKET}" >/dev/null
mc mirror --overwrite "${WORK_DIR}/minio" "tidc/${RESTORE_TEST_BUCKET}" >/dev/null

SOURCE_COUNT="$(find "${WORK_DIR}/minio" -type f | wc -l | tr -d ' ')"
RESTORED_COUNT="$(mc find "tidc/${RESTORE_TEST_BUCKET}" | wc -l | tr -d ' ')"
test "$SOURCE_COUNT" = "$RESTORED_COUNT" || { echo "MinIO restore count mismatch: ${SOURCE_COUNT}/${RESTORED_COUNT}" >&2; exit 1; }
echo "TIDC restore verification completed: database=${RESTORE_TEST_DATABASE}, objects=${RESTORED_COUNT}"
