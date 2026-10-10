import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { deleteMedia, updateMedia } from "@/lib/media";
import { revalidateAlbums } from "@/lib/revalidate";
import { errorResponse, optionalInt, optionalString } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的媒体 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const result = await updateMedia(id, {
      title: optionalString(body.title, "标题", 200),
      albumId: optionalInt(body.albumId, "相册"),
    });

    if (!result) {
      return NextResponse.json({ ok: false, error: "媒体不存在" }, { status: 404 });
    }

    // 图片可能在相册间移动，两侧都要刷新
    revalidateAlbums([result.previousAlbumId, result.updated.albumId]);

    return NextResponse.json({ ok: true, data: result.updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的媒体 id" }, { status: 400 });
  }

  const deleted = await deleteMedia(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "媒体不存在" }, { status: 404 });
  }

  await logOperation({ action: "media_delete", target: deleted.path, detail: deleted.title });
  revalidateAlbums([deleted.albumId]);

  return NextResponse.json({ ok: true, data: { id } });
}
