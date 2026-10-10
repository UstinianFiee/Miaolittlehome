import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { postSlugBase, tagSlugBase, uniquePostSlug, uniqueTagSlug } from "@/lib/slug";

export const POST_LIST_PAGE_SIZE = 20;

export type PostStatusFilter = "all" | "published" | "draft";

export type PostListParams = {
  page: number;
  pageSize: number;
  status: PostStatusFilter;
  categoryId: number | null;
  keyword: string | null;
};

export const postListSelect = {
  id: true,
  title: true,
  slug: true,
  published: true,
  pinned: true,
  views: true,
  cover: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { id: true, name: true } } } },
} satisfies Prisma.PostSelect;

export async function listPosts(params: PostListParams) {
  const where: Prisma.PostWhereInput = {};

  if (params.status === "published") {
    where.published = true;
  } else if (params.status === "draft") {
    where.published = false;
  }

  if (params.categoryId !== null) {
    where.categoryId = params.categoryId;
  }

  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword } },
      { summary: { contains: params.keyword } },
      { slug: { contains: params.keyword } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: postListSelect,
    }),
  ]);

  return { total, items };
}

export async function getPostForEdit(id: number) {
  return prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      content: true,
      cover: true,
      categoryId: true,
      published: true,
      pinned: true,
      views: true,
      createdAt: true,
      updatedAt: true,
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  });
}

export type PostInput = {
  title: string;
  slug: string | null;
  summary: string;
  content: string;
  cover: string | null;
  categoryId: number | null;
  tagNames: string[];
  published: boolean;
  pinned: boolean;
};

/** 把标签名解析为 id，缺失的自动创建。 */
export async function resolveTagIds(names: string[]): Promise<number[]> {
  const ids: number[] = [];

  for (const name of names) {
    const existing = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const slug = await uniqueTagSlug(tagSlugBase(name));
    const created = await prisma.tag.create({ data: { name, slug }, select: { id: true } });
    ids.push(created.id);
  }

  return ids;
}

export async function createPost(input: PostInput) {
  const slug = await uniquePostSlug(postSlugBase(input.title, input.slug));
  const tagIds = await resolveTagIds(input.tagNames);

  return prisma.post.create({
    data: {
      title: input.title,
      slug,
      summary: input.summary,
      content: input.content,
      cover: input.cover,
      categoryId: input.categoryId,
      published: input.published,
      pinned: input.pinned,
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
    select: { id: true, slug: true },
  });
}

export async function updatePost(id: number, input: PostInput) {
  const current = await prisma.post.findUnique({
    where: { id },
    select: { slug: true },
  });

  if (!current) {
    return null;
  }

  const slug = await uniquePostSlug(postSlugBase(input.title, input.slug), id);
  const tagIds = await resolveTagIds(input.tagNames);

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: input.title,
      slug,
      summary: input.summary,
      content: input.content,
      cover: input.cover,
      categoryId: input.categoryId,
      published: input.published,
      pinned: input.pinned,
      tags: {
        deleteMany: {},
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    select: { id: true, slug: true },
  });

  return { updated, previousSlug: current.slug };
}

export async function deletePost(id: number) {
  const current = await prisma.post.findUnique({
    where: { id },
    select: { slug: true, title: true },
  });

  if (!current) {
    return null;
  }

  await prisma.post.delete({ where: { id } });
  return current;
}
