# 生产镜像：Next.js standalone 输出 + Prisma CLI（仅用于启动时执行 migrate deploy）
#
# 设计要点：
# - 运行阶段只带 standalone 产物，不带完整 node_modules；
#   Prisma CLI 单独装在一个隔离目录，避免污染 standalone 的依赖树
# - SQLite / 媒体 / 软件包 / 备份全部落在 /data 卷（compose 里挂载）
# - 媒体与安装包在生产由 Nginx alias 直出，不经过应用
# - **系统依赖只在 base 阶段装一次**，其余阶段全部继承（见下方说明）

# ---------- 公共基础：系统依赖只装一次 ----------
#
# 之前 deps / builder / prisma-cli / runner 四个阶段各自跑了一遍
# `apt-get update && apt-get install openssl ca-certificates`。
# Debian 官方源在国内经常单次要 5–15 分钟，四次叠加就是半小时以上。
# 现在统一从这个 stage 继承，apt 只跑一次；四层镜像共享同一批 layer，不会重复下载。
#
# 另外两个提速手段：
#   1) 换国内镜像源（默认阿里云）。官方源更快时用
#      `--build-arg APT_MIRROR=deb.debian.org` 覆盖；腾讯云内网机器可用
#      `mirrors.tencentyun.com`（走内网，最快）。
#   2) apt 的 lists / 缓存挂成 BuildKit cache mount：不写进镜像层（体积不变），
#      重建时直接命中缓存，不再联网。
FROM node:20-slim AS base

ARG APT_MIRROR=mirrors.aliyun.com

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    set -eux; \
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources; do \
      [ -f "$f" ] || continue; \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" "$f"; \
    done; \
    apt-get update; \
    apt-get install -y --no-install-recommends openssl ca-certificates

# ---------- 依赖 ----------
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# npm 缓存同样挂成 cache mount：重建时不必重新下载依赖包
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- 构建 ----------
FROM base AS builder
WORKDIR /app

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
FROM base AS prisma-cli
WORKDIR /cli

# 版本与 package.json 中的 prisma 保持一致
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm npm install --no-save --omit=dev prisma@6.19.3

# ---------- 运行 ----------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 系统依赖已由 base 提供，这里只建运行用户
RUN groupadd --system --gid 1001 nodejs \
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
