#!/usr/bin/env bash
# Fresh installation only. Never use this script against an existing deployment.
set -euo pipefail
umask 077

fail() { printf '%s\n' "停止：$*" >&2; exit 1; }
[[ $# -eq 1 ]] || fail '用法：sudo bash deploy/fresh-install.sh http://实际服务器IP（也可用已解析域名）'
SITE_ADDRESS="$1"
[[ "$SITE_ADDRESS" =~ ^http://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:]+\])/?$ ]] || fail '请填写真实 HTTP 地址，不带路径或端口；HTTPS 需另配证书。'
SITE_ADDRESS="${SITE_ADDRESS%/}"
[[ "$(uname -s)" == Linux ]] || fail '仅支持 Linux 服务器。'
[[ "$(id -u)" == 0 ]] || fail '请使用 sudo bash 运行。'
for cmd in docker openssl ss cp chown chmod mkdir; do
  command -v "$cmd" >/dev/null || fail "缺少命令：$cmd（请先安装 Docker Compose v2、OpenSSL 和 iproute2）"
done
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd -- "$ROOT"
NAME=miaolittlehome-20261016
FRESH_DATA=/srv/miaolittlehome-20261016-data
[[ -f Dockerfile && -f docker-compose.yml && -f deploy/entrypoint.sh ]] || fail '请使用完整源码包。'
[[ ! -e .env.production && ! -L .env.production && ! -e .env && ! -L .env ]] || fail '项目已有环境配置；不能重复初始化或覆盖旧站。'
[[ -d /srv ]] || fail '/srv 目录不存在，请先由管理员准备。'
[[ ! -e "$FRESH_DATA" && ! -L "$FRESH_DATA" ]] || fail "数据目录已经存在：$FRESH_DATA；不会覆盖，请勿删除旧数据来绕过检查。"

# Ignore inherited interpolation variables; never edit system/global settings.
unset COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_PROFILES COMPOSE_ENV_FILES COMPOSE_DISABLE_ENV_FILE
unset DATA_DIR DATABASE_URL MEDIA_DIR SOFTWARE_DIR BACKUP_DIR RUN_SEED
unset JWT_SECRET IP_HASH_SALT ADMIN_USERNAME ADMIN_PASSWORD NEXT_PUBLIC_SITE_URL
unset APT_MIRROR NPM_REGISTRY PRISMA_ENGINES_MIRROR SESSION_COOKIE_SECURE
compose() { docker compose -p "$NAME" --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" --env-file "$ROOT/.env.production" "$@"; }
docker info >/dev/null
docker compose version >/dev/null
HELP="$(docker compose up --help)"
[[ "$HELP" == *--wait* ]] || fail 'Docker Compose 版本不支持 --wait，请先升级工具。'
EXISTING="$(docker ps -aq --filter "label=com.docker.compose.project=$NAME")"
[[ -z "$EXISTING" ]] || fail "已有同名部署 $NAME，不进行初始化。"
LISTENERS="$(ss -H -ltn '( sport = :80 or sport = :443 )')"
PUBLISHED="$(docker ps -q --filter publish=80 --filter publish=443)"
[[ -z "$LISTENERS" && -z "$PUBLISHED" ]] || fail '80/443 已被占用。确认是旧站后，在旧项目目录停止旧站再重试；本脚本不会停止或删除任何旧服务。'

PASSWORD="$(openssl rand -hex 16)"
JWT_VALUE="$(openssl rand -hex 48)"
SALT_VALUE="$(openssl rand -hex 32)"
trap 'rc=$?; printf "部署中止（退出码 %s）。已创建的配置和数据保留；不要删库或重复 seed。根据报错排查，详细说明见 DEPLOY-SIMPLE.md。\n" "$rc" >&2; exit "$rc"' ERR
(
  set -o noclobber
  {
    printf 'COMPOSE_PROJECT_NAME=%s\nDATA_DIR=%s\n' "$NAME" "$FRESH_DATA"
    printf 'NEXT_PUBLIC_SITE_URL=%s\n' "$SITE_ADDRESS"
    printf 'JWT_SECRET=%s\nIP_HASH_SALT=%s\n' "$JWT_VALUE" "$SALT_VALUE"
    printf 'ADMIN_USERNAME=admin\nADMIN_PASSWORD=%s\n' "$PASSWORD"
    printf 'RUN_SEED=false\n'
  } > .env.production
)
chmod 600 .env.production
# mkdir without -p refuses any path created concurrently. Parent /srv already exists.
mkdir -- "$FRESH_DATA"
chown 1001:1001 "$FRESH_DATA"
chmod 755 "$FRESH_DATA"
mkdir -p deploy/nginx/certs

printf '%s\n' '正在构建应用（首次构建需要下载依赖）……'
compose build app
printf '%s\n' '仅对本次新建目录执行一次初始化……'
compose run --rm -T --no-deps -e RUN_SEED=true app true
# Populate only bundled demo files in this newly created data directory.
for pair in 'uploads media' 'software software'; do
  read -r source target <<< "$pair"
  if [[ -d "$source/demo" ]]; then
    [[ ! -e "$FRESH_DATA/$target/demo" ]] || fail '示例目录意外存在，停止以避免覆盖。'
    cp -a -- "$source/demo" "$FRESH_DATA/$target/demo"
    chown -R 1001:1001 "$FRESH_DATA/$target/demo"
  fi
done
compose up -d --wait app
compose up -d --no-deps --force-recreate nginx
compose exec -T nginx nginx -t
compose ps
printf '\n部署命令已完成，请验证网站及后台。\n网站：%s\n后台：%s/admin\n管理员：admin\n初始密码：%s\n新数据目录：%s\n' "$SITE_ADDRESS" "$SITE_ADDRESS" "$PASSWORD" "$FRESH_DATA"
printf '%s\n' '密码同时保存在权限600的 .env.production，请妥善保管且勿公开。' '初始化开关始终为 false；旧站数据未被导入、删除或覆盖。HTTP仅用于初始验收，请尽快配置HTTPS。'
