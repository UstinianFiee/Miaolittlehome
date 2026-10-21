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
  const requestedPage = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const keyword = url.searchParams.get("q")?.trim() || null;
  const action = url.searchParams.get("action")?.trim() || null;

  const [stats, actions] = await Promise.all([logStats(), listOperationActions()]);

  if (type === "visit") {
    const firstPage = await listVisitLogs({ page: requestedPage, keyword });
    // 页码越界时夹到最后一页，避免前端停在“第 99 页/共 1 页”的空列表
    const totalPages = Math.max(1, Math.ceil(firstPage.total / firstPage.pageSize));
    const page = Math.min(requestedPage, totalPages);
    const { total, items, pageSize } =
      page === requestedPage
        ? firstPage
        : await listVisitLogs({ page, keyword });

    return NextResponse.json({
      ok: true,
      data: {
        type,
        total,
        page,
        pageSize,
        pageCount: totalPages,
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

  const firstPage = await listOperationLogs({ page: requestedPage, keyword, action });
  const totalPages = Math.max(1, Math.ceil(firstPage.total / firstPage.pageSize));
  const page = Math.min(requestedPage, totalPages);
  const { total, items, pageSize } =
    page === requestedPage
      ? firstPage
      : await listOperationLogs({ page, keyword, action });

  return NextResponse.json({
    ok: true,
    data: {
      type,
      total,
      page,
      pageSize,
      pageCount: totalPages,
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
