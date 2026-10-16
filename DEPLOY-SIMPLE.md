# 最新包怎么用

应用基线：已发布提交 `7706a58` + 本轮修复（客户端异常中文兜底、背景图文字可读性、进场遮罩时序、完整 HTTPS 配置）。
包内不含真实数据库、密码、node_modules 或构建产物，服务器首次构建需联网下载依赖。

**两条路，按你的情况选一条：**

| 你的情况 | 用哪个 | 结果 |
|---|---|---|
| 想在**现在这个站**上更新（保留已发布的文章、上传的图片、后台设置） | `patch-20261016-v2.zip`（增量补丁）→ 见 **A** | 数据目录完全不动 |
| 想**重新部署一个新站** | `miaolittlehome-20261016-full.zip`（完整包）→ 见 **B** | 另建独立数据目录；旧站数据不删除，但**旧内容不会自动带过来** |

> **如果你已经在旧站里写过文章或传过图片，请走 A。** 走 B 会得到一个内容为空的新站
> （旧数据仍在原目录里，但新站不会读它）。不要把完整包覆盖解压到旧项目目录。

---

## A. 更新现有站点（保留数据）

在服务器上的**旧项目目录**里执行：

```bash
unzip -o patch-20261016-v2.zip
docker compose --env-file .env.production up -d --build
```

数据在宿主机数据目录里（默认 `/srv/miaolittlehome-20261015-data`），本补丁只覆盖程序文件，**不动数据**。
确认 `.env.production` 里 `RUN_SEED=false`（保持原值，不要改成 `true`）。

> ⚠️ 补丁里含 `deploy/nginx/nginx.conf`。如果你已经自己改过它（比如配了 HTTPS），
> 解压时排除掉它：`unzip -o patch-20261016-v2.zip -x deploy/nginx/nginx.conf`
>
> 重建期间站点会短暂不可用，属正常。

---

## B. 全新部署一个新站

### 准备

Linux 服务器已装 Docker、Docker Compose v2（支持 `--wait`）、OpenSSL、unzip、iproute2（`ss`）；Docker 正常运行。安全组开放 TCP 80；Compose 也绑定 443，但 HTTPS 需另配证书（见 `docs/HTTPS部署.md`）。

若旧站占用 80/443：确认是你要替换的旧站后，先在**旧项目根目录**用原参数停止服务（会中断旧站，但不删除其数据）：

```bash
docker compose --env-file .env.production stop
```

若原来有额外 `-f`/`-p` 参数，继续使用原参数。不要停止不明服务，**不要执行 `down -v`**。新站失败时先停新站，在旧目录用原参数 `start` 可以重新启动尚未改动的旧容器；本流程没有覆盖旧数据库。

### 部署：上传压缩包后执行

下面的 `<服务器IP>` 必须替换成真实 IP，**不能原样粘贴**；仅填 HTTP 地址，不带端口或路径。应在**独立空目录**中解压，已有同名目录就换一个空目录。

```bash
unzip miaolittlehome-20261016-full.zip
cd miaolittlehome-20261016
sudo bash deploy/fresh-install.sh "http://<服务器IP>"
```

脚本会检查已有配置、数据路径、同名部署和端口；自动生成随机密钥、管理员密码；构建镜像、对新目录仅执行一次初始化，再启动 app 与 Nginx。**遇到已有配置或新数据目录即拒绝重跑，不会删除它们。** 初始化只在一次性容器中启用，持久配置始终 `RUN_SEED=false`。

成功后终端显示网站、后台和初始密码：账号 **admin**，后台路径 **/admin**。密码同时保存在项目 `.env.production`（权限 600），请私密保管。先核验首页、后台登录和上传图片。

### 数据与排错

- 新数据目录固定 `/srv/miaolittlehome-20261016-data`，容器内仍为 `/data`；项目名 `miaolittlehome-20261016`。旧的 `/srv/miaolittlehome-20261015-data` 不会被接管或删除。
- 运行失败：保留 `.env.production` 和新数据，**勿删库、勿重复 seed**。先看具体错误；构建失败需修复网络/依赖后分阶段继续，初始化是否完成须核对日志，不能盲目重跑安装脚本。
- 在**新项目根目录**查看状态和日志：

```bash
sudo docker compose -p miaolittlehome-20261016 --env-file .env.production ps
sudo docker compose -p miaolittlehome-20261016 --env-file .env.production logs --tail=80 app nginx
```

- 新站及旧站均不要删数据目录，**不执行 `down -v`**；后续备份须停写并保存完整数据和配置。

---

## 本轮包含的修复

- **背景图上的文字看不清**：页面标题、副标题、计数原来直接压在照片上。现在统一加一层薄底
  （90% 卡片色 + 10px 模糊 + 细边框，与站内卡片同材质）。**只在设置了背景图时生效**，没背景图排版不变。
- **客户端异常中文兜底**：原来出错显示英文 `Application error`。现在显示站点自己的提示页，
  并且「部署后旧标签页拿到失效代码分片」这类错误会**自动刷新一次**恢复。
- **进场遮罩**：原来等 `load` 才消失（首页能拖到 10s+）、上限 3 秒、期间吞掉点击。
  现在上限 1.2 秒且不挡点击，实测消失时间 3s+ → **0.79s**。
- **HTTPS 配置**：`deploy/nginx/nginx.conf` 已含完整 HTTPS（域名 + 证书、HTTP 跳转、
  IP/未知域名直接断开）。**域名只在文件最上面的 `map` 里写一处**（现在是占位符 `example.com`），
  改完先 `nginx -t` 再重启，步骤见 `docs/HTTPS部署.md`。
- 另有青碧主题、120/104px 星环播放器、真实频谱与随机播放、说说尖角修复。
- 仓库未提供示例视频，相关演示项可能显示降级提示。

---

**验证边界：**应用基线 `7706a58` 已完成此前的生产构建与浏览器验收；本轮修复已完成生产构建、
TypeScript 检查和针对性浏览器验收（`.verify/check-error-boundary.mjs` 11/11、
`.verify/check-page-heading.mjs` 8/8、`.verify/check-home-scroll.mjs` 4/4），
并对压缩包做了解压回验与 Shell 语法/LF 检查。**本机没有 Docker Engine，
未实际执行 Linux Docker 构建、部署或生产恢复**，不能把语法/模拟通过当作容器实机验收。
