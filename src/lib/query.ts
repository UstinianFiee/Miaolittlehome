import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { shuoshuoSelect, type ShuoshuoRecord } from "@/lib/shuoshuo";

/**
 * 前台只读取「已发布」文章。
 * 所有查询都在服务端执行（SSG / ISR），客户端不直连数据库。
 */

export const SITE_PAGE_SIZE = 10;

/** About page uses only public content, never drafts or unfiled media. */
export async function getAboutOverview() {
  const [posts, notes, albums, friends, recent, photos, latestNote] = await Promise.all([
    prisma.post.count({ where: { published: true } }),
    prisma.shuoshuo.count({ where: { published: true } }),
    prisma.album.count(), prisma.friend.count(),
    prisma.post.findMany({ where: { published: true }, take: 3, orderBy: { createdAt: "desc" }, select: { slug: true, title: true, titleEn: true, createdAt: true } }),
    prisma.media.findMany({ where: { type: "image", albumId: { not: null } }, take: 3, orderBy: { createdAt: "desc" }, select: { id: true, path: true, thumb: true, title: true, albumId: true } }),
    prisma.shuoshuo.findFirst({ where: { published: true }, orderBy: { createdAt: "desc" }, select: { content: true, contentEn: true, createdAt: true } }),
  ]);
  return { posts, notes, albums, friends, recent, photos, latestNote };
}

export const postCardSelect = {
  id: true,
  title: true,
  titleEn: true,
  slug: true,
  summary: true,
  summaryEn: true,
  cover: true,
  views: true,
  pinned: true,
  createdAt: true,
  category: { select: { id: true, name: true, nameEn: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.PostSelect;

export type PostCard = Prisma.PostGetPayload<{ select: typeof postCardSelect }>;

export async function listPublishedPosts(params: {
  page: number;
  pageSize?: number;
  categoryId?: number | null;
  tagId?: number | null;
  keyword?: string | null;
}) {
  const pageSize = params.pageSize ?? SITE_PAGE_SIZE;

  const where: Prisma.PostWhereInput = { published: true };

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }
  if (params.tagId) {
    where.tags = { some: { tagId: params.tagId } };
  }
  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword } },
      { summary: { contains: params.keyword } },
      { content: { contains: params.keyword } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * pageSize,
      take: pageSize,
      select: postCardSelect,
    }),
  ]);

  return { total, items, pageSize };
}

/**
 * 已发布文章总数。
 * 分页页只需要用它判断页码是否越界 / 算出总页数，避免再执行一次带 `findMany` 的列表查询。
 */
export async function countPublishedPosts(): Promise<number> {
  return prisma.post.count({ where: { published: true } });
}

/** 侧边栏「热点文章」：按浏览量降序。 */
export async function listPopularPosts(limit = 5) {
  return prisma.post.findMany({
    where: { published: true },
    orderBy: [{ views: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      titleEn: true,
      slug: true,
      views: true,
      createdAt: true,
    },
  });
}

/** 侧边栏「最新文章」：轻量字段。 */
export async function listRecentPosts(limit = 5) {
  return prisma.post.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      titleEn: true,
      slug: true,
      views: true,
      createdAt: true,
    },
  });
}

export async function getPublishedPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: { slug, published: true },
    select: {
      ...postCardSelect,
      content: true,
      contentEn: true,
      updatedAt: true,
    },
  });
}

/** generateStaticParams 用：所有已发布文章的 slug。 */
export async function listPublishedSlugs() {
  return prisma.post.findMany({
    where: { published: true },
    select: { slug: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCategoriesWithCount() {
  return prisma.category.findMany({
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      type: true,
      _count: { select: { posts: { where: { published: true } } } },
    },
  });
}

export async function getCategoryById(id: number) {
  return prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, nameEn: true, type: true },
  });
}

export async function listTagsWithCount() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { posts: { where: { post: { published: true } } } } },
    },
  });
}

export async function getTagBySlug(slug: string) {
  return prisma.tag.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export type ArchiveGroup = {
  /** 形如 2026-10 */
  key: string;
  year: number;
  month: number;
  posts: { id: number; title: string; titleEn: string | null; slug: string; createdAt: Date }[];
};

/** 归档：按年月分组，组内与组间均按时间倒序。 */
export async function listArchive(): Promise<ArchiveGroup[]> {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, titleEn: true, slug: true, createdAt: true },
  });

  const groups = new Map<string, ArchiveGroup>();

  for (const post of posts) {
    const year = post.createdAt.getUTCFullYear();
    const month = post.createdAt.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    const group = groups.get(key) ?? { key, year, month, posts: [] };
    group.posts.push(post);
    groups.set(key, group);
  }

  return [...groups.values()];
}

/** sitemap 用：所有已发布文章的 slug 与更新时间。 */
export async function listPostsForSitemap() {
  return prisma.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** 前台相册列表；封面为空时取相册内首图。 */
export async function listAlbumsForSite() {
  const albums = await prisma.album.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      cover: true,
      description: true,
      media: {
        where: { type: "image" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { path: true, thumb: true },
      },
      _count: { select: { media: { where: { type: "image" } } } },
    },
  });

  return albums.map((album) => ({
    id: album.id,
    name: album.name,
    nameEn: album.nameEn,
    description: album.description,
    cover: album.cover ?? album.media[0]?.thumb ?? album.media[0]?.path ?? null,
    count: album._count.media,
  }));
}

export async function getAlbumWithPhotos(id: number) {
  const album = await prisma.album.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameEn: true,
      description: true,
      cover: true,
      media: {
        where: { type: "image" },
        orderBy: { createdAt: "asc" },
        select: { id: true, path: true, thumb: true, title: true },
      },
    },
  });

  if (!album) {
    return null;
  }

  return {
    id: album.id,
    name: album.name,
    nameEn: album.nameEn,
    description: album.description,
    cover: album.cover ?? album.media[0]?.thumb ?? album.media[0]?.path ?? null,
    photos: album.media.map((item) => ({
      id: item.id,
      src: item.path,
      thumb: item.thumb ?? item.path,
      title: item.title,
    })),
  };
}

// ---------- 首页信息流（文章 + 说说） ----------

export type FeedEntry =
  | { kind: "post"; id: number; createdAt: Date; post: PostCard }
  | { kind: "shuoshuo"; id: number; createdAt: Date; shuoshuo: ShuoshuoRecord };

/**
 * 首页信息流：文章与说说按时间合并。
 *
 * 两张表没法在一条 SQL 里 union 再分页（Prisma 不支持），所以：
 * 1) 只取两张表的 `(id, pinned, createdAt)` —— 数据量很小（每条几十字节）；
 * 2) 在 JS 里按「置顶优先 → 时间倒序」合并排序，切出当前页；
 * 3) 再按 id 批量取这一页的完整记录。
 *
 * 这样**分页边界是准确的**（不会出现某一页少几条），也不会把全部正文拉进内存。
 */
export async function listPublishedFeed(params: { page: number; pageSize: number }) {
  const [postRows, shuoshuoRows] = await Promise.all([
    prisma.post.findMany({
      where: { published: true },
      select: { id: true, pinned: true, createdAt: true },
    }),
    prisma.shuoshuo.findMany({
      where: { published: true },
      select: { id: true, pinned: true, createdAt: true },
    }),
  ]);

  const merged = [
    ...postRows.map((row) => ({
      kind: "post" as const,
      id: row.id,
      pinned: row.pinned,
      createdAt: row.createdAt,
    })),
    ...shuoshuoRows.map((row) => ({
      kind: "shuoshuo" as const,
      id: row.id,
      pinned: row.pinned,
      createdAt: row.createdAt,
    })),
  ].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const total = merged.length;
  const start = Math.max(0, (params.page - 1) * params.pageSize);
  const slice = merged.slice(start, start + params.pageSize);

  const postIds = slice.filter((item) => item.kind === "post").map((item) => item.id);
  const shuoshuoIds = slice.filter((item) => item.kind === "shuoshuo").map((item) => item.id);

  const [posts, shuoshuo] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({ where: { id: { in: postIds } }, select: postCardSelect })
      : Promise.resolve([]),
    shuoshuoIds.length
      ? prisma.shuoshuo.findMany({ where: { id: { in: shuoshuoIds } }, select: shuoshuoSelect })
      : Promise.resolve([]),
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post]));
  const shuoshuoMap = new Map(shuoshuo.map((item) => [item.id, item]));

  const entries: FeedEntry[] = [];
  for (const item of slice) {
    if (item.kind === "post") {
      const post = postMap.get(item.id);
      if (post) {
        entries.push({ kind: "post", id: item.id, createdAt: item.createdAt, post });
      }
    } else {
      const one = shuoshuoMap.get(item.id);
      if (one) {
        entries.push({ kind: "shuoshuo", id: item.id, createdAt: item.createdAt, shuoshuo: one });
      }
    }
  }

  return { entries, total, pageSize: params.pageSize };
}

/**
 * 首页信息流总条数（文章 + 说说）。
 *
 * `listPublishedFeed` 为了准确分页必须把两张表的 `(id, pinned, createdAt)` 全取回来；
 * 而分页页只是为了判断「页码是否越界 / 一共几页」时，两条 count 就能得到同一个 total，
 * 不必再为算总数跑一遍全量查询。
 */
export async function countPublishedFeed(): Promise<number> {
  const [posts, shuoshuo] = await Promise.all([
    prisma.post.count({ where: { published: true } }),
    prisma.shuoshuo.count({ where: { published: true } }),
  ]);

  return posts + shuoshuo;
}

/** 读取已发布文章的当前浏览量（供前端刷新显示）。 */
export async function getPublishedPostViews(slug: string): Promise<number | null> {
  const post = await prisma.post.findFirst({
    where: { slug, published: true },
    select: { views: true },
  });

  return post ? post.views : null;
}

/**
 * 浏览量 +1。仅用于已发布文章。
 *
 * 注意 `Post.updatedAt` 是 Prisma 的 `@updatedAt`：任何 update 都会把它写成当前时间。
 * 而「被浏览」不等于「内容被编辑」——不处理的话，每被看一眼：
 * - sitemap 里这篇文章的 `lastModified` 就变成「刚刚更新」（`listPostsForSitemap`）；
 * - 文章页的 `updatedAt - createdAt > 60s` 判定会把从未编辑过的文章显示成「更新于」。
 * 所以这里把原值读出来，在同一次 update 里显式回写（Prisma 允许显式给 `@updatedAt`
 * 字段赋值），让「更新时间」只跟随内容编辑。
 */
export async function incrementPostViews(slug: string): Promise<number | null> {
  const post = await prisma.post.findFirst({
    where: { slug, published: true },
    select: { id: true, updatedAt: true },
  });

  if (!post) {
    return null;
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { views: { increment: 1 }, updatedAt: post.updatedAt },
    select: { views: true },
  });

  return updated.views;
}
