import type { Metadata } from "next";

import { AlbumManager, type AlbumRow } from "@/components/admin/album-manager";
import type { MediaOption } from "@/components/admin/media-field";
import { listAlbums } from "@/lib/albums";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";

export const metadata: Metadata = {
  title: catalogs.zh.albums.title,
};

export default async function AdminAlbumsPage() {
  const [albums, images] = await Promise.all([listAlbums(), listMedia({ type: "image", limit: 200 })]);

  const items: AlbumRow[] = albums.map((album) => ({
    id: album.id,
    name: album.name,
    nameEn: album.nameEn,
    cover: album.cover,
    description: album.description,
    sort: album.sort,
    photoCount: album._count.media,
  }));

  const imageOptions: MediaOption[] = images.map((image) => ({
    id: image.id,
    path: image.path,
    title: image.title ?? image.path,
  }));

  return <AlbumManager items={items} images={imageOptions} />;
}
