// 种子数据：docs/SPEC.md「数据与外部系统 → 种子数据」
// 运行：npm run db:seed
//
// 设计为幂等：优先用唯一键 upsert；无唯一键的实体按「自然键」查找后创建，
// 不会删除已有数据（重复执行安全）。

import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me-before-first-run";
const DEMO_IMAGE = "uploads/demo/cover.svg";
const DEMO_IMAGE_URL = "/media/demo/cover.svg";

/** 自然键不存在则创建，存在则更新（用于没有唯一约束的实体）。 */
async function ensure(model, where, data) {
  const existing = await model.findFirst({ where });
  if (existing) {
    return model.update({ where: { id: existing.id }, data });
  }
  return model.create({ data });
}

function fileSize(relativePath) {
  const absolute = path.join(process.cwd(), relativePath);
  return fs.existsSync(absolute) ? BigInt(fs.statSync(absolute).size) : BigInt(0);
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: { passwordHash },
    create: { username: ADMIN_USERNAME, passwordHash },
  });
  return ADMIN_USERNAME;
}

async function seedCategories() {
  const rows = [
    { name: "随笔", nameEn: "Notes", type: "post", sort: 1 },
    { name: "技术", nameEn: "Tech", type: "post", sort: 2 },
    { name: "视频", nameEn: "Videos", type: "video", sort: 3 },
    { name: "软件", nameEn: "Software", type: "software", sort: 4 },
  ];

  for (const row of rows) {
    await prisma.category.upsert({ where: { name: row.name }, update: row, create: row });
  }
}

async function seedTags() {
  const rows = [
    { name: "Next.js", slug: "nextjs" },
    { name: "TypeScript", slug: "typescript" },
    { name: "Prisma", slug: "prisma" },
    { name: "随笔", slug: "essay" },
  ];

  for (const row of rows) {
    await prisma.tag.upsert({ where: { slug: row.slug }, update: row, create: row });
  }
}

async function seedPosts() {
  const categoryByName = async (name) =>
    (await prisma.category.findUnique({ where: { name } }))?.id ?? null;
  const tagBySlug = async (slug) => prisma.tag.findUnique({ where: { slug } });

  const posts = [
    {
      slug: "hello-blog",
      title: "开始写博客这件事",
      titleEn: "On starting a blog",
      summary: "为什么重新开一个博客，以及我打算在这里写些什么。",
      summaryEn: "Why I started blogging again, and what I plan to write about.",
      categoryId: await categoryByName("随笔"),
      published: true,
      pinned: false,
      tags: ["essay"],
      content: [
        "## 为什么写",
        "",
        "写下来的东西才真正属于自己。这个博客首先是写给自己看的：把踩过的坑、想清楚的事、",
        "以及一些不成体系的念头放在一个不会被时间冲走的地方。",
        "",
        "> 如果恰好对你有用，那就更好了。",
        "",
        "## 打算写什么",
        "",
        "- 前端与工程化实践",
        "- 一些读代码的笔记",
        "- 偶尔的随笔",
      ].join("\n"),
    },
    {
      slug: "build-blog-with-nextjs",
      title: "用 Next.js 15 搭建个人博客",
      titleEn: "Building a blog with Next.js 15",
      summary: "从零搭建一个个人博客：技术选型、目录结构与踩坑记录。",
      summaryEn: "Tech choices, project layout and pitfalls when building a blog from scratch.",
      categoryId: await categoryByName("技术"),
      published: true,
      pinned: true,
      tags: ["nextjs", "typescript"],
      content: [
        "## 技术选型",
        "",
        "核心诉求是「加载快、能静态化、部署简单」，所以选了 Next.js App Router。",
        "",
        "```ts",
        "// next.config.ts",
        "const nextConfig: NextConfig = {",
        '  output: "standalone",',
        "};",
        "```",
        "",
        "## 目录结构",
        "",
        "前台走语言路由，后台不参与国际化，因此使用两个根布局。",
      ].join("\n"),
    },
    {
      slug: "prisma-sqlite-notes",
      title: "Prisma + SQLite 的实践笔记",
      titleEn: "Notes on Prisma with SQLite",
      summary: "在 SQLite 上使用 Prisma 的注意事项：枚举、大整数与迁移。",
      summaryEn: "Enums, big integers and migrations when using Prisma on SQLite.",
      categoryId: await categoryByName("技术"),
      published: true,
      pinned: false,
      tags: ["prisma", "typescript"],
      cover: DEMO_IMAGE_URL,
      content: [
        "## 两个容易踩的点",
        "",
        "第一，文件体积要用 `BigInt`：2GB 已经超过 32 位整数的上限。",
        "",
        "![示例图片](" + DEMO_IMAGE_URL + ")",
        "",
        "第二，枚举在 SQLite 上由 Prisma 以文本实现，数据库层没有额外约束。",
        "",
        "```prisma",
        "model Media {",
        "  id   Int       @id @default(autoincrement())",
        "  type MediaType",
        "  size BigInt",
        "}",
        "```",
      ].join("\n"),
    },
  ];

  for (const post of posts) {
    const { tags, ...data } = post;
    const saved = await prisma.post.upsert({
      where: { slug: data.slug },
      update: data,
      create: data,
    });

    await prisma.postTag.deleteMany({ where: { postId: saved.id } });
    for (const slug of tags) {
      const tag = await tagBySlug(slug);
      if (tag) {
        await prisma.postTag.create({ data: { postId: saved.id, tagId: tag.id } });
      }
    }
  }
}

async function seedComments() {
  const parent = await ensure(
    prisma.comment,
    { type: "wall", author: "路过的小明" },
    {
      type: "wall",
      refId: null,
      author: "路过的小明",
      email: null,
      content: "博客配色很舒服，期待更新！",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      browser: "Edge",
      os: "Windows 10",
      ipRegion: "中国 广东 深圳",
      isAdmin: false,
      approved: true,
    }
  );

  await ensure(
    prisma.comment,
    { type: "wall", author: "Shifenmiao" },
    {
      type: "wall",
      refId: null,
      author: "Shifenmiao",
      email: null,
      content: "谢谢！会持续更新的。",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      browser: "Safari",
      os: "macOS",
      ipRegion: "中国 北京 北京",
      parentId: parent.id,
      isAdmin: true,
      approved: true,
    }
  );
}

async function seedFriends() {
  const rows = [
    {
      name: "Vercel",
      url: "https://vercel.com",
      avatar: null,
      description: "前端云平台",
      sort: 1,
    },
    {
      name: "GitHub",
      url: "https://github.com",
      avatar: null,
      description: "代码托管",
      sort: 2,
    },
  ];

  for (const row of rows) {
    await ensure(prisma.friend, { url: row.url }, row);
  }
}

async function seedMediaAndAlbum() {
  const image = await ensure(
    prisma.media,
    { path: DEMO_IMAGE_URL },
    {
      type: "image",
      path: DEMO_IMAGE_URL,
      thumb: null,
      title: "示例封面",
      size: fileSize(DEMO_IMAGE),
    }
  );

  await ensure(
    prisma.media,
    { path: "/media/demo/sample.wav" },
    {
      type: "audio",
      path: "/media/demo/sample.wav",
      thumb: null,
      title: "示例音乐 A",
      size: fileSize("uploads/demo/sample.wav"),
    }
  );

  await ensure(
    prisma.media,
    { path: "/media/demo/sample-b.wav" },
    {
      type: "audio",
      path: "/media/demo/sample-b.wav",
      thumb: null,
      title: "示例音乐 B",
      size: fileSize("uploads/demo/sample-b.wav"),
    }
  );

  await ensure(
    prisma.media,
    { path: "/media/demo/sample.mp4" },
    {
      type: "video",
      path: "/media/demo/sample.mp4",
      thumb: null,
      title: "示例视频",
      size: BigInt(12_000_000),
    }
  );

  const album = await prisma.album.upsert({
    where: { name: "示例相册" },
    update: { nameEn: "Sample Album", description: "用于验证相册列表与浏览。" },
    create: {
      name: "示例相册",
      nameEn: "Sample Album",
      description: "用于验证相册列表与浏览。",
      sort: 1,
    },
  });

  await prisma.media.update({
    where: { id: image.id },
    data: { albumId: album.id },
  });
}

async function seedVideos() {
  const rows = [
    {
      title: "示例视频：本站演示片段",
      titleEn: "Demo video clip",
      // 故意不设封面：视频没有服务端缩略图，这里正好演示 VideoThumb 的首帧兜底
      cover: null,
      sourceType: "local",
      srcUrl: "/media/demo/sample.mp4",
      description: "用于验证视频列表与播放页的示例视频。",
      published: true,
      pinned: false,
      sort: 0,
    },
    {
      title: "示例视频：外链嵌入",
      titleEn: "Embedded video",
      cover: null,
      sourceType: "iframe",
      srcUrl: "https://www.example.com/embed/demo",
      description: "用于验证 iframe 外链嵌入方式。",
      published: true,
      pinned: false,
      sort: 1,
    },
  ];

  for (const row of rows) {
    await ensure(prisma.video, { title: row.title }, row);
  }
}

async function seedSoftware() {
  const rows = [
    {
      name: "示例工具",
      nameEn: "Demo Tool",
      icon: DEMO_IMAGE_URL,
      description: "用于验证软件分享页的示例条目。",
      published: true,
      sort: 0,
    },
  ];

  for (const row of rows) {
    const software = await ensure(prisma.software, { name: row.name }, row);

    await ensure(
      prisma.softwareFile,
      { softwareId: software.id, version: "1.0.0" },
      {
        softwareId: software.id,
        version: "1.0.0",
        platform: "windows",
        fileName: "demo-tool-1.0.0.zip",
        // 公开路径；真实文件在 SOFTWARE_DIR/demo/ 下，随仓库自带
        filePath: "/software-files/demo/demo-tool-1.0.0.zip",
        fileSize: fileSize("software/demo/demo-tool-1.0.0.zip"),
        downloads: 0,
      }
    );
  }
}

async function seedAnnouncements() {
  // 种子放 7 条：验证「首页默认 5 条 + 其余弹窗展示」（docs/SPEC.md 验收项）
  const rows = [
    { content: "博客已上线，欢迎随便逛逛，也欢迎在留言墙留句话。", pinned: true, published: true },
    { content: "新增了相册页面，照片会陆续整理上来。", pinned: false, published: true },
    { content: "文章评论区已开放，采用先审后显的方式。", pinned: false, published: true },
    { content: "软件分享页上线，支持多版本安装包下载。", pinned: false, published: true },
    { content: "全站音乐播放器已可用，切换页面不会中断播放。", pinned: false, published: true },
    { content: "搜索功能已上线，支持跨文章 / 相册 / 视频 / 软件检索。", pinned: false, published: true },
    { content: "这是一条已隐藏的公告，只用于验证后台的显示/隐藏功能。", pinned: false, published: false },
  ];

  for (const row of rows) {
    await ensure(prisma.announcement, { content: row.content }, row);
  }
}

async function seedShuoshuo() {
  // 说说：短内容，以气泡卡片夹杂在首页文章流里
  const rows = [
    {
      content:
        "把首页的文章流和说说混在一起了 —— 长文归长文，随手记的碎念就用气泡卡片，看起来像在聊天。",
      location: "广东 · 深圳",
      images: JSON.stringify([DEMO_IMAGE_URL]),
      pinned: true,
      published: true,
    },
    {
      content: "折腾了一晚上缓存失效，最后发现是路由组名字没写对。",
      location: null,
      images: "[]",
      pinned: false,
      published: true,
    },
    {
      content: "相册页整理完了，照片还在慢慢传。",
      location: "浙江 · 杭州",
      images: "[]",
      pinned: false,
      published: true,
    },
    {
      content: "这是一条已隐藏的说说，只用于验证后台的显示 / 隐藏功能。",
      location: null,
      images: "[]",
      pinned: false,
      published: false,
    },
  ];

  for (const row of rows) {
    await ensure(prisma.shuoshuo, { content: row.content }, row);
  }
}

async function seedSettings() {
  // 播放列表以 JSON 存在 Setting 里，前台播放器直接读取
  const playlist = [
    {
      id: "demo-a",
      title: "示例音乐 A",
      artist: "Demo",
      src: "/media/demo/sample.wav",
      cover: DEMO_IMAGE_URL,
    },
    {
      id: "demo-b",
      title: "示例音乐 B",
      artist: "Demo",
      src: "/media/demo/sample-b.wav",
      cover: DEMO_IMAGE_URL,
    },
  ];

  const rows = [
    { key: "site.name", value: "渺の小家" },
    { key: "site.author", value: "Shifenmiao" },
    { key: "site.description", value: "记录技术、生活与琐碎念头的地方。" },
    { key: "profile.bio", value: "写代码，也写字。" },
    { key: "profile.avatar", value: DEMO_IMAGE_URL },
    { key: "social.github", value: "https://github.com/" },
    { key: "playlist", value: JSON.stringify(playlist) },
  ];

  for (const row of rows) {
    await prisma.setting.upsert({ where: { key: row.key }, update: row, create: row });
  }
}

async function main() {
  const username = await seedAdmin();
  await seedCategories();
  await seedTags();
  await seedPosts();
  await seedComments();
  await seedFriends();
  await seedMediaAndAlbum();
  await seedVideos();
  await seedSoftware();
  await seedAnnouncements();
  await seedShuoshuo();
  await seedSettings();

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    tags: await prisma.tag.count(),
    posts: await prisma.post.count(),
    postTags: await prisma.postTag.count(),
    comments: await prisma.comment.count(),
    friends: await prisma.friend.count(),
    media: await prisma.media.count(),
    albums: await prisma.album.count(),
    videos: await prisma.video.count(),
    software: await prisma.software.count(),
    softwareFiles: await prisma.softwareFile.count(),
    announcements: await prisma.announcement.count(),
    shuoshuo: await prisma.shuoshuo.count(),
    settings: await prisma.setting.count(),
  };

  console.log(`种子完成，管理员账号：${username}`);
  console.table(counts);
}

main()
  .catch((error) => {
    console.error("种子执行失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
