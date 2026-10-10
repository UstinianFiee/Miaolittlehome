# Blog · 渺の小家

个人博客：前台面向公开访客，后台单管理员管理。技术栈与需求已确认，见 `docs/SPEC.md`。

## 项目信息

- 类型：Web（Next.js 全栈；前台 ISR 静态化 + 后台客户端应用）
- 技术栈：Next.js 15 (App Router) + TypeScript(strict) + Tailwind CSS v4 + shadcn/ui
- 数据：Prisma + SQLite（开发 `./dev.db`，生产 `file:/data/db/blog.db`）
- 部署：Linux + Docker 双容器（Next.js `standalone` + Nginx），数据与媒体挂 `/data`
- 当前阶段：**全部 16 个阶段已完成**（含 Docker 部署配置）
- UI 风格：深色底 + 半透明卡片 + 毛玻璃悬浮导航 + 蓝色强调，日夜双主题

## UI 风格

主题色板集中在 `src/app/globals.css` 的 CSS 变量里：

| 元素 | 深色 | 浅色 |
|---|---|---|
| 页面底色 | `#090909` + 顶部淡蓝光晕 | `#eef0f3` |
| 卡片 / 区块 | `rgb(40 44 52 / 0.72)` 半透明 + `#333` 边框 | `rgb(253 253 253 / 0.86)` |
| 标题 / 正文 | `#dcdcdc` / `#bdbdbd` | `#333` / `#3f3f3f` |
| 次要文字 | `#a3a9b2`（8.4:1） | `#666d78`（4.6:1） |
| 悬浮导航胶囊 | `rgb(26 29 35 / 0.78)`（`--nav-bg`） | `rgb(252 252 253 / 0.82)` |
| 强调色 | `#5eb3e4` | `#2f8fd0` |
| 圆角 | `0.375rem`（小圆角） | 同 |
| 正文字体 | 系统字体栈（PingFang / 微软雅黑 …），行高 1.8 | 同 |
| 根字号 | `html { font-size: 17px }`（全站 rem 等比放大一档） | 同 |
| 标题字体 | 站酷快乐体（`@fontsource/zcool-kuaile`，工具类 `font-display`） | 同 |

> 次要文字（`--muted-foreground`）的取值以 **WCAG AA 4.5:1** 为准绳调过一轮：
> 原来浅色 `#8a9098` 只有约 3.2:1，压在半透明卡片上会明显发糊。
> 导航胶囊也必须用 `--nav-bg` 而不是 `bg-card/40`——后者实际只有约 29% 不透明，
> 压在背景图上会灰成一片。

可复用的类：`.surface`（半透明卡片）、`.surface-glass`（低不透明度 + `backdrop-filter`，
只用在文章正文这种「大块、数量少」的地方，列表里几十张卡片用它会让滚动持续重绘）、
`.section-title`（竖条标题）、`.tag-pill`（标签胶囊）。

**布局**：顶部导航是 fixed 悬浮毛玻璃胶囊（`h-16 sm:h-[4.25rem]`，1280px 起胶囊放宽到 `78rem` 以容纳英文菜单），
布局层用 `main` 的 `pt-[5.25rem] sm:pt-[5.75rem]` 补占位；首页封面区用等量负 margin 拉满全屏。
首页顶部时导航自动转为透明（滚动或进入其他页面后恢复毛玻璃）。
桌面导航 1280px 起显示，更窄时走抽屉；容器可收缩 + 横向滚动兜底，英文长菜单也不会溢出。

**首页**：全屏封面（背景支持**视频 / 多图轮播 / 单图**，见 `HeroBackground`）+ 站点名 + 打字机副标题（`Typewriter`）
+ 向下滚动提示 + **底部波浪过渡**（`HeroWave`）；下滑是「北京时间问候语 + 文章列表 + 右侧栏」的两栏布局，
**文章每页 5 篇，超出分页**（`/?page=N`）。**文章列表页**同样两栏，每页 10 篇。

**封面背景优先级**：视频 > 多图轮播 > 单图 > 渐变底。轮播 7 秒交叉淡入淡出，图层**按需挂载**并提前预取下一张
（不会一次把 10 张大图全下下来）；视频静音循环、用第一张图做 poster。开启 `prefers-reduced-motion` 时停在第一张。

**波浪过渡**（`HeroWave`）：**3 层**横向平铺的 CSS `mask`（透明度 `0.45/0.68/0.92`、流速 `34s/25s/17s`、
波高依次变浅），容器 `h-20 sm:h-32`（桌面约 136px）。
每层还叠了一层**波峰提亮**（`--hero-wave-tint`，底部渐隐到透明）：深色主题下波浪填的是「内容区背景」，
和封面图一样暗、光靠填充几乎看不出曲线，这层提亮负责把波浪读出来，同时因为底部透明不会产生接缝。用 `mask` 而不是直接画 SVG，是因为遮罩里可以填「与内容区完全一致的背景」
（纯色底时是 `--background`，设了内容区背景图时复刻「固定背景图 + 同款遮罩」），
所以波浪与下方内容区之间不会出现色带。**改内容区遮罩透明度时要同步改这里。**
动的是 `mask-position` 而不是 transform——一旦加 transform，填充层的 `background-attachment: fixed` 会失效。

**代码块复制按钮**（`CodeCopy`）：挂在文章页，挂载后给每个 `.markdown-body pre` 包一层 `.code-block` 再插入按钮，
**不参与 hydration**、也不会把文章 HTML 重复塞进客户端负载；依赖 `pathname` 重新执行以适配客户端路由切换。
悬停显示、触屏常显、可键盘聚焦，复制成功显示「已复制」；`navigator.clipboard` 不可用时回退 `execCommand`。

**文章页**（`posts/[slug]`）：
- **标题居中**，下面一行是「发布于 / 作者 / 分类 / 浏览」，再用 `<hr>` 分隔符切到正文；
- 正文包在 `.surface-glass` 玻璃卡里：低不透明度 + `backdrop-filter: blur(14px)`，
  背景图能透出来、模糊又把底层抹平，所以文字对比度不会被背景图拉低；
- **阅读进度条 + 文章导航栏**（`ArticleBar`）：视口顶部一条渐变细线按 `#article-body` 的已读比例推进
  （用 `transform: scaleX` 而不是改 width，不触发布局）；滚过标题后浮出文章导航栏，
  含返回列表、标题、进度百分比与回到顶部。**文章不足一屏时退化成整页进度**，否则会永远停在 0%。

**评论**（`CommentSection`）：每条评论是一张带边框与底色的卡片 + 昵称首字头像（底色由昵称哈希决定，
颜色稳定且彼此不同），站长用主题色 + 盾牌图标单独标识；时间右对齐，嵌套回复左侧有主题色竖线并换一层底色。

**页脚**（`SiteFooter`）：顶部 3 层波浪（`FooterWaves`）→ 站点名 + 描述 → 版权 + 技术栈 → 备案区。
- 波浪是 3 层横向平铺的 SVG，透明度 `0.25 / 0.45 / 0.72`、流速 `34s / 26s / 18s` 各不相同，
  只动 `transform: translateX(-50%)`（走合成器，不重绘）；矢量渲染所以曲线平滑无锯齿。
- 渐变与底色由 `--footer-wave-top/-bottom` / `--footer-bg` 控制，**页脚底色必须等于波浪渐变的下端色**，
  否则接缝会露出来；夜间刻意比页面底色亮（`#2c333e → #171d28`），不然深色主题下波浪看不见。
- 备案号与链接读 `site.icp` / `site.icpLink`，**没配置就整块不渲染**。
- 波浪区 `h-12 sm:h-16`、页脚 `py-7`、上边距 `mt-14 sm:mt-20`——刻意压扁过一轮，别随手调大。

**后台**视觉与前台对齐：悬浮毛玻璃胶囊顶栏（同一个 `--nav-bg`）、`.surface` 卡片、展示字体站点名、
同一个 `--background` 底色；登录页展示站点 Logo（没设 Logo 时回退成主题色圆点）；
「返回前台」在顶栏（所有尺寸可见）与侧边栏底部各有一个，抽屉里也能用。

**问候语**（`Greeting`）：按**北京时间**（固定 UTC+8，与访客时区无关）输出「早上好呀 / 中午好呀 / 下午好呀 /
晚上好呀 / 夜深了呀」，每 30 秒刷新。只能在客户端计算——服务端算出来的时间会被 ISR 缓存住。

**侧边栏**（`SiteSidebar`）依次为：个人资料卡（头像 / 个人名字 / 简介 / 自定义链接）、**公告**（3 条 + 「查看更多」弹窗）、
最新 / 热点文章标签页、标签聚合、友情链接。公告只在侧边栏展示，首页主内容区不再单独占一块。

**动效**：`Reveal` 组件用 IntersectionObserver 做滚动进入视口的淡入上移；`Typewriter` 做逐字打字，两者都零依赖，
并遵循 `prefers-reduced-motion`。

**404**：`(site)/[locale]/not-found.tsx` 配合 `[locale]/[...rest]/page.tsx` 兜底路由生效（缺任一都不生效）。

**后台可配置**（设置中心 → 站点信息）：站点名称（同时作为浏览器页签标题与页脚）、副标题、作者、描述、
**Logo**、**页签图标**、**首页背景图（多张轮播）**、**首页背景视频**、**内容区背景图**（首页封面下方与各内页）、
**文章页背景图**、**备案号 / 备案链接**。所有媒体字段都支持**直接上传**或**从媒体库选图**（视频字段选视频），保存后立即生效。

- 站点名称 / 作者 / 描述还会驱动 `generateMetadata`（页签标题、`<meta>`）与关于页的作者信息；
- **页签图标未单独设置时自动回退到 Logo**——换 Logo 时导航栏与页签一起变；
- 背景图之上压一层 `bg-background/75` 半透明遮罩（再高就只剩纯色底了，背景图等于白设）；
  同时给外层加 `has-page-bg`，把 `.surface` 卡片底色加实一档（浅色 `0.94` / 深色 `0.9`）保证正文对比度；
- `src/app/favicon.ico` 是内置兜底（浏览器默认会请求 `/favicon.ico`），设置页签图标后会额外注入 `shortcut icon` 覆盖它。

## 图片处理

上传的图片会**自动压缩**（`src/lib/media.ts` 的 `optimizeImage`）：

- 最长边超过 **2560px** 时等比缩小（足够 2K 屏与正文放大查看）；
- **无透明通道的 PNG 转 WebP** —— 照片类 PNG 常是十几 MB，收益最大；
- **扩展名以实际内容为准**：上传文件的后缀常与真实格式不符（例如 `.png` 里其实是 JPEG），
  会自动改名为 `.jpg`，避免 `/media` 路由返回错误的 `Content-Type`；
- 内容已合规、只是后缀不对时**只重命名，不重新编码**（不损画质）；
- 体积小于 400KB 且尺寸合规的图片**原样保留**；
- `gif` / `svg` 不做处理（避免破坏动画与矢量）；
- 另外生成 640px 的 WebP 缩略图，供列表与相册网格使用。

历史上传的图片可用维护脚本批量处理（会同步更新数据库里的所有引用）：

```bash
node scripts/optimize-images.mjs
```

## 交互动效

全部零依赖（CSS + 少量原生 JS），并统一遵守 `prefers-reduced-motion`（该偏好下动画与过渡一律关闭）。

| 类别 | 实现方式 | 类名 / 组件 |
|---|---|---|
| 顶部路由进度条 | 点击内部链接启动、路由完成收尾；进度按「越接近 90% 越慢」逼近 | `RouteProgress` |
| 页面切换 | `template.tsx` 每次路由重新挂载，触发淡入上移 | `.page-enter` |
| 按钮按压 | 按下轻微缩放（所有 `button` 默认生效） | `.press` |
| 水波纹 | 事件委托注入扩散圈，半径取到最远角 | `.ripple` + `RippleLayer` |
| 卡片抬升 | 上浮 + 阴影加深 + 边框微亮 | `.lift` |
| 图片缩放 | 容器内轻微放大 + 遮罩淡入 | `.media-zoom` |
| 链接下划线 | 从中间向两侧展开 | `.link-underline` |
| 按钮渐变 | 背景位移 | `.btn-gradient` |
| 骨架屏 | 流光扫过 | `.skeleton` + `loading.tsx` |
| 加载状态 | 三点跳动 | `.loading-dots` |
| 图标反馈 | 弹跳 | `.icon-pop` |
| 粒子背景 | canvas 自绘，数量随画布面积自适应 | `Particles` |

**自定义光标**：默认光标是**小猫图**（`public/cursor-cat.png`，由 `scripts/make-cursor.mjs`
用媒体库里的小猫图 + 左上角一个小尖尖合成，热点就在尖端 `2 2`）；手型 / 文本 I 型 / 等待 / 拖拽仍是内联 SVG。
仅在 `@media (pointer: fine)` 生效，触屏保持系统默认；忙碌状态（`aria-busy="true"`）自动切等待光标。


## 开始之前

1. 阅读 `CLAUDE.md`（协作规则、进度）与 `docs/SPEC.md`（需求唯一来源）。
2. 按 `docs/SPEC.md`「阶段计划」顺序推进，不跳阶段。
3. 技术栈已确认，不擅自替换、升级或引入同类依赖。

## 环境要求

- **Node 20**（`.nvmrc` = `20.19.5`）：执行 `nvm use` 切换；`package.json` 的 `engines` 为 `>=20.0.0`
- npm（锁文件由 npm 生成，不手工伪造、不随意删除）

## 首次运行

```bash
nvm use                 # 切换到 Node 20
npm install             # 安装依赖
cp .env.example .env    # 建立本地环境变量（.env 不入库）
npm run db:generate     # 生成 Prisma 客户端
npm run dev             # 启动开发服务器 http://localhost:3000
```

> Prisma CLI 只读取 `.env`，因此本地环境变量统一放在 `.env`（Next.js 同样会加载）。

## 常用命令

| 用途 | 命令 | 工作目录 / 前提 | 验证状态 |
| --- | --- | --- | --- |
| 安装依赖 | `npm install` | 项目根目录；Node 20 | 已运行（2026-10-09，成功） |
| 开发调试 | `npm run dev` | 项目根目录；`.env` 已建立 | 已运行（HTTP 200，页面正常渲染） |
| 类型检查 | `npm run typecheck` | 项目根目录 | 已运行（通过，strict） |
| 生成 Prisma 客户端 | `npm run db:generate` | 项目根目录；`.env` 含 `DATABASE_URL` | 已运行（成功） |
| 同步 Vditor 资源 | `npm run sync:vditor` | 安装依赖后执行一次（`dev`/`build` 会自动执行） | 已运行（成功） |
| 校验 Prisma schema | `npx prisma validate` | 项目根目录 | 已运行（schema valid） |
| 数据库迁移 | `npm run db:migrate -- --name xxx` | 项目根目录；`.env` 含 `DATABASE_URL` | 已运行（`init` 迁移已生成并应用） |
| 写入种子数据 | `npm run db:seed` | 需先完成迁移 | 已运行（幂等，可重复执行） |
| 查看数据 | `npm run db:studio` | 项目根目录 | 未运行 |
| 构建 | `npm run build` | 项目根目录 | 已运行（成功，产出 `.next/standalone/server.js`） |
| 生产启动 | `npm run start` | 需先 `npm run build` | 未运行 |

## 目录结构

```
Dockerfile             生产镜像（standalone + Prisma CLI，多阶段构建）
docker-compose.yml     应用 + Nginx 双容器编排，数据落在 /data 卷
.dockerignore          Docker 构建上下文排除项
deploy/                部署产物（entrypoint、nginx 配置与 SSL 占位、环境变量模板、cron 示例）
scripts/backup.sh      数据备份（tar.gz，保留 12 份）
docs/DEPLOY.md         部署手册（含首次部署核对清单与排障）
prisma/schema.prisma   数据模型（16 个实体，见 docs/SPEC.md「数据与外部系统」）
prisma/migrations/     数据库迁移（必须入库，只新增不回改）
prisma/seed.mjs        种子数据脚本（幂等，可重复执行）
src/app/globals.css    Tailwind v4 入口 + shadcn/ui 主题变量
src/app/icon.svg       站点图标
src/app/(site)/[locale]/   前台：按语言分路由（/zh、/en），含根布局
src/app/(admin)/admin/     后台：不参与语言路由，界面固定中文
src/app/(admin)/admin/(shell)/  后台受保护区（侧边栏 + 顶栏 + 各管理模块）
src/app/api/admin/         后台 API（登录 / 登出 / 文章 / 分类 / 标签 / 媒体 / 相册）
src/app/api/admin/media/upload/  分片上传（init / chunk / complete）
src/app/api/posts/[slug]/views/  前台浏览量接口（GET 读取 / POST +1）
src/app/api/comments/      公开评论提交接口
src/app/api/playlist/      公开播放列表接口
src/app/api/admin/announcements/  公告管理 API
src/app/api/admin/friends/  友链管理 API
src/app/api/admin/settings/profile/  关于页资料 API
src/app/api/admin/settings/site/     站点信息 API
src/app/api/admin/logs/     日志查询与手动清理 API
src/app/api/software/download/[id]/  安装包下载（计数后 302 到真实文件）
src/app/software-files/[...path]/    开发环境安装包直出（生产由 Nginx 承担）
src/app/media/[...path]/   开发环境媒体直出（含 Range；生产由 Nginx 承担）
src/app/sitemap.ts         sitemap.xml
src/app/robots.ts          robots.txt
src/components/site/       前台组件（文章卡片、分页、Markdown 渲染、浏览量、相册网格与大图浏览、评论区、搜索高亮、音乐播放器、视频播放器、公告区、分享）
src/components/admin/      后台组件（外壳、仪表盘、文章表单与列表、分类标签管理、媒体库、相册管理、评论审核、播放列表、视频与软件管理、公告与友链管理、站点与个人资料、日志中心、Vditor 封装）
src/components/        UI 组件（shadcn/ui 组件放在 src/components/ui）
src/config/site.ts     站点信息与导航结构（标签只存文案 key）
src/config/admin-nav.ts 后台导航结构（分组 + 阶段标注）
src/i18n/              next-intl 配置（routing / navigation / request）
src/middleware.ts      语言协商 + 后台鉴权 + 访问记录（Node.js 运行时）
src/lib/markdown.ts    Markdown → HTML（remark/rehype + Shiki 双主题高亮）
src/lib/query.ts       前台数据查询（仅已发布内容）
src/lib/media.ts       媒体存储（分片合并、sharp WebP 缩略图、安全路径）
src/lib/albums.ts      相册数据访问
src/lib/comments.ts    评论数据访问（两层组装、审核、限频）
src/lib/ip-region.ts   IP 归属地（ip2region 离线库）
src/lib/user-agent.ts  UA 解析（ua-parser-js）
src/lib/search.ts      全局搜索（跨文章/相册/视频/软件）
src/lib/playlist.ts    播放列表读写与校验
src/lib/videos.ts      视频数据访问
src/lib/software.ts    软件与安装包数据访问
src/lib/software-storage.ts  安装包存储（SOFTWARE_DIR、≤2GB、分片）
src/lib/chunked-upload.ts    分片上传内核（媒体库与安装包共用）
src/lib/serve-file.ts  静态文件直出（Range、下载头、防穿越）
src/lib/client-upload.ts     浏览器端分片上传
src/lib/format.ts      通用格式化（字节大小等）
src/lib/announcements.ts  公告数据访问
src/lib/friends.ts     友链数据访问
src/lib/settings.ts    站点设置读写（个人资料/社交链接）
src/lib/auth.ts        自写 JWT（HS256，node:crypto）
src/lib/session.ts     会话 cookie 读写（httpOnly）
src/lib/logs.ts        操作日志 / 访问记录（含 7 天惰性清理）
src/lib/slug.ts        slug 生成与唯一化
src/lib/posts.ts       文章数据访问
src/lib/taxonomy.ts    分类与标签数据访问
src/lib/revalidate.ts  发布后按需刷新前台缓存
src/lib/datetime.ts    时间展示（UTC+8 与 UTC 双显示）
scripts/sync-vditor.mjs 同步 Vditor 运行时资源到 public/vditor/dist
src/lib/               其他工具（prisma.ts、utils.ts、messages.ts、metadata.ts、validation.ts）
public/vditor/         Vditor 资源（由脚本生成，不入库）
data/ip2region.db      ip2region 离线库数据（IPv4，随仓库自带）
data/ipv6wry.db        ip2region 离线库数据（IPv6，随仓库自带）
software/demo/         示例安装包（随仓库自带；其余 software/ 内容不入库）
messages/zh.json       UI 文案源（中文）
messages/en.json       UI 文案源（英文）
uploads/demo/          种子用的示例媒体资源（唯一入库的 uploads 子目录）
docs/SPEC.md           需求唯一来源
CLAUDE.md              协作规则与进度
```

> 前台与后台使用**两个根布局**（Next.js 路由组），因此不存在 `src/app/layout.tsx`。
> 根路径 `/` 由 `next.config.ts` 做 **301 → /zh**；`/admin` 由中间件 matcher 排除在语言路由之外。

> `.verify/` 为本地验证产物（截图 + 一次性浏览器校验脚本），已加入 `.gitignore`；
> 脚本依赖受管工作区中的 `playwright-core` 与本机 Edge，不属于项目依赖。

## 当前状态

- **阶段 1（项目初始化）**：Next.js + TypeScript(strict) + Tailwind CSS v4 + shadcn/ui 基础设施 + Prisma(SQLite) 接入 + 目录结构 + 环境变量模板。
- **阶段 2（全局布局）**：顶部导航（桌面横排 / 移动端抽屉）、Footer、日夜主题切换（可持久化）、路由占位页。
- **阶段 3（国际化）**：next-intl 接入、`/zh` `/en` 路由、`/` 301 → `/zh`、canonical + hreflang、语言切换器；后台固定中文且不带语言前缀。
- **阶段 4（数据库）**：16 个实体的完整 schema、`init` 迁移、幂等种子数据（分类 4 / 文章 3 / 标签 4 / 留言 2（含 1 条嵌套回复）/ 友链 2 / 媒体 3 / 相册 1 / 管理员 1 / 站点设置 6）。
- **阶段 5（后台登录）**：自写 JWT（HS256 + `node:crypto`）、httpOnly cookie 会话、登录/登出接口、middleware 保护 `/admin` 与 `/api/admin/**`、中文登录页。
- **阶段 6（后台框架）**：后台外壳（侧边栏分组导航 + 顶栏 + 移动端抽屉）、13 个管理模块路由骨架、仪表盘（内容统计 + 最近操作）、操作日志与访问记录工具（7 天惰性清理）。
- **阶段 7（文章管理）**：文章列表（搜索 / 状态与分类筛选 / 分页）、Vditor 编辑器（资源自托管）、文章增删改查、置顶与草稿、标签自动创建、分类与标签管理；写操作记录操作日志并刷新前台缓存。
- **阶段 8（前台文章）**：Markdown 渲染管线（remark/rehype + Shiki 双主题高亮）、文章列表与详情、分类页、标签页、归档（按年月分组 + 时间线）、浏览量统计（24h 防重）、sitemap.xml 与 robots.txt、媒体直出（含 Range）。
- **阶段 9（媒体库与相册）**：分片上传（8MB/片，>10MB 才分片）、sharp 生成 WebP 缩略图、媒体库管理（类型筛选 / 归属相册 / 复制路径 / 删除）、相册管理与前台相册页（网格 + 自写大图浏览）。
- **阶段 10（评论与留言墙）**：文章评论与留言墙、先审后显、待审状态对提交者可见、两层嵌套回复、IP 归属地与 UA 解析、反垃圾（同 IP 60 秒限频 + 蜜罐）、后台评论审核。
- **阶段 11（全局搜索）**：跨类型检索文章 / 相册 / 视频 / 软件，结果按类型分组、关键词高亮、导航栏搜索入口；仅检索已发布内容，搜索页不索引。
- **阶段 12（音乐播放器）**：全站音乐播放器（挂在站点布局，路由切换不中断播放）、播放列表、进度/音量/循环模式、后台可编辑播放列表。
- **阶段 13（视频页 + 软件分享页）**：视频列表与播放（本地 MP4 / 外链 iframe）、软件列表与详情、多版本安装包下载与下载计数、后台视频与软件管理（含 ≤2GB 分片上传安装包）。
- **阶段 14（公告 / 关于页 / 友链 / 文章分享）**：首页公告区（置顶优先、默认 5 条、其余弹窗、可展开）、关于页（头像/简介/社交链接/友链，空项不显示）、后台公告与友链管理、文章分享（复制链接 / Web Share / 二维码）。
- **阶段 15（后台设置中心）**：站点信息设置（名称/作者/描述，前台头部与页脚同步）、日志中心（操作日志与访问记录查询、动作筛选、关键词搜索、分页、概览统计）、手动清理超期日志；访问记录补齐 IP 归属地。
- **阶段 16（Docker 部署）**：多阶段 Dockerfile（standalone + 独立 Prisma CLI）、compose 双容器（应用 + Nginx）、Nginx 媒体与安装包直出（含 Range 与上传上限）、SSL 占位配置、`prisma migrate deploy` 入口脚本、备份脚本（保留 12 份）与部署手册。

## 部署

见 [docs/DEPLOY.md](docs/DEPLOY.md)。**该文档中的镜像构建与运行未在本机验证**（开发环境没有 Docker 与 nginx），首次部署请按手册中的核对清单逐项确认。

未运行项目测试套件，未自动提交或部署。
