# 部署手册（详细）

面向 Linux 服务器：Docker 双容器（Next.js 应用 + Nginx 反代）。首次部署见 [极简部署手册](./部署手册.md)，保留文章、评论、媒体和设置升级见 [更新手册](./更新手册.md)。

> 验证边界：文档与仓库实现已作静态核对，不代表已经在生产服务器构建、迁移或恢复成功。本次文档修订未执行服务器命令、访问生产密钥或数据库。上线前须在自己的环境验收；归档命令成功不等于备份具备可恢复性。

## 一、前置要求与数据位置

- Linux 服务器，已安装 Git、Docker 与 Docker Compose v2；升级检查还需 Bash、Python 3、GNU tar、realpath 和 sudo。
- 80 / 443 端口按访问方式开放；HTTPS 域名需解析并准备有效证书。
- 留足镜像、完整数据备份及隔离恢复副本的空间，不在数据目录里生成升级备份。

生产数据库为容器内 `file:/data/db/blog.db`。文章、评论、设置、管理员等存在数据库中；媒体与软件包是独立文件，**必须与数据库一起保留**。

| 位置 | 含义 |
| --- | --- |
| 原 `.env.production` 的 `DATA_DIR`（未设置时默认 `/data`） | 宿主机数据目录，现有站点不得擅自改动 |
| Compose 的 `${DATA_DIR:-/data}:/data` | 将宿主机目录绑定到 app 的 `/data` |
| Compose 的 `app.environment.DATA_DIR: /data` | 容器内固定路径，覆盖 env_file 的同名变量，不要回退 |
| `db/blog.db` 及存在的 `-wal` / `-shm` / journal | 数据库及配套状态文件，不可只备份主文件 |
| `media/`、`software/` | 媒体与软件安装包，Nginx 只读直出 |
| `backups/` | 应用导出包、导入暂存及自动快照，不等于独立灾备 |

自定义宿主路径仅在**全新部署前**规划，目录属主须为 `1001:1001`；容器内部仍使用 `/data`。旧站点以原 app 的实际 Mounts 为准，不能根据模板或默认值猜位置。当前简化流程不处理命名卷、容器层数据、挂载改变或数据迁移。

## 二、首次部署

仅限全新空库。以下命令在同一 Linux Bash 会话执行，失败即停止；已有站点跳到 [更新手册](./更新手册.md)。

### 1. 拉取代码并准备专用目录

```bash
set -euo pipefail
git clone https://github.com/UstinianFiee/Miaolittlehome.git blog
cd blog
sudo mkdir -p /data
DATA_CONTENTS="$(sudo ls -A /data)"
test -z "$DATA_CONTENTS"  # 已有内容就停止，不删除、不覆盖
sudo chown 1001:1001 /data
```

上例只适用于新建专用 `/data`。不要对其他服务正在使用的目录递归改属主；采用其他宿主路径时，首次启动前在配置中填写其绝对路径，并对应调整准备目录的命令。

### 2. 填写生产环境变量

```bash
umask 077
test ! -e .env.production
cp deploy/.env.production.example .env.production
chmod 600 .env.production
openssl rand -base64 48  # 用于 JWT_SECRET
openssl rand -base64 24  # 用于 IP_HASH_SALT
```

在编辑器中修改新建的 `.env.production`，不要把下面的配置示意当 Shell 命令执行：

```dotenv
JWT_SECRET=填写第一条随机输出
IP_HASH_SALT=填写第二条随机输出
ADMIN_USERNAME=admin
ADMIN_PASSWORD=填写你的强密码
NEXT_PUBLIC_SITE_URL=http://服务器IP
RUN_SEED=true
```

- `NEXT_PUBLIC_SITE_URL` 填真实访问地址；仅 HTTP 时不要填写尚未启用的 HTTPS。启用 HTTPS 后更新地址并重新构建。
- `RUN_SEED=true` **仅用于全新空库初始化**。`prisma/seed.mjs` 会更新已有管理员密码、部分站点设置与同名示例文章等内容，不是“只补缺失记录”；升级、恢复一律为 `false`。
- 生产配置含密钥，不提交、不公开、不随意打印；已有配置绝不用模板覆盖。不要通过 `source .env.production` 执行配置。
- Compose 的插值可能被当前 Shell 环境覆盖；始终使用原项目目录与调用环境，检查挂载解析结果，不能仅凭文件里有正确值就认定实际生效。

### 3. 构建并启动

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=80 app
```

所有 Compose 命令显式带 `--env-file .env.production`。其中 `NEXT_PUBLIC_SITE_URL` 通过 build args 内联到产物；只改配置或重启不会更新已有构建产物。

Dockerfile 构建期用临时空库准备页面，不是生产数据库。运行期入口依次检查 `/data` 可写、执行 `prisma migrate deploy`、按开关执行 seed、启动应用。**迁移可改变生产数据库结构；不能因为数据卷仍在就承诺升级绝不丢数据。**

### 4. 关闭初始化开关，再修改站点内容

访问 `/admin`，确认用配置中的管理员账号能够登录、初始化无报错后，在原 `.env.production` 中将 `RUN_SEED` 改为 `false`，再执行：

```bash
docker compose --env-file .env.production up -d --no-deps app
docker compose --env-file .env.production restart nginx
```

重建 app 后让 Nginx 重新解析其地址。确认开关关闭后再编辑个人资料、站点设置及文章；不要只改文件后使用 `restart app`，那不会重新加载容器环境。

### 5. 可选示例媒体

种子记录引用仓库中的示例素材，容器不会自动把它们复制到媒体卷。仅全新部署使用默认 `/data`、且目标 demo 目录不存在时，可从宿主机复制：

```bash
sudo test ! -e /data/media/demo
sudo test ! -e /data/software/demo
sudo cp -a uploads/demo /data/media/demo
sudo cp -a software/demo /data/software/demo
sudo chown -R 1001:1001 /data/media/demo /data/software/demo
```

自定义路径按已确认的宿主目录调整。文件或目标状态不符就停止；这不是升级步骤，不覆盖自己的媒体。

## 三、启用 HTTPS

1. 将证书放进 `deploy/nginx/certs/`（`fullchain.pem`、`privkey.pem`），私钥只授予必要读取权限，不能提交。证书若是符号链接，还须确认容器内能解析到目标；宿主机可读不代表容器可读。
2. 把 `deploy/nginx/ssl.conf.example` 的配置合并进 `deploy/nginx/nginx.conf`，设置正确域名和证书路径，并将 HTTP 转向 HTTPS。保留原生产定制，不直接覆盖。
3. 原 `.env.production` 的 `NEXT_PUBLIC_SITE_URL` 改为真实 HTTPS 地址，保持 `RUN_SEED=false`。
4. 验证配置并重新构建应用、重建反代：

```bash
docker compose --env-file .env.production exec nginx nginx -t
docker compose --env-file .env.production up -d --build app
docker compose --env-file .env.production up -d --no-deps --force-recreate nginx
docker compose --env-file .env.production ps
```

HTTP 登录异常时检查 `SESSION_COOKIE_SECURE`：纯 HTTP 不应强制为 `true`；模板默认按请求协议判断。编辑原配置后用 `up -d` 应用，不重跑 seed。

## 四、备份、升级与恢复

### 冷备份是本手册的安全基线

**现有 `scripts/backup.sh` 不可作为可靠在线备份。** 它直接打包正在使用的文件，且排除 `*.db-wal`、`*.db-shm`、journal，没有创建一致性快照；默认归档也在数据目录内部。即使产出了 tar.gz 或过去运行未报错，也不能据此认定数据库可恢复。这里不修改脚本，且不再推荐直接安装旧 cron 示例。

SQLite 的 WAL 可能含已提交但尚未写回主文件的数据。关闭所有写入者后复制**完整真实数据目录**；存在的 WAL / SHM / journal 都保留，不手工删除、不排除。在线逐个复制数据库与 WAL 也不保证同一时点一致性。确需不停机备份时须另行验证 SQLite 一致性备份方案，并协调媒体、软件文件的一致性，不套用本流程。

按照 [更新手册第 1、2 步](./更新手册.md) 核对 Mounts、关 seed、停 app 与 Nginx、验证停止状态，再冷备份。日常备份做到第 2 步即可；不拉代码，确认配置无变化、备份检查通过后重新启动并验收原版本。需同时暂停宿主定时任务、自动部署和其他写库进程，不能只停一个容器却留下其他写入者。

完整检查点包括：

| 备份文件 | 用途 |
| --- | --- |
| `data.tar.gz` | 整个真实数据目录，含存在的 SQLite 状态文件、媒体、软件及应用备份目录 |
| `config.tar.gz` | `.env.production`、原 `docker-compose.yml`、整个 `deploy/nginx`（含证书目标内容） |
| `REVISION`、`code.tar`、`local.patch` | 升级前提交、源代码与未提交差异；未跟踪的部署文件需另行处理后才能继续 |
| `app-image-id`、`images.tar` | 旧 app 镜像标识及 app / Nginx 镜像归档，避免仅依赖可变标签重建旧环境 |
| `paths` | 原项目和真实数据绝对路径 |

使用外部 Nginx、外部证书目录或其他编排文件时，简化流程应停止，补齐实际配置与证书备份后再制定步骤。所有备份放在数据和项目目录外：父目录及每次备份目录为 `700`，归档文件 `600`；密钥、私钥、数据库及日志不得公开。`tar -h` 仅用于配置归档以收集证书链接目标，**不要对数据归档随意启用解引用**；数据存在外链时另行确认范围。

备份应另有受控、加密的异机副本；定期在隔离目录做恢复演练，再决定保留和清理策略。不要把唯一可用检查点自动删除，也不要在升级验收前清理旧镜像。

### 保留数据升级

完整可执行流程见 [更新手册](./更新手册.md)，顺序为：核对旧容器实际挂载 → 保留原路径和配置并关闭 seed → 停机冷备份 → `git pull --ff-only` → 再核对挂载与生产配置 → 构建、迁移并验收。

遇到冲突、分支分叉或文件覆盖提示就停止，手工合并确认；不使用 `git reset`、`git stash` 隐藏问题，不删除项目重新部署。**绝不使用 `down` 的 `-v` 选项，也不删除真实数据目录。**

<a id="rollback"></a>

### 配套回滚与恢复

**必须恢复同一检查点的代码 / 镜像 + 完整数据 + 生产配置 / Nginx / 证书。** 单独回退 Git 不能撤销已执行的数据库迁移，不能让旧代码直接连接迁移后的库。恢复检查点也会回退检查点之后的文章、评论和上传；这些内容应留在失败现场，后续人工核对，不能盲目合并数据库文件。

以下是受控恢复顺序，**不是向原目录直接解压的“一键恢复”**：

1. **停止服务并保全失败现场。** 在原项目目录停止 app 和 Nginx，确认它们已停止且所有写入任务暂停。另建独立、权限 `700` 的失败现场目录（不能复用升级前备份目录）；按冷备份方法保存此时的完整数据（含 WAL）、当前生产配置、Nginx/证书、Git 版本与差异、镜像 ID 及日志。日志只存私有文件，不公开；容器或 Compose 配置异常无法确认停止时，先由管理员定位实际容器，不能继续恢复。

   ```bash
   docker compose --env-file .env.production stop app nginx
   docker compose --env-file .env.production ps -a
   ```

2. **选择一个已完成且可验证的升级前检查点。** 对照 `REVISION`、`paths`、镜像记录和备份时间，确认各文件属于同次冷备份；校验归档、权限和可用空间。不要混用旧数据库、新媒体或其他版本的配置；旧的在线 `backup.sh` 产物若缺 WAL，不能承诺可恢复，应保留现场并先单独验证。

3. **只向隔离的新目录解包。** 将下面 `BACKUP` 改成真实检查点绝对路径，不能照抄示例占位。`STAGE` 必须位于数据与项目目录外；任何路径重合、证书缺失、外部挂载或归档损坏都停止。命令仅创建隔离副本，绝不解压到原 `/data` 或原项目。

   ```bash
   set -euo pipefail
   umask 077
   BACKUP=/var/backups/miaolittlehome/填写真实检查点目录
   sudo test -f "$BACKUP/data.tar.gz"
   sudo test -f "$BACKUP/config.tar.gz"
   sudo test -f "$BACKUP/code.tar"
   STAGE="$(sudo mktemp -d /var/backups/miaolittlehome/restore-XXXXXXXX)"
   sudo mkdir -m 700 "$STAGE/data" "$STAGE/project"
   sudo tar -xzf "$BACKUP/data.tar.gz" -C "$STAGE/data"
   sudo tar -xf "$BACKUP/code.tar" -C "$STAGE/project"
   sudo tar -xzf "$BACKUP/config.tar.gz" -C "$STAGE/project"
   sudo chmod 600 "$STAGE/project/.env.production"
   ```

4. **核验副本，不连接原库。** 对恢复副本做 SQLite 完整性检查（保留配套 WAL），核对媒体、文章、评论、设置以及管理员数据。审核 `local.patch`，仅恢复需要的旧定制，不对已从 `config.tar.gz` 恢复的文件重复打补丁。使用 `images.tar` 中保存的旧镜像并按 `app-image-id` 核对实际 ID；不能凭 `blog-app:latest` 标签认定是旧版本。若旧源代码需重建，应先在隔离环境验证兼容性，不能当作原镜像的等价替代。

5. **停机后由管理员切换整套检查点。** 保持原项目路径、Compose 项目名及原 `DATA_DIR`。先把失败数据目录整体隔离保存，再将已验证的数据副本放回原路径；原项目中的失败代码与配置也先另存，再按记录恢复旧提交和配套生产配置，保留 `.git` 与原项目身份，不直接覆盖删除。不要把 tar 解压到仍有失败数据库或陈旧 WAL 的目录。原数据目录如果是独立磁盘挂载点、含子挂载或符号链接，不能用目录重命名/覆盖套用，须按挂载拓扑安排卷级恢复。本手册不提供可能覆盖活库的自动切换命令。

6. **复核后再启动。** 确认容器内路径仍为 `/data`、挂载源仍是原真实目录、`RUN_SEED=false`、恢复的数据允许 `1001:1001` 访问，且配置和私钥权限正确。若旧提交早于 `app.environment.DATA_DIR: /data` 修复，回滚时仍须保留这一覆盖，不能把宿主路径传入入口脚本。先启动恢复的旧 app 镜像并检查健康及迁移日志，再重建 Nginx 以刷新上游地址；独立验收文章、评论、媒体和设置后才恢复公网写入及定时任务。整个过程中保留升级前备份和失败现场，不清理它们。

### 常用只读检查

在原项目根目录执行；分享日志前删除敏感信息，不粘贴完整环境配置。

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=80 app
docker compose --env-file .env.production logs --tail=80 nginx
docker compose --env-file .env.production exec app node -v
```

## 五、部署验收清单

- [ ] 挂载源是预期的真实目录；app 内 `DATA_DIR=/data`，数据库与媒体都在该挂载下。
- [ ] 新站点初始化前确为空目录；原站点没有重新执行 seed。
- [ ] 原生产配置安全保存，`JWT_SECRET` / `IP_HASH_SALT` 为随机值，管理员为强密码。
- [ ] `NEXT_PUBLIC_SITE_URL` 是真实访问地址，构建后核对 sitemap 与 canonical。
- [ ] app 健康、日志中迁移成功且无异常；Nginx 配置检查通过。
- [ ] 前台与 `/admin` 可用，文章、评论、媒体、软件和设置与预期一致。
- [ ] 新站点后台上传图片可展示；视频可读取并拖动进度，评论可提交和审核。
- [ ] `RUN_SEED=false` 已通过重建 app 生效，不能只改文件不应用。
- [ ] 已做完整冷备份，保存同一检查点的代码、数据、配置与证书，并安排隔离恢复演练。

## 六、常见问题排查

### 容器提示 `/data` 不可写

先核对旧容器 Mounts 和配置解析源，排除挂错目录；只对已确认的专用真实数据目录修正 `1001:1001` 访问权限。不要为了能启动而创建另一个空目录，也不要盲目递归修改宿主 `/data`。

### 升级后文章、评论或设置为空

停止 app，避免向错误目录继续写入。按更新手册比对旧挂载记录、原 `DATA_DIR` 与数据库实际路径，不重跑 seed，不删除旧目录、不重建空库。需要恢复时按 [配套回滚](#rollback) 执行。

### 构建阶段 Prisma 安装失败

当前 Dockerfile 在 `deps` 阶段安装 Prisma CLI。检查构建日志、网络及原配置中的软件源；不要临时拼装 CLI 依赖或直接修改生产数据库。解决构建问题后再按原流程继续。

### 图片或视频 404

先确认文件实际存在于已核对的宿主数据目录；检查 Nginx 的只读挂载指向同一目录，再检查 alias 和生产配置。不要上传同名文件覆盖旧媒体以掩盖路径问题。

```bash
docker compose --env-file .env.production exec nginx ls /data/media
```

### 大文件上传失败

检查 Nginx `client_max_body_size` 与应用上传限制是否匹配、数据盘空间是否足够；调整生产 Nginx 配置前先备份，验证后再重建反代。

### 刚启动时 502

检查 app 健康状态、启动和迁移日志。app 重建后 Nginx 可能仍使用旧上游地址，需要重建 Nginx；不能以反复重跑 seed 解决问题。

### 评论 IP 归属地为空

检查生产 Nginx 中传递客户端地址的配置是否保留：`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`。不要公开完整访问日志或客户端隐私信息。

## 七、镜像与卷结构速查

```text
容器 app（node:20-slim，uid 1001）
  /app                  standalone 应用与静态资源
  /app/prisma           schema、迁移与 seed
  /app/data             ip2region 离线库
  /app/prisma-cli        Prisma CLI
  /data                 原宿主 DATA_DIR 的绑定挂载
    db/blog.db          数据库及可能存在的 WAL / SHM / journal
    media/              媒体文件
    software/           软件安装包
    backups/            应用导出、暂存与自动快照

容器 nginx
  /etc/nginx/conf.d/default.conf  来自 deploy/nginx/nginx.conf
  /etc/nginx/certs               来自 deploy/nginx/certs
  /data/media                   同一宿主目录下 media（只读）
  /data/software                同一宿主目录下 software（只读）

升级检查点：数据与项目目录外的私有备份目录，不在 /data/backups 中
```
