# 渺の小家 · 个人博客

一个自己写来记录技术、生活与琐碎念头的地方。前台面向访客（ISR 静态化，打开快），
后台单管理员，文章、相册、视频、软件、音乐播放列表、评论都能在网页上管。
界面是深色底 + 半透明卡片 + 毛玻璃悬浮导航，支持日夜双主题，中文 / 英文双语。

## 功能

**前台**

- **首页**：全屏封面（背景支持视频 / 多图轮播 / 单图），打字机副标题，底部波浪过渡；
  下滑是「北京时间问候语 + 文章列表 + 侧边栏」两栏布局
- **文章**：Markdown 渲染 + Shiki 代码高亮、目录、阅读进度条与文章导航栏、代码块一键复制、
  浏览量统计、分享（复制链接 / 系统分享 / 二维码）
- **说说**：短内容，以**气泡卡片**的形式按时间夹杂在首页文章流里（长文与碎念一眼分得清），
  支持配图（最多 9 张）、地点、置顶；另有独立的「说说」页
- **内容页**：相册（网格 + 大图浏览）、视频（本地 / 外链）、软件下载（多版本 + 下载计数）、
  归档、分类、标签、关于页
- **评论**：文章评论与留言墙，两层嵌套回复，先审后显，显示 IP 归属地与浏览器信息
- **其他**：全站搜索、全站音乐播放器（路由切换不中断）、公告、友链、RSS 式的 sitemap 与 robots

**后台**

- 文章管理（Vditor 编辑器、草稿 / 置顶、分类与标签）
- 说说管理（配图从媒体库选或直接上传、地点、置顶 / 隐藏）
- 媒体库（分片上传、图片自动压缩转 WebP、生成缩略图、视频显示首帧、点击标题重命名）
- 相册、视频、软件与安装包、公告、友链、音乐播放列表
- 评论审核、站点设置（名称 / Logo / 页签图标 / 各种背景图 / ICP 与公安备案）、个人资料
- 操作日志与访问记录（保留 7 天，惰性清理）

**细节**

- 中文 / 英文双语路由，`hreflang` 与 canonical 齐全，sitemap 自动生成
- 全站 404 返回真正的 404 状态码
- 登录页有密码强度温度计、暂停输入后批改式打勾、电梯式浮动标签、输错时框体轻晃
- 所有动效零依赖，统一遵守 `prefers-reduced-motion`

## 技术栈

| 分类 | 选型 |
|---|---|
| 框架 | Next.js 15（App Router）+ React 19 |
| 语言 | TypeScript（strict） |
| 样式 | Tailwind CSS v4 + shadcn/ui（Radix 原语） |
| 数据 | Prisma + SQLite |
| 国际化 | next-intl |
| 内容 | Markdown + remark / rehype + Shiki；编辑器 Vditor |
| 图片 | sharp（压缩、转 WebP、缩略图） |
| 其他 | 自写 JWT（`node:crypto`）、ip2region 离线归属地、ua-parser-js |
| 部署 | Docker 双容器（Next.js standalone + Nginx），数据挂 `/data` |

## 快速开始

需要 **Node 20**（`.nvmrc` = `20.19.5`）。

```bash
nvm use                 # 切到 Node 20
npm install             # 安装依赖
cp .env.example .env    # 本地环境变量（.env 不入库）
npm run db:generate     # 生成 Prisma 客户端
npm run db:migrate      # 建表
npm run db:seed         # 写入示例数据（幂等，可重复执行）
npm run dev             # http://localhost:3000
```

后台在 `http://localhost:3000/admin`，默认账号见 `.env` 里的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`。

## 常用命令

| 用途 | 命令 |
|---|---|
| 开发调试 | `npm run dev` |
| 构建 | `npm run build` |
| 生产启动 | `npm run start` |
| 类型检查 | `npm run typecheck` |
| 代码检查 | `npm run lint` |
| 生成 Prisma 客户端 | `npm run db:generate` |
| 数据库迁移 | `npm run db:migrate -- --name xxx` |
| 写入种子数据 | `npm run db:seed` |
| 查看数据 | `npm run db:studio` |
| 批量优化历史图片 | `node scripts/optimize-images.mjs` |

## 目录结构

```
src/app/
  (site)/[locale]/      前台（/zh、/en），含首页、文章、相册、视频、软件、留言墙、搜索
  (admin)/admin/        后台（不参与语言路由，界面固定中文）
  api/                  接口：后台 CRUD、评论提交、浏览量、下载计数、分片上传
  media/                开发环境媒体直出（生产由 Nginx 承担）
  globals.css           Tailwind 入口 + 主题变量 + 全部动效类
src/components/
  site/                 前台组件
  admin/                后台组件
  ui/                   shadcn/ui 组件与通用件（浮动标签、打勾等）
src/lib/                数据访问与工具（query / posts / media / comments / revalidate …）
src/i18n/               next-intl 配置
src/middleware.ts       语言协商 + 后台鉴权 + 访问记录
prisma/                 schema、迁移、种子脚本
deploy/                 entrypoint、Nginx 配置、环境变量模板、备份 cron
docs/                   需求（SPEC.md）、部署手册、技术说明
scripts/                备份、图片优化、光标生成等脚本
data/                   ip2region 离线归属地库
messages/               中英文文案
```

> 前台与后台用**两个根布局**（Next.js 路由组），因此没有 `src/app/layout.tsx`。
> 根路径 `/` 301 到 `/zh`，`/admin` 被中间件排除在语言路由之外。

## 部署

生产用 Docker 双容器（应用 + Nginx），数据与媒体都落在 `/data` 卷。

- 一页纸版本：[docs/部署手册.md](docs/部署手册.md)
- 完整版（含核对清单与排障）：[docs/DEPLOY.md](docs/DEPLOY.md)

## 文档

| 文件 | 内容 |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | 需求唯一来源 |
| [docs/技术说明.md](docs/技术说明.md) | 实现细节与踩过的坑（改代码前建议先看） |
| [docs/部署手册.md](docs/部署手册.md) | 部署三步走 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 部署细节与排障 |
| [CLAUDE.md](CLAUDE.md) | 协作规则与阶段进度 |

## 许可

[MIT](LICENSE) © 2026 UstinianFiee
