import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateVideos } from "@/lib/revalidate";
import { errorResponse, optionalString, requireString } from "@/lib/validation";
import { createVideo, listVideosForAdmin, validateVideoSource } from "@/lib/videos";

export async function GET() {
  const items = await listVideosForAdmin();
  return NextResponse.json({ ok: true, data: { items } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const sourceType = body.sourceType === "iframe" ? "iframe" : "local";
    const srcUrl = requireString(body.srcUrl, "视频地址", { max: 1000 });

    const source = validateVideoSource(sourceType, srcUrl);
    if (!source.ok) {
      return NextResponse.json({ ok: false, error: source.message }, { status: 400 });
    }

    const created = await createVideo({
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

    revalidateVideos();
    await logOperation({ action: "video_create", target: created.title });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
