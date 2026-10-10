import type { Metadata } from "next";

import { AlbumManager, type AlbumRow } from "@/components/admin/album-manager";
import { listAlbums } from "@/lib/albums";
import { catalogs } from "@/lib/messages";

export const metadata: Metadata = {
  title: catalogs.zh.albums.title,
};

export default async function AdminAlbumsPage() {
  const albums = await listAlbums();

  const items: AlbumRow[] = albums.map((album) => ({
    id: album.id,
    name: album.name,
    nameEn: album.nameEn,
    cover: album.cover,
    description: album.description,
    sort: album.sort,
    photoCount: album._count.media,
  }));

  return <AlbumManager items={items} />;
}
