import { NextResponse } from "next/server";

import {
  COMMENT_ADMIN_PAGE_SIZE,
  countCommentsByStatus,
  listCommentsForAdmin,
  type AdminCommentStatus,
} from "@/lib/comments";

const STATUSES: AdminCommentStatus[] = ["pending", "approved", "all"];

export async function GET(request: Request) {
  const url = new URL(request.url);

  const statusParam = url.searchParams.get("status");
  const status: AdminCommentStatus = STATUSES.includes(statusParam as AdminCommentStatus)
    ? (statusParam as AdminCommentStatus)
    : "pending";

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number(url.searchParams.get("pageSize") ?? COMMENT_ADMIN_PAGE_SIZE) || COMMENT_ADMIN_PAGE_SIZE
    )
  );

  const [{ total, items }, counts] = await Promise.all([
    listCommentsForAdmin({ status, page, pageSize }),
    countCommentsByStatus(),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      items: items.map((item) => ({
        id: item.id,
        author: item.author,
        email: item.email,
        content: item.content,
        ua: item.ua,
        browser: item.browser,
        os: item.os,
        ipRegion: item.ipRegion,
        isAdmin: item.isAdmin,
        approved: item.approved,
        parentId: item.parentId,
        createdAt: item.createdAt.toISOString(),
        refType: item.refType,
        refId: item.refId,
        post: item.post,
      })),
      total,
      page,
      pageSize,
      counts,
    },
  });
}
