#!/usr/bin/env bash
#
# 数据备份：把 SQLite 数据库、媒体库、软件包打包成 tar.gz，并只保留最近 N 份。
# docs/SPEC.md：每月备份、保留 12 份。
#
# 用法：
#   sudo DATA_DIR=/data ./scripts/backup.sh
#
# 建议由宿主机 cron 每月执行一次，例如 /etc/cron.d/blog-backup：
#   0 4 1 * * root DATA_DIR=/data /opt/blog/scripts/backup.sh >> /var/log/blog-backup.log 2>&1
#
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
KEEP="${BACKUP_KEEP:-12}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/blog-$STAMP.tar.gz"

log() {
  printf '[backup] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

if [ ! -d "$DATA_DIR" ]; then
  log "数据目录不存在：$DATA_DIR"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# 只打包实际存在的子目录，避免因缺目录导致 tar 失败
INCLUDES=()
for dir in db media software; do
  if [ -d "$DATA_DIR/$dir" ]; then
    INCLUDES+=("$dir")
  fi
done

if [ "${#INCLUDES[@]}" -eq 0 ]; then
  log "$DATA_DIR 下没有可备份的目录（db / media / software）"
  exit 1
fi

log "开始备份 ${INCLUDES[*]} → $ARCHIVE"

# 排除备份目录自身、分片上传临时目录与 SQLite 的临时文件
tar \
  --exclude='backups' \
  --exclude='.tmp' \
  --exclude='*.db-journal' \
  --exclude='*.db-wal' \
  --exclude='*.db-shm' \
  -czf "$ARCHIVE" \
  -C "$DATA_DIR" "${INCLUDES[@]}"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
log "备份完成：$ARCHIVE（$SIZE）"

# 只保留最近 KEEP 份
if [ "$KEEP" -gt 0 ]; then
  # shellcheck disable=SC2012
  OLD="$(ls -1t "$BACKUP_DIR"/blog-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)"
  if [ -n "$OLD" ]; then
    echo "$OLD" | while IFS= read -r file; do
      rm -f "$file"
      log "清理旧备份：$file"
    done
  fi
fi

REMAIN="$(ls -1 "$BACKUP_DIR"/blog-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')"
log "当前保留备份：$REMAIN 份（上限 $KEEP）"
