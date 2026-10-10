import { prisma } from "@/lib/prisma";

/** 相册数据访问。封面为空时由前台取相册内首图。 */

export async function listAlbums() {
  return prisma.album.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      cover: true,
      description: true,
      sort: true,
      _count: { select: { media: true } },
    },
  });
}

export type AlbumInput = {
  name: string;
  nameEn: string | null;
  description: string | null;
  cover: string | null;
  sort: number;
};

export async function createAlbum(input: AlbumInput) {
  return prisma.album.create({
    data: input,
    select: { id: true, name: true },
  });
}

export async function updateAlbum(id: number, input: AlbumInput) {
  const existing = await prisma.album.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.album.update({
    where: { id },
    data: input,
    select: { id: true, name: true },
  });
}

/** 删除相册；其下媒体的 albumId 由外键置空（onDelete: SetNull）。 */
export async function deleteAlbum(id: number) {
  const existing = await prisma.album.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { media: true } } },
  });

  if (!existing) {
    return null;
  }

  await prisma.album.delete({ where: { id } });
  return existing;
}
