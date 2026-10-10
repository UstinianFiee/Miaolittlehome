import { NextResponse } from "next/server";

import { deleteAlbum, updateAlbum } from "@/lib/albums";
import { logOperation } from "@/lib/logs";
import { revalidateAlbums } from "@/lib/revalidate";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的相册 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const updated = await updateAlbum(id, {
      name: requireString(body.name, "相册名", { max: 50 }),
      nameEn: optionalString(body.nameEn, "英文名", 50),
      description: optionalString(body.description, "描述", 500),
      cover: optionalString(body.cover, "封面", 500),
      sort: Number(body.sort) || 0,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "相册不存在" }, { status: 404 });
    }

    await logOperation({ action: "album_update", target: updated.name });
    revalidateAlbums([id]);

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的相册 id" }, { status: 400 });
  }

  const deleted = await deleteAlbum(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "相册不存在" }, { status: 404 });
  }

  await logOperation({
    action: "album_delete",
    target: deleted.name,
    detail: `${deleted._count.media} 张图片已移出相册`,
  });
  revalidateAlbums([id]);

  return NextResponse.json({ ok: true, data: { id } });
}
