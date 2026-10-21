import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { clientIpFromHeaders } from "@/lib/ip-region";
import { getPublishedPostViews, incrementPostViews } from "@/lib/query";

type RouteParams = { params: Promise<{ slug: string }> };

/** 浏览器端 24h 标记只是「少发请求」；服务端必须自己去重，否则可以被随意刷量。 */
const VIEW_DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
/** 内存表上限，防止被大量不同 IP/slug 撑爆 */
const VIEW_DEDUPE_MAX_ENTRIES = 20_000;

const lastViewAt = new Map<string, number>();

/**
 * 是否应该计一次浏览。
 *
 * key = 来源 IP 哈希 + slug。这里不依赖 IP_HASH_SALT（浏览量只是统计，
 * 不该因为生产环境漏配盐把接口打成 500），用固定前缀做进程内去重即可。
 */
function shouldCountView(headers: Headers, slug: string): boolean {
  const now = Date.now();

  for (const [key, at] of lastViewAt) {
    if (now - at >= VIEW_DEDUPE_TTL_MS) {
      lastViewAt.delete(key);
    }
  }
  if (lastViewAt.size > VIEW_DEDUPE_MAX_ENTRIES) {
    // Map 保持插入顺序：超量时从最早的开始丢
    const excess = lastViewAt.size - VIEW_DEDUPE_MAX_ENTRIES;
    let dropped = 0;
    for (const key of lastViewAt.keys()) {
      lastViewAt.delete(key);
      dropped += 1;
      if (dropped >= excess) {
        break;
      }
    }
  }

  const ip = clientIpFromHeaders(headers) ?? "unknown";
  const ipHash = createHash("sha256").update(`view-counter:${ip}`).digest("hex").slice(0, 16);
  const key = `${ipHash}:${slug}`;

  const last = lastViewAt.get(key);
  if (last !== undefined && now - last < VIEW_DEDUPE_TTL_MS) {
    return false;
  }

  lastViewAt.set(key, now);
  return true;
}

/** 读取当前浏览量。文章页是静态缓存的，客户端需要拉取最新值。 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const views = await getPublishedPostViews(slug);
  if (views === null) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { views } });
}

/**
 * 浏览量 +1。
 *
 * 服务端按「IP + slug」24h 去重（进程内存态），客户端 localStorage 标记只用来
 * 减少请求数，不能作为防刷依据。
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;

  if (!shouldCountView(request.headers, slug)) {
    // 窗口期内已经计过：只读当前值，不再写库
    const views = await getPublishedPostViews(slug);
    if (views === null) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { views } });
  }

  const views = await incrementPostViews(slug);
  if (views === null) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { views } });
}
