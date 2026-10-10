import type { Prisma, SoftwarePlatform } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { removePackageFile, toPackagePublicPath } from "@/lib/software-storage";

/** 软件分享数据访问（docs/SPEC.md：软件独立成表，支持多版本安装包）。 */

export const PLATFORMS: SoftwarePlatform[] = ["windows", "macos", "linux", "android", "ios"];

export function isPlatform(value: string): value is SoftwarePlatform {
  return (PLATFORMS as string[]).includes(value);
}

const fileSelect = {
  id: true,
  version: true,
  platform: true,
  fileName: true,
  filePath: true,
  fileSize: true,
  downloads: true,
  createdAt: true,
} satisfies Prisma.SoftwareFileSelect;

/** 列表页：带安装包数量与总下载量，不返回每个文件的明细。 */
export async function listPublishedSoftware() {
  return prisma.software.findMany({
    where: { published: true },
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      icon: true,
      description: true,
      createdAt: true,
      files: { select: { downloads: true, platform: true, fileSize: true } },
    },
  });
}

export async function getPublishedSoftware(id: number) {
  return prisma.software.findFirst({
    where: { id, published: true },
    select: {
      id: true,
      name: true,
      nameEn: true,
      icon: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      files: { select: fileSelect, orderBy: [{ createdAt: "desc" }] },
    },
  });
}

export async function listPublishedSoftwareIds() {
  return prisma.software.findMany({
    where: { published: true },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSoftwareForAdmin() {
  return prisma.software.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      icon: true,
      description: true,
      published: true,
      sort: true,
      createdAt: true,
      updatedAt: true,
      files: { select: fileSelect, orderBy: [{ createdAt: "desc" }] },
    },
  });
}

export type SoftwareInput = {
  name: string;
  nameEn: string | null;
  icon: string | null;
  description: string;
  published: boolean;
  sort: number;
};

export async function createSoftware(input: SoftwareInput) {
  return prisma.software.create({ data: input, select: { id: true, name: true } });
}

export async function updateSoftware(id: number, input: SoftwareInput) {
  const existing = await prisma.software.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.software.update({ where: { id }, data: input, select: { id: true, name: true } });
}

/** 删除软件及其安装包文件（数据库记录由级联删除处理）。 */
export async function deleteSoftware(id: number) {
  const existing = await prisma.software.findUnique({
    where: { id },
    select: { id: true, name: true, files: { select: { filePath: true } } },
  });

  if (!existing) {
    return null;
  }

  await prisma.software.delete({ where: { id } });

  for (const file of existing.files) {
    await removePackageFile(file.filePath);
  }

  return existing;
}

export async function addSoftwareFile(params: {
  softwareId: number;
  version: string;
  platform: SoftwarePlatform;
  fileName: string;
  relativePath: string;
  fileSize: number;
}) {
  const software = await prisma.software.findUnique({
    where: { id: params.softwareId },
    select: { id: true },
  });

  if (!software) {
    return null;
  }

  return prisma.softwareFile.create({
    data: {
      softwareId: params.softwareId,
      version: params.version,
      platform: params.platform,
      fileName: params.fileName,
      filePath: toPackagePublicPath(params.relativePath),
      fileSize: BigInt(params.fileSize),
    },
    select: fileSelect,
  });
}

/** 删除某个安装包；同时删除磁盘文件。 */
export async function deleteSoftwareFile(id: number) {
  const existing = await prisma.softwareFile.findUnique({
    where: { id },
    select: { id: true, fileName: true, filePath: true, softwareId: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.softwareFile.delete({ where: { id } });
  await removePackageFile(existing.filePath);

  return existing;
}

export async function getSoftwareFileForDownload(id: number) {
  return prisma.softwareFile.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      filePath: true,
      version: true,
      platform: true,
      software: { select: { id: true, name: true, published: true } },
    },
  });
}

export async function incrementDownload(id: number) {
  return prisma.softwareFile.update({
    where: { id },
    data: { downloads: { increment: 1 } },
    select: { downloads: true },
  });
}
