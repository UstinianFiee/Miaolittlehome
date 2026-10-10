#!/usr/bin/env bash
#
# 应用容器入口：
#   1. 校验 /data 卷可写（SQLite、媒体、软件包都在这里）
#   2. 执行 prisma migrate deploy（幂等，可重复启动）
#   3. 可选执行种子（RUN_SEED=true，仅在需要初始化时打开）
#   4. 启动 Next.js standalone 服务
#
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
DB_PATH="${DATABASE_URL:-file:$DATA_DIR/db/blog.db}"
PRISMA_CLI="/app/prisma-cli/node_modules/prisma/build/index.js"
SCHEMA="/app/prisma/schema.prisma"

log() {
  printf '[entrypoint] %s\n' "$*"
}

# ---------- 1. 数据卷检查 ----------
for dir in "$DATA_DIR/db" "$DATA_DIR/media" "$DATA_DIR/software" "$DATA_DIR/backups"; do
  if ! mkdir -p "$dir" 2>/dev/null; then
    log "无法创建目录 $dir"
    log "请先在宿主机执行：mkdir -p $DATA_DIR && chown -R 1001:1001 $DATA_DIR"
    exit 1
  fi
done

if ! touch "$DATA_DIR/.write-test" 2>/dev/null; then
  log "$DATA_DIR 不可写。请在宿主机执行：chown -R 1001:1001 $DATA_DIR"
  exit 1
fi
rm -f "$DATA_DIR/.write-test"

# ---------- 2. 数据库迁移 ----------
if [ ! -f "$PRISMA_CLI" ]; then
  log "未找到 Prisma CLI（$PRISMA_CLI），跳过迁移"
  exit 1
fi

log "执行数据库迁移：$DB_PATH"
node "$PRISMA_CLI" migrate deploy --schema "$SCHEMA"

# ---------- 3. 可选种子 ----------
if [ "${RUN_SEED:-false}" = "true" ]; then
  log "执行种子数据（RUN_SEED=true）"
  node prisma/seed.mjs
fi

# ---------- 4. 启动 ----------
log "启动应用：$*"
exec "$@"
