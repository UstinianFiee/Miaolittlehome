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

# 构建期需要两样东西，缺一 next build 就会失败或产出错误内容：
#
# 1) DATABASE_URL —— 前台页面在构建期预渲染，会调用 Prisma 取数据，
#    没有这个变量会直接报 "Environment variable not found: DATABASE_URL"。
#    容器里没有生产数据库（它由 entrypoint 在首次启动时才创建），
#    所以这里用一次性的 SQLite 文件跑一遍迁移，只求表结构存在。
#    空库渲染出来的页面由站点布局里的 `revalidate = 60` 在容器启动后自动重新生成。
#    注意：DATABASE_URL 不会被打包进产物（实测确认），运行时仍读容器的环境变量。
# 2) NEXT_PUBLIC_SITE_URL —— NEXT_PUBLIC_* 会被内联进产物，
#    sitemap.xml / robots.txt 依赖它，所以必须在构建期就传进来。
#    值由 docker-compose.yml 的 build.args 提供。
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV DATABASE_URL=file:/tmp/build.db

RUN npx prisma migrate deploy --schema prisma/schema.prisma

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
