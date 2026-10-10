# Blog · 需求规格

状态：**需求已确认**（2026-10-08 首轮评审 / 2026-10-09 二轮拍板）。本文件是需求唯一来源；未确认前不得假设，变更须先经用户确认。
下一步：等待用户发出「开始」后进入阶段 1。

## 背景与项目描述

个人博客，单管理员。前台面向公开访客，后台仅管理员使用。生产部署于 Linux 服务器：Docker 双容器（Next.js 应用 + Nginx 反代），SQLite 数据库与媒体库挂载宿主机 `/data` 卷。
域名、证书、服务器位置本期不决策，由用户在阶段 16 之后自行手动部署；相关配置在交付物中留占位。

## 用户与运行环境

- 目标用户：公开访客（PC / 平板 / 手机）+ 单管理员
- 项目类型：Web，Next.js 全栈（前台 ISR 静态化 + 后台客户端应用）
- 运行环境：Linux 服务器 Docker；**本地开发 Node 20**（`.nvmrc` + `engines` 固定；本机 Node 22 可运行 20）
- 内容语言：**初期只做中文**；`titleEn` / `contentEn` 等字段预留，未填回退中文。中文内容完整后再补英文内容

## 目标

- 加载极速：内容页静态化、媒体直出、图片 WebP、长缓存
- SEO 友好：generateMetadata、语义化 HTML、sitemap.xml + robots.txt、hreflang
- 自适应：PC / 平板 / 手机
- 体验：日夜主题、中英切换、评论互动、标签与相册浏览

## 核心能力（本版本）

前台：

- [ ] 文章列表（分页、置顶、封面、浏览量）
- [ ] 文章标签（`/tags` 列表页 + `/tags/[slug]` 文章列表）
- [ ] 公告区（置顶优先 → 其余按日期倒序；默认展示 5 条，其余「查看更多」弹窗展示，点条目展开详情）
- [ ] 时间线、归档（按年月分组）、分类页
- [ ] 视频页（独立页面；本地 MP4 + 外链 iframe 嵌入）
- [ ] 软件分享页（独立页面；安装包下载、下载计数）
- [ ] 音乐播放器（全局不中断，移动端迷你条；播放列表存 Setting JSON）
- [ ] 全局搜索（标题 > 摘要 > 内容，权重排序）
- [ ] 留言墙（支持嵌套回复）
- [ ] 相册（相册列表 + 手势大图浏览）
- [ ] 评论（嵌套回复、浏览器/系统图标、IP 归属地、先审后显、本人可见审核状态）
- [ ] 文章分享（Web Share / 二维码 / 复制链接）
- [ ] 关于页（头像、简介、友链不填不显示、社交链接）
- [ ] 中英切换（UI 双语；文章 `titleEn`/`contentEn` 未填回退中文）
- [ ] 日夜主题切换
- [ ] 后台登录入口按钮
- [ ] `/` 301 重定向到 `/zh`，输出 hreflang

后台（**仅中文界面**）：

- [ ] 管理员登录（JWT httpOnly cookie）
- [ ] 文章撰写/编辑/删除/置顶/草稿/发布（Vditor，MD 源码 + 所见即所得）+ 标签管理
- [ ] 视频管理（本地 MP4 / 外链 iframe）
- [ ] 软件管理（元信息 + 安装包上传/下载/删除，支持多版本）
- [ ] 媒体库（图片/音乐/视频上传与管理，sharp 缩略图 + WebP，分片上传）+ 相册管理
- [ ] 公告管理（多条，置顶/发布/隐藏）
- [ ] 分类管理、标签管理、评论审核与删除
- [ ] 个人主页设置（头像、简介、友链、GitHub 等第三方链接）
- [ ] 操作日志（重要写操作记录）
- [ ] 访问记录（前台访问日志）
- [ ] 站点设置中心（KV 设置、播放列表 JSON）

## 明确不做（本版本）

- 多用户注册、多管理员
- 支付、邮件订阅
- 第三方评论系统（自建）
- 独立搜索引擎服务（Meilisearch 等留作后期）
- 文章内容自动翻译
- 服务器监控 / 告警
- RSS 订阅（sitemap + robots 已满足 SEO；后期可加）
- 自动化测试框架（验收靠 `tsc --noEmit` + 手动）
- 大文件断点续传（本期只做分片上传 + 合并）
- 公告定时发布（仅发布/隐藏）
- 评论审核状态跨设备同步（仅同浏览器可见）
- slug 拼音转换（不引入拼音库）

## 验收标准

| 场景         | 前提与输入                  | 可观测的预期结果                          | 验证方法                     |
| ---------- | ---------------------- | --------------------------------- | ------------------------ |
| 文章发布       | 后台撰写并发布                | 前台列表即可见，详情页为静态缓存                  | 手动 + revalidatePath 生效   |
| 文章标签       | 后台给文章打标签               | 前台文章页显示标签，`/tags/[slug]` 列出该标签文章   | 手动                       |
| 响应式        | 375 / 768 / 1280 px 访问 | 布局自适应，导航折叠抽屉                      | DevTools 设备模拟            |
| 主题切换       | 点击日夜切换                 | 全站配色切换，刷新保持                       | 手动                       |
| 中英切换       | 切换至 /en                | UI 全英文，无中文硬编码残留；文章内容回退中文          | 遍历页面                     |
| 根路径        | 访问 `/`                  | 301 到 `/zh`，页面含 hreflang 标签       | 手动 + DevTools Network     |
| 音乐连续播放     | 播放中切换路由                | 播放不中断                             | 手动                       |
| 评论展示       | 发表一条评论                 | 显示浏览器/系统图标与 IP 归属地，不显示完整 IP       | 手动                       |
| 评论先审后显     | 访客发表评论                 | 前台不公开显示；**发表者本机可见自己的评论与「审核中」状态**  | 手动（同一浏览器）                |
| 评论审核       | 后台点击通过                 | 评论在前台公开显示                         | 手动                       |
| 留言墙嵌套      | 在留言墙回复某条留言             | 形成嵌套层级                            | 手动                       |
| 公告展示       | 存在 6 条以上公告             | 默认显示 5 条（置顶优先、按日期倒序），其余弹窗展示       | 手动                       |
| 浏览量        | 访问文章详情                 | views 递增；同一浏览器 24h 内重复访问不重复计数      | 手动 + 查库                  |
| 媒体直出       | 播放本地视频                 | 进度条可拖动（Range 生效）                  | 手动                       |
| 大文件上传      | 上传 2G 软件包 / 100M 视频    | 分片上传成功并可下载/播放                     | 手动                       |
| 后台鉴权       | 未登录访问 /admin 或管理 API   | 页面跳转登录，API 返回 401                 | 手动                       |
| 操作/访问日志    | 执行写操作 / 访问前台            | 后台可查看对应日志，7 天后自动清理                | 手动 + 查库                  |
| 时间显示       | 查看任意含时间的内容             | 同时显示 UTC+8 与 UTC                 | 手动                       |
| 性能         | Lighthouse 移动端首页       | 性能 ≥ 90                           | 实测                       |

各阶段细项验收由 AI 在阶段结束时输出清单，用户确认后视为该阶段通过。

## 数据与外部系统

核心实体（Prisma，详见 `prisma/schema.prisma`）：

```prisma
User         // id, username, passwordHash
Post         // id, title, titleEn?, slug(unique), summary, summaryEn?, content, contentEn?,
             // cover?, categoryId?, published, pinned, views(default 0), createdAt, updatedAt
Tag          // id, name(unique), slug(unique)
PostTag      // postId + tagId（显式多对多，便于按标签查文章）
Category     // id, name, nameEn?, type(post|video|software), sort
Comment      // id, type(post|wall), refId?(wall 时为 null), author, email?, content, ua,
             // browser, os, ipRegion, ipHash?(仅限频用，不对外暴露), parentId?,
             // isAdmin, approved(default false), createdAt
Media        // id, type(image|audio|video), path, thumb?, albumId?, title?, size, createdAt
Album        // id, name, nameEn?, cover?(默认首图、可手选), description?, sort, createdAt
Announcement // id, content, pinned, published, createdAt, updatedAt
Video        // id, title, titleEn?, cover?, sourceType(local|iframe), srcUrl, description?,
             // published, pinned?, sort, createdAt, updatedAt
Software     // id, name, nameEn?, icon?, description, published, sort, createdAt, updatedAt
SoftwareFile // id, softwareId, version, platform, fileName, filePath, fileSize,
             // downloads(default 0), createdAt
Friend       // id, name, url, avatar?, description?, sort
Setting      // key(unique), value（站点信息、社交链接、播放列表 JSON 等）
OperationLog // id, action, target?, detail?, createdAt（保留 7 天）
VisitLog     // id, path, ipRegion?, ua?, referer?, createdAt（保留 7 天）
```

- 种子数据：分类 4 个（随笔 / 技术 / 视频 / 软件，含 `nameEn`）；文章 3 篇（普通 / 置顶 / 含图片+代码块）；留言 2 条；友链 2 个；媒体 3 个（image / audio / video 各 1）
- 存储路径：SQLite 生产 `file:/data/db/blog.db`；媒体 `/data/media`（`MEDIA_DIR`）；软件包 `/data/software`（`SOFTWARE_DIR`）；备份 `/data/backups`
- 外部系统：无强制外部依赖；ip2region 为本地离线库
- 敏感数据：密码 bcrypt 哈希；评论仅存归属地文字与 UA，**不向前台暴露完整 IP**；`ipHash` 仅用于服务端限频；SQLite 与媒体在 `/data` 卷，**每月 tar 备份、保留 12 份**

## 技术约束（已确认）

1. 文章页 `generateStaticParams` + ISR；发布/编辑后 `revalidatePath` 按需刷新，不整站重建
2. 生产媒体由 Nginx alias 直出（`/media/` → `/data/media/`），支持 Range
3. 音乐播放器全局不中断；播放列表顺序存 Setting JSON，不建表
4. 真实 IP 取 `X-Forwarded-For` 首值 → ip2region 查归属地；另存 `ipHash`（HMAC）用于限频
5. 音频 MP3、视频 MP4（H.264/AAC）；大视频用 iframe 外链嵌入
6. 上传：视频/图片/音乐单文件 ≤ 100M，软件包 ≤ 2G；**分片上传（8MB/片，> 10MB 才分片），不做断点续传**；sharp 生成缩略图 + WebP
7. 单管理员自写 JWT（httpOnly cookie）；middleware 保护 `/admin` 与管理 API
8. 后台写操作走 **Route Handlers `/api/admin/**`**，middleware 统一鉴权 + 调用 `revalidatePath`
9. 开发环境媒体由 **Route Handler `/media/[...path]`** 读 `MEDIA_DIR`；生产 Nginx alias
10. 搜索：Prisma `OR` 三字段匹配 + 应用层分档排序（标题 3 / 摘要 2 / 正文 1），**禁止 raw SQL**
11. 国际化：`/` **301 → `/zh`** + hreflang；**后台仅中文**，前台双语
12. Docker 基础镜像 **`node:20-slim`**；容器 entrypoint 执行 `prisma migrate deploy`
13. 时间：数据库统一存 UTC；前端**同时展示 UTC+8 与 UTC**（主显 UTC+8，附 UTC）
14. 评论反垃圾：长度校验 + 频率限制（60 秒 1 条 / 每小时 10 条）+ 蜜罐字段，**不做验证码**
15. 日志：`OperationLog` + `VisitLog`，保留 7 天，**惰性清理**（写入时顺带删除超期记录）+ 后台手动清理按钮
16. 浏览量防刷：同一浏览器 24h 内只计一次
17. 评论审核状态：**仅同浏览器可见**（localStorage 记录本人评论 id，查询接口回状态）
18. slug 规则：英文/数字标题 → kebab-case；纯中文 → 回退 `日期-短随机串`；后台可手填；唯一冲突自动追加 `-2`；**不引入拼音库**
19. 允许按需引入成熟前端库（每次新增须单独说明用途）

## 关键决策记录

### 首轮开放问题 → 已确认

| 原开放问题 | 结论 |
| --- | --- |
| 域名与服务器位置 | 本期不决策，用户后续手动部署 |
| HTTPS 证书方式 | 本期不决策，用户后续手动部署 |
| 文章内容双语 | 初期只写中文，字段预留 |
| 评论先审后显 | 默认先审后显（`approved=false`），发表者本机可见审核状态 |
| 种子数据内容 | 见「数据与外部系统」种子数据 |

### 二轮拍板（2026-10-09）

- 视频页、软件分享页**独立成页**；文章正文可嵌入视频与链接
- **视频、软件使用独立数据表**（不复用 Post，避免多套 CRUD 分叉）
- 软件支持**多版本**（`SoftwareFile`），安装包存 `/data/software`，统计下载次数
- **标签仅用于文章**，提供 `/tags` 与 `/tags/[slug]` 页面
- 相册建 **`Album` 表**，封面默认首图、可手选覆盖
- 公告**多条**：置顶优先 → 日期倒序，默认 5 条，其余弹窗展示；不做定时发布
- 新增**浏览量 views**、**操作日志**、**访问记录**
- 每月备份、保留 12 份；不做监控
- 环境变量补充 `SOFTWARE_DIR`、`LOG_RETENTION_DAYS`
- 站点名：**渺の小家**；域名暂不设；作者署名：**Shifenmiao**

## 阶段计划（顺序执行，依赖关系不可打乱）

1. 项目初始化（框架 + Tailwind/shadcn + Prisma 连接 + 目录结构 + `.env.example` + README 回填）
2. 全局布局（导航/移动端抽屉/Footer/日夜主题）
3. 国际化（next-intl，`/` → `/zh`、`/en`、hreflang）
4. 数据库（完整 schema + migrate + 种子数据；含 Tag/Album/Announcement/Video/Software/日志等全部实体）
5. 后台登录（JWT + middleware 保护）
6. 后台框架（管理布局与路由骨架；建立操作日志/访问记录工具函数，后续写操作顺手调用）
7. 文章管理（列表 + Vditor 编辑 + CRUD + 标签 + 分类）
8. 前台文章（列表/详情/分类/归档/时间线/标签页 + 浏览量 + sitemap/robots）
9. 媒体库（分片上传 + 管理 + 相册）
10. 评论与留言墙（UA/IP 归属地 + 先审后显 + 审核状态可见 + 嵌套 + 反垃圾）
11. 全局搜索
12. 音乐播放器（全局不中断 + 播放列表）
13. 视频页 + 软件分享页（含安装包管理）
14. 公告/关于页/友链/文章分享
15. 后台设置中心（站点设置 + 操作日志 + 访问记录 + 清理）
16. Docker 部署（Dockerfile + compose + nginx + SSL 占位 + 备份脚本）

## 后续待定（非阻塞）

- 域名与服务器位置、HTTPS 证书方式（用户手动部署时决定）
- RSS 订阅（后期可选）
- 独立搜索服务 Meilisearch（后期可选）

## 变更约定

范围变更先经用户确认，再同步计划；不要把假设写成已确认需求。
