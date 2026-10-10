import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * 前台只读取「已发布」文章。
 * 所有查询都在服务端执行（SSG / ISR），客户端不直连数据库。
 */

export const SITE_PAGE_SIZE = 10;

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

/** 读取已发布文章的当前浏览量（供前端刷新显示）。 */
export async function getPublishedPostViews(slug: string): Promise<number | null> {
  const post = await prisma.post.findFirst({
    where: { slug, published: true },
    select: { views: true },
  });

  return post ? post.views : null;
}

/** 浏览量 +1。仅用于已发布文章。 */
export async function incrementPostViews(slug: string): Promise<number | null> {
  const post = await prisma.post.findFirst({
    where: { slug, published: true },
    select: { id: true },
  });

  if (!post) {
    return null;
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
    select: { views: true },
  });

  return updated.views;
}
