# 生产镜像：Next.js standalone 输出 + Prisma CLI（仅用于启动时执行 migrate deploy）
#
# 设计要点：
# - 运行阶段只带 standalone 产物，不带完整 node_modules；
#   Prisma CLI 单独装在一个隔离目录，避免污染 standalone 的依赖树
# - SQLite / 媒体 / 软件包 / 备份全部落在 /data 卷（compose 里挂载）
# - 媒体与安装包在生产由 Nginx alias 直出，不经过应用

# ---------- 依赖 ----------
FROM node:20-slim AS deps
WORKDIR /app

# Prisma 需要 openssl；构建期装一次即可
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------- 构建 ----------
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client；npm run build 的 prebuild 会顺带同步 Vditor 资源
RUN npx prisma generate && npm run build

# ---------- Prisma CLI（独立目录，供 entrypoint 执行迁移） ----------
FROM node:20-slim AS prisma-cli
WORKDIR /cli

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 版本与 package.json 中的 prisma 保持一致
COPY package.json ./
RUN npm install --no-save --omit=dev prisma@6.19.3

# ---------- 运行 ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 产物（含 server.js、最小 node_modules、messages）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 静态资源与 public（含构建期生成的 public/vditor）
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# 迁移文件、schema 与种子脚本
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# ip2region 离线库（随仓库自带）
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

# Prisma CLI
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./prisma-cli/node_modules

COPY --chown=nextjs:nodejs deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
