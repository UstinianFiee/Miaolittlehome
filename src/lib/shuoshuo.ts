import { prisma } from "@/lib/prisma";

/**
 * 说说数据访问。
 *
 * 说说是一句话 / 一段碎念级别的短内容，**以气泡卡片的形式夹杂在首页文章流里**
 * （长文走 PostCardView，短内容走 ShuoshuoCard），另有 `/shuoshuo` 独立页。
 * 不做详情页：内容短，气泡里一次就展示完了。
 */

/** 单条说说最多几张配图（与朋友圈九宫格一致）。 */
export const SHUOSHUO_MAX_IMAGES = 9;
/** 独立页每页条数。 */
export const SHUOSHUO_PAGE_SIZE = 20;

export const shuoshuoSelect = {
  id: true,
  content: true,
  contentEn: true,
  images: true,
  location: true,
  pinned: true,
  published: true,
  createdAt: true,
  updatedAt: true,
};

export type ShuoshuoRecord = {
  id: number;
  content: string;
  contentEn: string | null;
  images: string;
  location: string | null;
  pinned: boolean;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** 把存库的 JSON 字符串安全地解析成路径数组（脏数据不至于让页面 500）。 */
export function parseImages(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, SHUOSHUO_MAX_IMAGES);
  } catch {
    return [];
  }
}

export async function listPublishedShuoshuo(params: { page?: number; pageSize?: number } = {}) {
  const pageSize = params.pageSize ?? SHUOSHUO_PAGE_SIZE;
  const page = Math.max(1, params.page ?? 1);

  const where = { published: true };

  const [total, items] = await Promise.all([
    prisma.shuoshuo.count({ where }),
    prisma.shuoshuo.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: shuoshuoSelect,
    }),
  ]);

  return { total, items, pageSize, page };
}

/** 首页用：取前 N 条已发布说说，和文章一起按时间排序。 */
export async function listPublishedShuoshuoForFeed(limit: number) {
  return prisma.shuoshuo.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: shuoshuoSelect,
  });
}

/** 侧边栏「最新说说」用。 */
export async function listRecentShuoshuo(limit = 3) {
  return prisma.shuoshuo.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: shuoshuoSelect,
  });
}

export async function countPublishedShuoshuo(): Promise<number> {
  return prisma.shuoshuo.count({ where: { published: true } });
}

// ---------- 后台 ----------

export async function listShuoshuoForAdmin() {
  return prisma.shuoshuo.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: shuoshuoSelect,
  });
}

export type ShuoshuoInput = {
  content: string;
  contentEn: string | null;
  images: string[];
  location: string | null;
  published: boolean;
  pinned: boolean;
};

function toData(input: ShuoshuoInput) {
  return {
    content: input.content,
    contentEn: input.contentEn,
    images: JSON.stringify(input.images.slice(0, SHUOSHUO_MAX_IMAGES)),
    location: input.location,
    published: input.published,
    pinned: input.pinned,
  };
}

export async function createShuoshuo(input: ShuoshuoInput) {
  return prisma.shuoshuo.create({ data: toData(input), select: shuoshuoSelect });
}

export async function updateShuoshuo(id: number, input: ShuoshuoInput) {
  const existing = await prisma.shuoshuo.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.shuoshuo.update({ where: { id }, data: toData(input), select: shuoshuoSelect });
}

export async function deleteShuoshuo(id: number) {
  const existing = await prisma.shuoshuo.findUnique({
    where: { id },
    select: { id: true, content: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.shuoshuo.delete({ where: { id } });
  return existing;
}
