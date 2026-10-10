import type { Metadata } from "next";

import { MediaManager, type MediaItem } from "@/components/admin/media-manager";
import { listAlbums } from "@/lib/albums";
import { formatDual } from "@/lib/datetime";
import { catalogs } from "@/lib/messages";
import { listMedia, type MediaKind } from "@/lib/media";

export const metadata: Metadata = {
  title: catalogs.zh.media.title,
};

type SearchParams = Promise<{ type?: string; album?: string }>;

const KINDS: MediaKind[] = ["image", "audio", "video"];

export default async function AdminMediaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const typeParam = params.type;
  const type = KINDS.includes(typeParam as MediaKind) ? (typeParam as MediaKind) : null;
  const albumId = params.album === undefined ? undefined : Number(params.album) || null;

  const [items, albums] = await Promise.all([listMedia({ type, albumId }), listAlbums()]);

  const listItems: MediaItem[] = items.map((item) => ({
    id: item.id,
    type: item.type,
    path: item.path,
    thumb: item.thumb,
    title: item.title,
    // BigInt → string，避免序列化问题
    size: item.size.toString(),
    createdAtLabel: formatDual(item.createdAt),
    albumId: item.albumId,
    albumName: item.album?.name ?? null,
  }));

  return (
    <MediaManager
      items={listItems}
      type={type ?? "all"}
      albums={albums.map((album) => ({ id: album.id, name: album.name }))}
    />
  );
}
