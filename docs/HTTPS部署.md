# HTTPS 部署（域名 + 证书，关闭 HTTP 与 IP 直连）

适用：已经用 `docker compose` 部署好站点，现在拿到**域名**和**证书文件**，要切成 HTTPS。
全程只改 3 个地方，不碰数据库、媒体和文章。

---

## 0. 先确认两件事

1. **域名已解析**：域名 A 记录指向服务器 IP。验证：
   ```bash
   dig +short 你的域名
   ```
   返回的 IP 必须是这台服务器。

2. **安全组 / 防火墙放行 443**（80 也要留着，用于跳转和证书续期）。

---

## 1. 放证书

**Nginx 只认证书的「内容」，不认文件名** —— 名字随便，只要配置里写对就行。
下面用 `fullchain.pem` / `privkey.pem` 这两个通用叫法。

把文件放到**项目目录**下的 `deploy/nginx/certs/`（compose 已经把这个目录挂到容器的 `/etc/nginx/certs`）：

| 配置里要的 | 内容 | 常见来源文件名 |
|---|---|---|
| `fullchain.pem` | **证书链**：站点证书 + 中间证书（**必须带链**，只有站点证书会让部分手机/旧安卓报"证书不完整"） | 腾讯云 `xxx_bundle.crt`；阿里云 `xxx.pem`；Let's Encrypt `fullchain.pem` |
| `privkey.pem` | **私钥** | `privkey.key`、`xxx.key`、`privkey.pem` |

> ⚠️ `.csr` 是**证书签名请求**，申请时用的，**不用传到服务器**。
> 如果下载包里同时有 `xxx.crt`（单张）和 `xxx_bundle.crt`（多张），用 **bundle 那份**。

### 上传 + 改名 + 三项自检

在服务器上（先把证书文件上传到任意目录，比如 `/root/cert/`）：

```bash
cd /home/Shifenmiao/miaolittlehome-20261015     # 换成你的项目目录
mkdir -p deploy/nginx/certs

cp /root/cert/fullchain.pem      deploy/nginx/certs/fullchain.pem
cp /root/cert/privkey.key        deploy/nginx/certs/privkey.pem    # 私钥顺便改名
chmod 644 deploy/nginx/certs/fullchain.pem
chmod 600 deploy/nginx/certs/privkey.pem

# ① 证书链是否完整：必须 >= 2（1 表示只有站点证书，中间证书缺了）
grep -c 'BEGIN CERTIFICATE' deploy/nginx/certs/fullchain.pem

# ② 证书和私钥是否配套：两个 md5 必须一模一样
openssl x509 -noout -modulus -in deploy/nginx/certs/fullchain.pem | openssl md5
openssl rsa  -noout -modulus -in deploy/nginx/certs/privkey.pem  | openssl md5

# ③ 证书覆盖哪些域名（有没有 www）、有效期到什么时候
openssl x509 -noout -subject -dates -ext subjectAltName -in deploy/nginx/certs/fullchain.pem
```

第 ③ 步的结果决定第 2 步里 `www` 那一行要不要保留：**证书的 `subjectAltName` 里没有
`www.你的域名` 就把 map 里那行删掉**，否则 `https://www.你的域名` 会在 TLS 握手阶段就失败。

文件名不想改成 `privkey.pem` 也行 —— 那就改 `deploy/nginx/nginx.conf` 里的
`ssl_certificate` / `ssl_certificate_key` 两行指向你的实际文件名。

```bash
ls -l deploy/nginx/certs/
```

---

## 2. 改 Nginx 配置里的域名

打开 `deploy/nginx/nginx.conf`，**只需要改一处** —— 文件最上面的 `map`：

```nginx
map $host $site_canonical {
    default                  "";
    example.com              example.com;      # ← 改成你的域名
    www.example.com          example.com;      # ← 证书不含 www 就删掉本行
}
```

左边是访问时用的 `Host`，右边是统一跳转到的规范域名（不带 www）。没列出来的 Host
（用 IP 直连、扫描器、未知域名）映射成空串，会被直接断开。

> **为什么只有一处**：早先的写法把域名同时写在 80 段和 443 段的 `server_name` 里，
> 只改了其中一处就会出现「HTTPS 能开、HTTP 直接连不上」——HTTP 的 Host 匹配不上域名 server，
> 落到 `default_server` 被 `444` 断掉。用 `map` 之后不存在这个坑。

配置里已经写好的行为：

- **HTTP（80）**：域名 → `301` 跳 HTTPS（带 `$request_uri`，深层链接和查询串不会丢）；
  **用 IP 或未知域名访问 → 直接断开**（`return 444`）。
  想改成"IP 访问也跳到域名"，把 `if ($site_canonical = "")` 那两行换成
  `return 301 https://你的域名$request_uri;`。
- **HTTPS（443）**：只有你配的域名能访问；IP 直连、未知域名 → 断开；`www` 统一跳到规范域名。
- **HSTS 默认关闭**。确认 HTTPS 稳定后再打开（配置里那段注释有说明和风险提示）。

---

## 3. 校验并重启 Nginx

```bash
cd /你的项目目录
docker compose --env-file .env.production exec nginx nginx -t
docker compose --env-file .env.production restart nginx
```

> `nginx -t` 会**先于**重启报错。证书路径写错、文件没放好，这一步就会失败 ——
> 这时 Nginx 仍在跑旧配置，站点不会挂，改完再来一次即可。

---

## 4. 让站点自己的 URL 变成 https

`.env.production` 里改一行：

```env
NEXT_PUBLIC_SITE_URL=https://你的域名
```

这个值在**构建期**被内联进产物（`sitemap.xml`、`robots.txt`、页面的 `hreflang` 都读它），
所以必须重新构建，光重启容器不生效：

```bash
docker compose --env-file .env.production up -d --build
```

> 不重建的表现：页面 `<link rel="alternate" hreflang=...>` 和 sitemap 里还是旧地址
> （之前是容器内的 `http://blog_app`，搜索引擎会拿到打不开的链接）。

重建期间站点会有几十秒不可用，属正常。

---

## 5. 验收

```bash
# 1) 域名走 HTTPS，返回 200
curl -sI https://你的域名/zh | head -3

# 2) HTTP 自动跳 HTTPS
curl -sI http://你的域名/zh | grep -i location

# 3) IP 直连被拒绝（应当超时或空响应，而不是返回页面）
curl -sI --max-time 5 http://服务器IP/zh ; echo "exit=$?"

# 4) 页面里的 hreflang 已经是 https 域名
curl -s https://你的域名/zh | grep -o 'hreflang="zh"[^>]*' | head -1
```

浏览器里再确认一遍：地址栏是锁头图标、无"混合内容"警告，后台能正常登录
（登录态 Cookie 此时会带 `Secure`，是预期的）。

---

## 6. 回滚

出问题时按原路退回即可，**不需要动数据**：

1. 把 `deploy/nginx/nginx.conf` 换回 HTTP 版本（或把 443 段注释掉、80 段恢复 `server_name _;`）；
2. `docker compose --env-file .env.production restart nginx`；
3. `.env.production` 的 `NEXT_PUBLIC_SITE_URL` 改回原值并 `up -d --build`。

数据库、媒体、软件包都在宿主机数据目录里，和这次改动无关。

---

## 7. 站点打不开了怎么排查

最典型的症状：**域名和 IP 都连不上**（`curl` 直接失败、没有响应头），说明**根本没有服务在监听** ——
基本是 Nginx 容器起不来。按顺序跑一遍，一条命令看一项：

```bash
cd /你的项目目录

# 1) 容器状态：nginx 是不是 Exited / Restarting？
docker compose --env-file .env.production ps -a

# 2) 80/443 有没有在监听？
ss -ltn | grep -E ':(80|443)' || echo '没有监听'

# 3) 证书到底在不在、文件名对不对
ls -l deploy/nginx/certs/

# 4) 配置本身能不能过（容器没起来时这条会报错，正常）
docker compose --env-file .env.production exec nginx nginx -t

# 5) Nginx 到底在抱怨什么
docker compose --env-file .env.production logs --tail=40 nginx
```

**按报错对号入座：**

| 报错 | 原因 | 处理 |
|---|---|---|
| `cannot load certificate "/etc/nginx/certs/fullchain.pem"` 或 `...privkey.pem` | 证书没上传 / 放错目录 / **文件名不对**（云厂商给的是 `xxx_bundle.crt` + `privkey.key`，直接放进去 nginx 找不到） | 文件必须放在**项目目录**的 `deploy/nginx/certs/`，且叫 `fullchain.pem` 与 `privkey.pem`（compose 把这个目录挂到容器的 `/etc/nginx/certs`）。见上面第 1 步的对照表 |
| `host not found in upstream "app"` | app 容器没起 | 先 `docker compose --env-file .env.production up -d app` |
| `bind() to 0.0.0.0:80 failed (98: Address already in use)` | 80 被别的服务占了 | `ss -ltnp \| grep :80` 看是谁；是旧站就先在旧目录用原参数 `stop` |
| 配置语法错（`unexpected "}"` 等） | 手改漏了括号 / 少了一行 | 别手改，直接用包里的 `deploy/nginx/nginx.conf` |

**先恢复访问（不折腾证书）**：仓库自带一份只跑 HTTP 的应急配置，换上就能立刻恢复：

```bash
cp deploy/nginx/nginx.conf deploy/nginx/nginx.https.conf.bak
cp deploy/nginx/nginx.http-only.conf deploy/nginx/nginx.conf
docker compose --env-file .env.production exec nginx nginx -t
docker compose --env-file .env.production restart nginx
```

站点恢复后再把 `nginx.https.conf.bak` 换回去，继续调 HTTPS。

---

## 附：证书续期

Let's Encrypt 用 HTTP-01 的话，`/.well-known/acme-challenge/` 已经保留在 80 端口段里，
续期脚本能正常跑；续期后 `docker compose --env-file .env.production restart nginx` 让新证书生效。
用云厂商证书则在控制台重新签发下载后替换 `certs/` 里两个文件并重启 Nginx。
