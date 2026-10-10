import type { Prisma, VideoSourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** 视频数据访问（docs/SPEC.md：视频独立成表，不复用 Post）。 */

export const videoCardSelect = {
  id: true,
  title: true,
  titleEn: true,
  cover: true,
  sourceType: true,
  srcUrl: true,
  description: true,
  pinned: true,
  sort: true,
  createdAt: true,
} satisfies Prisma.VideoSelect;

export type VideoCard = Prisma.VideoGetPayload<{ select: typeof videoCardSelect }>;

export async function listPublishedVideos(): Promise<VideoCard[]> {
  return prisma.video.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { sort: "asc" }, { createdAt: "desc" }],
    select: videoCardSelect,
  });
}

export async function getPublishedVideo(id: number): Promise<VideoCard | null> {
  return prisma.video.findFirst({
    where: { id, published: true },
    select: videoCardSelect,
  });
}

export async function listPublishedVideoIds() {
  return prisma.video.findMany({
    where: { published: true },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listVideosForAdmin() {
  return prisma.video.findMany({
    orderBy: [{ pinned: "desc" }, { sort: "asc" }, { createdAt: "desc" }],
    select: { ...videoCardSelect, published: true, updatedAt: true },
  });
}

export type VideoInput = {
  title: string;
  titleEn: string | null;
  cover: string | null;
  sourceType: VideoSourceType;
  srcUrl: string;
  description: string | null;
  published: boolean;
  pinned: boolean;
  sort: number;
};

export async function createVideo(input: VideoInput) {
  return prisma.video.create({ data: input, select: { id: true, title: true } });
}

export async function updateVideo(id: number, input: VideoInput) {
  const existing = await prisma.video.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.video.update({ where: { id }, data: input, select: { id: true, title: true } });
}

export async function deleteVideo(id: number) {
  const existing = await prisma.video.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.video.delete({ where: { id } });
  return existing;
}

/** 校验视频来源：本地要求站内路径，iframe 要求 http(s) 外链。 */
export function validateVideoSource(
  sourceType: VideoSourceType,
  srcUrl: string
): { ok: true } | { ok: false; message: string } {
  if (sourceType === "local") {
    return srcUrl.startsWith("/")
      ? { ok: true }
      : { ok: false, message: "本地视频地址需以 / 开头（例如 /media/…）" };
  }

  return /^https?:\/\//i.test(srcUrl)
    ? { ok: true }
    : { ok: false, message: "外链视频地址需以 http:// 或 https:// 开头" };
}
