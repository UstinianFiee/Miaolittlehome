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

  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const [{ items, total }, counts] = await Promise.all([
    listCommentsForAdmin({ status, page }),
    countCommentsByStatus(),
  ]);

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
    createdAt: item.createdAt.toISOString(),
    refType: item.refType,
    post: item.post ? { id: item.post.id, title: item.post.title, slug: item.post.slug } : null,
  }));

  return (
    <CommentManager
      items={listItems}
      status={status}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / COMMENT_ADMIN_PAGE_SIZE))}
      total={total}
      counts={counts}
    />
  );
}
