import type { Metadata } from "next";

import type { MediaOption } from "@/components/admin/media-field";
import { ShuoshuoManager, type ShuoshuoRow } from "@/components/admin/shuoshuo-manager";
import { listMedia } from "@/lib/media";
import { catalogs } from "@/lib/messages";
import { listShuoshuoForAdmin, parseImages } from "@/lib/shuoshuo";

export const metadata: Metadata = {
  title: catalogs.zh.adminShuoshuo.title,
};

export default async function AdminShuoshuoPage() {
  const [items, images] = await Promise.all([
    listShuoshuoForAdmin(),
    listMedia({ type: "image", limit: 200 }),
  ]);

  const rows: ShuoshuoRow[] = items.map((item) => ({
    id: item.id,
    content: item.content,
    contentEn: item.contentEn,
    images: parseImages(item.images),
    location: item.location,
    pinned: item.pinned,
    published: item.published,
    createdAt: item.createdAt.toISOString(),
  }));

  const imageOptions: MediaOption[] = images.map((item) => ({
    id: item.id,
    path: item.path,
    title: item.title ?? item.path,
  }));

  return <ShuoshuoManager items={rows} images={imageOptions} />;
}
