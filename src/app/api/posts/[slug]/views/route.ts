import { NextResponse } from "next/server";

import { getPublishedPostViews, incrementPostViews } from "@/lib/query";

type RouteParams = { params: Promise<{ slug: string }> };

/** 读取当前浏览量。文章页是静态缓存的，客户端需要拉取最新值。 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const views = await getPublishedPostViews(slug);
  if (views === null) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { views } });
}

/** 浏览量 +1。防刷由客户端 24h 标记控制（见 ViewCounter）。 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const views = await incrementPostViews(slug);
  if (views === null) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { views } });
}
