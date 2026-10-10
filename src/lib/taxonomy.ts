import { prisma } from "@/lib/prisma";
import { tagSlugBase, uniqueTagSlug } from "@/lib/slug";

/** 分类与标签的数据访问。 */

export const CATEGORY_TYPES = ["post", "video", "software"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export function isCategoryType(value: string): value is CategoryType {
  return (CATEGORY_TYPES as readonly string[]).includes(value);
}

/** 把任意输入归一化为 0~9999 的整数排序值。 */
export function normalizeSort(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(9999, parsed));
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: [{ type: "asc" }, { sort: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      type: true,
      sort: true,
      _count: { select: { posts: true } },
    },
  });
}

export async function listTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { posts: true } },
    },
  });
}

export async function createCategory(input: {
  name: string;
  nameEn: string | null;
  type: string;
  sort: number;
}) {
  return prisma.category.create({
    data: {
      name: input.name,
      nameEn: input.nameEn,
      type: input.type as never,
      sort: input.sort,
    },
    select: { id: true, name: true },
  });
}

export async function updateCategory(
  id: number,
  input: { name: string; nameEn: string | null; type: string; sort: number }
) {
  const current = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    return null;
  }

  return prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      nameEn: input.nameEn,
      type: input.type as never,
      sort: input.sort,
    },
    select: { id: true, name: true },
  });
}

export async function deleteCategory(id: number) {
  const current = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { posts: true } } },
  });

  if (!current) {
    return null;
  }

  await prisma.category.delete({ where: { id } });
  return current;
}

export async function createTag(name: string) {
  const slug = await uniqueTagSlug(tagSlugBase(name));
  return prisma.tag.create({ data: { name, slug }, select: { id: true, name: true } });
}

export async function findTagByName(name: string) {
  return prisma.tag.findUnique({ where: { name }, select: { id: true } });
}

export async function findCategoryByName(name: string) {
  return prisma.category.findUnique({ where: { name }, select: { id: true } });
}

export async function updateTag(id: number, name: string) {
  const current = await prisma.tag.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    return null;
  }

  return prisma.tag.update({
    where: { id },
    data: { name },
    select: { id: true, name: true },
  });
}

export async function deleteTag(id: number) {
  const current = await prisma.tag.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { posts: true } } },
  });

  if (!current) {
    return null;
  }

  await prisma.tag.delete({ where: { id } });
  return current;
}
