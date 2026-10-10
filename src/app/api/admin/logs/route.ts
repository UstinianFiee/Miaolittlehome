import { NextResponse } from "next/server";

import {
  listOperationActions,
  listOperationLogs,
  listVisitLogs,
  logStats,
} from "@/lib/logs";

/** 日志查询：type=operation 取操作日志，type=visit 取访问记录；同时返回概览统计。 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const type = url.searchParams.get("type") === "visit" ? "visit" : "operation";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const keyword = url.searchParams.get("q")?.trim() || null;
  const action = url.searchParams.get("action")?.trim() || null;

  const [stats, actions] = await Promise.all([logStats(), listOperationActions()]);

  if (type === "visit") {
    const { total, items, pageSize } = await listVisitLogs({ page, keyword });

    return NextResponse.json({
      ok: true,
      data: {
        type,
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
        stats,
        actions,
        items: items.map((item) => ({
          id: item.id,
          path: item.path,
          ipRegion: item.ipRegion,
          ua: item.ua,
          referer: item.referer,
          createdAt: item.createdAt.toISOString(),
        })),
      },
    });
  }

  const { total, items, pageSize } = await listOperationLogs({ page, keyword, action });

  return NextResponse.json({
    ok: true,
    data: {
      type,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      stats,
      actions,
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        target: item.target,
        detail: item.detail,
        createdAt: item.createdAt.toISOString(),
      })),
    },
  });
}
