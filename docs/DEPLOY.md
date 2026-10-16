# 部署手册（详细）

面向 Linux 服务器：Docker 双容器（Next.js 应用 + Nginx 反代）。首次部署见 [极简部署手册](./部署手册.md)。已有站点按原安装方式选择：**压缩包 + Docker Compose 用 [压缩包更新手册](./压缩包更新手册.md)**；Git 克隆安装用 [Git 更新手册](./更新手册.md)。两种方式都保留原文章、评论、媒体与设置，不重新初始化。

> 验证边界：文档与仓库实现已作静态核对，不代表已经在生产服务器构建、迁移或恢复成功。本次文档修订未执行服务器命令、访问生产密钥或数据库。上线前须在自己的环境验收；归档命令成功不等于备份具备可恢复性。

## 一、前置要求与数据位置

- Linux 服务器，已安装 Docker 与 Docker Compose v2；升级检查还需 Bash、Python 3、GNU tar、realpath 和 sudo。只有 Git 安装/更新路线需要 Git，压缩包更新不需要。
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

按原安装方式选择备份流程：**压缩包安装使用 [无 Git 核对与冷备份](#archive-update)**；Git 安装使用 [完整操作第 1、2 步](#safe-update)。两者均核对 Mounts、关闭 seed、停 app 与 Nginx、验证停止状态后再冷备份。仅做日常备份时，不更新代码，确认配置无变化、备份检查通过后重新启动并验收原版本。需同时暂停宿主定时任务、自动部署和其他写库进程，不能只停一个容器却留下其他写入者。

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

<a id="safe-update"></a>

### 保留数据升级：完整操作

简短入口见 [更新手册](./更新手册.md)。以下在**同一个 Linux Bash 会话、原项目根目录**顺序执行；需 Docker Compose v2（支持 `--wait`）、Python 3、GNU tar、realpath、sudo。任一步失败就停止。先安排停机，暂停自动部署、定时写入及其他访问该数据库的进程。

#### 1. 核对旧容器与原配置

```bash
set -euo pipefail
umask 077
test -f .env.production
PROJECT="$(pwd -P)"
APP_ID="$(docker compose --env-file .env.production ps -a -q app)"
test -n "$APP_ID"
docker inspect --format '{{json .Mounts}}' "$APP_ID"
TYPE="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Type}}{{end}}{{end}}' "$APP_ID")"
SOURCE="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' "$APP_ID")"
test "$TYPE" = bind
DATA="$(sudo realpath -e -- "$SOURCE")"
test "$DATA" != /
sudo test -f "$DATA/db/blog.db"
OLD_PROJECT="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$APP_ID")"
test "$(realpath -e -- "$OLD_PROJECT")" = "$PROJECT"
git status --short
```

找不到旧 app、不是 bind mount、来源不明或项目目录不符就停止。命名卷、容器内数据、外部 Nginx、额外挂载、数据子目录外链以及额外 `-f` / `-p` 参数不适用此流程。核对 Nginx 仍使用同一数据源及 `deploy/nginx/` 中的配置和证书；未跟踪部署文件或未提交业务代码先人工整理。

只编辑原 `.env.production`，确保唯一的 `RUN_SEED=false`；**不用模板覆盖，不更改原 DATA_DIR、密钥、账号、站点地址或 Compose 项目身份**。不要 `source` 或打印完整配置。下列函数仅提取挂载源并检查 seed，不输出密钥：

```bash
check_config() {
  local expected
  expected="$(docker compose --env-file .env.production config --format json | python3 -c '
import json, sys
s = json.load(sys.stdin)["services"]["app"]
assert s["environment"].get("RUN_SEED") == "false", "停止：RUN_SEED 必须为 false"
assert s["environment"].get("DATA_DIR") == "/data", "停止：容器内 DATA_DIR 必须为 /data"
v = [v for v in s["volumes"] if v["target"] == "/data"]
assert len(v) == 1 and v[0]["type"] == "bind", "停止：需要原绑定目录"
print(v[0]["source"])')"
  test "$(sudo realpath -e -- "$expected")" = "$DATA"
}
check_config
```

路径不一致就停止，不创建空目录或改路径绕过检查。若旧 Compose 尚无容器内 `DATA_DIR: /data` 覆盖，先备份并人工核对该差异，不能把宿主自定义路径当作容器路径。

#### 2. 停机并完整冷备份

备份目录在数据目录和项目目录**之外**，有足够空间，仅管理员可访问。以下保存整个数据目录（不排除 WAL / SHM / journal）、配置和证书、旧代码与镜像。数据子目录存在外链或子挂载时先另定完整备份范围。

```bash
BACKUP_ROOT="$(sudo realpath -m /var/backups/miaolittlehome)"
case "$BACKUP_ROOT/" in "$DATA/"*|"$PROJECT/"*) exit 1 ;; esac
sudo install -d -m 700 -o root -g root "$BACKUP_ROOT"
BACKUP="$BACKUP_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
sudo mkdir -m 700 "$BACKUP"

docker compose --env-file .env.production stop app nginx
test "$(docker inspect --format '{{.State.Running}} {{.State.Restarting}}' "$APP_ID")" = 'false false'
sudo tar -czf "$BACKUP/data.tar.gz" -C "$DATA" .
# -h 将证书链接的目标内容一起备份；不可读或缺失即停止
sudo tar -chzf "$BACKUP/config.tar.gz" .env.production docker-compose.yml deploy/nginx
git rev-parse HEAD | sudo tee "$BACKUP/REVISION" >/dev/null
git archive --format=tar HEAD | sudo tee "$BACKUP/code.tar" >/dev/null
git diff --binary HEAD | sudo tee "$BACKUP/local.patch" >/dev/null
APP_IMAGE="$(docker inspect --format '{{.Image}}' "$APP_ID")"
NGINX_ID="$(docker compose --env-file .env.production ps -a -q nginx)"
test -n "$NGINX_ID"
NGINX_IMAGE="$(docker inspect --format '{{.Image}}' "$NGINX_ID")"
printf '%s\n' "$APP_IMAGE" | sudo tee "$BACKUP/app-image-id" >/dev/null
printf '%s\n' "$NGINX_IMAGE" | sudo tee "$BACKUP/nginx-image-id" >/dev/null
docker image save "$APP_IMAGE" "$NGINX_IMAGE" | sudo tee "$BACKUP/images.tar" >/dev/null
printf '%s\n' "$PROJECT" "$DATA" | sudo tee "$BACKUP/paths" >/dev/null
sudo chmod 600 "$BACKUP"/{data.tar.gz,config.tar.gz,REVISION,code.tar,local.patch,app-image-id,nginx-image-id,images.tar,paths}
sudo tar -tzf "$BACKUP/data.tar.gz" >/dev/null
sudo tar -tzf "$BACKUP/config.tar.gz" >/dev/null
sudo tar -tf "$BACKUP/code.tar" >/dev/null
sudo tar -tf "$BACKUP/images.tar" >/dev/null
printf '本次备份目录：%s\n' "$BACKUP"
```

记录备份路径。任何复制、空间、权限或归档检查失败，都不继续；归档可列出不等于恢复演练通过。不要使用旧 `scripts/backup.sh` 代替，不清理旧镜像或备份。日常冷备份做到这里即可；确认配置未变化后启动原版本并验收，不拉代码。

#### 3. 更新、复核并启动

```bash
git pull --ff-only
check_config
```

**启动前必须对照备份核对原配置、Nginx 定制、证书和挂载没有意外变化。** 发现差异先处理；验收期间在服务器入口限制公网访问，仅允许管理员测试。

```bash
docker compose --env-file .env.production up -d --build --wait app
docker compose --env-file .env.production up -d --no-deps --force-recreate nginx
docker compose --env-file .env.production exec nginx nginx -t
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=80 app nginx
```

`--wait` 等待 app 健康，失败不启动 Nginx。Compose 不支持此选项时先处理工具兼容，不能直接删掉等待检查。确认迁移无错误、前台与后台可用，旧文章、评论、媒体、软件、设置与管理员登录正常，再恢复对外写入和定时任务。

遇到冲突、分支分叉或文件覆盖提示就停止，手工合并确认；不使用 `git reset`、`git stash` 隐藏问题，不删除项目重新部署。非 Git 安装先核对同样的挂载与冷备份，再另定文件更新方案，不能直接覆盖上传。**绝不使用 `down` 的 `-v` 选项，也不删除真实数据目录。** 失败时保存现场，按下节配套回滚，不只回退代码。

<a id="archive-update"></a>

### 压缩包部署：无 Git 核对与冷备份

**这是 ZIP + Docker Compose 旧站的更新准备流程，不需要 Git。** 完成后回到 [压缩包更新手册](./压缩包更新手册.md) 第 3、4 步替换程序并启动。新包先解压在原项目与数据目录之外，不在新目录启动。

适用范围：Linux Bash、Docker Compose v2（支持 `--wait` 和 JSON 配置输出）、Python 3、GNU tar、realpath、sudo；使用原 `docker-compose.yml` 和 `.env.production` 的标准 app/nginx 双服务、宿主绑定目录。若旧部署使用额外 `-f` / `-p`、命名卷、额外服务、外部 Nginx、其他环境文件或额外挂载，先停止并按原实际配置调整，不能套用默认命令。全程保持同一个终端，报错立即停止。

#### A. 确认旧项目和实际数据位置

先暂停自动部署、定时写入和其他访问同一数据库的进程，安排维护窗口。进入**原项目根目录**执行：

```bash
set -euo pipefail
umask 077
test -f .env.production
PROJECT="$(pwd -P)"
APP_ID="$(docker compose --env-file .env.production ps -a -q app)"
NGINX_ID="$(docker compose --env-file .env.production ps -a -q nginx)"
test -n "$APP_ID"
test -n "$NGINX_ID"
docker inspect --format '{{.Name}} {{json .Mounts}}' "$APP_ID" "$NGINX_ID"
TYPE="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Type}}{{end}}{{end}}' "$APP_ID")"
SOURCE="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' "$APP_ID")"
test "$TYPE" = bind
DATA="$(sudo realpath -e -- "$SOURCE")"
test "$DATA" != /
test "$PROJECT" != /
sudo test -f "$DATA/db/blog.db"
OLD_PROJECT="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$APP_ID")"
OLD_NAME="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$APP_ID")"
test "$(realpath -e -- "$OLD_PROJECT")" = "$PROJECT"
test -n "$OLD_NAME"
test "$OLD_NAME" != '<no value>'
printf '原项目：%s\n真实数据目录：%s\n项目名：%s\n' "$PROJECT" "$DATA" "$OLD_NAME"
```

人工对照两个容器的 Mounts：nginx 媒体与软件目录应分别来自真实 `$DATA/media`、`$DATA/software`，配置和证书应来自原项目的 `deploy/nginx/`。任何额外或不明挂载、数据目录外链、子挂载均先停止，补齐实际备份范围。不要根据默认 `/data` 猜宿主位置，不打印整份环境配置或密钥。

只在原 `.env.production` 中确认唯一的 `RUN_SEED=false`，其他密钥、路径、账号和站点地址不改。定义后续复查函数：

```bash
check_archive_config() {
  local expected
  expected="$(docker compose --env-file .env.production config --format json | python3 -c '
import json, os, sys
c = json.load(sys.stdin)
phase, old_name = sys.argv[1:]
assert c.get("name") == old_name, "停止：Compose 项目名变化"
assert set(c["services"]) == {"app", "nginx"}, "停止：存在非标准服务，需补齐备份范围"
a = c["services"]["app"]
e = a["environment"]
assert e.get("RUN_SEED") == "false", "停止：RUN_SEED 必须为 false"
def bind(service, target):
    items = [v for v in service.get("volumes", []) if v["target"] == target]
    assert len(items) == 1 and items[0]["type"] == "bind", "停止：挂载必须为原绑定目录"
    return os.path.realpath(items[0]["source"])
source = bind(a, "/data")
n = c["services"]["nginx"]
for folder in ("media", "software"):
    assert bind(n, "/data/" + folder) == os.path.realpath(os.path.join(source, folder)), "停止：nginx 数据源不一致"
if phase == "ready":
    for key, value in {"DATA_DIR": "/data", "DATABASE_URL": "file:/data/db/blog.db", "MEDIA_DIR": "/data/media", "SOFTWARE_DIR": "/data/software", "BACKUP_DIR": "/data/backups"}.items():
        assert e.get(key) == value, "停止：容器内存储路径不符：" + key
print(source)
' "${1:-ready}" "$OLD_NAME")"
  test "$(sudo realpath -e -- "$expected")" = "$DATA"
}
check_archive_config backup
```

`backup` 阶段只检查原挂载、项目名与 seed，不强制较旧 Compose 已包含新版容器路径覆盖；先完成备份，再对照新版合并必要差异。启动前必须执行无参数的 `check_archive_config`，会进一步检查容器内路径。两阶段都不能通过更改宿主 `DATA_DIR` 绕过检查。

#### B. 停机并保存完整检查点

下面保存真实数据和**整个旧项目**（包括隐藏配置及本地定制，不依赖 Git），同时保存证书目标文件和旧镜像。若数据在项目内会重复备份，先确认空间足够；不为了缩短时间排除数据库附属文件。备份目录必须在项目和数据目录之外。

```bash
BACKUP_ROOT="$(sudo realpath -m /var/backups/miaolittlehome)"
case "$BACKUP_ROOT/" in "$DATA/"*|"$PROJECT/"*) exit 1 ;; esac
sudo install -d -m 700 -o root -g root "$BACKUP_ROOT"
BACKUP="$(sudo mktemp -d "$BACKUP_ROOT/archive-XXXXXXXX")"
APP_IMAGE="$(docker inspect --format '{{.Image}}' "$APP_ID")"
NGINX_IMAGE="$(docker inspect --format '{{.Image}}' "$NGINX_ID")"
docker compose --env-file .env.production stop app nginx
for id in "$APP_ID" "$NGINX_ID"; do
  test "$(docker inspect --format '{{.State.Running}} {{.State.Restarting}}' "$id")" = 'false false'
done
sudo tar -czf "$BACKUP/data.tar.gz" -C "$DATA" .
sudo tar -cf "$BACKUP/code.tar" -C "$PROJECT" .
sudo tar -chzf "$BACKUP/config.tar.gz" -C "$PROJECT" .env.production docker-compose.yml deploy/nginx
docker image save "$APP_IMAGE" "$NGINX_IMAGE" | sudo tee "$BACKUP/images.tar" >/dev/null
printf '%s\n' "$APP_IMAGE" | sudo tee "$BACKUP/app-image-id" >/dev/null
printf '%s\n' "$NGINX_IMAGE" | sudo tee "$BACKUP/nginx-image-id" >/dev/null
printf '%s\n' "$PROJECT" "$DATA" "$OLD_NAME" | sudo tee "$BACKUP/paths" >/dev/null
printf '%s\n' 'archive-install; original project captured in code.tar; no Git revision assumed' | sudo tee "$BACKUP/REVISION" >/dev/null
sudo chmod 600 "$BACKUP"/{data.tar.gz,code.tar,config.tar.gz,images.tar,app-image-id,nginx-image-id,paths,REVISION}
sudo tar -tzf "$BACKUP/data.tar.gz" >/dev/null
sudo tar -tf "$BACKUP/code.tar" >/dev/null
sudo tar -tzf "$BACKUP/config.tar.gz" >/dev/null
sudo tar -tf "$BACKUP/images.tar" >/dev/null
printf '备份完成，记录此路径：%s\n' "$BACKUP"
```

任何命令失败都停止，保留现场；归档可读取不等于恢复演练已通过。证书软链接目标不可读或缺失时必须处理，不能跳过。记录并保管备份，另做受控异机副本。现在回到 [压缩包更新手册第 3 步](./压缩包更新手册.md) 更新程序；不恢复自动写入、不清理旧镜像，直到新版本验收完成。

**压缩包回滚对应关系：**下节的 `code.tar` 就是上述完整旧项目快照，`REVISION` 标识为 archive-install，不是 Git 提交；不需要 `git checkout`、`.git` 或 `local.patch`。只在全新的隔离目录解包验证，原项目与真实数据位置按 `paths` 恢复，同样不能覆盖活库。

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
