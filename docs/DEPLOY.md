# 部署手册

面向 Linux 服务器：**Docker 双容器**（Next.js 应用 + Nginx 反代），
SQLite、媒体、软件包、备份全部落在宿主机 `/data` 卷。

> ⚠️ **验证状态说明**：本手册的配置文件（Dockerfile / compose / nginx / 脚本）
> 在开发机上**无法实际构建运行**——开发环境没有 Docker 与 nginx。
> 已完成的是：compose YAML 解析、nginx 与 compose 的路径一致性核对、
> 环境变量与代码逐一对照、shell 脚本语法检查、**备份脚本真实执行验证**。
> 首次部署时请按「五、首次部署核对清单」逐项确认。

---

## 一、前置要求

| 项 | 要求 |
| --- | --- |
| 服务器 | Linux x86_64，已装 Docker 24+ 与 Docker Compose v2 |
| 磁盘 | 建议 ≥ 20GB（镜像约 1GB，其余留给媒体与软件包） |
| 域名 | 已解析到服务器（用于 sitemap / canonical / HTTPS） |
| 端口 | 80 与 443 对公网开放 |

---

## 二、首次部署

### 1. 拉取代码并准备目录

```bash
git clone <你的仓库地址> /opt/blog
cd /opt/blog

# 数据卷：容器内以 uid 1001 运行，必须先把属主改过来
sudo mkdir -p /data
sudo chown -R 1001:1001 /data
```

> 不执行 `chown` 时，容器启动会打印明确提示并退出，不会静默失败。

### 2. 填写生产环境变量

```bash
cp deploy/.env.production.example .env.production
```

必改项：

```bash
# 生成随机密钥
openssl rand -base64 48      # → JWT_SECRET
openssl rand -base64 24      # → IP_HASH_SALT

# 编辑 .env.production
JWT_SECRET=<上面生成的值>
IP_HASH_SALT=<上面生成的值>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<你的强密码>
NEXT_PUBLIC_SITE_URL=https://你的域名
RUN_SEED=true                # 仅首次部署时打开
```

> `.env.production` 已在 `.gitignore` 与 `.dockerignore` 中排除，不会进仓库也不会进镜像。

### 3. 构建并启动

```bash
docker compose --env-file .env.production up -d --build
```

> **为什么必须带 `--env-file`**：构建阶段要把 `NEXT_PUBLIC_SITE_URL` 内联进产物
> （`sitemap.xml` 与 `robots.txt` 用的是它），而这个值由 compose 的插值环境文件提供，
> 默认只读项目根目录的 `.env`。不加这个参数，sitemap 里会写成 `http://localhost:3000`。
>
> **构建期还会用一个临时空库**：前台页面在构建期预渲染，需要 `DATABASE_URL` 才能跑通
> （见 `Dockerfile` 里 builder 阶段的 `prisma migrate deploy`）。空库渲染出的页面
> 由站点布局的 `revalidate = 60` 在容器启动写入真实数据后自动重新生成，无需人工干预。
>
> 部署完可以这样确认域名是否内联正确：
> `curl -s http://你的域名/sitemap.xml | head -5`

容器启动流程（`deploy/entrypoint.sh`）：

1. 校验 `/data` 及其子目录可写
2. 执行 `prisma migrate deploy`（幂等，可重复启动）
3. `RUN_SEED=true` 时写入种子数据（含管理员账号）
4. 启动 Next.js standalone 服务

查看启动日志确认无报错：

```bash
docker compose logs -f app
```

### 4. 导入示例媒体（可选）

种子数据引用了仓库自带的示例素材，而生产媒体目录在 `/data/media`，
因此需要拷贝一次（否则示例封面/音频会 404）。

**从宿主机拷贝**（容器里没有 `uploads/` 目录，不要在容器内 cp）：

```bash
sudo cp -rn uploads/demo /data/media/demo
sudo cp -rn software/demo /data/software/demo
sudo chown -R 1001:1001 /data/media /data/software
```

> 页面上看到示例内容需要最多 60 秒——前台页面走 ISR（`revalidate = 60`），
> 容器启动写入数据后会自动重新生成。

### 5. 关闭种子开关

初始化成功后，把 `.env.production` 里的 `RUN_SEED` 改回 `false`，避免每次启动重复执行：

```bash
sed -i 's/^RUN_SEED=true/RUN_SEED=false/' .env.production
docker compose up -d
```

### 6. 访问

- 前台：`http://<服务器IP>/` （会自动跳到 `/zh`）
- 后台：`http://<服务器IP>/admin` ，用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录

**登录后第一件事**：到「站点设置」把站点名称、作者、个人资料改成你自己的。

---

## 三、启用 HTTPS

1. 把证书放进 `deploy/nginx/certs/`（`fullchain.pem` + `privkey.pem`）
2. 把 `deploy/nginx/ssl.conf.example` 的内容合并进 `deploy/nginx/nginx.conf`
   （或作为独立文件挂载到 `conf.d/`）
3. 把 80 端口的 server 改成 301 跳转到 HTTPS（示例见 ssl.conf.example 末尾）
4. 重启 Nginx：

```bash
docker compose restart nginx
```

证书获取方式（Let's Encrypt / 云厂商签发 / 自签）由部署时决定，配置里只留了骨架。

---

## 四、日常运维

### 备份

`scripts/backup.sh` 把 `db` / `media` / `software` 打包为 tar.gz，
并只保留最近 12 份（对应 SPEC 的「每月备份、保留 12 份」）。

```bash
# 手动执行一次
sudo DATA_DIR=/data ./scripts/backup.sh

# 装成每月 1 号凌晨 4 点执行
sudo cp deploy/cron.d/blog-backup.example /etc/cron.d/blog-backup
sudo chmod 644 /etc/cron.d/blog-backup
```

备份产物位于 `/data/backups/blog-YYYYMMDD-HHMMSS.tar.gz`。

> 建议再把 `/data/backups` 同步到异地（对象存储 / 另一台机器），
> 单机备份无法抵御磁盘损坏。

### 恢复

```bash
docker compose down
sudo tar -xzf /data/backups/blog-YYYYMMDD-HHMMSS.tar.gz -C /data
sudo chown -R 1001:1001 /data
docker compose up -d
```

### 升级

```bash
git pull
docker compose --env-file .env.production up -d --build
```

迁移会在容器启动时自动执行。**升级前先备份**。

### 常用命令

```bash
docker compose ps                     # 状态
docker compose logs -f app            # 应用日志
docker compose logs -f nginx          # Nginx 日志
docker compose restart app            # 重启应用
docker compose exec app node -v       # 进入容器执行命令
```

---

## 五、首次部署核对清单

由于配置未经真实构建验证，首次部署请逐项确认：

- [ ] `sudo chown -R 1001:1001 /data` 已执行
- [ ] `.env.production` 中 `JWT_SECRET` / `IP_HASH_SECRET` 已改为随机值
- [ ] `NEXT_PUBLIC_SITE_URL` 是真实域名（影响 sitemap 与 canonical）
- [ ] `docker compose --env-file .env.production up -d --build` 构建成功（若 Prisma CLI 安装失败，见下方排查）
- [ ] `docker compose logs app` 中能看到「执行数据库迁移」且无报错
- [ ] 访问 `/` 能正常打开并跳转到 `/zh`
- [ ] 访问 `/admin` 能用设置的管理员账号登录
- [ ] 示例媒体已拷入 `/data/media/demo`（否则封面与音频 404）
- [ ] 后台上传一张图片 → 前台能正常显示（验证 `/data/media` 权限与 Nginx alias）
- [ ] 上传一个视频 → 进度条可拖动（验证 Nginx Range 直出）
- [ ] 评论区提交一条留言 → 后台能看到 IP 归属地（验证 `X-Forwarded-For` 传递）
- [ ] 执行一次 `scripts/backup.sh` → `/data/backups` 出现 tar.gz
- [ ] `RUN_SEED` 已改回 `false`

---

## 六、常见问题排查

### 容器启动即退出，提示 `/data 不可写`

宿主机目录属主不对。执行：

```bash
sudo chown -R 1001:1001 /data
```

### 构建阶段 `npm install prisma@6.19.3` 失败

`prisma-cli` 阶段需要联网。若服务器无法访问 npm 源，可以改用镜像内的完整
`node_modules`：把 Dockerfile 中该阶段替换为从 `deps` 阶段直接拷贝
`node_modules/prisma` 与 `node_modules/@prisma`，并注意补齐 `c12` / `deepmerge-ts` /
`empathic` 等传递依赖。

### 图片/视频 404

1. 确认 `/data/media` 下有文件：`ls -R /data/media | head`
2. 确认 Nginx 容器挂到了同一目录：`docker compose exec nginx ls /data/media`
3. 确认 `docker-compose.yml` 里 nginx 的 volumes 未被改动

### 大文件上传失败（软件包）

Nginx 的 `client_max_body_size` 与应用的 2GB 限制需同时满足。
`nginx.conf` 中已设为 `2100m`；若你改过该值，注意保持 ≥ 2000m。

### 评论里 IP 归属地一直是空

说明 `X-Forwarded-For` 没传到应用。检查 Nginx 配置中的
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` 是否还在。

### 站点名称改了但前台没变

站点名在布局层渲染，`revalidatePath` 需要用**路由模式** `/[locale]` 才能刷新布局。
代码里已按此实现（`src/lib/revalidate.ts`），若你改过这部分逻辑请注意这一点。

---

## 七、镜像与卷结构速查

```
容器 app（node:20-slim，非 root，uid 1001）
  /app                standalone 产物（server.js + 最小 node_modules）
  /app/public         静态资源（含构建期生成的 public/vditor）
  /app/prisma         schema 与迁移文件
  /app/data           ip2region 离线库
  /app/prisma-cli     Prisma CLI（仅启动时跑迁移）
  /data               挂载自宿主机
    db/blog.db        SQLite
    media/            媒体库（Nginx 直出）
    software/         软件安装包（Nginx 直出）
    backups/          备份归档

容器 nginx（nginx:1.27-alpine）
  /etc/nginx/conf.d/default.conf   ← deploy/nginx/nginx.conf
  /data/media（只读）              → alias /media/
  /data/software（只读）           → alias /software-files/
```
