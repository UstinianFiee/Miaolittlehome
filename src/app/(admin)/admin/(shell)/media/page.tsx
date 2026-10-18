import type { Metadata } from "next";

import { MediaManager, type MediaItem } from "@/components/admin/media-manager";
import { listAlbums } from "@/lib/albums";
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

  /*
   * 一次把媒体元数据读出来，交给客户端做类型/相册/关键词筛选和分页。
   * 之前每次点筛选都用 router.push 触发整页 RSC + 重新挂载 200 张卡片，
   * 媒体一多就会明显卡住；现在切换筛选不再走服务端。
   */
  const [items, albums] = await Promise.all([listMedia({ limit: 500 }), listAlbums()]);

  const listItems: MediaItem[] = items.map((item) => ({
    id: item.id,
    type: item.type,
    path: item.path,
    thumb: item.thumb,
    title: item.title,
    // BigInt → string，避免序列化问题
    size: item.size.toString(),
    createdAt: item.createdAt.toISOString(),
    albumId: item.albumId,
    albumName: item.album?.name ?? null,
  }));

  return (
    <MediaManager
      items={listItems}
      type={type ?? "all"}
      initialAlbum={albumId === undefined || albumId === null ? "all" : String(albumId)}
      albums={albums.map((album) => ({ id: album.id, name: album.name }))}
    />
  );
}
