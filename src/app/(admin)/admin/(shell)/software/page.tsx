import type { Metadata } from "next";

import { SoftwareManager, type SoftwareRow } from "@/components/admin/software-manager";
import type { MediaOption } from "@/components/admin/media-field";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";
import { listSoftwareForAdmin } from "@/lib/software";

export const metadata: Metadata = {
  title: catalogs.zh.adminSoftware.title,
};

export default async function AdminSoftwarePage() {
  const [software, images] = await Promise.all([
    listSoftwareForAdmin(),
    listMedia({ type: "image", limit: 200 }),
  ]);

  const items: SoftwareRow[] = software.map((item) => ({
    id: item.id,
    name: item.name,
    nameEn: item.nameEn,
    icon: item.icon,
    description: item.description,
    published: item.published,
    sort: item.sort,
    files: item.files.map((file) => ({
      id: file.id,
      version: file.version,
      platform: file.platform,
      fileName: file.fileName,
      // BigInt → string，避免序列化问题
      fileSize: file.fileSize.toString(),
      downloads: file.downloads,
    })),
  }));

  const imageOptions: MediaOption[] = images.map((image) => ({
    id: image.id,
    path: image.path,
    title: image.title ?? image.path,
  }));

  return <SoftwareManager items={items} images={imageOptions} />;
}
