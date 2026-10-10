import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateVideos } from "@/lib/revalidate";
import { errorResponse, optionalString, requireString } from "@/lib/validation";
import { deleteVideo, updateVideo, validateVideoSource } from "@/lib/videos";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的视频 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const sourceType = body.sourceType === "iframe" ? "iframe" : "local";
    const srcUrl = requireString(body.srcUrl, "视频地址", { max: 1000 });

    const source = validateVideoSource(sourceType, srcUrl);
    if (!source.ok) {
      return NextResponse.json({ ok: false, error: source.message }, { status: 400 });
    }

    const updated = await updateVideo(id, {
      title: requireString(body.title, "标题", { max: 200 }),
      titleEn: optionalString(body.titleEn, "英文标题", 200),
      cover: optionalString(body.cover, "封面", 500),
      sourceType,
      srcUrl,
      description: optionalString(body.description, "描述", 2000),
      published: body.published === true,
      pinned: body.pinned === true,
      sort: Number(body.sort) || 0,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "视频不存在" }, { status: 404 });
    }

    revalidateVideos();
    await logOperation({ action: "video_update", target: updated.title });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的视频 id" }, { status: 400 });
  }

  const deleted = await deleteVideo(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "视频不存在" }, { status: 404 });
  }

  revalidateVideos();
  await logOperation({ action: "video_delete", target: deleted.title });

  return NextResponse.json({ ok: true, data: { id } });
}
