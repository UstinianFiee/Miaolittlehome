import type { Metadata } from "next";

import { SoftwareManager, type SoftwareRow } from "@/components/admin/software-manager";
import { catalogs } from "@/lib/messages";
import { listSoftwareForAdmin } from "@/lib/software";

export const metadata: Metadata = {
  title: catalogs.zh.adminSoftware.title,
};

export default async function AdminSoftwarePage() {
  const software = await listSoftwareForAdmin();

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

  return <SoftwareManager items={items} />;
}
