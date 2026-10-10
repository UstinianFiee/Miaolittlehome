import { prisma } from "@/lib/prisma";

/**
 * 公告数据访问（docs/SPEC.md：多条公告，置顶优先 → 日期倒序；
 * 侧边栏默认展示 3 条，其余弹窗展示；不做定时发布）。
 */

/** 侧边栏公告展示条数；其余通过「查看更多」弹窗查看。 */
export const ANNOUNCEMENT_SIDEBAR_LIMIT = 3;

const announcementSelect = {
  id: true,
  content: true,
  pinned: true,
  published: true,
  createdAt: true,
  updatedAt: true,
};

export async function listPublishedAnnouncements(limit?: number) {
  return prisma.announcement.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    ...(limit ? { take: limit } : {}),
    select: announcementSelect,
  });
}

export async function countPublishedAnnouncements(): Promise<number> {
  return prisma.announcement.count({ where: { published: true } });
}

export async function listAnnouncementsForAdmin() {
  return prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: announcementSelect,
  });
}

export type AnnouncementInput = { content: string; pinned: boolean; published: boolean };

export async function createAnnouncement(input: AnnouncementInput) {
  return prisma.announcement.create({ data: input, select: announcementSelect });
}

export async function updateAnnouncement(id: number, input: AnnouncementInput) {
  const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.announcement.update({ where: { id }, data: input, select: announcementSelect });
}

export async function deleteAnnouncement(id: number) {
  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, content: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.announcement.delete({ where: { id } });
  return existing;
}
