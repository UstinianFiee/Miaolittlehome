import { NextResponse } from "next/server";

import { listMedia, type MediaKind } from "@/lib/media";

const KINDS: MediaKind[] = ["image", "audio", "video"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");
  const type = KINDS.includes(typeParam as MediaKind) ? (typeParam as MediaKind) : null;

  const albumParam = url.searchParams.get("album");
  const albumId = albumParam === null ? undefined : Number(albumParam) || null;

  const items = await listMedia({ type, albumId });

  return NextResponse.json({
    ok: true,
    data: {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        path: item.path,
        thumb: item.thumb,
        title: item.title,
        // BigInt 不能直接 JSON 序列化
        size: item.size.toString(),
        createdAt: item.createdAt.toISOString(),
        albumId: item.albumId,
        albumName: item.album?.name ?? null,
      })),
    },
  });
}
