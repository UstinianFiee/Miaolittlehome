import type { Metadata } from "next";

import { CommentManager, type AdminCommentItem } from "@/components/admin/comment-manager";
import {
  COMMENT_ADMIN_PAGE_SIZE,
  countCommentsByStatus,
  listCommentsForAdmin,
  type AdminCommentStatus,
} from "@/lib/comments";
import { catalogs } from "@/lib/messages";

export const metadata: Metadata = {
  title: catalogs.zh.comments.adminTitle,
};

type SearchParams = Promise<{ status?: string; page?: string }>;

const STATUSES: AdminCommentStatus[] = ["pending", "approved", "all"];

export default async function AdminCommentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const statusParam = params.status;
  const status: AdminCommentStatus = STATUSES.includes(statusParam as AdminCommentStatus)
    ? (statusParam as AdminCommentStatus)
    : "pending";

  const requestedPage = Math.max(1, Number(params.page ?? "1") || 1);

  const [firstPage, counts] = await Promise.all([
    listCommentsForAdmin({ status, page: requestedPage }),
    countCommentsByStatus(),
  ]);

  // 审核掉最后一页的评论、或手改 URL 后，把页码夹回有效范围，避免停在空列表
  const totalPages = Math.max(1, Math.ceil(firstPage.total / COMMENT_ADMIN_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const { items, total } =
    page === requestedPage
      ? firstPage
      : await listCommentsForAdmin({ status, page });

  const listItems: AdminCommentItem[] = items.map((item) => ({
    id: item.id,
    author: item.author,
    email: item.email,
    content: item.content,
    ua: item.ua,
    browser: item.browser,
    os: item.os,
    ipRegion: item.ipRegion,
    approved: item.approved,
    parentId: item.parentId,
    parentApproved: item.parentApproved,
    replyCount: item.replyCount,
    createdAt: item.createdAt.toISOString(),
    refType: item.refType,
    post: item.post ? { id: item.post.id, title: item.post.title, slug: item.post.slug } : null,
  }));

  return (
    <CommentManager
      items={listItems}
      status={status}
      page={page}
      totalPages={totalPages}
      total={total}
      counts={counts}
    />
  );
}
